BEGIN;

CREATE TABLE IF NOT EXISTS public.matricula_reclassificacoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  escola_id uuid NOT NULL REFERENCES public.escolas(id) ON DELETE CASCADE,
  matricula_id uuid NOT NULL REFERENCES public.matriculas(id) ON DELETE CASCADE,
  aluno_id uuid NOT NULL REFERENCES public.alunos(id) ON DELETE CASCADE,
  origem_session_id uuid NOT NULL REFERENCES public.anos_letivos(id),
  destino_session_id uuid NOT NULL REFERENCES public.anos_letivos(id),
  origem_turma_id uuid REFERENCES public.turmas(id),
  destino_turma_id uuid REFERENCES public.turmas(id),
  tipo text NOT NULL CHECK (tipo IN ('FIM_PRIMARIO', 'FIM_I_CICLO', 'PRE_ESCOLAR')),
  status text NOT NULL DEFAULT 'aguardando_destino'
    CHECK (status IN ('aguardando_destino', 'matriculado_novo_ciclo', 'concluido_arquivado', 'transferido', 'cancelado')),
  motivo text,
  resolvido_por uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  resolvido_em timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT matricula_reclassificacoes_unique_matricula UNIQUE (escola_id, matricula_id)
);

CREATE INDEX IF NOT EXISTS idx_matricula_reclassificacoes_queue
  ON public.matricula_reclassificacoes (escola_id, destino_session_id, status, tipo, created_at);
CREATE INDEX IF NOT EXISTS idx_matricula_reclassificacoes_aluno
  ON public.matricula_reclassificacoes (escola_id, aluno_id);

ALTER TABLE public.matricula_reclassificacoes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS matricula_reclassificacoes_select ON public.matricula_reclassificacoes;
CREATE POLICY matricula_reclassificacoes_select
  ON public.matricula_reclassificacoes FOR SELECT TO authenticated
  USING (
    escola_id = public.current_tenant_escola_id()
    AND public.user_has_role_in_school(escola_id, ARRAY['admin','admin_escola','staff_admin','admin_secretaria','diretor','admin_financeiro'])
  );

DROP POLICY IF EXISTS matricula_reclassificacoes_write ON public.matricula_reclassificacoes;
CREATE POLICY matricula_reclassificacoes_write
  ON public.matricula_reclassificacoes FOR ALL TO authenticated
  USING (
    escola_id = public.current_tenant_escola_id()
    AND public.user_has_role_in_school(escola_id, ARRAY['admin','admin_escola','staff_admin','admin_secretaria','diretor'])
  )
  WITH CHECK (
    escola_id = public.current_tenant_escola_id()
    AND public.user_has_role_in_school(escola_id, ARRAY['admin','admin_escola','staff_admin','admin_secretaria','diretor'])
  );

