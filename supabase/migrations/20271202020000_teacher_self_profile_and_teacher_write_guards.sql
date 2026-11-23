-- Fix teacher edit independent of legacy public.professores rows.
-- A canonical public.teachers record and an active school membership suffice.
CREATE OR REPLACE FUNCTION public.update_teacher_details_atomic(
  p_escola_id uuid,
  p_profile_id uuid,
  p_details jsonb,
  p_skill_ids uuid[]
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_teacher_id uuid;
  v_nome text := pg_catalog.btrim(p_details ->> 'nome_completo');
  v_skill_ids uuid[] := COALESCE(p_skill_ids, ARRAY[]::uuid[]);
BEGIN
  IF auth.uid() IS NULL OR p_escola_id IS NULL OR p_profile_id IS NULL THEN
    RAISE EXCEPTION 'UPDATE_TEACHER_FORBIDDEN';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.escola_users eu
    WHERE eu.escola_id = p_escola_id AND eu.user_id = auth.uid()
      AND coalesce(eu.papel, eu.role) IN
        ('admin', 'admin_escola', 'admin_secretaria', 'admin_secretario', 'admin_financeiro', 'diretor', 'staff_admin', 'secretaria', 'secretaria_financeiro')
  ) THEN
    RAISE EXCEPTION 'UPDATE_TEACHER_FORBIDDEN';
  END IF;
  IF p_details IS NULL OR jsonb_typeof(p_details) <> 'object'
    OR v_nome IS NULL OR char_length(v_nome) < 3 OR char_length(v_nome) > 160
    OR cardinality(v_skill_ids) > 200 THEN
    RAISE EXCEPTION 'UPDATE_TEACHER_INVALID_INPUT';
  END IF;

  SELECT t.id INTO v_teacher_id
  FROM public.teachers t
  WHERE t.escola_id = p_escola_id AND t.profile_id = p_profile_id
    AND EXISTS (
      SELECT 1 FROM public.escola_users eu
      WHERE eu.escola_id = p_escola_id AND eu.user_id = p_profile_id
    )
  FOR UPDATE OF t;
  IF v_teacher_id IS NULL THEN
    RAISE EXCEPTION 'UPDATE_TEACHER_NOT_FOUND';
  END IF;

  IF (
    SELECT count(*) FROM public.disciplinas_catalogo d
    WHERE d.escola_id = p_escola_id AND d.id = ANY(v_skill_ids)
  ) <> cardinality(v_skill_ids) THEN
    RAISE EXCEPTION 'UPDATE_TEACHER_INVALID_SKILLS';
  END IF;

  UPDATE public.teachers SET
    nome_completo = v_nome,
    genero = p_details ->> 'genero',
    data_nascimento = nullif(p_details ->> 'data_nascimento', '')::date,
    numero_bi = nullif(p_details ->> 'numero_bi', ''),
    telefone_principal = nullif(p_details ->> 'telefone_principal', ''),
    habilitacoes = p_details ->> 'habilitacoes',
    area_formacao = nullif(p_details ->> 'area_formacao', ''),
    vinculo_contratual = p_details ->> 'vinculo_contratual',
    carga_horaria_maxima = (p_details ->> 'carga_horaria_maxima')::integer,
    turnos_disponiveis = ARRAY(
      SELECT jsonb_array_elements_text(COALESCE(p_details -> 'turnos_disponiveis', '[]'::jsonb))
    ),
    is_diretor_turma = COALESCE((p_details ->> 'is_diretor_turma')::boolean, false),
    updated_by = auth.uid()
  WHERE id = v_teacher_id AND escola_id = p_escola_id;

  -- profiles é global. Num docente de várias escolas, editar apenas o
  -- cadastro local de teachers para não modificar outra organização.
  IF NOT EXISTS (
    SELECT 1 FROM public.escola_users eu
    WHERE eu.user_id = p_profile_id AND eu.escola_id <> p_escola_id
  ) AND NOT EXISTS (
    SELECT 1 FROM public.professores p
    WHERE p.profile_id = p_profile_id AND p.escola_id <> p_escola_id
  ) AND NOT EXISTS (
    SELECT 1 FROM public.teachers t
    WHERE t.profile_id = p_profile_id AND t.escola_id <> p_escola_id
  ) THEN
    UPDATE public.profiles SET
      nome = v_nome,
      telefone = nullif(p_details ->> 'telefone_principal', '')
    WHERE user_id = p_profile_id;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'UPDATE_TEACHER_PROFILE_NOT_FOUND';
    END IF;
  END IF;

  DELETE FROM public.teacher_skills
  WHERE escola_id = p_escola_id AND teacher_id = v_teacher_id;

  INSERT INTO public.teacher_skills (escola_id, teacher_id, disciplina_id)
  SELECT p_escola_id, v_teacher_id, s.disciplina_id
  FROM pg_catalog.unnest(v_skill_ids) AS s(disciplina_id);
