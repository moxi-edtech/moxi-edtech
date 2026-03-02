BEGIN;

ALTER TABLE public.matriculas
  ADD COLUMN IF NOT EXISTS motivo_fecho text,
  ADD COLUMN IF NOT EXISTS data_fecho timestamptz,
  ADD COLUMN IF NOT EXISTS status_fecho_origem text DEFAULT 'manual',
  ADD COLUMN IF NOT EXISTS origem_transicao_matricula_id uuid;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'matriculas_status_fecho_origem_check'
      AND conrelid = 'public.matriculas'::regclass
  ) THEN
    ALTER TABLE public.matriculas
      ADD CONSTRAINT matriculas_status_fecho_origem_check
      CHECK (status_fecho_origem IN ('gradeengine', 'override_admin', 'manual'));
  END IF;
END;
$$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'matriculas_status_check'
      AND conrelid = 'public.matriculas'::regclass
  ) THEN
    ALTER TABLE public.matriculas DROP CONSTRAINT matriculas_status_check;
  END IF;
END;
$$;

ALTER TABLE public.matriculas
  ADD CONSTRAINT matriculas_status_check
  CHECK (
    status = ANY (ARRAY[
      'pendente'::text,
      'ativa'::text,
      'ativo'::text,
      'inativo'::text,
      'concluido'::text,
      'reprovado'::text,
      'transferido'::text,
      'anulado'::text,
      'reprovado_por_faltas'::text,
      'trancado'::text,
      'desistente'::text,
      'indefinido'::text,
      'rascunho'::text
    ])
  );

ALTER TABLE public.matriculas
  ADD CONSTRAINT matriculas_origem_transicao_fk
  FOREIGN KEY (origem_transicao_matricula_id)
  REFERENCES public.matriculas(id)
  ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_matriculas_origem_transicao
  ON public.matriculas (origem_transicao_matricula_id)
  WHERE origem_transicao_matricula_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.canonicalize_matricula_status_text(input text)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE PARALLEL SAFE
SET search_path TO 'public'
AS $$
DECLARE v text := lower(trim(coalesce(input, '')));
BEGIN
  IF v = '' THEN RETURN 'indefinido'; END IF;

  IF v IN ('ativa','ativo','active','em_andamento','matriculado') THEN RETURN 'ativa'; END IF;
  IF v IN ('concluida','concluido','graduado','aprovado') THEN RETURN 'concluido'; END IF;
  IF v IN ('reprovada','reprovado') THEN RETURN 'reprovado'; END IF;
  IF v IN ('reprovado_por_faltas') THEN RETURN 'reprovado_por_faltas'; END IF;
  IF v IN ('transferido','transferida') THEN RETURN 'transferido'; END IF;
  IF v IN ('anulado','anulada') THEN RETURN 'anulado'; END IF;
  IF v IN ('pendente','aguardando') THEN RETURN 'pendente'; END IF;
  IF v IN ('trancado','suspenso','desistente','inativo') THEN RETURN 'inativo'; END IF;
  RETURN 'indefinido';
END
$$;

