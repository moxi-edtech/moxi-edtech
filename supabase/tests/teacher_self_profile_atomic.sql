-- Disposable RLS and atomic write regression test. Run against a scratch database with psql -X -v ON_ERROR_STOP=1 -f.
-- All DDL and seed rows are rolled back; no fixture survives.
\set ON_ERROR_STOP on
BEGIN;
CREATE SCHEMA auth;
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $x$ SELECT NULLIF(current_setting('test.auth_uid', true),'')::uuid $x$;
CREATE FUNCTION public.current_tenant_escola_id() RETURNS uuid LANGUAGE sql STABLE AS $x$ SELECT NULLIF(current_setting('test.school_id',true),'')::uuid $x$;
CREATE TABLE public.escola_users (escola_id uuid, user_id uuid, papel text, role text);
CREATE TABLE public.professores (escola_id uuid, profile_id uuid);
CREATE TABLE public.disciplinas_catalogo (id uuid, escola_id uuid);
CREATE TABLE public.teachers (
  id uuid PRIMARY KEY, escola_id uuid, profile_id uuid, telefone_principal text, updated_by uuid,
  carga_horaria_maxima int, nome_completo text, genero text, data_nascimento date, numero_bi text,
  habilitacoes text, area_formacao text, vinculo_contratual text, turnos_disponiveis text[],
  is_diretor_turma boolean
);
CREATE TABLE public.teacher_skills (escola_id uuid, teacher_id uuid, disciplina_id uuid);
CREATE TABLE public.profiles (user_id uuid PRIMARY KEY, telefone text, bio text, naturalidade text, provincia text, updated_by uuid, deleted_at timestamptz, role text, global_role text, email text, email_auth text, email_real text, numero_login text, numero_processo_login text, escola_id uuid, current_escola_id uuid, updated_at timestamptz, avatar_url text, nome text);
ALTER TABLE public.teachers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.teacher_skills ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY teachers_tenant_isolation ON public.teachers FOR ALL TO PUBLIC USING (escola_id = current_tenant_escola_id()) WITH CHECK (escola_id = current_tenant_escola_id());
CREATE POLICY teacher_skills_tenant_isolation ON public.teacher_skills FOR ALL TO PUBLIC USING (escola_id = current_tenant_escola_id()) WITH CHECK (escola_id = current_tenant_escola_id());
CREATE POLICY profile_owner ON public.profiles FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY profile_tenant_read ON public.profiles FOR SELECT TO authenticated USING (escola_id = current_tenant_escola_id());
GRANT USAGE ON SCHEMA public,auth TO authenticated;
GRANT SELECT ON public.escola_users TO authenticated;
GRANT SELECT,INSERT,UPDATE,DELETE ON public.teachers,public.teacher_skills TO authenticated;
GRANT ALL ON public.teachers,public.teacher_skills TO anon;
GRANT SELECT,UPDATE ON public.profiles TO authenticated;
INSERT INTO public.escola_users VALUES
('11111111-1111-1111-1111-111111111111','44444444-4444-4444-4444-444444444444','professor','professor'),
('11111111-1111-1111-1111-111111111111','55555555-5555-5555-5555-555555555555','admin','admin');
INSERT INTO public.teachers VALUES ('33333333-3333-3333-3333-333333333333','11111111-1111-1111-1111-111111111111','44444444-4444-4444-4444-444444444444',NULL,NULL,24);
INSERT INTO public.profiles(user_id,role,escola_id,email,global_role) VALUES ('44444444-4444-4444-4444-444444444444','professor','11111111-1111-1111-1111-111111111111','professor@example.com','professor');
\ir ../migrations/20271202020000_teacher_self_profile_and_teacher_write_guards.sql
SET LOCAL ROLE authenticated;
SELECT set_config('test.auth_uid','44444444-4444-4444-4444-444444444444',true);
SELECT set_config('test.school_id','11111111-1111-1111-1111-111111111111',true);
SELECT set_config('request.jwt.claim.role','authenticated',true);
-- Teacher authorized self-contact write, atomic across both tables
SELECT public.update_teacher_self_contact_atomic('11111111-1111-1111-1111-111111111111', '{"telefone_principal":"+244 900 000 000","bio":"Professor piloto","naturalidade":"Luanda","provincia":"Luanda"}'::jsonb);
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.teachers WHERE telefone_principal = '+244 900 000 000') THEN RAISE EXCEPTION 'FAIL: teachers phone not persisted'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE telefone = '+244 900 000 000' AND bio='Professor piloto') THEN RAISE EXCEPTION 'FAIL: profiles mirror not persisted'; END IF;
END $$;
-- Unprivileged direct update must affect zero rows
DO $$ DECLARE v_count int; BEGIN
  UPDATE public.teachers SET carga_horaria_maxima=100 WHERE id='33333333-3333-3333-3333-333333333333';
  GET DIAGNOSTICS v_count = ROW_COUNT;
  IF v_count <> 0 THEN RAISE EXCEPTION 'FAIL: professor may change contractual load'; END IF;