CREATE OR REPLACE FUNCTION public.sync_reclassificacoes_virada(
  p_escola_id uuid,
  p_origem_session_id uuid,
  p_destino_session_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tenant uuid := public.current_tenant_escola_id();
  v_actor uuid := auth.uid();
  v_count integer := 0;
BEGIN
  IF v_tenant IS NULL OR v_tenant IS DISTINCT FROM p_escola_id THEN
    RAISE EXCEPTION 'AUTH: escola_id inválido';
  END IF;
  IF NOT public.user_has_role_in_school(
    p_escola_id,
    ARRAY['admin','admin_escola','staff_admin','admin_secretaria','diretor']
  ) THEN
    RAISE EXCEPTION 'AUTH: permissão negada';
  END IF;

  WITH candidates AS (
    SELECT
      target.id AS matricula_id,
      target.aluno_id,
      source.session_id AS origem_session_id,
      target.session_id AS destino_session_id,
      source.turma_id AS origem_turma_id,
      target.turma_id AS destino_turma_id,
      CASE
        WHEN public.turma_classe_numero(source.turma_id) = 6 THEN 'FIM_PRIMARIO'
        WHEN public.turma_classe_numero(source.turma_id) = 9 THEN 'FIM_I_CICLO'
        ELSE 'PRE_ESCOLAR'
      END AS tipo
    FROM public.matriculas target
    JOIN public.matriculas source
      ON source.escola_id = p_escola_id
     AND source.aluno_id = target.aluno_id
     AND source.session_id = p_origem_session_id
    JOIN public.turmas source_turma ON source_turma.id = source.turma_id
    JOIN public.turmas target_turma ON target_turma.id = target.turma_id
    WHERE target.escola_id = p_escola_id
      AND target.session_id = p_destino_session_id
      AND target.ativo = true
      AND source.ativo = false
      AND (
        (
          public.turma_classe_numero(source.turma_id) IN (6, 9)
          AND public.turma_classe_numero(target.turma_id) = public.turma_classe_numero(source.turma_id)
          AND source_turma.curso_id IS NOT DISTINCT FROM target_turma.curso_id
        )
        OR (
          public.turma_classe_numero(source.turma_id) IS NULL
          AND source_turma.classe_id IS NOT DISTINCT FROM target_turma.classe_id
          AND source_turma.curso_id IS NOT DISTINCT FROM target_turma.curso_id
        )
      )
  ), inserted AS (
    INSERT INTO public.matricula_reclassificacoes (
      escola_id, matricula_id, aluno_id, origem_session_id, destino_session_id,
      origem_turma_id, destino_turma_id, tipo, status
    )
    SELECT
      p_escola_id, c.matricula_id, c.aluno_id, c.origem_session_id, c.destino_session_id,
      c.origem_turma_id, c.destino_turma_id, c.tipo, 'aguardando_destino'
    FROM candidates c
    ON CONFLICT (escola_id, matricula_id) DO UPDATE
      SET destino_turma_id = EXCLUDED.destino_turma_id,
          updated_at = now()
      WHERE matricula_reclassificacoes.status = 'aguardando_destino'
    RETURNING id
  )
  SELECT count(*)::integer INTO v_count FROM inserted;

  INSERT INTO public.audit_logs (escola_id, actor_id, action, entity, entity_id, details, portal)
  VALUES (
    p_escola_id, v_actor, 'RECLASSIFICACOES_FINALISTAS_SINCRONIZADAS', 'matricula_reclassificacoes', p_destino_session_id::text,
    jsonb_build_object('origem_session_id', p_origem_session_id, 'destino_session_id', p_destino_session_id, 'created_or_reused', v_count, 'at', now()),
    'admin'
  );

  RETURN jsonb_build_object('ok', true, 'created_or_reused', v_count);
END;
$$;

CREATE OR REPLACE FUNCTION public.finalistas_concluir_arquivar(
  p_escola_id uuid,
  p_reclassificacao_ids uuid[],
  p_motivo text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tenant uuid := public.current_tenant_escola_id();
  v_actor uuid := auth.uid();
  v_count integer;
BEGIN
  IF v_tenant IS NULL OR v_tenant IS DISTINCT FROM p_escola_id THEN
    RAISE EXCEPTION 'AUTH: escola_id inválido';
  END IF;
  IF NOT public.user_has_role_in_school(p_escola_id, ARRAY['admin','admin_escola','staff_admin','admin_secretaria','diretor']) THEN
    RAISE EXCEPTION 'AUTH: permissão negada';
  END IF;

  WITH selected AS (
    SELECT mr.id, mr.matricula_id
    FROM public.matricula_reclassificacoes mr
    WHERE mr.escola_id = p_escola_id
      AND mr.id = ANY(coalesce(p_reclassificacao_ids, ARRAY[]::uuid[]))
      AND mr.status = 'aguardando_destino'
    FOR UPDATE
  ), updated_matriculas AS (
    UPDATE public.matriculas m
    SET status = 'concluido', ativo = false, numero_matricula = NULL, updated_at = now()
    FROM selected s
    WHERE m.id = s.matricula_id AND m.escola_id = p_escola_id
    RETURNING m.id
  )
  UPDATE public.matricula_reclassificacoes mr
  SET status = 'concluido_arquivado', motivo = coalesce(nullif(trim(p_motivo), ''), mr.motivo),
      resolvido_por = v_actor, resolvido_em = now(), updated_at = now()
  FROM selected s
  WHERE mr.id = s.id;

  GET DIAGNOSTICS v_count = ROW_COUNT;
  INSERT INTO public.audit_logs (escola_id, actor_id, action, entity, entity_id, details, portal)
  VALUES (p_escola_id, v_actor, 'FINALISTAS_CONCLUIDOS_ARQUIVADOS', 'matricula_reclassificacoes', p_escola_id::text,
          jsonb_build_object('count', v_count, 'ids', p_reclassificacao_ids, 'motivo', p_motivo, 'at', now()), 'admin');
  RETURN jsonb_build_object('ok', true, 'resolved', v_count, 'status', 'concluido_arquivado');
END;
$$;

CREATE OR REPLACE FUNCTION public.finalistas_matricular_novo_ciclo(
  p_escola_id uuid,
  p_reclassificacao_ids uuid[],
  p_turma_destino_id uuid,
  p_motivo text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tenant uuid := public.current_tenant_escola_id();
  v_actor uuid := auth.uid();
  v_session uuid;
  v_capacity integer;
  v_occupancy integer;
  v_count integer;
BEGIN
  IF v_tenant IS NULL OR v_tenant IS DISTINCT FROM p_escola_id THEN
    RAISE EXCEPTION 'AUTH: escola_id inválido';
  END IF;
  IF NOT public.user_has_role_in_school(p_escola_id, ARRAY['admin','admin_escola','staff_admin','admin_secretaria','diretor']) THEN
    RAISE EXCEPTION 'AUTH: permissão negada';
  END IF;

  SELECT session_id, capacidade_maxima INTO v_session, v_capacity
  FROM public.turmas
  WHERE id = p_turma_destino_id AND escola_id = p_escola_id
  FOR UPDATE;
  IF v_session IS NULL THEN RAISE EXCEPTION 'DATA: turma destino inválida'; END IF;

  IF EXISTS (
    SELECT 1
    FROM public.matricula_reclassificacoes
    WHERE escola_id = p_escola_id
      AND id = ANY(coalesce(p_reclassificacao_ids, ARRAY[]::uuid[]))
      AND status = 'aguardando_destino'
      AND destino_session_id IS DISTINCT FROM v_session
  ) THEN
    RAISE EXCEPTION 'DATA: turma destino pertence a outro ano letivo';
  END IF;

  SELECT count(*)::integer INTO v_count
  FROM public.matricula_reclassificacoes
  WHERE escola_id = p_escola_id AND id = ANY(coalesce(p_reclassificacao_ids, ARRAY[]::uuid[])) AND status = 'aguardando_destino';
  IF v_count = 0 THEN RETURN jsonb_build_object('ok', true, 'resolved', 0, 'status', 'matriculado_novo_ciclo'); END IF;

  SELECT count(*)::integer INTO v_occupancy
  FROM public.matriculas
  WHERE escola_id = p_escola_id AND turma_id = p_turma_destino_id AND ativo = true;
  IF v_capacity IS NOT NULL AND v_occupancy + v_count > v_capacity THEN
    RAISE EXCEPTION 'DATA: turma destino sem vagas para o lote';
  END IF;

  UPDATE public.matriculas m
  SET turma_id = p_turma_destino_id, session_id = v_session, ativo = true, status = 'ativo', updated_at = now()
  FROM public.matricula_reclassificacoes mr
  WHERE mr.escola_id = p_escola_id
    AND mr.id = ANY(coalesce(p_reclassificacao_ids, ARRAY[]::uuid[]))
    AND mr.status = 'aguardando_destino'
    AND m.id = mr.matricula_id;

  UPDATE public.matricula_reclassificacoes
  SET destino_turma_id = p_turma_destino_id, status = 'matriculado_novo_ciclo',
      motivo = coalesce(nullif(trim(p_motivo), ''), motivo), resolvido_por = v_actor,
      resolvido_em = now(), updated_at = now()
  WHERE escola_id = p_escola_id
    AND id = ANY(coalesce(p_reclassificacao_ids, ARRAY[]::uuid[]))
    AND status = 'aguardando_destino';

  INSERT INTO public.audit_logs (escola_id, actor_id, action, entity, entity_id, details, portal)
  VALUES (p_escola_id, v_actor, 'FINALISTAS_MATRICULADOS_NOVO_CICLO', 'matricula_reclassificacoes', p_turma_destino_id::text,
          jsonb_build_object('count', v_count, 'ids', p_reclassificacao_ids, 'turma_destino_id', p_turma_destino_id, 'at', now()), 'admin');
  RETURN jsonb_build_object('ok', true, 'resolved', v_count, 'turma_destino_id', p_turma_destino_id, 'status', 'matriculado_novo_ciclo');
END;
$$;

REVOKE ALL ON FUNCTION public.sync_reclassificacoes_virada(uuid,uuid,uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.finalistas_concluir_arquivar(uuid,uuid[],text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.finalistas_matricular_novo_ciclo(uuid,uuid[],uuid,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.sync_reclassificacoes_virada(uuid,uuid,uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.finalistas_concluir_arquivar(uuid,uuid[],text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.finalistas_matricular_novo_ciclo(uuid,uuid[],uuid,text) TO authenticated;

COMMIT;
