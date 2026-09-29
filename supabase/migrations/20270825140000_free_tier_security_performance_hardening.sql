-- Final hardening reconciliation.
-- This file intentionally runs after the repository's 2027 migrations so that
-- fresh environments converge to the same secure/performance state as production.

-- 1) Backup/test tables must not be reachable through the public Data API.
ALTER TABLE public._bk_20260924_curso_matriz ENABLE ROW LEVEL SECURITY;
ALTER TABLE public._bk_20260924_turma_disciplinas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public._bk_20260924_avaliacoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public._bk_20260924_notas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public._bk_20260924_mensalidades_caroline ENABLE ROW LEVEL SECURITY;
ALTER TABLE public._bk_20260924_alunos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public._bk_20260924_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public._bk_20260924b_mensalidades_teta ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.academic_regime_contract_cases ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE
  public._bk_20260924_curso_matriz,
  public._bk_20260924_turma_disciplinas,
  public._bk_20260924_avaliacoes,
  public._bk_20260924_notas,
  public._bk_20260924_mensalidades_caroline,
  public._bk_20260924_alunos,
  public._bk_20260924_profiles,
  public._bk_20260924b_mensalidades_teta,
  public.academic_regime_contract_cases
FROM PUBLIC, anon, authenticated;

-- 2) Trigger functions are invoked by PostgreSQL triggers, not by client RPC calls.
REVOKE EXECUTE ON FUNCTION public.audit_excecao_pauta_changes() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.enforce_mensalidade_matricula_scope() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.ensure_default_raa_policy() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.set_matricula_financial_start() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.sync_turma_academic_year() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.trg_aplicar_desconto_familiar() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.validate_education_offering_calendar_profile() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.validate_k12_offering_curriculum_preset() FROM PUBLIC, anon, authenticated;

-- 3) Internal helper is only called by the validated public wrapper / privileged backend.
REVOKE EXECUTE ON FUNCTION public.aplicar_desconto_familiar_interno(uuid, uuid)
FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.aplicar_desconto_familiar_interno(uuid, uuid) TO service_role;

-- 4) MV refresh is maintenance-only.
REVOKE EXECUTE ON FUNCTION public.refresh_mv_financeiro_escola_dia_ano()
FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.refresh_mv_financeiro_escola_dia_ano() TO service_role;

-- 5) Finance reporting view can safely be SECURITY INVOKER because authenticated
-- already has SELECT on the backing materialized view.
ALTER VIEW public.vw_financeiro_escola_dia_ano SET (security_invoker = true);
REVOKE ALL ON TABLE public.vw_financeiro_escola_dia_ano FROM PUBLIC, anon;
GRANT SELECT ON TABLE public.vw_financeiro_escola_dia_ano TO authenticated, service_role;

REVOKE ALL ON TABLE internal.mv_financeiro_escola_dia_ano FROM PUBLIC, anon;
GRANT SELECT ON TABLE internal.mv_financeiro_escola_dia_ano TO authenticated, service_role;

-- -----------------------------------------------------------------------------

-- Rebuild professor pending-grades MV so duplicate evaluation rows do not
-- violate the concurrent-refresh unique index. No source evaluations/notes
-- are deleted; duplicates are consolidated logically.
DROP VIEW IF EXISTS public.vw_professor_pendencias;
DROP MATERIALIZED VIEW IF EXISTS internal.mv_professor_pendencias;