END $$;
DO $$ BEGIN
  BEGIN
    UPDATE public.profiles SET role='admin' WHERE user_id='44444444-4444-4444-4444-444444444444';
    RAISE EXCEPTION 'FAIL: self-role escalation was allowed';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM NOT LIKE 'TEACHER_%FORBIDDEN' THEN RAISE; END IF;
  END;
END $$;
-- Should reject extraneous fields even if caller owns teacher
DO $$ BEGIN
  BEGIN
    PERFORM public.update_teacher_self_contact_atomic('11111111-1111-1111-1111-111111111111', '{"telefone_principal":"1","bio":null,"naturalidade":null,"provincia":null,"role":"admin"}'::jsonb);
    RAISE EXCEPTION 'FAIL: arbitrary field accepted';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM <> 'TEACHER_SELF_INVALID_INPUT' THEN RAISE; END IF;
  END;
END $$;
DO $$ BEGIN
  BEGIN
    PERFORM public.update_teacher_self_contact_atomic('22222222-2222-2222-2222-222222222222', '{"telefone_principal":"1","bio":null,"naturalidade":null,"provincia":null}'::jsonb);
    RAISE EXCEPTION 'FAIL: cross-tenant self-update allowed';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM <> 'TEACHER_SELF_FORBIDDEN' THEN RAISE; END IF;
  END;
END $$;
-- Manager writes to school-scoped teacher row succeed
SELECT set_config('test.auth_uid','55555555-5555-5555-5555-555555555555',true);
DO $$ DECLARE v_count int; BEGIN
  UPDATE public.teachers SET carga_horaria_maxima=30 WHERE id='33333333-3333-3333-3333-333333333333';
  GET DIAGNOSTICS v_count = ROW_COUNT;
  IF v_count <> 1 THEN RAISE EXCEPTION 'FAIL: manager cannot write'; END IF;
END $$;
-- Manager can edit a canonical teacher with NO legacy professores row.
SELECT public.update_teacher_details_atomic(
  '11111111-1111-1111-1111-111111111111',
  '44444444-4444-4444-4444-444444444444',
  '{"nome_completo":"Professor Atualizado","genero":"M","data_nascimento":null,"numero_bi":null,"telefone_principal":"+244 922 000 000","habilitacoes":"Licenciatura","area_formacao":"Educação","vinculo_contratual":"Efetivo","carga_horaria_maxima":28,"turnos_disponiveis":["Manhã"],"is_diretor_turma":false}'::jsonb,
  ARRAY[]::uuid[]
);
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.teachers WHERE nome_completo='Professor Atualizado' AND carga_horaria_maxima=28)
    OR NOT EXISTS (SELECT 1 FROM public.profiles WHERE nome='Professor Atualizado' AND telefone='+244 922 000 000')
  THEN RAISE EXCEPTION 'FAIL: canonical manager edit did not persist across teachers and profiles'; END IF;
END $$;
RESET ROLE;
DO $$ BEGIN
  IF has_table_privilege('anon', 'public.teachers', 'UPDATE')
     OR has_table_privilege('anon', 'public.teacher_skills', 'DELETE')
     OR has_function_privilege('anon', 'public.update_teacher_self_contact_atomic(uuid,jsonb)', 'EXECUTE')
  THEN RAISE EXCEPTION 'FAIL: anonymous write privilege retained'; END IF;
END $$;
SELECT 'PASS: self-service, management update, tenant RLS, no anon grants and role guard' AS result;
ROLLBACK;
