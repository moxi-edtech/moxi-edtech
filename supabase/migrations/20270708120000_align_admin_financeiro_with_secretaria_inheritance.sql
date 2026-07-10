BEGIN;

CREATE OR REPLACE FUNCTION public.user_has_role_in_school(
  p_escola_id uuid,
  p_roles text[]
)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_uid uuid := public.safe_auth_uid();
BEGIN
  IF public.check_super_admin_role() THEN
    RETURN true;
  END IF;

  IF v_uid IS NULL THEN
    RETURN false;
  END IF;

  RETURN EXISTS (
    SELECT 1
    FROM public.escola_users eu
    WHERE eu.escola_id = p_escola_id
      AND eu.user_id = v_uid
      AND eu.papel = ANY (
        ARRAY(
          SELECT DISTINCT expanded.role_name
          FROM unnest(coalesce(p_roles, ARRAY[]::text[])) AS requested(role_name)
          CROSS JOIN LATERAL (
            VALUES
              (lower(trim(requested.role_name))),
              (CASE WHEN lower(trim(requested.role_name)) IN ('admin', 'staff_admin', 'admin_escola') THEN 'admin' END),
              (CASE WHEN lower(trim(requested.role_name)) IN ('admin', 'staff_admin', 'admin_escola') THEN 'staff_admin' END),
              (CASE WHEN lower(trim(requested.role_name)) IN ('admin', 'staff_admin', 'admin_escola') THEN 'admin_escola' END),
              (CASE WHEN lower(trim(requested.role_name)) IN ('admin', 'staff_admin', 'admin_escola') THEN 'admin_financeiro' END),
              (CASE WHEN lower(trim(requested.role_name)) = 'financeiro' THEN 'secretaria_financeiro' END),
              (CASE WHEN lower(trim(requested.role_name)) = 'financeiro' THEN 'admin_financeiro' END),
              (CASE WHEN lower(trim(requested.role_name)) = 'secretaria' THEN 'secretaria_financeiro' END),
              (CASE WHEN lower(trim(requested.role_name)) = 'secretaria' THEN 'admin_financeiro' END)
          ) AS expanded(role_name)
          WHERE expanded.role_name IS NOT NULL
        )
      )
  );
END;
$$;

COMMIT;