END;
$function$;

REVOKE ALL ON FUNCTION public.update_teacher_details_atomic(uuid,uuid,jsonb,uuid[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.update_teacher_details_atomic(uuid,uuid,jsonb,uuid[]) TO authenticated;

-- Professor: personal self-service only; contractual and academic management stays with school.
-- One RPC = one Postgres transaction across teachers + profiles. No direct teacher mutation by peers.
CREATE OR REPLACE FUNCTION public.update_teacher_self_contact_atomic(
  p_escola_id uuid,
  p_contact jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_teacher_id uuid;
  v_phone text;
  v_bio text;
  v_naturalidade text;
  v_provincia text;
BEGIN
  IF auth.uid() IS NULL OR p_escola_id IS NULL OR p_contact IS NULL
    OR pg_catalog.jsonb_typeof(p_contact) <> 'object'
    OR EXISTS (
      SELECT 1 FROM pg_catalog.jsonb_object_keys(p_contact) AS k(key)
      WHERE k.key NOT IN ('telefone_principal', 'bio', 'naturalidade', 'provincia')
    )
    OR NOT (p_contact ?& ARRAY['telefone_principal', 'bio', 'naturalidade', 'provincia']) THEN
    RAISE EXCEPTION 'TEACHER_SELF_INVALID_INPUT';
  END IF;

  v_phone := nullif(pg_catalog.btrim(p_contact ->> 'telefone_principal'), '');
  v_bio := nullif(pg_catalog.btrim(p_contact ->> 'bio'), '');
  v_naturalidade := nullif(pg_catalog.btrim(p_contact ->> 'naturalidade'), '');
  v_provincia := nullif(pg_catalog.btrim(p_contact ->> 'provincia'), '');
  IF pg_catalog.char_length(v_phone) > 40
    OR pg_catalog.char_length(v_bio) > 1000
    OR pg_catalog.char_length(v_naturalidade) > 120
    OR pg_catalog.char_length(v_provincia) > 120 THEN
    RAISE EXCEPTION 'TEACHER_SELF_INVALID_INPUT';
  END IF;

  SELECT t.id INTO v_teacher_id
  FROM public.teachers AS t
  WHERE t.escola_id = p_escola_id
    AND t.profile_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.escola_users AS eu
      WHERE eu.escola_id = p_escola_id AND eu.user_id = auth.uid()
    )
  FOR UPDATE OF t;
  IF v_teacher_id IS NULL THEN
    RAISE EXCEPTION 'TEACHER_SELF_FORBIDDEN';
  END IF;

  UPDATE public.teachers
  SET telefone_principal = v_phone, updated_by = auth.uid()
  WHERE id = v_teacher_id AND escola_id = p_escola_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'TEACHER_SELF_WRITE_FAILED'; END IF;

  UPDATE public.profiles
  SET telefone = v_phone,
      bio = v_bio,
      naturalidade = v_naturalidade,
      provincia = v_provincia,
      updated_by = auth.uid()
  WHERE user_id = auth.uid() AND deleted_at IS NULL;
  IF NOT FOUND THEN RAISE EXCEPTION 'TEACHER_SELF_PROFILE_NOT_FOUND'; END IF;

  RETURN pg_catalog.jsonb_build_object('teacher_id', v_teacher_id, 'profile_id', auth.uid());
END;
$function$;

REVOKE ALL ON FUNCTION public.update_teacher_self_contact_atomic(uuid,jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.update_teacher_self_contact_atomic(uuid,jsonb) TO authenticated;

-- Existing ALL policies authorized every member of a school to UPDATE/DELETE
-- any teacher or teacher skill. Replace with separate read and manager-write gates.
DO $do$
DECLARE
  v_table text;
  v_qualified text;
  v_manager text := $$escola_id = public.current_tenant_escola_id()
    AND EXISTS (
      SELECT 1 FROM public.escola_users eu
      WHERE eu.escola_id = public.current_tenant_escola_id() AND eu.user_id = (SELECT auth.uid())
        AND COALESCE(eu.papel, eu.role) IN
        ('admin','admin_escola','admin_secretaria','admin_secretario',
         'admin_financeiro','diretor','staff_admin','secretaria','secretaria_financeiro')
    )$$;
BEGIN
  FOREACH v_table IN ARRAY ARRAY['teachers','teacher_skills'] LOOP
    v_qualified := pg_catalog.format('public.%I', v_table);
    EXECUTE pg_catalog.format('DROP POLICY IF EXISTS %I ON %s', v_table || '_tenant_isolation', v_qualified);
    EXECUTE pg_catalog.format('DROP POLICY IF EXISTS %I ON %s', v_table || '_read_tenant', v_qualified);
    EXECUTE pg_catalog.format('DROP POLICY IF EXISTS %I ON %s', v_table || '_manager_write', v_qualified);
    EXECUTE pg_catalog.format('CREATE POLICY %I ON %s FOR SELECT TO authenticated USING (escola_id = public.current_tenant_escola_id())', v_table || '_read_tenant', v_qualified);
    EXECUTE pg_catalog.format('CREATE POLICY %I ON %s FOR ALL TO authenticated USING (%s) WITH CHECK (%s)', v_table || '_manager_write', v_qualified, v_manager, v_manager);
    EXECUTE pg_catalog.format('REVOKE ALL PRIVILEGES ON TABLE %s FROM anon', v_qualified);
  END LOOP;
END;
$do$;

-- A profile is globally scoped. A teacher must not be able to promote their
-- own role or rewrite identity/auth columns through a direct PostgREST UPDATE.
-- Preserve pre-existing workflows for profiles that are not teachers.
CREATE OR REPLACE FUNCTION public.guard_teacher_profile_identity_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
BEGIN
  IF COALESCE(pg_catalog.current_setting('request.jwt.claim.role', true), '') <> 'authenticated' OR NOT EXISTS (
    SELECT 1 FROM public.teachers t WHERE t.profile_id = OLD.user_id
  ) THEN
    RETURN NEW;
  END IF;

  -- Teachers may only self-edit the published personal profile fields.
  -- DB-managed audit timestamps and school selection are exempted separately.
  IF auth.uid() = OLD.user_id
    AND (pg_catalog.to_jsonb(NEW) - ARRAY[
      'telefone','bio','naturalidade','provincia','avatar_url',
      'updated_at','updated_by','current_escola_id'
    ]) IS DISTINCT FROM (pg_catalog.to_jsonb(OLD) - ARRAY[
      'telefone','bio','naturalidade','provincia','avatar_url',
      'updated_at','updated_by','current_escola_id'
    ]) THEN
    RAISE EXCEPTION 'TEACHER_SELF_PROFILE_FIELD_FORBIDDEN';
  END IF;

  IF NEW.user_id IS DISTINCT FROM OLD.user_id
    OR NEW.escola_id IS DISTINCT FROM OLD.escola_id
    OR NEW.global_role IS DISTINCT FROM OLD.global_role
    OR NEW.email IS DISTINCT FROM OLD.email
    OR NEW.email_auth IS DISTINCT FROM OLD.email_auth
    OR NEW.email_real IS DISTINCT FROM OLD.email_real
    OR NEW.numero_login IS DISTINCT FROM OLD.numero_login
    OR NEW.numero_processo_login IS DISTINCT FROM OLD.numero_processo_login
    OR NEW.deleted_at IS DISTINCT FROM OLD.deleted_at THEN
    RAISE EXCEPTION 'TEACHER_IDENTITY_WRITE_FORBIDDEN';
  END IF;

  -- Role/identity changes must use a separately authorized, privileged path;
  -- even a manager must not self-promote using profiles.update under self RLS.
  IF NEW.role IS DISTINCT FROM OLD.role THEN
    RAISE EXCEPTION 'TEACHER_ROLE_WRITE_FORBIDDEN';
  END IF;

  IF NEW.current_escola_id IS DISTINCT FROM OLD.current_escola_id
    AND NEW.current_escola_id IS NOT NULL AND NOT EXISTS (
      SELECT 1 FROM public.escola_users eu
      WHERE eu.escola_id = NEW.current_escola_id AND eu.user_id = OLD.user_id
    ) THEN
    RAISE EXCEPTION 'TEACHER_SCHOOL_SWITCH_FORBIDDEN';
  END IF;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_guard_teacher_profile_identity_update ON public.profiles;
CREATE TRIGGER trg_guard_teacher_profile_identity_update
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.guard_teacher_profile_identity_update();

REVOKE ALL ON FUNCTION public.guard_teacher_profile_identity_update() FROM PUBLIC, anon, authenticated;
