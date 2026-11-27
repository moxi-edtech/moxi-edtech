\set ON_ERROR_STOP on
BEGIN;
-- Run only after complete migration replay on the isolated local Supabase stack.
DO $$
DECLARE fn text; rel text;
BEGIN
 IF current_setting('server_version_num')::integer NOT BETWEEN 170000 AND 179999 THEN RAISE EXCEPTION 'POSTGRES_17_REQUIRED'; END IF;
 FOREACH rel IN ARRAY ARRAY['teachers','turmas','turma_disciplinas','turma_disciplinas_professores'] LOOP
   IF NOT EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relname=rel AND c.relrowsecurity) THEN RAISE EXCEPTION 'RLS_MISSING: %',rel; END IF;
 END LOOP;
 FOREACH fn IN ARRAY ARRAY[
  'public.configure_teacher_workload_atomic(uuid,uuid,text,integer,integer)',
  'public.assign_teacher_regime_atomic(uuid,uuid,text,uuid,uuid[])',
  'public.replace_teacher_titular_atomic(uuid,uuid,uuid,uuid)',
  'public.get_teacher_workloads_by_profiles(uuid,uuid[])',
  'public.apply_teacher_workload_internal(uuid,uuid,text,integer,integer)'
 ] LOOP
  IF to_regprocedure(fn) IS NULL OR has_function_privilege('anon',fn,'EXECUTE') THEN RAISE EXCEPTION 'RPC_MISSING_OR_ANON_EXECUTE: %',fn; END IF;
 END LOOP;
 IF has_function_privilege('authenticated','public.apply_teacher_workload_internal(uuid,uuid,text,integer,integer)','EXECUTE') THEN RAISE EXCEPTION 'INTERNAL_RPC_EXPOSED'; END IF;
 IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid='public.turmas'::regclass AND conname='turmas_docencia_titular_fk' AND convalidated) THEN RAISE EXCEPTION 'TITULAR_TENANT_FK_MISSING'; END IF;
 IF EXISTS(SELECT 1 FROM public.teachers WHERE carga_lectiva_limite_minutos IS NOT NULL AND carga_contratual_minutos IS NOT NULL AND carga_lectiva_limite_minutos>carga_contratual_minutos) THEN RAISE EXCEPTION 'CONTRACT_LIMIT_INVALID'; END IF;
 IF NOT EXISTS(SELECT 1 FROM pg_trigger WHERE tgrelid='public.turma_disciplinas'::regclass AND tgname='trg_guard_mono_td' AND tgenabled='O') THEN RAISE EXCEPTION 'CANONICAL_GUARD_MISSING'; END IF;
 IF NOT EXISTS(SELECT 1 FROM pg_trigger WHERE tgrelid='public.turma_disciplinas_professores'::regclass AND tgname='trg_guard_mono_tdp' AND tgenabled='O') THEN RAISE EXCEPTION 'SHARED_GUARD_MISSING'; END IF;
END $$;
-- No authenticated identity, no privileged write/read. No actual data changes.
DO $$ BEGIN
 BEGIN
  PERFORM public.configure_teacher_workload_atomic(gen_random_uuid(),gen_random_uuid(),'minutos',1200,NULL);
  RAISE EXCEPTION 'EXPECTED_AUTH_FAILURE';
 EXCEPTION WHEN OTHERS THEN IF SQLERRM<>'TEACHER_LOAD_FORBIDDEN' THEN RAISE; END IF; END;
 BEGIN
  PERFORM public.assign_teacher_regime_atomic(gen_random_uuid(),gen_random_uuid(),'monodocencia',gen_random_uuid(),NULL);
  RAISE EXCEPTION 'EXPECTED_AUTH_FAILURE';
 EXCEPTION WHEN OTHERS THEN IF SQLERRM<>'TEACHER_REGIME_FORBIDDEN' THEN RAISE; END IF; END;
END $$;
ROLLBACK;
