# Apply Diff — 20260708_ADMIN_FINANCEIRO_SECRETARIA_CONSOLIDATION

## Objetivo

Consolidar `admin_financeiro` como papel composto que também satisfaz guards de `secretaria` no helper SQL central, e alinhar os testes unitários com a semântica atual do app.

## Diff

```diff
++ supabase/migrations/20270708120000_align_admin_financeiro_with_secretaria_inheritance.sql
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

++ apps/web/tests/unit/k12-role-inheritance.spec.ts
test("roleMatchesAllowedRoles aplica herança composta do k12 incluindo admin_financeiro em secretaria", () => {
  assert.equal(roleMatchesAllowedRoles("admin_financeiro", ["secretaria"], "k12"), true);
});

test("redirects K12 usam semantica central para papeis compostos e financeiro", () => {
  assert.equal(
    getDefaultK12PortalPathForRole("admin_financeiro", "curtume"),
    "/escola/curtume/operacoes/dashboard"
  );
});
```

## Risco

Baixo. A mudança só amplia a herança esperada de autorização para `admin_financeiro` no helper central e alinha testes com o comportamento já implementado no app.
