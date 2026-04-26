BEGIN;

-- Wave 1: consolidate multiple permissive policies for finance-related tables
-- Goal: reduce duplicated policy evaluation while preserving effective access semantics.

-- ---------------------------------------------------------------------------
-- public.assinaturas
-- Before: one SELECT tenant policy + one ALL super-admin policy (duplicates on SELECT)
-- After : one unified SELECT policy + explicit super-admin write policies
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS escola_propria_assinatura ON public.assinaturas;
DROP POLICY IF EXISTS super_admin_all_assinaturas ON public.assinaturas;
DROP POLICY IF EXISTS assinaturas_select_unified ON public.assinaturas;
DROP POLICY IF EXISTS assinaturas_insert_super_admin ON public.assinaturas;
DROP POLICY IF EXISTS assinaturas_update_super_admin ON public.assinaturas;
DROP POLICY IF EXISTS assinaturas_delete_super_admin ON public.assinaturas;

CREATE POLICY assinaturas_select_unified
ON public.assinaturas
FOR SELECT
TO public
USING (
  escola_id = current_tenant_escola_id()
  OR check_super_admin_role()
);

CREATE POLICY assinaturas_insert_super_admin
ON public.assinaturas
FOR INSERT
TO public
WITH CHECK (check_super_admin_role());

CREATE POLICY assinaturas_update_super_admin
ON public.assinaturas
FOR UPDATE
TO public
USING (check_super_admin_role())
WITH CHECK (check_super_admin_role());

CREATE POLICY assinaturas_delete_super_admin
ON public.assinaturas
FOR DELETE
TO public
USING (check_super_admin_role());

-- ---------------------------------------------------------------------------
-- public.pagamentos_saas
-- Same consolidation pattern as assinaturas.
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS escola_propria_pagamentos_saas ON public.pagamentos_saas;
DROP POLICY IF EXISTS super_admin_all_pagamentos_saas ON public.pagamentos_saas;
DROP POLICY IF EXISTS pagamentos_saas_select_unified ON public.pagamentos_saas;
DROP POLICY IF EXISTS pagamentos_saas_insert_super_admin ON public.pagamentos_saas;
DROP POLICY IF EXISTS pagamentos_saas_update_super_admin ON public.pagamentos_saas;
DROP POLICY IF EXISTS pagamentos_saas_delete_super_admin ON public.pagamentos_saas;

CREATE POLICY pagamentos_saas_select_unified
ON public.pagamentos_saas
FOR SELECT
TO public
USING (
  escola_id = current_tenant_escola_id()
  OR check_super_admin_role()
);

CREATE POLICY pagamentos_saas_insert_super_admin
ON public.pagamentos_saas
FOR INSERT
TO public
WITH CHECK (check_super_admin_role());

CREATE POLICY pagamentos_saas_update_super_admin
ON public.pagamentos_saas
FOR UPDATE
TO public
USING (check_super_admin_role())
WITH CHECK (check_super_admin_role());

CREATE POLICY pagamentos_saas_delete_super_admin
ON public.pagamentos_saas
FOR DELETE
TO public
USING (check_super_admin_role());

-- ---------------------------------------------------------------------------
-- public.financeiro_templates_cobranca
-- Before: SELECT tenant + ALL admin/financeiro (duplicate on SELECT)
-- After : keep SELECT tenant, split ALL into explicit write-only policies
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS financeiro_templates_cobranca_write ON public.financeiro_templates_cobranca;
DROP POLICY IF EXISTS financeiro_templates_cobranca_insert ON public.financeiro_templates_cobranca;
DROP POLICY IF EXISTS financeiro_templates_cobranca_update ON public.financeiro_templates_cobranca;
DROP POLICY IF EXISTS financeiro_templates_cobranca_delete ON public.financeiro_templates_cobranca;

CREATE POLICY financeiro_templates_cobranca_insert
ON public.financeiro_templates_cobranca
FOR INSERT
TO authenticated
WITH CHECK (
  escola_id = current_tenant_escola_id()
  AND user_has_role_in_school(escola_id, ARRAY['admin','financeiro']::text[])
);

CREATE POLICY financeiro_templates_cobranca_update
ON public.financeiro_templates_cobranca
FOR UPDATE
TO authenticated
USING (
  escola_id = current_tenant_escola_id()
  AND user_has_role_in_school(escola_id, ARRAY['admin','financeiro']::text[])
)
WITH CHECK (
  escola_id = current_tenant_escola_id()
  AND user_has_role_in_school(escola_id, ARRAY['admin','financeiro']::text[])
);

CREATE POLICY financeiro_templates_cobranca_delete
ON public.financeiro_templates_cobranca
FOR DELETE
TO authenticated
USING (
  escola_id = current_tenant_escola_id()
  AND user_has_role_in_school(escola_id, ARRAY['admin','financeiro']::text[])
);

-- ---------------------------------------------------------------------------
-- public.pagamentos
-- Before: duplicated INSERT/SELECT/UPDATE policies for authenticated
-- After : keep broad SELECT tenant policy, merge INSERT/UPDATE role checks,
--         remove redundant narrower SELECT policy.
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS pagamentos_insert ON public.pagamentos;
DROP POLICY IF EXISTS pagamentos_insert_secretaria ON public.pagamentos;
CREATE POLICY pagamentos_insert
ON public.pagamentos
FOR INSERT
TO authenticated
WITH CHECK (
  escola_id = current_tenant_escola_id()
  AND user_has_role_in_school(
    escola_id,
    ARRAY['admin_escola','secretaria','financeiro','admin','global_admin','super_admin']::text[]
  )
);

DROP POLICY IF EXISTS pagamentos_update ON public.pagamentos;
DROP POLICY IF EXISTS pagamentos_update_financeiro ON public.pagamentos;
CREATE POLICY pagamentos_update
ON public.pagamentos
FOR UPDATE
TO authenticated
USING (
  escola_id = current_tenant_escola_id()
  AND user_has_role_in_school(
    escola_id,
    ARRAY['admin_escola','secretaria','financeiro','admin','global_admin','super_admin']::text[]
  )
)
WITH CHECK (
  escola_id = current_tenant_escola_id()
  AND user_has_role_in_school(
    escola_id,
    ARRAY['admin_escola','secretaria','financeiro','admin','global_admin','super_admin']::text[]
  )
);

DROP POLICY IF EXISTS pagamentos_select_secretaria_own ON public.pagamentos;

-- ---------------------------------------------------------------------------
-- public.fecho_caixa
-- Before: duplicated UPDATE policies for secretaria and financeiro/admin tracks
-- After : single UPDATE policy with union of allowed roles.
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS fecho_approve_financeiro ON public.fecho_caixa;
DROP POLICY IF EXISTS fecho_update_secretaria ON public.fecho_caixa;
DROP POLICY IF EXISTS fecho_update_unified ON public.fecho_caixa;

CREATE POLICY fecho_update_unified
ON public.fecho_caixa
FOR UPDATE
TO authenticated
USING (
  escola_id = current_tenant_escola_id()
  AND user_has_role_in_school(
    escola_id,
    ARRAY['secretaria','financeiro','admin','global_admin','super_admin']::text[]
  )
)
WITH CHECK (
  escola_id = current_tenant_escola_id()
  AND user_has_role_in_school(
    escola_id,
    ARRAY['secretaria','financeiro','admin','global_admin','super_admin']::text[]
  )
);

COMMIT;
