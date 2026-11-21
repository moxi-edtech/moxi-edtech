-- P1: replace the *global* top-courses MV refresh with a per-course cache.
-- Boletim MV remains unchanged for all academic RPC consumers (separate migration).
-- The public view retains its four columns and school membership authorization.
BEGIN;

CREATE TABLE internal.top_cursos_media_live (
  escola_id uuid NOT NULL,
  curso_id uuid NOT NULL,
  curso_nome text,
  media numeric,
  PRIMARY KEY(escola_id,curso_id)
);
CREATE TABLE internal.top_cursos_dirty (
  escola_id uuid NOT NULL,
  curso_id uuid NOT NULL,
  requested_at timestamptz NOT NULL DEFAULT pg_catalog.clock_timestamp(),
  PRIMARY KEY(escola_id,curso_id)
);
CREATE INDEX idx_top_cursos_dirty_age
  ON internal.top_cursos_dirty(requested_at,escola_id,curso_id);

REVOKE ALL ON TABLE internal.top_cursos_media_live,internal.top_cursos_dirty
  FROM PUBLIC,anon,authenticated,service_role;
ALTER TABLE internal.top_cursos_media_live ENABLE ROW LEVEL SECURITY;
CREATE POLICY top_cursos_read_own_school ON internal.top_cursos_media_live
FOR SELECT TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.escola_users eu
  WHERE eu.user_id = (SELECT auth.uid())
    AND eu.escola_id = top_cursos_media_live.escola_id
));
GRANT SELECT ON TABLE internal.top_cursos_media_live TO authenticated,service_role;

-- Initial, contract-preserving snapshot. Fresh values are then converged
-- against source tables via the per-course dirty queue.
INSERT INTO internal.top_cursos_media_live(escola_id,curso_id,curso_nome,media)
SELECT escola_id,curso_id,curso_nome,media
FROM internal.mv_top_cursos_media;

CREATE OR REPLACE VIEW public.vw_top_cursos_media
WITH (security_invoker = true) AS
SELECT v.escola_id,v.curso_id,v.curso_nome,v.media
FROM internal.top_cursos_media_live v
WHERE v.escola_id IN (
  SELECT eu.escola_id
  FROM public.escola_users eu
  WHERE eu.user_id = (SELECT auth.uid())
);

