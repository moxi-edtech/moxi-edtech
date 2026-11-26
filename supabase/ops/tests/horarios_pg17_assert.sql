\set ON_ERROR_STOP on
SELECT set_config('request.jwt.claim.role','authenticated',false),set_config('request.jwt.claim.sub',fixture_id(100)::text,false);
DO $$
BEGIN
  -- Saving a draft must not replace the current publication.
  PERFORM public.upsert_quadro_horarios_versao_atomic(fixture_id(1),fixture_id(20),fixture_id(81),fixture_item(70,90,91),false);
  IF (SELECT status FROM public.horario_versoes WHERE id=fixture_id(80)) <> 'publicada' THEN RAISE EXCEPTION 'draft altered published version'; END IF;
  IF (SELECT count(*) FROM public.quadro_horarios WHERE versao_id=fixture_id(80))<>1 THEN RAISE EXCEPTION 'draft altered published rows'; END IF;
  BEGIN
    PERFORM public.upsert_quadro_horarios_versao_atomic(fixture_id(1),fixture_id(20),fixture_id(80),fixture_item(70),false);
    RAISE EXCEPTION 'published version was writable';
  EXCEPTION WHEN check_violation THEN IF SQLERRM NOT LIKE 'HORARIO_STALE:%' THEN RAISE; END IF; END;
  -- Same room/teacher in historical year is permitted.
  PERFORM public.upsert_quadro_horarios_versao_atomic(fixture_id(1),fixture_id(20),fixture_id(81),fixture_item(70,90,91),true);
  IF (SELECT status FROM public.horario_versoes WHERE id=fixture_id(80)) <> 'arquivada' THEN RAISE EXCEPTION 'old version not archived'; END IF;
  IF (SELECT status FROM public.horario_versoes WHERE id=fixture_id(83)) <> 'publicada' THEN RAISE EXCEPTION 'historical version modified'; END IF;
  -- Real overlapping time in different shifts must be rejected atomically.
  BEGIN
    PERFORM public.upsert_quadro_horarios_versao_atomic(fixture_id(1),fixture_id(21),fixture_id(82),fixture_item(71,90,91),true);
    RAISE EXCEPTION 'overlap accepted';
  EXCEPTION WHEN check_violation THEN IF SQLERRM NOT LIKE 'HORARIO_CONFLICT:%' THEN RAISE; END IF; END;
  IF EXISTS(SELECT 1 FROM public.quadro_horarios WHERE versao_id=fixture_id(82)) THEN RAISE EXCEPTION 'failed publish persisted rows'; END IF;
  BEGIN
    PERFORM public.upsert_quadro_horarios_versao_atomic(fixture_id(1),fixture_id(24),fixture_id(85),fixture_item(73),true);
    RAISE EXCEPTION 'interval accepted';
  EXCEPTION WHEN check_violation THEN IF SQLERRM <> 'HORARIO_INVALID_CURRICULUM_OR_SLOT' THEN RAISE; END IF; END;
  BEGIN
    PERFORM public.upsert_quadro_horarios_versao_atomic(fixture_id(1),fixture_id(24),fixture_id(85),fixture_item(74,NULL,NULL,999),true);
    RAISE EXCEPTION 'foreign discipline accepted';
  EXCEPTION WHEN check_violation THEN IF SQLERRM <> 'HORARIO_INVALID_CURRICULUM_OR_SLOT' THEN RAISE; END IF; END;
  -- Adjacent time, without curriculum load settings, is allowed.
  PERFORM public.upsert_quadro_horarios_versao_atomic(fixture_id(1),fixture_id(21),fixture_id(82),fixture_item(72,90,91),true);
  PERFORM public.upsert_quadro_horarios_versao_atomic(fixture_id(1),fixture_id(24),fixture_id(85),fixture_item(74),true);
  BEGIN
    PERFORM public.upsert_quadro_horarios_versao_atomic(fixture_id(2),fixture_id(23),fixture_id(84),fixture_item(75,NULL,NULL,61),true);
    RAISE EXCEPTION 'cross tenant admin accepted';
  EXCEPTION WHEN insufficient_privilege THEN IF SQLERRM <> 'HORARIO_UPSERT_FORBIDDEN' THEN RAISE; END IF; END;
  PERFORM set_config('request.jwt.claim.sub',fixture_id(102)::text,false);
  BEGIN
    PERFORM public.upsert_quadro_horarios_versao_atomic(fixture_id(1),fixture_id(20),fixture_id(81),fixture_item(70),false);
    RAISE EXCEPTION 'student write accepted';
  EXCEPTION WHEN insufficient_privilege THEN IF SQLERRM <> 'HORARIO_UPSERT_FORBIDDEN' THEN RAISE; END IF; END;
END $$;
SELECT 'PASS: draft, historical, overlap, rollback, interval, curriculum, adjacent, optional resources and authorization' AS result;

DO $$ BEGIN
  IF (SELECT slot_id FROM public.quadro_horarios WHERE versao_id=fixture_id(88))<>fixture_id(76)
     OR (SELECT count(*) FROM public.audit_logs WHERE action='HORARIO_SLOT_RELINK')<>1
  THEN RAISE EXCEPTION 'exact slot repair failed'; END IF;
  IF has_function_privilege('anon','public.ensure_horario_versao(uuid,uuid,uuid,text)','EXECUTE')
     OR has_function_privilege('authenticated','public.publish_horario_versao(uuid,uuid,uuid)','EXECUTE')
     OR has_function_privilege('authenticated','public.log_horario_event(uuid,uuid,uuid,text,jsonb)','EXECUTE')
     OR has_table_privilege('authenticated','public.horario_eventos','INSERT')
     OR has_table_privilege('authenticated','public.quadro_horarios','TRUNCATE')
  THEN RAISE EXCEPTION 'direct writer bypass'; END IF;
END $$;
SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub',fixture_id(100)::text,false);
DO $$ BEGIN
  BEGIN UPDATE public.horario_versoes SET status='arquivada' WHERE id=fixture_id(81); RAISE EXCEPTION 'direct archive allowed'; EXCEPTION WHEN check_violation THEN NULL; END;
  BEGIN DELETE FROM public.quadro_horarios WHERE versao_id=fixture_id(81); RAISE EXCEPTION 'direct delete allowed'; EXCEPTION WHEN check_violation THEN NULL; END;
  BEGIN UPDATE public.horario_slots SET inicio='07:50' WHERE id=fixture_id(76); RAISE EXCEPTION 'shared slot mutation allowed'; EXCEPTION WHEN check_violation THEN NULL; END;
  BEGIN PERFORM public.ensure_horario_versao(fixture_id(2),fixture_id(23),NULL,'draft'); RAISE EXCEPTION 'cross-school draft allowed'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  BEGIN PERFORM public.log_horario_event(fixture_id(1),fixture_id(20),fixture_id(81),'PUBLISH','{}'); RAISE EXCEPTION 'fake event allowed'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  IF public.ensure_horario_versao(fixture_id(1),fixture_id(20),NULL,'draft') IS NULL THEN RAISE EXCEPTION 'admin draft failed'; END IF;
END $$;
RESET ROLE;
