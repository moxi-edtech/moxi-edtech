BEGIN;

CREATE OR REPLACE FUNCTION public.fiscal_empresa_has_members(p_empresa_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.fiscal_empresa_users feu
    WHERE feu.empresa_id = p_empresa_id
  );
$$;

DROP POLICY IF EXISTS fiscal_empresas_mutation ON public.fiscal_empresas;
DROP POLICY IF EXISTS fiscal_empresas_insert ON public.fiscal_empresas;
DROP POLICY IF EXISTS fiscal_empresas_update ON public.fiscal_empresas;
DROP POLICY IF EXISTS fiscal_empresas_delete ON public.fiscal_empresas;

CREATE POLICY fiscal_empresas_insert
ON public.fiscal_empresas
FOR INSERT
TO authenticated
WITH CHECK (
  public.check_super_admin_role()
  OR public.safe_auth_uid() IS NOT NULL
);

CREATE POLICY fiscal_empresas_update
ON public.fiscal_empresas
FOR UPDATE
TO authenticated
USING (
  public.check_super_admin_role()
  OR public.user_has_role_in_empresa(id, ARRAY['owner','admin'])
)
WITH CHECK (
  public.check_super_admin_role()
  OR public.user_has_role_in_empresa(id, ARRAY['owner','admin'])
);

CREATE POLICY fiscal_empresas_delete
ON public.fiscal_empresas
FOR DELETE
TO authenticated
USING (
  public.check_super_admin_role()
  OR public.user_has_role_in_empresa(id, ARRAY['owner','admin'])
);

DROP POLICY IF EXISTS fiscal_empresa_users_mutation ON public.fiscal_empresa_users;
DROP POLICY IF EXISTS fiscal_empresa_users_insert ON public.fiscal_empresa_users;
DROP POLICY IF EXISTS fiscal_empresa_users_update ON public.fiscal_empresa_users;
DROP POLICY IF EXISTS fiscal_empresa_users_delete ON public.fiscal_empresa_users;

CREATE POLICY fiscal_empresa_users_insert
ON public.fiscal_empresa_users
FOR INSERT
TO authenticated
WITH CHECK (
  public.check_super_admin_role()
  OR public.user_has_role_in_empresa(empresa_id, ARRAY['owner','admin'])
  OR (
    user_id = public.safe_auth_uid()
    AND role = 'owner'
    AND NOT public.fiscal_empresa_has_members(empresa_id)
  )
);

CREATE POLICY fiscal_empresa_users_update
ON public.fiscal_empresa_users
FOR UPDATE
TO authenticated
USING (
  public.check_super_admin_role()
  OR public.user_has_role_in_empresa(empresa_id, ARRAY['owner','admin'])
)
WITH CHECK (
  public.check_super_admin_role()
  OR public.user_has_role_in_empresa(empresa_id, ARRAY['owner','admin'])
);

CREATE POLICY fiscal_empresa_users_delete
ON public.fiscal_empresa_users
FOR DELETE
TO authenticated
USING (
  public.check_super_admin_role()
  OR public.user_has_role_in_empresa(empresa_id, ARRAY['owner','admin'])
);

COMMIT;
