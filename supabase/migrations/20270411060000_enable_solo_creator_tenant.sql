-- Migration: Habilitação do Tenant SOLO_CREATOR
-- Data: 11/04/2026

-- 1. Atualizar constraint na tabela de escolas
ALTER TABLE public.escolas DROP CONSTRAINT IF EXISTS escolas_tenant_type_check;
ALTER TABLE public.escolas ADD CONSTRAINT escolas_tenant_type_check 
CHECK (tenant_type IN ('k12', 'formacao', 'solo_creator'));

-- 2. Atualizar constraint na tabela de usuários da escola (vínculos)
ALTER TABLE public.escola_users DROP CONSTRAINT IF EXISTS escola_users_tenant_type_check;
ALTER TABLE public.escola_users ADD CONSTRAINT escola_users_tenant_type_check 
CHECK (tenant_type IN ('k12', 'formacao', 'solo_creator'));

-- 3. Comentário para documentação
COMMENT ON COLUMN public.escolas.tenant_type IS 'Tipo de inquilino: k12 (Escolas), formacao (Centros Corporativos), solo_creator (Mentores/Coaches).';