CREATE MATERIALIZED VIEW internal.mv_professor_pendencias AS
WITH base AS (
  SELECT
    td.escola_id,
    td.id AS turma_disciplina_id,
    td.turma_id,
    td.professor_id,
    pr.profile_id,
    t.nome AS turma_nome,
    cm.disciplina_id,
    dc.nome AS disciplina_nome
  FROM public.turma_disciplinas td
  LEFT JOIN public.professores pr ON pr.id = td.professor_id
  LEFT JOIN public.turmas t ON t.id = td.turma_id
  LEFT JOIN public.curso_matriz cm ON cm.id = td.curso_matriz_id
  LEFT JOIN public.disciplinas_catalogo dc ON dc.id = cm.disciplina_id
  WHERE td.escola_id IS NOT NULL
),
active_matriculas AS (
  SELECT
    m.escola_id,
    m.turma_id,
    COUNT(*)::int AS total_alunos
  FROM public.matriculas m
  WHERE m.status IN ('ativa', 'ativo', 'active')
  GROUP BY m.escola_id, m.turma_id
),
tipos AS (
  SELECT unnest(ARRAY['MAC','NPP','NPT']) AS tipo
),
trimestres AS (
  SELECT unnest(ARRAY[1,2,3])::int AS trimestre
),
avaliacoes_grouped AS (
  SELECT
    a.escola_id,
    a.turma_disciplina_id,
    upper(a.tipo) AS tipo,
    a.trimestre,
    (array_agg(a.id ORDER BY a.created_at DESC, a.id DESC))[1] AS avaliacao_id,
    array_agg(a.id) AS avaliacao_ids
  FROM public.avaliacoes a
  WHERE a.escola_id IS NOT NULL
    AND a.turma_disciplina_id IS NOT NULL
    AND a.tipo IS NOT NULL
    AND a.trimestre IS NOT NULL
  GROUP BY a.escola_id, a.turma_disciplina_id, upper(a.tipo), a.trimestre
)
SELECT
  b.escola_id,
  b.professor_id,
  b.profile_id,
  b.turma_disciplina_id,
  b.turma_id,
  b.turma_nome,
  b.disciplina_id,
  b.disciplina_nome,
  t.tipo,
  tr.trimestre,
  ag.avaliacao_id,
  COALESCE(am.total_alunos, 0) AS total_alunos,
  COUNT(DISTINCT n.matricula_id) FILTER (WHERE n.id IS NOT NULL)::int AS notas_lancadas,
  CASE
    WHEN COALESCE(am.total_alunos, 0) = 0 THEN 0
    WHEN ag.avaliacao_id IS NULL THEN COALESCE(am.total_alunos, 0)
    ELSE GREATEST(COALESCE(am.total_alunos, 0) - COUNT(DISTINCT n.matricula_id), 0)
  END AS pendentes
FROM base b
CROSS JOIN tipos t
CROSS JOIN trimestres tr
LEFT JOIN avaliacoes_grouped ag
  ON ag.escola_id = b.escola_id
 AND ag.turma_disciplina_id = b.turma_disciplina_id
 AND ag.tipo = t.tipo
 AND ag.trimestre = tr.trimestre
LEFT JOIN public.notas n
  ON ag.avaliacao_ids IS NOT NULL
 AND n.escola_id = b.escola_id
 AND n.avaliacao_id = ANY(ag.avaliacao_ids)
LEFT JOIN active_matriculas am
  ON am.escola_id = b.escola_id
 AND am.turma_id = b.turma_id
GROUP BY
  b.escola_id,
  b.professor_id,
  b.profile_id,
  b.turma_disciplina_id,
  b.turma_id,
  b.turma_nome,
  b.disciplina_id,
  b.disciplina_nome,
  t.tipo,
  tr.trimestre,
  ag.avaliacao_id,
  am.total_alunos;

CREATE UNIQUE INDEX ux_mv_professor_pendencias
  ON internal.mv_professor_pendencias
     (escola_id, turma_disciplina_id, tipo, trimestre);

CREATE INDEX idx_mv_professor_pendencias_escola_turma
  ON internal.mv_professor_pendencias (escola_id, turma_id);

REVOKE ALL ON TABLE internal.mv_professor_pendencias FROM PUBLIC, anon;
GRANT SELECT ON TABLE internal.mv_professor_pendencias TO authenticated, service_role;

CREATE VIEW public.vw_professor_pendencias
WITH (security_invoker = true) AS
SELECT
  escola_id,
  professor_id,
  profile_id,
  turma_disciplina_id,
  turma_id,
  turma_nome,
  disciplina_id,
  disciplina_nome,
  tipo,
  trimestre,
  avaliacao_id,
  total_alunos,
  notas_lancadas,
  pendentes
FROM internal.mv_professor_pendencias
WHERE escola_id IN (
  SELECT eu.escola_id
  FROM public.escola_users eu
  WHERE eu.user_id = auth.uid()
);

