-- Read-only production readiness audit. No student data, writes or DDL.
BEGIN TRANSACTION READ ONLY;
WITH published AS (
  SELECT q.id,q.escola_id,q.turma_id,q.professor_id,q.sala_id,q.slot_id,
         t.ano_letivo_id,t.turno,t.status_validacao,a.ativo,
         s.id AS found_slot,s.turno_id,s.is_intervalo,s.dia_semana,s.inicio,s.fim
  FROM public.quadro_horarios q
  JOIN public.horario_versoes v ON v.id=q.versao_id AND v.escola_id=q.escola_id
    AND v.turma_id=q.turma_id AND v.status='publicada'
  JOIN public.turmas t ON t.id=q.turma_id AND t.escola_id=q.escola_id
  LEFT JOIN public.anos_letivos a ON a.id=t.ano_letivo_id AND a.escola_id=t.escola_id
  LEFT JOIN public.horario_slots s ON s.id=q.slot_id AND s.escola_id=q.escola_id
), active AS (SELECT * FROM published WHERE ativo AND status_validacao='ativo'),
bad AS (
  SELECT * FROM active WHERE found_slot IS NULL OR coalesce(is_intervalo,false)
    OR turno_id IS DISTINCT FROM CASE upper(turno)
      WHEN 'M' THEN 'matinal' WHEN 'T' THEN 'tarde' WHEN 'N' THEN 'noite' END
)
SELECT (SELECT count(*) FROM published) AS published_lessons,
       (SELECT count(*) FROM active) AS active_lessons,
       (SELECT count(*) FROM bad) AS invalid_slots,
       (SELECT count(DISTINCT turma_id) FROM bad) AS affected_classes,
       (SELECT count(*) FROM active a JOIN active b
        ON a.escola_id=b.escola_id AND a.ano_letivo_id=b.ano_letivo_id
        AND a.id<b.id AND a.dia_semana=b.dia_semana
        AND a.inicio<b.fim AND b.inicio<a.fim
        AND (a.turma_id=b.turma_id OR a.professor_id=b.professor_id OR a.sala_id=b.sala_id))
        AS active_conflict_pairs;
SELECT p.proname,p.prosecdef AS security_definer,
       has_function_privilege('anon',p.oid,'EXECUTE') AS anon_execute,
       has_function_privilege('authenticated',p.oid,'EXECUTE') AS authenticated_execute,
       position('pg_advisory_xact_lock' IN p.prosrc)>0 AS advisory_lock_reference,
       position('HORARIO_STALE' IN p.prosrc)>0 AS stale_guard_reference
FROM pg_proc p WHERE p.pronamespace='public'::regnamespace
  AND p.proname IN ('ensure_horario_versao','publish_horario_versao',
    'upsert_quadro_horarios_versao_atomic','log_horario_event',
    'trg_validate_quadro_published_conflicts','trg_horario_publication_guard')
ORDER BY p.proname;
SELECT c.relname AS table_name,t.tgname
FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid
WHERE c.relnamespace='public'::regnamespace
  AND c.relname IN ('horario_versoes','quadro_horarios','horario_slots')
  AND NOT t.tgisinternal ORDER BY c.relname,t.tgname;
COMMIT;
