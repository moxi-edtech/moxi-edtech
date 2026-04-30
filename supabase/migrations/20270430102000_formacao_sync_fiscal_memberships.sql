BEGIN;

CREATE OR REPLACE FUNCTION public.sync_formacao_fiscal_memberships_for_escola(p_escola_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF p_escola_id IS NULL THEN
    RETURN;
  END IF;

  WITH active_bindings AS (
    SELECT feb.escola_id, feb.empresa_id
    FROM public.fiscal_escola_bindings feb
    JOIN public.escolas e ON e.id = feb.escola_id
    WHERE feb.escola_id = p_escola_id
      AND e.tenant_type IN ('formacao', 'solo_creator')
      AND feb.effective_from <= CURRENT_DATE
      AND (feb.effective_to IS NULL OR feb.effective_to >= CURRENT_DATE)
  ),
  role_sources AS (
    SELECT
      eu.escola_id,
      eu.user_id,
      CASE
        WHEN eu.papel = 'formacao_admin' THEN 'admin'
        WHEN eu.papel = 'formacao_financeiro' THEN 'operator'
      END AS fiscal_role
    FROM public.escola_users eu
    WHERE eu.escola_id = p_escola_id
      AND eu.tenant_type = 'formacao'
      AND eu.papel IN ('formacao_admin', 'formacao_financeiro')

    UNION

    SELECT
      COALESCE(p.current_escola_id, p.escola_id) AS escola_id,
      p.user_id,
      CASE
        WHEN p.role::text = 'formacao_admin' THEN 'admin'
        WHEN p.role::text = 'formacao_financeiro' THEN 'operator'
      END AS fiscal_role
    FROM public.profiles p
    WHERE COALESCE(p.current_escola_id, p.escola_id) = p_escola_id
      AND p.role::text IN ('formacao_admin', 'formacao_financeiro')
  ),
  memberships AS (
    SELECT DISTINCT
      ab.empresa_id,
      rs.user_id,
      rs.fiscal_role
    FROM active_bindings ab
    JOIN role_sources rs ON rs.escola_id = ab.escola_id
    WHERE rs.user_id IS NOT NULL
      AND rs.fiscal_role IS NOT NULL
  )
  INSERT INTO public.fiscal_empresa_users (empresa_id, user_id, role)
  SELECT empresa_id, user_id, fiscal_role
  FROM memberships
  ON CONFLICT (empresa_id, user_id) DO UPDATE
  SET role = CASE
    WHEN public.fiscal_empresa_users.role = 'owner' THEN 'owner'
    WHEN EXCLUDED.role = 'admin' THEN 'admin'
    WHEN public.fiscal_empresa_users.role IN ('admin', 'operator') THEN public.fiscal_empresa_users.role
    ELSE EXCLUDED.role
  END;
END;
$$;

COMMENT ON FUNCTION public.sync_formacao_fiscal_memberships_for_escola(uuid)
IS 'Synchronizes formacao administrative/finance users into fiscal_empresa_users so fiscal bindings are visible under RLS.';

CREATE OR REPLACE FUNCTION public.trg_sync_formacao_fiscal_memberships_from_binding()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  PERFORM public.sync_formacao_fiscal_memberships_for_escola(NEW.escola_id);
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.trg_sync_formacao_fiscal_memberships_from_escola_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.tenant_type = 'formacao'
     AND NEW.papel IN ('formacao_admin', 'formacao_financeiro') THEN
    PERFORM public.sync_formacao_fiscal_memberships_for_escola(NEW.escola_id);
  END IF;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.trg_sync_formacao_fiscal_memberships_from_profile()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_escola_id uuid;
BEGIN
  v_escola_id := COALESCE(NEW.current_escola_id, NEW.escola_id);

  IF v_escola_id IS NOT NULL
     AND NEW.role::text IN ('formacao_admin', 'formacao_financeiro') THEN
    PERFORM public.sync_formacao_fiscal_memberships_for_escola(v_escola_id);
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_formacao_fiscal_memberships_binding
  ON public.fiscal_escola_bindings;

CREATE TRIGGER trg_sync_formacao_fiscal_memberships_binding
AFTER INSERT OR UPDATE OF escola_id, empresa_id, effective_from, effective_to
ON public.fiscal_escola_bindings
FOR EACH ROW
EXECUTE FUNCTION public.trg_sync_formacao_fiscal_memberships_from_binding();

DROP TRIGGER IF EXISTS trg_sync_formacao_fiscal_memberships_escola_user
  ON public.escola_users;

CREATE TRIGGER trg_sync_formacao_fiscal_memberships_escola_user
AFTER INSERT OR UPDATE OF escola_id, user_id, papel, tenant_type
ON public.escola_users
FOR EACH ROW
EXECUTE FUNCTION public.trg_sync_formacao_fiscal_memberships_from_escola_user();

DROP TRIGGER IF EXISTS trg_sync_formacao_fiscal_memberships_profile
  ON public.profiles;

CREATE TRIGGER trg_sync_formacao_fiscal_memberships_profile
AFTER INSERT OR UPDATE OF user_id, role, escola_id, current_escola_id
ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.trg_sync_formacao_fiscal_memberships_from_profile();

SELECT public.sync_formacao_fiscal_memberships_for_escola(e.id)
FROM public.escolas e
WHERE e.tenant_type IN ('formacao', 'solo_creator')
  AND EXISTS (
    SELECT 1
    FROM public.fiscal_escola_bindings feb
    WHERE feb.escola_id = e.id
  );

COMMIT;
