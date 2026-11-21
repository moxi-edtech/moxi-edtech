-- P1 read-model regression. Run after both migrations in an isolated session.
-- The queue is processed only inside this transaction; all test writes roll back.
BEGIN;
SET LOCAL lock_timeout = '1s';
SET LOCAL statement_timeout = '30s';

DO $verify$
DECLARE
  v_processed integer;
  v_total integer := 0;
  v_diff integer;
BEGIN
  IF (SELECT count(*) FROM cron.job
       WHERE jobname='refresh-boletim-hourly' AND active
         AND btrim(command)='SELECT internal.refresh_boletim_if_dirty();') <> 1 THEN
    RAISE EXCEPTION 'Boletim cron did not migrate to dirty-aware refresh';
  END IF;

  IF (SELECT count(*) FROM cron.job
       WHERE jobname='refresh_mv_top_cursos_media' AND active
         AND btrim(command)='SELECT internal.process_top_cursos_dirty(50);') <> 1 THEN
    RAISE EXCEPTION 'Top courses still run a full MV refresh';
  END IF;

  IF (SELECT count(*) FROM pg_trigger
       WHERE tgname='trg_klasse_boletim_dirty' AND NOT tgisinternal) <> 8 THEN
    RAISE EXCEPTION 'Boletim source invalidations not fully installed';
  END IF;

  IF (SELECT count(*) FROM pg_trigger
       WHERE tgname LIKE 'trg_klasse_top_cursos_%' AND NOT tgisinternal) <> 15 THEN
    RAISE EXCEPTION 'Top-course statement transition triggers missing';
  END IF;

  IF NOT (SELECT relrowsecurity
          FROM pg_class WHERE oid='internal.top_cursos_media_live'::regclass) THEN
    RAISE EXCEPTION 'Incremental top-course cache must have RLS';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='internal' AND tablename='top_cursos_media_live'
      AND policyname='top_cursos_read_own_school'
      AND qual LIKE '%auth.uid()%'
  ) THEN
    RAISE EXCEPTION 'Top-course per-tenant SELECT policy missing';
  END IF;

  -- Force daily-reconcile-equivalent queue work, but roll it all back at end.
  PERFORM internal.enqueue_top_cursos_reconciliation();

  FOR i IN 1..100 LOOP
    v_processed := internal.process_top_cursos_dirty(100);
    v_total := v_total + v_processed;
    EXIT WHEN v_processed = 0;
  END LOOP;

  IF EXISTS (SELECT 1 FROM internal.top_cursos_dirty) THEN
    RAISE EXCEPTION 'Incremental course queue failed to drain';
  END IF;

  WITH expected AS (
    SELECT n.escola_id,c.id AS curso_id,c.nome AS curso_nome,round(avg(n.valor),2) AS media
    FROM public.notas n
    JOIN public.avaliacoes a ON a.id=n.avaliacao_id
    JOIN public.turma_disciplinas td ON td.id=a.turma_disciplina_id
    JOIN public.curso_matriz cm ON cm.id=td.curso_matriz_id
    JOIN public.cursos c ON c.id=cm.curso_id
    WHERE n.valor IS NOT NULL
    GROUP BY n.escola_id,c.id,c.nome
  ), differences AS (
    (SELECT * FROM expected EXCEPT ALL SELECT * FROM internal.top_cursos_media_live)
    UNION ALL
    (SELECT * FROM internal.top_cursos_media_live EXCEPT ALL SELECT * FROM expected)
  )
  SELECT count(*) INTO v_diff FROM differences;

  IF v_diff > 0 THEN
    RAISE EXCEPTION 'Incremental course cache differs from canonical AVG query: %', v_diff;
  END IF;
END;
$verify$;

ROLLBACK;
