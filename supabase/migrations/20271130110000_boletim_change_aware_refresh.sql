-- Phase 1: safe, change-aware refresh for the original academic MV.
-- Its direct SQL/RPC consumers keep the SAME relation, columns and permissions.
-- No arbitrary reduction of freshness when grades/curricula actually change.
BEGIN;

CREATE TABLE IF NOT EXISTS internal.boletim_refresh_state (
  singleton boolean PRIMARY KEY DEFAULT true CHECK (singleton),
  dirty_version bigint NOT NULL DEFAULT 1 CHECK (dirty_version >= 0),
  refreshed_version bigint NOT NULL DEFAULT 0 CHECK (refreshed_version >= 0),
  last_refreshed_at timestamptz,
  CHECK (refreshed_version <= dirty_version)
);

REVOKE ALL ON TABLE internal.boletim_refresh_state FROM PUBLIC, anon, authenticated, service_role;

INSERT INTO internal.boletim_refresh_state(singleton,dirty_version,refreshed_version)
VALUES (true,1,0)
ON CONFLICT (singleton) DO NOTHING;

-- Changes are transactional: failed academic writes cannot invalidate the MV.
-- A single low-cost UPDATE per SQL statement avoids per-student trigger overhead.
CREATE OR REPLACE FUNCTION internal.mark_boletim_dirty()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $fn$
BEGIN
  UPDATE internal.boletim_refresh_state
  SET dirty_version = dirty_version + 1
  WHERE singleton;
  RETURN NULL;
END;
$fn$;
REVOKE ALL ON FUNCTION internal.mark_boletim_dirty() FROM PUBLIC, anon, authenticated, service_role;

-- DML uses one invalidation per statement, including bulk uploads.
DROP TRIGGER IF EXISTS trg_klasse_boletim_dirty ON public.notas;
CREATE TRIGGER trg_klasse_boletim_dirty
AFTER INSERT OR UPDATE OF valor,is_isento,avaliacao_id,matricula_id,escola_id OR DELETE ON public.notas
FOR EACH STATEMENT EXECUTE FUNCTION internal.mark_boletim_dirty();

-- DML uses one invalidation per statement, including bulk uploads.
DROP TRIGGER IF EXISTS trg_klasse_boletim_dirty ON public.matriculas;
CREATE TRIGGER trg_klasse_boletim_dirty
AFTER INSERT OR UPDATE OF turma_id,aluno_id,escola_id,ano_letivo,status OR DELETE ON public.matriculas
FOR EACH STATEMENT EXECUTE FUNCTION internal.mark_boletim_dirty();

-- DML uses one invalidation per statement, including bulk uploads.
DROP TRIGGER IF EXISTS trg_klasse_boletim_dirty ON public.avaliacoes;
CREATE TRIGGER trg_klasse_boletim_dirty
AFTER INSERT OR UPDATE OF turma_disciplina_id,escola_id,ano_letivo,nome,tipo,trimestre,peso OR DELETE ON public.avaliacoes
FOR EACH STATEMENT EXECUTE FUNCTION internal.mark_boletim_dirty();

-- DML uses one invalidation per statement, including bulk uploads.
DROP TRIGGER IF EXISTS trg_klasse_boletim_dirty ON public.turma_disciplinas;
CREATE TRIGGER trg_klasse_boletim_dirty
AFTER INSERT OR UPDATE OF turma_id,curso_matriz_id,conta_para_media_med,escola_id OR DELETE ON public.turma_disciplinas
FOR EACH STATEMENT EXECUTE FUNCTION internal.mark_boletim_dirty();

-- DML uses one invalidation per statement, including bulk uploads.
DROP TRIGGER IF EXISTS trg_klasse_boletim_dirty ON public.curso_matriz;
CREATE TRIGGER trg_klasse_boletim_dirty
AFTER INSERT OR UPDATE OF curso_id,classe_id,disciplina_id,avaliacao_modelo_id,avaliacao_mode,avaliacao_disciplina_id,modelo_excecao_id,ativo,escola_id OR DELETE ON public.curso_matriz
FOR EACH STATEMENT EXECUTE FUNCTION internal.mark_boletim_dirty();

