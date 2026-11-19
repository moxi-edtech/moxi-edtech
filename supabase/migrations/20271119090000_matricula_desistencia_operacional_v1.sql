-- KLASSE | Desistência é movimento administrativo da matrícula, não resultado académico.
-- Estado canónico já existe: matriculas.status='desistente', ativo=false.
-- A matrícula e os seus vínculos académicos/financeiros são PRESERVADOS.
BEGIN;
SET LOCAL lock_timeout = '5s';

COMMENT ON COLUMN public.matriculas.motivo_fecho IS
  'Motivo administrativo de fecho da matrícula; na desistência, explicação obrigatória e auditada. Não é nota nem decisão RAA.';
COMMENT ON COLUMN public.matriculas.data_fecho IS
  'Instante UTC do encerramento administrativo; na desistência, preenchido no registo da escola.';

CREATE TABLE IF NOT EXISTS public.matricula_desistencia_sinalizacoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  escola_id uuid NOT NULL REFERENCES public.escolas(id),
  matricula_id uuid NOT NULL REFERENCES public.matriculas(id),
  aluno_id uuid NOT NULL REFERENCES public.alunos(id),
  turma_id uuid NOT NULL REFERENCES public.turmas(id),
  criado_por uuid NOT NULL,
  motivo text NOT NULL CHECK (length(btrim(motivo)) BETWEEN 10 AND 500),
  status text NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente','confirmada','descartada')),
  criado_em timestamptz NOT NULL DEFAULT now(),
  resolvido_em timestamptz,
  resolvido_por uuid,
  CONSTRAINT sinalizacao_resolucao_consistente CHECK (
    (status='pendente' AND resolvido_em IS NULL AND resolvido_por IS NULL)
    OR (status<>'pendente' AND resolvido_em IS NOT NULL AND resolvido_por IS NOT NULL)
  )
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_sinalizacao_desistencia_pendente
  ON public.matricula_desistencia_sinalizacoes(matricula_id, criado_por)
  WHERE status='pendente';
CREATE INDEX IF NOT EXISTS idx_sinalizacoes_escola_pendentes
  ON public.matricula_desistencia_sinalizacoes(escola_id, matricula_id, criado_em DESC)
  WHERE status='pendente';
ALTER TABLE public.matricula_desistencia_sinalizacoes ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.matricula_desistencia_sinalizacoes FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.matricula_desistencia_sinalizacoes TO authenticated;

DROP POLICY IF EXISTS sinalizacoes_desistencia_select ON public.matricula_desistencia_sinalizacoes;
CREATE POLICY sinalizacoes_desistencia_select ON public.matricula_desistencia_sinalizacoes
  FOR SELECT TO authenticated
  USING (
    criado_por = (select auth.uid())
    OR public.user_has_role_in_school(escola_id,
      ARRAY['diretor','admin','admin_escola','staff_admin','admin_secretaria',
            'secretaria','secretaria_financeiro','admin_financeiro']::text[])
  );

CREATE OR REPLACE FUNCTION public.registar_desistencia_matricula(
  p_matricula_id uuid,
  p_motivo text
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'pg_catalog','public'
AS $desistencia$
DECLARE
  v_user uuid := (select auth.uid());
  v_m public.matriculas%ROWTYPE;
  v_reason text := btrim(coalesce(p_motivo,''));
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'DESISTENCIA_NAO_AUTENTICADA' USING ERRCODE='42501';
  END IF;
  IF p_matricula_id IS NULL OR length(v_reason) NOT BETWEEN 10 AND 500 THEN
    RAISE EXCEPTION 'DESISTENCIA_MOTIVO_OBRIGATORIO' USING ERRCODE='22023';
  END IF;

  SELECT * INTO v_m FROM public.matriculas WHERE id=p_matricula_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'DESISTENCIA_MATRICULA_INEXISTENTE' USING ERRCODE='22023';
  END IF;
  IF NOT public.user_has_role_in_school(v_m.escola_id,
      ARRAY['diretor','admin','admin_escola','staff_admin','admin_secretaria',
            'secretaria','secretaria_financeiro','admin_financeiro']::text[]) THEN
    RAISE EXCEPTION 'DESISTENCIA_SEM_PERMISSAO' USING ERRCODE='42501';
  END IF;

  IF v_m.status='desistente' AND v_m.ativo IS FALSE THEN
    RETURN jsonb_build_object('ok',true,'idempotent',true,
      'matricula_id',v_m.id,'status','desistente');
  END IF;
  IF v_m.status <> 'ativo' OR v_m.ativo IS DISTINCT FROM TRUE
      OR v_m.turma_id IS NULL OR v_m.session_id IS NULL THEN
    RAISE EXCEPTION 'DESISTENCIA_EXIGE_MATRICULA_ATIVA' USING ERRCODE='23514';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.anos_letivos al
     WHERE al.id=v_m.session_id AND al.escola_id=v_m.escola_id
       AND al.ano=v_m.ano_letivo AND al.ativo IS TRUE
  ) THEN
    RAISE EXCEPTION 'DESISTENCIA_APENAS_ANO_ATIVO' USING ERRCODE='23514';
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.historico_anos ha
    WHERE ha.escola_id=v_m.escola_id AND ha.matricula_id=v_m.id
      AND ha.snapshot_status='fechado'
  ) THEN
    RAISE EXCEPTION 'DESISTENCIA_HISTORICO_FECHADO' USING ERRCODE='23514';
  END IF;

  UPDATE public.matriculas SET
    status='desistente', ativo=false, motivo_fecho=v_reason,
    data_fecho=now(), status_fecho_origem='manual', updated_by=v_user
  WHERE id=v_m.id AND escola_id=v_m.escola_id AND status='ativo' AND ativo=true;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'DESISTENCIA_CONFLITO_CONCORRENTE' USING ERRCODE='23514';
  END IF;

  UPDATE public.matricula_desistencia_sinalizacoes
  SET status='confirmada', resolvido_em=now(), resolvido_por=v_user
  WHERE matricula_id=v_m.id AND escola_id=v_m.escola_id AND status='pendente';

  -- trg_matriculas_status_audit já regista estado anterior, novo, autor e motivo.
  -- Não modificar notas, frequências, histórico anual, mensalidades ou aluno.status.
  RETURN jsonb_build_object('ok',true,'idempotent',false,
    'matricula_id',v_m.id,'status','desistente','escola_id',v_m.escola_id);