-- Targeted AVG: only one school's one course is scanned/updated.
-- UPDATE ... WHERE DISTINCT avoids generating WAL for unchanged values.
CREATE FUNCTION internal.refresh_top_curso_media_one(p_escola_id uuid,p_curso_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $fn$
DECLARE
  v_course_name text;
  v_average numeric;
BEGIN
  SELECT c.nome,pg_catalog.round(pg_catalog.avg(n.valor),2)
    INTO v_course_name,v_average
  FROM public.notas n
  JOIN public.avaliacoes a ON a.id=n.avaliacao_id
  JOIN public.turma_disciplinas td ON td.id=a.turma_disciplina_id
  JOIN public.curso_matriz cm ON cm.id=td.curso_matriz_id
  JOIN public.cursos c ON c.id=cm.curso_id
  WHERE n.escola_id=p_escola_id AND c.escola_id=p_escola_id
    AND c.id=p_curso_id AND n.valor IS NOT NULL
  GROUP BY c.nome;

  IF FOUND THEN
    INSERT INTO internal.top_cursos_media_live(escola_id,curso_id,curso_nome,media)
    VALUES (p_escola_id,p_curso_id,v_course_name,v_average)
    ON CONFLICT(escola_id,curso_id) DO UPDATE
    SET curso_nome = EXCLUDED.curso_nome,media = EXCLUDED.media
    WHERE (top_cursos_media_live.curso_nome,top_cursos_media_live.media)
      IS DISTINCT FROM (EXCLUDED.curso_nome,EXCLUDED.media);
  ELSE
    DELETE FROM internal.top_cursos_media_live
    WHERE escola_id=p_escola_id AND curso_id=p_curso_id;
  END IF;
END;
$fn$;

-- One queue UPSERT per affected course / SQL statement, not per grade row.
CREATE FUNCTION internal.queue_top_cursos_from_notas()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $fn$
BEGIN
  IF TG_OP='INSERT' THEN
    INSERT INTO internal.top_cursos_dirty (escola_id, curso_id)
  SELECT DISTINCT n.escola_id, cm.curso_id FROM new_rows n
    JOIN public.avaliacoes a ON a.id = n.avaliacao_id
    JOIN public.turma_disciplinas td ON td.id = a.turma_disciplina_id
    JOIN public.curso_matriz cm ON cm.id = td.curso_matriz_id
    WHERE n.escola_id IS NOT NULL AND cm.curso_id IS NOT NULL
  ON CONFLICT (escola_id,curso_id)
  DO UPDATE SET requested_at = pg_catalog.clock_timestamp();
  ELSIF TG_OP='DELETE' THEN
    INSERT INTO internal.top_cursos_dirty (escola_id, curso_id)
  SELECT DISTINCT n.escola_id, cm.curso_id FROM old_rows n
    JOIN public.avaliacoes a ON a.id = n.avaliacao_id
    JOIN public.turma_disciplinas td ON td.id = a.turma_disciplina_id
    JOIN public.curso_matriz cm ON cm.id = td.curso_matriz_id
    WHERE n.escola_id IS NOT NULL AND cm.curso_id IS NOT NULL
  ON CONFLICT (escola_id,curso_id)
  DO UPDATE SET requested_at = pg_catalog.clock_timestamp();
  ELSIF TG_OP='UPDATE' THEN
    INSERT INTO internal.top_cursos_dirty (escola_id, curso_id)
  SELECT DISTINCT q.escola_id, cm.curso_id FROM (
      SELECT escola_id,avaliacao_id FROM old_rows
      UNION
      SELECT escola_id,avaliacao_id FROM new_rows
    ) q
    JOIN public.avaliacoes a ON a.id = q.avaliacao_id
    JOIN public.turma_disciplinas td ON td.id = a.turma_disciplina_id
    JOIN public.curso_matriz cm ON cm.id = td.curso_matriz_id
    WHERE q.escola_id IS NOT NULL AND cm.curso_id IS NOT NULL
  ON CONFLICT (escola_id,curso_id)
  DO UPDATE SET requested_at = pg_catalog.clock_timestamp();
  END IF;
  RETURN NULL;
END;
$fn$;

-- Infrequent course/curriculum/evaluation changes conservatively invalidate
-- all courses in the affected school; grades invalidate only their courses.
CREATE FUNCTION internal.queue_top_cursos_from_school_change()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $fn$
BEGIN
  IF TG_OP='INSERT' THEN
    INSERT INTO internal.top_cursos_dirty (escola_id, curso_id)
  WITH affected_schools AS (SELECT DISTINCT escola_id FROM new_rows WHERE escola_id IS NOT NULL),
    targets AS (
      SELECT c.escola_id, c.id AS curso_id
      FROM public.cursos c JOIN affected_schools a ON a.escola_id = c.escola_id
      UNION
      SELECT v.escola_id, v.curso_id
      FROM internal.top_cursos_media_live v
      JOIN affected_schools a ON a.escola_id = v.escola_id
    )
    SELECT escola_id,curso_id FROM targets
  ON CONFLICT (escola_id,curso_id)
  DO UPDATE SET requested_at = pg_catalog.clock_timestamp();
  ELSIF TG_OP='DELETE' THEN
    INSERT INTO internal.top_cursos_dirty (escola_id, curso_id)
  WITH affected_schools AS (SELECT DISTINCT escola_id FROM old_rows WHERE escola_id IS NOT NULL),
    targets AS (
      SELECT c.escola_id, c.id AS curso_id
      FROM public.cursos c JOIN affected_schools a ON a.escola_id = c.escola_id
      UNION
      SELECT v.escola_id, v.curso_id
      FROM internal.top_cursos_media_live v
      JOIN affected_schools a ON a.escola_id = v.escola_id
    )
    SELECT escola_id,curso_id FROM targets
  ON CONFLICT (escola_id,curso_id)
  DO UPDATE SET requested_at = pg_catalog.clock_timestamp();
  ELSIF TG_OP='UPDATE' THEN
    INSERT INTO internal.top_cursos_dirty (escola_id, curso_id)
  WITH affected_schools AS (SELECT escola_id FROM old_rows WHERE escola_id IS NOT NULL UNION SELECT escola_id FROM new_rows WHERE escola_id IS NOT NULL),
    targets AS (
      SELECT c.escola_id, c.id AS curso_id
      FROM public.cursos c JOIN affected_schools a ON a.escola_id = c.escola_id
      UNION
      SELECT v.escola_id, v.curso_id
      FROM internal.top_cursos_media_live v
      JOIN affected_schools a ON a.escola_id = v.escola_id
    )
    SELECT escola_id,curso_id FROM targets
  ON CONFLICT (escola_id,curso_id)
  DO UPDATE SET requested_at = pg_catalog.clock_timestamp();
  END IF;
  RETURN NULL;
END;
$fn$;

REVOKE ALL ON FUNCTION
  internal.refresh_top_curso_media_one(uuid,uuid),
  internal.queue_top_cursos_from_notas(),
  internal.queue_top_cursos_from_school_change()
FROM PUBLIC,anon,authenticated,service_role;

DROP TRIGGER IF EXISTS trg_klasse_top_cursos_insert ON public.notas;
CREATE TRIGGER trg_klasse_top_cursos_insert
AFTER INSERT ON public.notas
REFERENCING NEW TABLE AS new_rows FOR EACH STATEMENT
EXECUTE FUNCTION internal.queue_top_cursos_from_notas();

DROP TRIGGER IF EXISTS trg_klasse_top_cursos_update ON public.notas;
CREATE TRIGGER trg_klasse_top_cursos_update
AFTER UPDATE ON public.notas
REFERENCING OLD TABLE AS old_rows NEW TABLE AS new_rows FOR EACH STATEMENT
EXECUTE FUNCTION internal.queue_top_cursos_from_notas();

DROP TRIGGER IF EXISTS trg_klasse_top_cursos_delete ON public.notas;
CREATE TRIGGER trg_klasse_top_cursos_delete
AFTER DELETE ON public.notas
REFERENCING OLD TABLE AS old_rows FOR EACH STATEMENT
EXECUTE FUNCTION internal.queue_top_cursos_from_notas();

DROP TRIGGER IF EXISTS trg_klasse_top_cursos_insert ON public.avaliacoes;
CREATE TRIGGER trg_klasse_top_cursos_insert
AFTER INSERT ON public.avaliacoes
REFERENCING NEW TABLE AS new_rows FOR EACH STATEMENT
EXECUTE FUNCTION internal.queue_top_cursos_from_school_change();

DROP TRIGGER IF EXISTS trg_klasse_top_cursos_update ON public.avaliacoes;
CREATE TRIGGER trg_klasse_top_cursos_update
AFTER UPDATE ON public.avaliacoes
REFERENCING OLD TABLE AS old_rows NEW TABLE AS new_rows FOR EACH STATEMENT
EXECUTE FUNCTION internal.queue_top_cursos_from_school_change();

DROP TRIGGER IF EXISTS trg_klasse_top_cursos_delete ON public.avaliacoes;
CREATE TRIGGER trg_klasse_top_cursos_delete
AFTER DELETE ON public.avaliacoes
REFERENCING OLD TABLE AS old_rows FOR EACH STATEMENT
EXECUTE FUNCTION internal.queue_top_cursos_from_school_change();

DROP TRIGGER IF EXISTS trg_klasse_top_cursos_insert ON public.turma_disciplinas;
CREATE TRIGGER trg_klasse_top_cursos_insert
AFTER INSERT ON public.turma_disciplinas
REFERENCING NEW TABLE AS new_rows FOR EACH STATEMENT
EXECUTE FUNCTION internal.queue_top_cursos_from_school_change();

DROP TRIGGER IF EXISTS trg_klasse_top_cursos_update ON public.turma_disciplinas;
CREATE TRIGGER trg_klasse_top_cursos_update
AFTER UPDATE ON public.turma_disciplinas
REFERENCING OLD TABLE AS old_rows NEW TABLE AS new_rows FOR EACH STATEMENT
EXECUTE FUNCTION internal.queue_top_cursos_from_school_change();

DROP TRIGGER IF EXISTS trg_klasse_top_cursos_delete ON public.turma_disciplinas;
CREATE TRIGGER trg_klasse_top_cursos_delete
AFTER DELETE ON public.turma_disciplinas
REFERENCING OLD TABLE AS old_rows FOR EACH STATEMENT
EXECUTE FUNCTION internal.queue_top_cursos_from_school_change();

DROP TRIGGER IF EXISTS trg_klasse_top_cursos_insert ON public.curso_matriz;
CREATE TRIGGER trg_klasse_top_cursos_insert
AFTER INSERT ON public.curso_matriz
REFERENCING NEW TABLE AS new_rows FOR EACH STATEMENT
EXECUTE FUNCTION internal.queue_top_cursos_from_school_change();

DROP TRIGGER IF EXISTS trg_klasse_top_cursos_update ON public.curso_matriz;
CREATE TRIGGER trg_klasse_top_cursos_update
AFTER UPDATE ON public.curso_matriz
REFERENCING OLD TABLE AS old_rows NEW TABLE AS new_rows FOR EACH STATEMENT
EXECUTE FUNCTION internal.queue_top_cursos_from_school_change();

DROP TRIGGER IF EXISTS trg_klasse_top_cursos_delete ON public.curso_matriz;
CREATE TRIGGER trg_klasse_top_cursos_delete
AFTER DELETE ON public.curso_matriz
REFERENCING OLD TABLE AS old_rows FOR EACH STATEMENT
EXECUTE FUNCTION internal.queue_top_cursos_from_school_change();

DROP TRIGGER IF EXISTS trg_klasse_top_cursos_insert ON public.cursos;
CREATE TRIGGER trg_klasse_top_cursos_insert
AFTER INSERT ON public.cursos
REFERENCING NEW TABLE AS new_rows FOR EACH STATEMENT
EXECUTE FUNCTION internal.queue_top_cursos_from_school_change();

DROP TRIGGER IF EXISTS trg_klasse_top_cursos_update ON public.cursos;
CREATE TRIGGER trg_klasse_top_cursos_update
AFTER UPDATE ON public.cursos
REFERENCING OLD TABLE AS old_rows NEW TABLE AS new_rows FOR EACH STATEMENT
EXECUTE FUNCTION internal.queue_top_cursos_from_school_change();

DROP TRIGGER IF EXISTS trg_klasse_top_cursos_delete ON public.cursos;
CREATE TRIGGER trg_klasse_top_cursos_delete
AFTER DELETE ON public.cursos
REFERENCING OLD TABLE AS old_rows FOR EACH STATEMENT
EXECUTE FUNCTION internal.queue_top_cursos_from_school_change();

-- Lock one queue item until its source calculation and DELETE commit together.
-- An academic write racing with this worker will requeue after its lock waits;
-- no committed grade change can be dropped between compute and dequeue.
CREATE FUNCTION internal.process_top_cursos_dirty(p_limit integer DEFAULT 50)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $fn$
DECLARE
  v_target record;
  v_count integer := 0;
BEGIN
  IF p_limit IS NULL OR p_limit < 1 OR p_limit > 100 THEN
    RAISE EXCEPTION 'top_cursos_dirty: invalid batch limit';
  END IF;

  FOR v_target IN
    SELECT escola_id,curso_id
    FROM internal.top_cursos_dirty
    ORDER BY requested_at,escola_id,curso_id
    LIMIT p_limit
    FOR UPDATE SKIP LOCKED
  LOOP
    PERFORM internal.refresh_top_curso_media_one(
      v_target.escola_id,v_target.curso_id
    );
    DELETE FROM internal.top_cursos_dirty
    WHERE escola_id=v_target.escola_id AND curso_id=v_target.curso_id;
    v_count := v_count + 1;
  END LOOP;
  RETURN v_count;
END;
$fn$;

-- Daily safety reconciliation, targeted by course, catches administrative
-- restores or missed trigger operations without a whole-view refresh.
CREATE FUNCTION internal.enqueue_top_cursos_reconciliation()
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $fn$
DECLARE v_rows integer;
BEGIN
  INSERT INTO internal.top_cursos_dirty(escola_id,curso_id)
  SELECT targets.escola_id,targets.curso_id
  FROM (
    SELECT c.escola_id,c.id AS curso_id FROM public.cursos c
    UNION
    SELECT v.escola_id,v.curso_id FROM internal.top_cursos_media_live v
  ) targets
  ON CONFLICT (escola_id,curso_id)
  DO UPDATE SET requested_at=pg_catalog.clock_timestamp();
  GET DIAGNOSTICS v_rows = ROW_COUNT;
  RETURN v_rows;
END;
$fn$;
REVOKE ALL ON FUNCTION
  internal.process_top_cursos_dirty(integer),
  internal.enqueue_top_cursos_reconciliation()
FROM PUBLIC,anon,authenticated,service_role;

-- Bootstrap convergence regardless of the legacy MV's last refresh time.
SELECT internal.enqueue_top_cursos_reconciliation();

DO $cron$
DECLARE v_job record;
BEGIN
  SELECT jobid,command,username INTO v_job
  FROM cron.job WHERE jobname='refresh_mv_top_cursos_media' AND active;
  IF NOT FOUND OR
    pg_catalog.btrim(v_job.command) IS DISTINCT FROM
    'REFRESH MATERIALIZED VIEW CONCURRENTLY internal.mv_top_cursos_media'
  THEN RAISE EXCEPTION 'Top-courses cron unexpected: cutover aborted'; END IF;
  IF v_job.username <> CURRENT_USER THEN
    RAISE EXCEPTION 'Top-courses cron owner mismatch'; END IF;

  PERFORM cron.alter_job(v_job.jobid,
    schedule := '*/10 * * * *',
    command := 'SELECT internal.process_top_cursos_dirty(50);');

  IF EXISTS (SELECT 1 FROM cron.job
    WHERE jobname='top-cursos-reconcile-daily') THEN
    RAISE EXCEPTION 'Top-courses reconciliation cron already exists; inspect before cutover';
  END IF;
  PERFORM cron.schedule(
    'top-cursos-reconcile-daily',
    '17 3 * * *',
    'SELECT internal.enqueue_top_cursos_reconciliation();'
  );
END;
$cron$;

COMMIT;