CREATE TABLE IF NOT EXISTS public.matriculas_status_audit (
  id bigserial PRIMARY KEY,
  matricula_id uuid NOT NULL REFERENCES public.matriculas(id) ON DELETE CASCADE,
  status_anterior text NOT NULL,
  status_novo text NOT NULL,
  alterado_por uuid NULL,
  origem text NOT NULL,
  motivo text NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE OR REPLACE FUNCTION public.trg_matriculas_status_audit()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    INSERT INTO public.matriculas_status_audit (
      matricula_id,
      status_anterior,
      status_novo,
      alterado_por,
      origem,
      motivo
    ) VALUES (
      NEW.id,
      OLD.status,
      NEW.status,
      nullif(current_setting('request.jwt.claim.sub', true), '')::uuid,
      COALESCE(NEW.status_fecho_origem, 'sql_direct'),
      NEW.motivo_fecho
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS t_matriculas_status_audit ON public.matriculas;
CREATE TRIGGER t_matriculas_status_audit
BEFORE UPDATE OF status ON public.matriculas
FOR EACH ROW
EXECUTE FUNCTION public.trg_matriculas_status_audit();

CREATE OR REPLACE FUNCTION public.gradeengine_calcular_situacao(
  p_matricula_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_escola_id uuid := public.current_tenant_escola_id();
  v_matricula record;
  v_missing_count bigint := 0;
  v_has_reprovacao boolean := false;
BEGIN
  IF v_escola_id IS NULL THEN
    RAISE EXCEPTION 'AUTH: escola_id inválido.';
  END IF;

  IF NOT public.user_has_role_in_school(v_escola_id, ARRAY['secretaria', 'admin', 'admin_escola', 'staff_admin']) THEN
    RAISE EXCEPTION 'AUTH: Permissão negada.';
  END IF;

  SELECT id, escola_id
  INTO v_matricula
  FROM public.matriculas
  WHERE id = p_matricula_id
    AND escola_id = v_escola_id;

  IF v_matricula.id IS NULL THEN
    RAISE EXCEPTION 'DATA: Matrícula não encontrada.';
  END IF;

  SELECT COALESCE(SUM(missing_count), 0)
  INTO v_missing_count
  FROM public.vw_boletim_por_matricula
  WHERE matricula_id = p_matricula_id;

  IF v_missing_count > 0 THEN
    RETURN jsonb_build_object(
      'situacao_final', 'incompleto',
      'motivos', jsonb_build_array('Existem disciplinas sem notas lançadas ou pautas abertas.')
    );
  END IF;

  IF EXISTS (
    SELECT 1
    FROM (
      SELECT disciplina_id,
             COUNT(*) FILTER (WHERE nota_final IS NOT NULL) AS trimestres_com_nota,
             AVG(nota_final) FILTER (WHERE nota_final IS NOT NULL) AS media_final
      FROM public.vw_boletim_por_matricula
      WHERE matricula_id = p_matricula_id
      GROUP BY disciplina_id
    ) s
    WHERE s.trimestres_com_nota < 3 OR s.media_final IS NULL
  ) THEN
    RETURN jsonb_build_object(
      'situacao_final', 'incompleto',
      'motivos', jsonb_build_array('Não existem notas fechadas para todos os trimestres.')
    );
  END IF;

  SELECT EXISTS (
    SELECT 1
    FROM (
      SELECT disciplina_id,
             AVG(nota_final) FILTER (WHERE nota_final IS NOT NULL) AS media_final
      FROM public.vw_boletim_por_matricula
      WHERE matricula_id = p_matricula_id
      GROUP BY disciplina_id
    ) s
    WHERE s.media_final < 10
  )
  INTO v_has_reprovacao;

  RETURN jsonb_build_object(
    'situacao_final', CASE WHEN v_has_reprovacao THEN 'reprovado' ELSE 'aprovado' END,
    'motivos', jsonb_build_array()
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.finalizar_matricula_blindada(
  p_escola_id uuid,
  p_matricula_id uuid,
  p_motivo text DEFAULT NULL,
  p_is_override_manual boolean DEFAULT false,
  p_status_override text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_escola_id uuid := public.current_tenant_escola_id();
  v_actor_id uuid := auth.uid();
  v_matricula record;
  v_has_role boolean := false;
  v_is_admin boolean := false;
  v_status_calculado text;
  v_origem text;
  v_grade jsonb;
BEGIN
  IF v_escola_id IS NULL OR p_escola_id IS DISTINCT FROM v_escola_id THEN
    RAISE EXCEPTION 'AUTH: escola_id inválido.';
  END IF;

  SELECT public.user_has_role_in_school(v_escola_id, ARRAY['secretaria', 'admin', 'admin_escola', 'staff_admin']) INTO v_has_role;
  IF NOT v_has_role THEN
    RAISE EXCEPTION 'AUTH: Permissão negada.';
  END IF;

  SELECT * INTO v_matricula
  FROM public.matriculas
  WHERE id = p_matricula_id
    AND escola_id = v_escola_id
  FOR UPDATE;

  IF v_matricula.id IS NULL THEN
    RAISE EXCEPTION 'DATA: Matrícula não encontrada.';
  END IF;

  IF public.canonicalize_matricula_status_text(v_matricula.status) NOT IN ('ativa', 'pendente') THEN
    RAISE EXCEPTION 'LOGIC: Esta matrícula já foi finalizada ou não está em andamento.';
  END IF;

  IF p_is_override_manual THEN
    SELECT public.user_has_role_in_school(v_escola_id, ARRAY['admin', 'admin_escola', 'staff_admin']) INTO v_is_admin;
    IF NOT v_is_admin THEN
      RAISE EXCEPTION 'AUTH: Apenas admin/direção pode aplicar override manual.';
    END IF;

    IF p_status_override IS NULL THEN
      RAISE EXCEPTION 'LOGIC: status_override é obrigatório quando override manual está activo.';
    END IF;

    v_status_calculado := public.canonicalize_matricula_status_text(p_status_override);
    IF v_status_calculado NOT IN ('transferido', 'anulado', 'reprovado_por_faltas') THEN
      RAISE EXCEPTION 'LOGIC: Override inválido. Use transferido, anulado ou reprovado_por_faltas.';
    END IF;
    v_origem := 'override_admin';
  ELSE
    v_grade := public.gradeengine_calcular_situacao(p_matricula_id);

    IF COALESCE(v_grade->>'situacao_final', '') = 'incompleto' THEN
      RETURN jsonb_build_object(
        'ok', false,
        'status', 'incompleto',
        'message', 'Não é possível finalizar. Existem disciplinas sem notas lançadas ou pautas abertas.',
        'motivos', COALESCE(v_grade->'motivos', '[]'::jsonb)
      );
    END IF;

    IF v_grade->>'situacao_final' = 'aprovado' THEN
      v_status_calculado := 'concluido';
    ELSIF v_grade->>'situacao_final' = 'reprovado' THEN
      v_status_calculado := 'reprovado';
    ELSE
      RAISE EXCEPTION 'LOGIC: Situação final desconhecida retornada pelo GradeEngine.';
    END IF;

    v_origem := 'gradeengine';
  END IF;

  UPDATE public.matriculas
  SET status = v_status_calculado,
      motivo_fecho = NULLIF(trim(p_motivo), ''),
      data_fecho = now(),
      status_fecho_origem = v_origem,
      updated_at = now()
  WHERE id = p_matricula_id
    AND escola_id = v_escola_id
    AND public.canonicalize_matricula_status_text(status) IN ('ativa', 'pendente');

  IF NOT FOUND THEN
    RAISE EXCEPTION 'LOGIC: Conflito de concorrência ao finalizar matrícula.';
  END IF;

  INSERT INTO public.audit_logs (escola_id, actor_id, action, entity, entity_id, portal, details)
  VALUES (
    v_escola_id,
    v_actor_id,
    'MATRICULA_FINALIZADA_BLINDADA',
    'matriculas',
    p_matricula_id::text,
    'secretaria',
    jsonb_build_object(
      'status', v_status_calculado,
      'origem', v_origem,
      'motivo', NULLIF(trim(p_motivo), '')
    )
  );

  IF v_status_calculado IN ('concluido', 'reprovado') THEN
    PERFORM public.gerar_historico_anual(p_matricula_id);
  END IF;

  RETURN jsonb_build_object(
    'ok', true,
    'status', v_status_calculado,
    'status_fecho_origem', v_origem
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.fn_transitar_alunos(
  p_escola_id uuid,
  p_turma_origem_id uuid,
  p_turma_destino_id uuid,
  p_ano_letivo_origem int,
  p_ano_letivo_dest int,
  p_aluno_ids uuid[]
)
RETURNS TABLE (
  aluno_id uuid,
  sucesso boolean,
  erro text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_escola_id uuid := public.current_tenant_escola_id();
  v_aluno_id uuid;
  v_matricula_origem record;
  v_turma_destino record;
  v_tem_curriculo_publicado boolean;
  v_total_em_atraso numeric(14,2);
BEGIN
  IF v_escola_id IS NULL OR p_escola_id IS DISTINCT FROM v_escola_id THEN
    RAISE EXCEPTION 'AUTH: escola_id inválido.';
  END IF;

  IF NOT public.user_has_role_in_school(v_escola_id, ARRAY['secretaria', 'admin', 'admin_escola', 'staff_admin']) THEN
    RAISE EXCEPTION 'AUTH: Permissão negada.';
  END IF;

  SELECT t.id, t.curso_id, t.classe_id, t.ano_letivo
  INTO v_turma_destino
  FROM public.turmas t
  WHERE t.id = p_turma_destino_id
    AND t.escola_id = p_escola_id;

  IF v_turma_destino.id IS NULL THEN
    RAISE EXCEPTION 'DATA: Turma de destino não encontrada.';
  END IF;

  IF v_turma_destino.ano_letivo <> p_ano_letivo_dest THEN
    RAISE EXCEPTION 'LOGIC: Turma de destino fora do ano letivo de destino.';
  END IF;

  SELECT EXISTS (
    SELECT 1
    FROM public.anos_letivos al
    JOIN public.curso_curriculos cc ON cc.ano_letivo_id = al.id
    WHERE al.escola_id = p_escola_id
      AND al.ano = p_ano_letivo_dest
      AND cc.escola_id = p_escola_id
      AND cc.curso_id = v_turma_destino.curso_id
      AND (cc.classe_id IS NULL OR cc.classe_id = v_turma_destino.classe_id)
      AND cc.status = 'published'
  ) INTO v_tem_curriculo_publicado;

  IF NOT v_tem_curriculo_publicado THEN
    RAISE EXCEPTION 'LOGIC: Estrutura académica do ano destino não está pronta (currículo não publicado).';
  END IF;

  FOREACH v_aluno_id IN ARRAY p_aluno_ids LOOP
    BEGIN
      SELECT m.id, m.status, m.aluno_id
      INTO v_matricula_origem
      FROM public.matriculas m
      WHERE m.aluno_id = v_aluno_id
        AND m.turma_id = p_turma_origem_id
        AND m.ano_letivo = p_ano_letivo_origem
        AND m.escola_id = p_escola_id
      LIMIT 1;

      IF v_matricula_origem.id IS NULL THEN
        RETURN QUERY SELECT v_aluno_id, false, 'Matrícula de origem não encontrada';
        CONTINUE;
      END IF;

      IF public.canonicalize_matricula_status_text(v_matricula_origem.status) <> 'concluido' THEN
        IF public.canonicalize_matricula_status_text(v_matricula_origem.status) = 'reprovado' THEN
          RETURN QUERY SELECT v_aluno_id, false, 'Aluno reprovado na classe de origem';
        ELSE
          RETURN QUERY SELECT v_aluno_id, false, 'Notas incompletas ou matrícula não concluída';
        END IF;
        CONTINUE;
      END IF;

      SELECT COALESCE(SUM(GREATEST(COALESCE(m.valor_previsto, m.valor, 0) - COALESCE(m.valor_pago_total, 0), 0)), 0)
      INTO v_total_em_atraso
      FROM public.mensalidades m
      WHERE m.escola_id = p_escola_id
        AND m.matricula_id = v_matricula_origem.id
        AND m.status NOT IN ('pago', 'isento', 'cancelado');

      IF COALESCE(v_total_em_atraso, 0) > 0 THEN
        RETURN QUERY SELECT v_aluno_id, false, 'Dívidas em aberto na matrícula anterior';
        CONTINUE;
      END IF;

      IF EXISTS (
        SELECT 1
        FROM public.matriculas m
        WHERE m.escola_id = p_escola_id
          AND m.aluno_id = v_aluno_id
          AND m.ano_letivo = p_ano_letivo_dest
          AND m.turma_id = p_turma_destino_id
      ) THEN
        RETURN QUERY SELECT v_aluno_id, false, 'Aluno já possui matrícula na turma de destino';
        CONTINUE;
      END IF;

      INSERT INTO public.matriculas (
        escola_id,
        aluno_id,
        turma_id,
        ano_letivo,
        status,
        ativo,
        data_matricula,
        origem_transicao_matricula_id,
        created_at,
        updated_at
      )
      VALUES (
        p_escola_id,
        v_aluno_id,
        p_turma_destino_id,
        p_ano_letivo_dest,
        'pendente',
        true,
        CURRENT_DATE,
        v_matricula_origem.id,
        now(),
        now()
      );

      RETURN QUERY SELECT v_aluno_id, true, NULL::text;
    EXCEPTION
      WHEN OTHERS THEN
        RETURN QUERY SELECT v_aluno_id, false, SQLERRM;
    END;
  END LOOP;
END;
$$;

GRANT EXECUTE ON FUNCTION public.gradeengine_calcular_situacao(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.finalizar_matricula_blindada(uuid, uuid, text, boolean, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.fn_transitar_alunos(uuid, uuid, uuid, int, int, uuid[]) TO authenticated;

COMMIT;