-- DML uses one invalidation per statement, including bulk uploads.
DROP TRIGGER IF EXISTS trg_klasse_boletim_dirty ON public.disciplinas_catalogo;
CREATE TRIGGER trg_klasse_boletim_dirty
AFTER INSERT OR UPDATE OF nome,sigla,escola_id OR DELETE ON public.disciplinas_catalogo
FOR EACH STATEMENT EXECUTE FUNCTION internal.mark_boletim_dirty();

-- DML uses one invalidation per statement, including bulk uploads.
DROP TRIGGER IF EXISTS trg_klasse_boletim_dirty ON public.configuracoes_escola;
CREATE TRIGGER trg_klasse_boletim_dirty
AFTER INSERT OR UPDATE OF modelo_avaliacao,avaliacao_config,escola_id OR DELETE ON public.configuracoes_escola
FOR EACH STATEMENT EXECUTE FUNCTION internal.mark_boletim_dirty();

-- DML uses one invalidation per statement, including bulk uploads.
DROP TRIGGER IF EXISTS trg_klasse_boletim_dirty ON public.modelos_avaliacao;
CREATE TRIGGER trg_klasse_boletim_dirty
AFTER INSERT OR UPDATE OF formula,componentes,is_default,curso_id,nome,escola_id OR DELETE ON public.modelos_avaliacao
FOR EACH STATEMENT EXECUTE FUNCTION internal.mark_boletim_dirty();

CREATE OR REPLACE FUNCTION internal.refresh_boletim_if_dirty()
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $fn$
DECLARE
  v_dirty bigint;
  v_refreshed bigint;
  v_last_at timestamptz;
BEGIN
  -- Avoid overlapping automatic/maintenance refreshes without locking writes
  -- to academic source tables during the expensive MV operation.
  IF NOT pg_catalog.pg_try_advisory_xact_lock(184103, 91) THEN
    RETURN 'busy';
  END IF;

  SELECT dirty_version,refreshed_version,last_refreshed_at
  INTO v_dirty,v_refreshed,v_last_at
  FROM internal.boletim_refresh_state
  WHERE singleton;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Boletim change tracking not initialized';
  END IF;

  -- 24h safety reconciliation catches rare operations bypassing normal triggers
  -- (e.g. restore/replication), without hourly writes while the school is idle.
  IF v_dirty = v_refreshed
     AND v_last_at IS NOT NULL
     AND v_last_at > pg_catalog.clock_timestamp() - interval '24 hours'
  THEN
    RETURN 'unchanged';
  END IF;

  REFRESH MATERIALIZED VIEW CONCURRENTLY internal.mv_boletim_por_matricula;

  -- Snapshot was taken before REFRESH. If a concurrent academic transaction
  -- committed meanwhile, its version remains higher and the next cron retries.
  UPDATE internal.boletim_refresh_state
  SET refreshed_version = pg_catalog.greatest(refreshed_version, v_dirty),
      last_refreshed_at = pg_catalog.clock_timestamp()
  WHERE singleton;

  RETURN 'refreshed';
END;
$fn$;
REVOKE ALL ON FUNCTION internal.refresh_boletim_if_dirty() FROM PUBLIC, anon, authenticated, service_role;

-- Preserve the existing cron job ID and deployment behavior.
-- Abort on drift rather than silently reconfiguring an unexpected job.
DO $migrate$
DECLARE
  v_job record;
BEGIN
  SELECT jobid,command,username INTO v_job
  FROM cron.job
  WHERE jobname = 'refresh-boletim-hourly' AND active;
  IF NOT FOUND OR
     pg_catalog.btrim(v_job.command) IS DISTINCT FROM
       'REFRESH MATERIALIZED VIEW CONCURRENTLY internal.mv_boletim_por_matricula' THEN
    RAISE EXCEPTION 'Boletim cron unexpected or missing: cutover aborted';
  END IF;
  IF v_job.username <> CURRENT_USER THEN
    RAISE EXCEPTION 'Boletim cron owner differs from migration user; manual privilege review required';
  END IF;
  PERFORM cron.alter_job(v_job.jobid,
    command := 'SELECT internal.refresh_boletim_if_dirty();');
END;
$migrate$;

COMMIT;
