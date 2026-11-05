-- AUT-001/002/003: READ-ONLY production integrity certification.
-- Use with psql -X -v ON_ERROR_STOP=1 -f this_file; no student mutations.
BEGIN READ ONLY;
DO $$
DECLARE
  v_notes_total bigint;
  v_notes_bad bigint;
  v_tenant_bad bigint;
  v_exams_bad bigint;
  v_attendance_bad bigint;
BEGIN
  IF has_function_privilege('authenticated','public.transferir_matricula(uuid,uuid,uuid)','EXECUTE')
    OR has_function_privilege('anon','public.transferir_matricula(uuid,uuid,uuid)','EXECUTE') THEN
    RAISE EXCEPTION 'AUT-001 FAIL: unsafe legacy RPC still callable';
  END IF;
  IF NOT has_function_privilege('authenticated','public.transferir_aluno_turma(uuid,uuid,text)','EXECUTE')
    OR NOT has_function_privilege('authenticated','public.transferir_turma_em_lote(uuid,uuid,uuid,text)','EXECUTE') THEN
    RAISE EXCEPTION 'AUT-001 FAIL: supported transfer RPC unavailable';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgrelid='public.matriculas'::regclass
      AND tgname='trg_guard_turma_transfer_academic_evidence' AND tgenabled='O'
  ) THEN
    RAISE EXCEPTION 'AUT-001 FAIL: transfer academic evidence guard missing';
  END IF;
  -- Version 05000 is a strict schema/additive guard release gate.
  -- It must be installed before the application uses its preflight endpoint.
  IF to_regprocedure('public.turma_transfer_academic_evidence_v1(uuid)') IS NULL
     OR to_regprocedure('public.turma_transfer_has_secondary_evidence_v1(uuid,uuid,uuid,uuid,integer)') IS NULL
     OR NOT EXISTS (
       SELECT 1 FROM pg_trigger t
       WHERE t.tgrelid='public.matriculas'::regclass
         AND t.tgname='trg_guard_turma_transfer_secondary_evidence'
         AND t.tgenabled='O'
     ) THEN
    RAISE EXCEPTION 'AUT-001 FAIL: secondary academic gate missing';
  END IF;
  IF has_function_privilege(
       'anon','public.turma_transfer_academic_evidence_v1(uuid)','EXECUTE')
     OR has_function_privilege(
       'authenticated','public.turma_transfer_has_secondary_evidence_v1(uuid,uuid,uuid,uuid,integer)','EXECUTE')
     OR NOT has_function_privilege(
       'authenticated','public.turma_transfer_academic_evidence_v1(uuid)','EXECUTE') THEN
    RAISE EXCEPTION 'AUT-003 FAIL: preflight/guard function grants unsafe';
  END IF;
  SELECT count(*),
         count(*) FILTER (WHERE td.turma_id IS DISTINCT FROM m.turma_id),
         count(*) FILTER (WHERE n.escola_id IS DISTINCT FROM m.escola_id
           OR a.escola_id IS DISTINCT FROM m.escola_id
           OR td.escola_id IS DISTINCT FROM m.escola_id)
    INTO v_notes_total,v_notes_bad,v_tenant_bad
  FROM public.notas n
  JOIN public.matriculas m ON m.id=n.matricula_id
  JOIN public.avaliacoes a ON a.id=n.avaliacao_id
  JOIN public.turma_disciplinas td ON td.id=a.turma_disciplina_id;
  SELECT count(*) INTO v_exams_bad
  FROM public.exame_resultados er
  JOIN public.matriculas m ON m.id=er.matricula_id
  JOIN public.turma_disciplinas td ON td.id=er.turma_disciplina_id
  WHERE td.turma_id IS DISTINCT FROM m.turma_id
     OR er.escola_id IS DISTINCT FROM m.escola_id;
  SELECT count(*) INTO v_attendance_bad
  FROM public.frequencia_status_periodo fp
  JOIN public.matriculas m ON m.id=fp.matricula_id
  WHERE fp.turma_id IS DISTINCT FROM m.turma_id
     OR fp.escola_id IS DISTINCT FROM m.escola_id;
  RAISE NOTICE 'AUT-001 evidence snapshot: % notes; mismatches notes=%, tenant=%, exams=%, attendance=%',
    v_notes_total,v_notes_bad,v_tenant_bad,v_exams_bad,v_attendance_bad;
  IF v_notes_bad <> 0 OR v_tenant_bad <> 0
     OR v_exams_bad <> 0 OR v_attendance_bad <> 0 THEN
    RAISE EXCEPTION 'AUT-001 FAIL: historical evidence does not match enrollment origin';
  END IF;
END $$;
ROLLBACK;