REVOKE ALL ON TABLE public.vw_professor_pendencias FROM PUBLIC, anon;
GRANT SELECT ON TABLE public.vw_professor_pendencias TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.refresh_mv_professor_pendencias()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY internal.mv_professor_pendencias;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.refresh_mv_professor_pendencias()
FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.refresh_mv_professor_pendencias() TO service_role;

-- Auto-expire is a trusted internal transition and must opt into the same
-- guard used by official status RPCs only for the duration of its UPDATE.
CREATE OR REPLACE FUNCTION public.admissao_auto_expire_reservations()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_rec record;
BEGIN
  FOR v_rec IN
    SELECT id, escola_id, status, expires_at
    FROM public.candidaturas
    WHERE status = 'aguardando_pagamento'
      AND expires_at < now()
    FOR UPDATE SKIP LOCKED
  LOOP
    INSERT INTO public.candidaturas_status_log (
      escola_id, candidatura_id, from_status, to_status, motivo
    ) VALUES (
      v_rec.escola_id,
      v_rec.id,
      v_rec.status,
      'arquivada',
      'Reserva expirada (prazo de pagamento de 48h excedido).'
    );

    BEGIN
      PERFORM set_config('app.rpc_internal', 'on', true);

      UPDATE public.candidaturas
      SET status = 'arquivada',
          updated_at = now()
      WHERE id = v_rec.id;

      PERFORM set_config('app.rpc_internal', 'off', true);
    EXCEPTION WHEN OTHERS THEN
      PERFORM set_config('app.rpc_internal', 'off', true);
      RAISE;
    END;
  END LOOP;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.admissao_auto_expire_reservations()
FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admissao_auto_expire_reservations() TO service_role;

-- Repair two stale cron commands that referenced functions that do not exist.
DO $
DECLARE
  v_job record;
BEGIN
  FOR v_job IN
    SELECT jobid
    FROM cron.job
    WHERE jobname = 'refresh_mv_secretaria_matriculas_turma_status'
  LOOP
    PERFORM cron.alter_job(
      job_id := v_job.jobid,
      command := 'REFRESH MATERIALIZED VIEW CONCURRENTLY internal.mv_secretaria_matriculas_turma_status'
    );
  END LOOP;

  FOR v_job IN
    SELECT jobid
    FROM cron.job
    WHERE jobname = 'refresh_mv_cursos_reais'
  LOOP
    PERFORM cron.alter_job(
      job_id := v_job.jobid,
      command := 'REFRESH MATERIALIZED VIEW CONCURRENTLY internal.mv_cursos_reais'
    );
  END LOOP;
END;
$;

-- Drop structurally identical non-constraint indexes; keep the canonical/used copy.
DROP INDEX IF EXISTS public.ix_search_alunos_bi_numero_trgm;
DROP INDEX IF EXISTS public.ix_search_alunos_numero_processo_trgm;
DROP INDEX IF EXISTS public.ix_search_candidaturas_nome_trgm;
DROP INDEX IF EXISTS public.ix_search_cursos_nome_trgm;
DROP INDEX IF EXISTS public.idx_pautas_lote_jobs_escola_status;

-- These per-partition constraints duplicate the parent-attached unique constraint.
ALTER TABLE public.frequencias_2025_09 DROP CONSTRAINT IF EXISTS uq_frequencias_ssot__2025_09;
ALTER TABLE public.frequencias_2025_10 DROP CONSTRAINT IF EXISTS uq_frequencias_ssot__2025_10;
ALTER TABLE public.frequencias_2025_11 DROP CONSTRAINT IF EXISTS uq_frequencias_ssot__2025_11;
ALTER TABLE public.frequencias_2025_12 DROP CONSTRAINT IF EXISTS uq_frequencias_ssot__2025_12;
ALTER TABLE public.frequencias_2026_01 DROP CONSTRAINT IF EXISTS uq_frequencias_ssot__2026_01;
ALTER TABLE public.frequencias_2026_02 DROP CONSTRAINT IF EXISTS uq_frequencias_ssot__2026_02;
ALTER TABLE public.frequencias_default DROP CONSTRAINT IF EXISTS uq_frequencias_ssot__default;

