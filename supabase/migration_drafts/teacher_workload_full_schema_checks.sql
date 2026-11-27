\set ON_ERROR_STOP on
BEGIN;
-- Incremental security contract: run after applying the new migration to a disposable academic fixture.
-- These RLS policies are a synthetic tenant-scoped fixture, NOT a reproduction of the installed policies.
ALTER TABLE public.teachers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.turmas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.turma_disciplinas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.turma_disciplinas_professores ENABLE ROW LEVEL SECURITY;
CREATE POLICY fixture_teacher_scope ON public.teachers FOR ALL TO authenticated USING (escola_id=public.current_tenant_escola_id()) WITH CHECK (escola_id=public.current_tenant_escola_id());
CREATE POLICY fixture_turma_scope ON public.turmas FOR ALL TO authenticated USING (escola_id=public.current_tenant_escola_id()) WITH CHECK (escola_id=public.current_tenant_escola_id());
CREATE POLICY fixture_td_scope ON public.turma_disciplinas FOR ALL TO authenticated USING (escola_id=public.current_tenant_escola_id()) WITH CHECK (escola_id=public.current_tenant_escola_id());
CREATE POLICY fixture_tdp_scope ON public.turma_disciplinas_professores FOR ALL TO authenticated USING (escola_id=public.current_tenant_escola_id()) WITH CHECK (escola_id=public.current_tenant_escola_id());
GRANT USAGE ON SCHEMA auth,public TO authenticated;
GRANT SELECT,UPDATE ON public.teachers,public.turmas,public.turma_disciplinas,public.turma_disciplinas_professores TO authenticated;
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
  'public.apply_teacher_workload_internal(uuid,uuid,text,integer,integer)',
  'public.create_or_update_professor_academico(uuid,uuid,jsonb,jsonb,uuid[])',
  'public.update_teacher_details_atomic(uuid,uuid,jsonb,uuid[])'
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
-- Real authenticated role: direct edits of new configuration fail, while
-- authorized RPC changes succeed and cross-tenant RPC calls fail.
INSERT INTO public.escola_users(escola_id,user_id,papel,role) VALUES
 ('10000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000001','secretaria','staff'),
 ('10000000-0000-0000-0000-000000000002','20000000-0000-0000-0000-000000000002','secretaria','staff');
INSERT INTO public.profiles(user_id,nome) VALUES
 ('30000000-0000-0000-0000-000000000001','Docente A'),('30000000-0000-0000-0000-000000000002','Docente B');
INSERT INTO public.professores(id,escola_id,profile_id) VALUES
 ('40000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000001','30000000-0000-0000-0000-000000000001'),
 ('40000000-0000-0000-0000-000000000002','10000000-0000-0000-0000-000000000002','30000000-0000-0000-0000-000000000002');
INSERT INTO public.teachers(escola_id,profile_id,nome_completo,carga_horaria_maxima) VALUES
 ('10000000-0000-0000-0000-000000000001','30000000-0000-0000-0000-000000000001','Docente A',20),
 ('10000000-0000-0000-0000-000000000002','30000000-0000-0000-0000-000000000002','Docente B',20);
SELECT set_config('app.test_uid','20000000-0000-0000-0000-000000000001',true);
SELECT set_config('app.test_school','10000000-0000-0000-0000-000000000001',true);
SET LOCAL ROLE authenticated;
DO $role_test$
DECLARE n integer;
BEGIN
 BEGIN
  UPDATE public.teachers SET carga_lectiva_limite_minutos=1200 WHERE profile_id='30000000-0000-0000-0000-000000000001';
  RAISE EXCEPTION 'DIRECT_CONFIG_WAS_ALLOWED';
 EXCEPTION WHEN OTHERS THEN IF SQLERRM<>'TEACHER_CONFIG_RPC_REQUIRED' THEN RAISE; END IF; END;
 UPDATE public.teachers SET carga_lectiva_limite_minutos=1200 WHERE profile_id='30000000-0000-0000-0000-000000000002';
 GET DIAGNOSTICS n=ROW_COUNT;
 IF n<>0 THEN RAISE EXCEPTION 'CROSS_TENANT_UPDATE_ALLOWED'; END IF;
 PERFORM public.configure_teacher_workload_atomic('10000000-0000-0000-0000-000000000001','40000000-0000-0000-0000-000000000001','minutos',1200,1800);
 IF NOT EXISTS(SELECT 1 FROM public.teachers WHERE profile_id='30000000-0000-0000-0000-000000000001' AND carga_lectiva_limite_minutos=1200 AND carga_contratual_minutos=1800 AND carga_horaria_maxima=20) THEN RAISE EXCEPTION 'AUTHORIZED_CONFIG_FAILED'; END IF;
 BEGIN
  PERFORM public.configure_teacher_workload_atomic('10000000-0000-0000-0000-000000000002','40000000-0000-0000-0000-000000000002','minutos',1200,1800);
  RAISE EXCEPTION 'CROSS_TENANT_RPC_ALLOWED';
 EXCEPTION WHEN OTHERS THEN IF SQLERRM<>'TEACHER_LOAD_FORBIDDEN' THEN RAISE; END IF; END;
END $role_test$;
RESET ROLE;
ROLLBACK;
