-- KLASSE | Reativar a MESMA matrícula após desistência, sem apagar a trilha.
-- Depende de 20271119090000_matricula_desistencia_operacional_v1.sql.
BEGIN;
SET LOCAL lock_timeout = '5s';

CREATE TABLE IF NOT EXISTS public.matricula_desistencia_reativacoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  escola_id uuid NOT NULL REFERENCES public.escolas(id),
  matricula_id uuid NOT NULL REFERENCES public.matriculas(id),
  aluno_id uuid NOT NULL REFERENCES public.alunos(id),
  turma_id uuid NOT NULL REFERENCES public.turmas(id),
  ano_letivo integer NOT NULL,
  realizado_por uuid NOT NULL,
  motivo_reativacao text NOT NULL CHECK (length(btrim(motivo_reativacao)) BETWEEN 10 AND 500),
  motivo_desistencia_anterior text,
  data_desistencia_anterior timestamptz,
  realizado_em timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_desistencia_reativacoes_matricula
  ON public.matricula_desistencia_reativacoes(escola_id,matricula_id,realizado_em DESC);
ALTER TABLE public.matricula_desistencia_reativacoes ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.matricula_desistencia_reativacoes FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.matricula_desistencia_reativacoes TO authenticated;
DROP POLICY IF EXISTS reativacoes_desistencia_select_staff ON public.matricula_desistencia_reativacoes;
CREATE POLICY reativacoes_desistencia_select_staff ON public.matricula_desistencia_reativacoes
  FOR SELECT TO authenticated
  USING (
    public.user_has_role_in_school(escola_id,
      ARRAY['diretor','admin','admin_escola','staff_admin','admin_secretaria',
            'secretaria','secretaria_financeiro','admin_financeiro']::text[])
    AND cc_security.allowed_turma(escola_id,turma_id,ano_letivo)
  );

