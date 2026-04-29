BEGIN;

-- Canonicaliza formadores antigos que existiam apenas no Auth metadata.
-- A partir deste ponto, selectores operacionais usam escola_users.papel='formador'.
WITH auth_formadores_raw AS (
  SELECT
    u.id AS user_id,
    lower(NULLIF(u.email, '')) AS email,
    NULLIF(
      btrim(
        COALESCE(
          u.raw_user_meta_data ->> 'nome',
          u.raw_user_meta_data ->> 'full_name',
          u.email,
          'Formador'
        )
      ),
      ''
    ) AS nome,
    lower(NULLIF(COALESCE(u.raw_app_meta_data ->> 'role', u.raw_user_meta_data ->> 'role'), '')) AS role,
    lower(NULLIF(COALESCE(u.raw_app_meta_data ->> 'tenant_type', u.raw_user_meta_data ->> 'tenant_type'), '')) AS tenant_type,
    NULLIF(COALESCE(u.raw_app_meta_data ->> 'escola_id', u.raw_user_meta_data ->> 'escola_id'), '') AS escola_id_raw
  FROM auth.users u
),
auth_formadores AS (
  SELECT
    user_id,
    email,
    COALESCE(nome, email, 'Formador') AS nome,
    escola_id_raw::uuid AS escola_id
  FROM auth_formadores_raw
  WHERE role IN ('formador', 'formacao_formador')
    AND (tenant_type IS NULL OR tenant_type = 'formacao')
    AND escola_id_raw ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
),
valid_formadores AS (
  SELECT af.*
  FROM auth_formadores af
  JOIN public.escolas e ON e.id = af.escola_id
  WHERE e.tenant_type = 'formacao'
)
INSERT INTO public.escola_users (
  escola_id,
  user_id,
  papel,
  tenant_type
)
SELECT
  escola_id,
  user_id,
  'formador',
  'formacao'
FROM valid_formadores
ON CONFLICT (escola_id, user_id) DO UPDATE
SET
  papel = EXCLUDED.papel,
  tenant_type = EXCLUDED.tenant_type;

WITH auth_formadores_raw AS (
  SELECT
    u.id AS user_id,
    lower(NULLIF(u.email, '')) AS email,
    NULLIF(
      btrim(
        COALESCE(
          u.raw_user_meta_data ->> 'nome',
          u.raw_user_meta_data ->> 'full_name',
          u.email,
          'Formador'
        )
      ),
      ''
    ) AS nome,
    lower(NULLIF(COALESCE(u.raw_app_meta_data ->> 'role', u.raw_user_meta_data ->> 'role'), '')) AS role,
    lower(NULLIF(COALESCE(u.raw_app_meta_data ->> 'tenant_type', u.raw_user_meta_data ->> 'tenant_type'), '')) AS tenant_type,
    NULLIF(COALESCE(u.raw_app_meta_data ->> 'escola_id', u.raw_user_meta_data ->> 'escola_id'), '') AS escola_id_raw
  FROM auth.users u
),
auth_formadores AS (
  SELECT
    user_id,
    email,
    COALESCE(nome, email, 'Formador') AS nome,
    escola_id_raw::uuid AS escola_id
  FROM auth_formadores_raw
  WHERE role IN ('formador', 'formacao_formador')
    AND (tenant_type IS NULL OR tenant_type = 'formacao')
    AND escola_id_raw ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
),
valid_formadores AS (
  SELECT af.*
  FROM auth_formadores af
  JOIN public.escolas e ON e.id = af.escola_id
  WHERE e.tenant_type = 'formacao'
)
INSERT INTO public.profiles (
  user_id,
  email,
  nome,
  role,
  escola_id,
  current_escola_id
)
SELECT
  user_id,
  email,
  nome,
  'formador'::public.user_role,
  escola_id,
  escola_id
FROM valid_formadores
ON CONFLICT (user_id) DO UPDATE
SET
  email = COALESCE(public.profiles.email, EXCLUDED.email),
  nome = COALESCE(NULLIF(public.profiles.nome, ''), EXCLUDED.nome),
  role = 'formador'::public.user_role,
  escola_id = EXCLUDED.escola_id,
  current_escola_id = EXCLUDED.current_escola_id,
  updated_at = now();

CREATE OR REPLACE FUNCTION public.require_formacao_formador_membership()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM public.escola_users eu
    WHERE eu.escola_id = NEW.escola_id
      AND eu.user_id = NEW.formador_user_id
      AND eu.tenant_type = 'formacao'
      AND eu.papel = 'formador'
  ) THEN
    RAISE EXCEPTION 'formador_user_id inválido para este centro'
      USING ERRCODE = '23514';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_require_formacao_formador_membership_cohort
  ON public.formacao_cohort_formadores;

CREATE TRIGGER trg_require_formacao_formador_membership_cohort
BEFORE INSERT OR UPDATE OF escola_id, formador_user_id
ON public.formacao_cohort_formadores
FOR EACH ROW
EXECUTE FUNCTION public.require_formacao_formador_membership();

DROP TRIGGER IF EXISTS trg_require_formacao_formador_membership_honorarios
  ON public.formacao_honorarios_lancamentos;

CREATE TRIGGER trg_require_formacao_formador_membership_honorarios
BEFORE INSERT OR UPDATE OF escola_id, formador_user_id
ON public.formacao_honorarios_lancamentos
FOR EACH ROW
EXECUTE FUNCTION public.require_formacao_formador_membership();

COMMIT;