-- -----------------------------------------------------------------------------

-- Harden K12 privileged RPC at the database boundary.
CREATE OR REPLACE FUNCTION public.ensure_k12_course_offering(
  p_escola_id uuid,
  p_course_id uuid,
  p_curriculum_preset_id text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog, pg_temp
AS $$
DECLARE
  v_course_key text;
  v_category text;
  v_subsystem text;
  v_level text;
  v_calendar_profile_id uuid;
  v_offering_id uuid;
BEGIN
  IF p_escola_id IS DISTINCT FROM public.current_tenant_escola_id() THEN
    RAISE EXCEPTION 'AUTH: escola_id inválido.' USING ERRCODE = '42501';
  END IF;

  IF NOT public.user_has_role_in_school(
    p_escola_id,
    ARRAY['admin_escola','secretaria','admin','staff_admin','admin_financeiro']
  ) THEN
    RAISE EXCEPTION 'AUTH: Permissão negada.' USING ERRCODE = '42501';
  END IF;

  SELECT c.curriculum_key
    INTO v_course_key
  FROM public.cursos c
  WHERE c.id = p_course_id
    AND c.escola_id = p_escola_id;

  IF v_course_key IS NULL OR v_course_key IS DISTINCT FROM p_curriculum_preset_id THEN
    RAISE EXCEPTION 'Curso K12 sem correspondência exata com o preset solicitado.';
  END IF;

  SELECT p.category::text
    INTO v_category
  FROM public.curriculum_presets p
  WHERE p.id = p_curriculum_preset_id;

  IF v_category IS NULL THEN
    RAISE EXCEPTION 'Preset curricular K12 inexistente.';
  END IF;

  IF p_curriculum_preset_id = 'pre_escolar' THEN
    v_subsystem := 'PRE_ESCOLAR';
    v_level := 'PRE_SCHOOL';
  ELSIF v_category LIKE 'TECNICO%' THEN
    v_subsystem := 'TECNICO_PROFISSIONAL';
    v_level := 'SECONDARY';
  ELSIF v_category = 'PRIMARIO' THEN
    v_subsystem := 'REGULAR_ADULTOS';
    v_level := 'PRIMARY';
  ELSE
    v_subsystem := 'REGULAR_ADULTOS';
    v_level := 'SECONDARY';
  END IF;

  SELECT ct.id
    INTO v_calendar_profile_id
  FROM public.calendario_templates ct
  WHERE ct.is_oficial = true
    AND ct.estado = 'PUBLICADO'
    AND ct.ano_base = 2026
    AND ct.subsistema = v_subsystem
  ORDER BY ct.publicado_em DESC NULLS LAST, ct.updated_at DESC, ct.id DESC
  LIMIT 1;

  IF v_calendar_profile_id IS NULL THEN
    RAISE EXCEPTION 'Calendário oficial 2026/2027 não encontrado para o subsistema %.', v_subsystem;
  END IF;

  SELECT o.id
    INTO v_offering_id
  FROM public.school_education_offerings o
  WHERE o.escola_id = p_escola_id
    AND o.course_id = p_course_id
  ORDER BY o.status = 'active' DESC, o.updated_at DESC, o.id DESC
  LIMIT 1
  FOR UPDATE;

  IF v_offering_id IS NULL THEN
    INSERT INTO public.school_education_offerings (
      escola_id, education_subsystem, education_level, course_id,
      curriculum_preset_id, grades, calendar_profile_id,
      classification_source, classification_reason, status
    ) VALUES (
      p_escola_id, v_subsystem, v_level, p_course_id,
      p_curriculum_preset_id, '{}'::text[], v_calendar_profile_id,
      'curriculum_preset_install',
      'Preset K12 exato escolhido no momento da instalação do curso.',
      'active'
    )
    RETURNING id INTO v_offering_id;
  ELSE
    UPDATE public.school_education_offerings
    SET education_subsystem = v_subsystem,
        education_level = v_level,
        curriculum_preset_id = p_curriculum_preset_id,
        calendar_profile_id = v_calendar_profile_id,
        classification_source = 'curriculum_preset_install',
        classification_reason = 'Preset K12 exato escolhido no momento da instalação do curso.',
        status = 'active',
        updated_at = now()
    WHERE id = v_offering_id;
  END IF;

  RETURN v_offering_id;
END;
$$;

-- Explicit grants for privileged RPCs: never inherit PUBLIC execute by accident.
REVOKE EXECUTE ON FUNCTION public.ensure_k12_course_offering(uuid, uuid, text)
FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.ensure_k12_course_offering(uuid, uuid, text)
TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.professor_iniciar_aula_contexto(
  uuid, uuid, uuid, uuid, date, uuid, time without time zone, time without time zone
) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.professor_iniciar_aula_contexto(
  uuid, uuid, uuid, uuid, date, uuid, time without time zone, time without time zone
) TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.record_school_profile_audit(
  uuid, uuid, text, text, jsonb, jsonb, date
) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.record_school_profile_audit(
  uuid, uuid, text, text, jsonb, jsonb, date
) TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.set_school_operating_profile(
  uuid, text, text, text, text, text, date, text, boolean
) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_school_operating_profile(
  uuid, text, text, text, text, text, date, text, boolean
) TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.upsert_historico_transitado(
  uuid, uuid, uuid, integer, jsonb
) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.upsert_historico_transitado(
  uuid, uuid, uuid, integer, jsonb
) TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.user_can_access_raa_school(uuid)
FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.user_can_access_raa_school(uuid)
TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.turma_janela_fim_cobranca(uuid, uuid, date)
FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.turma_janela_fim_cobranca(uuid, uuid, date)
TO authenticated, service_role;

-- Trigger-only functions: deterministic search_path and no client RPC execution.
ALTER FUNCTION public.sync_historico_disciplinas_compat()
  SET search_path = pg_catalog, public;
ALTER FUNCTION public.sync_historico_anos_compat()
  SET search_path = pg_catalog, public;
ALTER FUNCTION public.set_admin_activity_event_metadata()
  SET search_path = pg_catalog, public;
ALTER FUNCTION public.assert_raa_exame_sessao_components()
  SET search_path = pg_catalog, public;
ALTER FUNCTION public.assert_raa_melhoria_recurso()
  SET search_path = pg_catalog, public;

REVOKE EXECUTE ON FUNCTION public.sync_historico_disciplinas_compat()
FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.sync_historico_anos_compat()
FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.set_admin_activity_event_metadata()
FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.assert_raa_exame_sessao_components()
FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.assert_raa_melhoria_recurso()
FROM PUBLIC, anon, authenticated;

-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.get_operacoes_dashboard_work_for_current_user()
RETURNS TABLE (
  escola_id uuid,
  classes_without_published_schedule integer,
  first_class_without_published_schedule_id uuid,
  documents_pending integer,
  failed_messages integer,
  refreshed_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_catalog, pg_temp
AS $$
  SELECT
    m.escola_id,
    m.classes_without_published_schedule,
    m.first_class_without_published_schedule_id,
    m.documents_pending,
    m.failed_messages,
    m.refreshed_at
  FROM internal.mv_operacoes_dashboard_work m
  WHERE (SELECT auth.uid()) IS NOT NULL
    AND EXISTS (
      SELECT 1
      FROM public.escola_users eu
      WHERE eu.escola_id = m.escola_id
        AND eu.user_id = (SELECT auth.uid())
    );
$$;

REVOKE EXECUTE ON FUNCTION public.get_operacoes_dashboard_work_for_current_user()
FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_operacoes_dashboard_work_for_current_user()
TO authenticated;

CREATE OR REPLACE VIEW public.vw_operacoes_dashboard_work
WITH (security_invoker = true, security_barrier = true)
AS
SELECT *
FROM public.get_operacoes_dashboard_work_for_current_user();

REVOKE ALL ON TABLE public.vw_operacoes_dashboard_work FROM PUBLIC, anon;
GRANT SELECT ON TABLE public.vw_operacoes_dashboard_work TO authenticated, service_role;

REVOKE ALL ON TABLE internal.mv_operacoes_dashboard_work FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE internal.mv_operacoes_dashboard_work TO service_role;