END;
$desistencia$;

CREATE OR REPLACE FUNCTION public.sinalizar_desistencia_matricula(
  p_matricula_id uuid,
  p_motivo text
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'pg_catalog','public'
AS $sinalizar$
DECLARE
  v_user uuid := (select auth.uid());
  v_reason text := btrim(coalesce(p_motivo,''));
  v_m public.matriculas%ROWTYPE;
  v_professor_id uuid;
  v_id uuid;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'SINALIZACAO_NAO_AUTENTICADA' USING ERRCODE='42501';
  END IF;
  IF p_matricula_id IS NULL OR length(v_reason) NOT BETWEEN 10 AND 500 THEN
    RAISE EXCEPTION 'SINALIZACAO_MOTIVO_OBRIGATORIO' USING ERRCODE='22023';
  END IF;
  SELECT * INTO v_m FROM public.matriculas WHERE id=p_matricula_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'SINALIZACAO_MATRICULA_INEXISTENTE' USING ERRCODE='22023';
  END IF;
  SELECT p.id INTO v_professor_id FROM public.professores p
  WHERE p.profile_id=v_user AND p.escola_id=v_m.escola_id LIMIT 1;
  IF v_professor_id IS NULL
     OR v_m.status<>'ativo' OR v_m.ativo IS DISTINCT FROM TRUE
     OR v_m.turma_id IS NULL
     OR NOT EXISTS (
       SELECT 1 FROM public.anos_letivos al
       WHERE al.id=v_m.session_id AND al.escola_id=v_m.escola_id AND al.ativo IS TRUE
     )
     OR NOT (
       EXISTS (
         SELECT 1 FROM public.turma_disciplinas_professores tdp
         WHERE tdp.escola_id=v_m.escola_id AND tdp.turma_id=v_m.turma_id
           AND tdp.professor_id=v_professor_id
       ) OR EXISTS (
         SELECT 1 FROM public.turma_disciplinas td
         WHERE td.escola_id=v_m.escola_id AND td.turma_id=v_m.turma_id
           AND td.professor_id=v_professor_id
       )
     ) THEN
    RAISE EXCEPTION 'SINALIZACAO_SEM_ATRIBUICAO' USING ERRCODE='42501';
  END IF;

  INSERT INTO public.matricula_desistencia_sinalizacoes
    (escola_id,matricula_id,aluno_id,turma_id,criado_por,motivo)
  VALUES (v_m.escola_id,v_m.id,v_m.aluno_id,v_m.turma_id,v_user,v_reason)
  ON CONFLICT (matricula_id,criado_por) WHERE status='pendente' DO NOTHING
  RETURNING id INTO v_id;
  IF v_id IS NULL THEN
    SELECT id INTO v_id FROM public.matricula_desistencia_sinalizacoes
      WHERE matricula_id=v_m.id AND criado_por=v_user AND status='pendente';
  END IF;
  RETURN jsonb_build_object('ok',true,'id',v_id,'status','pendente');
END;
$sinalizar$;

CREATE OR REPLACE FUNCTION public.descartar_sinalizacao_desistencia(
  p_sinalizacao_id uuid
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'pg_catalog','public'
AS $descartar$
DECLARE
  v_user uuid := (select auth.uid());
  v_row public.matricula_desistencia_sinalizacoes%ROWTYPE;
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'NAO_AUTENTICADO' USING ERRCODE='42501'; END IF;
  SELECT * INTO v_row FROM public.matricula_desistencia_sinalizacoes
  WHERE id=p_sinalizacao_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'SINALIZACAO_INEXISTENTE' USING ERRCODE='22023'; END IF;
  IF NOT public.user_has_role_in_school(v_row.escola_id,
     ARRAY['diretor','admin','admin_escola','staff_admin','admin_secretaria',
           'secretaria','secretaria_financeiro','admin_financeiro']::text[]) THEN
    RAISE EXCEPTION 'SEM_PERMISSAO' USING ERRCODE='42501';
  END IF;
  IF v_row.status='pendente' THEN
    UPDATE public.matricula_desistencia_sinalizacoes
      SET status='descartada',resolvido_em=now(),resolvido_por=v_user
    WHERE id=p_sinalizacao_id AND status='pendente';
  END IF;
  RETURN jsonb_build_object('ok',true,'status','descartada');
END;
$descartar$;

REVOKE ALL ON FUNCTION public.registar_desistencia_matricula(uuid,text) FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION public.sinalizar_desistencia_matricula(uuid,text) FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION public.descartar_sinalizacao_desistencia(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.registar_desistencia_matricula(uuid,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.sinalizar_desistencia_matricula(uuid,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.descartar_sinalizacao_desistencia(uuid) TO authenticated;
COMMIT;
