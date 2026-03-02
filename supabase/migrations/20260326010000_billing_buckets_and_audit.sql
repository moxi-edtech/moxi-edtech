-- Migration: 20260326010000_billing_buckets_and_audit.sql
-- Descrição: Configuração de buckets e auditoria para o sistema de billing

-- 1. Criar Bucket para Comprovativos de Billing
-- Nota: Usando a tabela storage.buckets directamente para garantir idempotência via INSERT
INSERT INTO storage.buckets (id, name, public)
VALUES ('billing-proofs', 'billing-proofs', false)
ON CONFLICT (id) DO NOTHING;

-- 2. Políticas de Acesso ao Bucket
-- As escolas podem fazer upload para a sua própria pasta
CREATE POLICY "Escolas podem fazer upload de comprovativos"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'billing-proofs' AND
  (storage.foldername(name))[1] = public.current_tenant_escola_id()::text
);

-- As escolas podem ver os seus próprios comprovativos
CREATE POLICY "Escolas podem ver seus comprovativos"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'billing-proofs' AND
  (storage.foldername(name))[1] = public.current_tenant_escola_id()::text
);

-- Super Admin pode ver tudo
CREATE POLICY "Super Admin tem acesso total ao billing-proofs"
ON storage.objects FOR ALL
TO authenticated
USING (
  bucket_id = 'billing-proofs' AND
  public.check_super_admin_role()
);

-- 3. Adicionar notas ao schema
COMMENT ON TABLE public.assinaturas IS 'Gestão de subscrições Klasse SaaS';
