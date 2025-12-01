-- 20251203_auth_helpers_rls.sql
-- Infra de autenticação / RLS (helpers globais)

-- ======================================================================
-- Função canônica de Tenant: current_tenant_escola_id()
-- Lê o claim "escola_id" do JWT gerado pelo Supabase
-- ======================================================================

CREATE OR REPLACE FUNCTION public.current_tenant_escola_id()
RETURNS uuid
LANGUAGE sql
STABLE
AS $$
  SELECT
    NULLIF(
      current_setting('request.jwt.claims', true)::jsonb->>'escola_id',
      ''
    )::uuid;
$$;

-- (Opcional) Helper para o user_id, se quiser padronizar também
CREATE OR REPLACE FUNCTION public.current_user_id()
RETURNS uuid
LANGUAGE sql
STABLE
AS $$
  SELECT
    NULLIF(
      current_setting('request.jwt.claims', true)::jsonb->>'sub',
      ''
    )::uuid;
$$;