CREATE OR REPLACE FUNCTION public.reativar_matricula_desistente(
  p_matricula_id uuid, p_motivo text
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'pg_catalog','public'
AS $reativar$
DECLARE
  v_user uuid := (select auth.uid());
  v_m public.matriculas%ROWTYPE;
  v_t public.turmas%ROWTYPE;
  v_reason text := btrim(coalesce(p_motivo,''));
  v_occupied integer;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'REATIVACAO_NAO_AUTENTICADA' USING ERRCODE='42501';
  END IF;
  IF p_matricula_id IS NULL OR length(v_reason) NOT BETWEEN 10 AND 500 THEN
    RAISE EXCEPTION 'REATIVACAO_MOTIVO_OBRIGATORIO' USING ERRCODE='22023';
  END IF;

  -- Serialização por matrícula e por turma; impede dois restauros simultâneos
  -- de ocuparem a última vaga disponível.
  SELECT * INTO v_m FROM public.matriculas WHERE id=p_matricula_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'REATIVACAO_MATRICULA_INEXISTENTE' USING ERRCODE='22023';
  END IF;
  IF NOT public.user_has_role_in_school(v_m.escola_id,
      ARRAY['diretor','admin','admin_escola','staff_admin','admin_secretaria',
            'secretaria','secretaria_financeiro','admin_financeiro']::text[])
     OR NOT cc_security.allowed_turma(v_m.escola_id,v_m.turma_id,v_m.ano_letivo) THEN
    RAISE EXCEPTION 'REATIVACAO_SEM_PERMISSAO' USING ERRCODE='42501';
  END IF;
  IF v_m.status='ativo' AND v_m.ativo IS TRUE THEN
    RETURN jsonb_build_object('ok',true,'idempotent',true,'matricula_id',v_m.id,'status','ativo');
  END IF;
  IF v_m.status <> 'desistente' OR v_m.ativo IS DISTINCT FROM FALSE
     OR v_m.turma_id IS NULL OR v_m.session_id IS NULL THEN
    RAISE EXCEPTION 'REATIVACAO_EXIGE_DESISTENCIA' USING ERRCODE='23514';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.anos_letivos al
     WHERE al.id=v_m.session_id AND al.escola_id=v_m.escola_id
       AND al.ano=v_m.ano_letivo AND al.ativo IS TRUE
  ) THEN
    RAISE EXCEPTION 'REATIVACAO_APENAS_ANO_ATIVO' USING ERRCODE='23514';
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.historico_anos ha
    WHERE ha.escola_id=v_m.escola_id AND ha.matricula_id=v_m.id
      AND ha.snapshot_status='fechado'
  ) THEN
    RAISE EXCEPTION 'REATIVACAO_HISTORICO_FECHADO' USING ERRCODE='23514';
  END IF;

  SELECT * INTO v_t FROM public.turmas
    WHERE id=v_m.turma_id AND escola_id=v_m.escola_id
      AND session_id=v_m.session_id AND ano_letivo=v_m.ano_letivo
    FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'REATIVACAO_TURMA_INCOMPATIVEL' USING ERRCODE='23514';
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.matriculas other
    WHERE other.escola_id=v_m.escola_id AND other.aluno_id=v_m.aluno_id
      AND other.session_id=v_m.session_id AND other.id<>v_m.id
      AND other.status='ativo' AND other.ativo IS TRUE
  ) THEN
    RAISE EXCEPTION 'REATIVACAO_MATRICULA_DUPLICADA' USING ERRCODE='23505';
  END IF;

  IF v_t.capacidade_maxima IS NOT NULL AND v_t.capacidade_maxima>0 THEN
    SELECT count(*)::integer INTO v_occupied FROM public.matriculas other
      WHERE other.escola_id=v_m.escola_id AND other.turma_id=v_m.turma_id
        AND other.session_id=v_m.session_id AND other.status='ativo' AND other.ativo IS TRUE;
    IF v_occupied >= v_t.capacidade_maxima THEN
      RAISE EXCEPTION 'REATIVACAO_SEM_VAGAS' USING ERRCODE='23514';
    END IF;
  END IF;

  -- Preservar a razão original num registo imutável; matrícula volta a ser
  -- operacional e deixa de possuir campos de fecho preenchidos.
  INSERT INTO public.matricula_desistencia_reativacoes
    (escola_id,matricula_id,aluno_id,turma_id,ano_letivo,realizado_por,
     motivo_reativacao,motivo_desistencia_anterior,data_desistencia_anterior)
  VALUES (v_m.escola_id,v_m.id,v_m.aluno_id,v_m.turma_id,v_m.ano_letivo,v_user,
          v_reason,v_m.motivo_fecho,v_m.data_fecho);

  UPDATE public.matriculas SET
    status='ativo', ativo=true, motivo_fecho=NULL, data_fecho=NULL,
    status_fecho_origem=NULL, updated_by=v_user
  WHERE id=v_m.id AND escola_id=v_m.escola_id
    AND status='desistente' AND ativo=false;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'REATIVACAO_CONFLITO_CONCORRENTE' USING ERRCODE='23514';
  END IF;
  -- t_matriculas_status_audit acompanha desistente -> ativo; o motivo
  -- de reativação fica na tabela privada acima. Não alterar dados financeiros.
  RETURN jsonb_build_object('ok',true,'idempotent',false,
    'matricula_id',v_m.id,'status','ativo','escola_id',v_m.escola_id);
END;
$reativar$;
REVOKE ALL ON FUNCTION public.reativar_matricula_desistente(uuid,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.reativar_matricula_desistente(uuid,text) TO authenticated;

-- Endurecimento da RPC original: respeitar isolamento por polo também ao
-- marcar desistente. Não reescrever migração já versionada/aplicável.
CREATE OR REPLACE FUNCTION public.registar_desistencia_matricula(
  p_matricula_id uuid, p_motivo text
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
            'secretaria','secretaria_financeiro','admin_financeiro']::text[])
    OR NOT cc_security.allowed_turma(v_m.escola_id,v_m.turma_id,v_m.ano_letivo) THEN
    RAISE EXCEPTION 'DESISTENCIA_SEM_PERMISSAO' USING ERRCODE='42501';
  END IF;
  IF v_m.status='desistente' AND v_m.ativo IS FALSE THEN
    RETURN jsonb_build_object('ok',true,'idempotent',true,
      'matricula_id',v_m.id,'status','desistente');
  END IF;
  IF v_m.status<>'ativo' OR v_m.ativo IS DISTINCT FROM TRUE
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
  RETURN jsonb_build_object('ok',true,'idempotent',false,
    'matricula_id',v_m.id,'status','desistente','escola_id',v_m.escola_id);
END;
$desistencia$;
REVOKE ALL ON FUNCTION public.registar_desistencia_matricula(uuid,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.registar_desistencia_matricula(uuid,text) TO authenticated;

COMMIT;
