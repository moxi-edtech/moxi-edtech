-- supabase/migrations/20260127130001_add_rls_to_financeiro_transacoes_importadas.sql
ALTER TABLE public.financeiro_transacoes_importadas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Can view own school transactions" ON public.financeiro_transacoes_importadas
FOR SELECT TO authenticated USING (escola_id = public.current_tenant_escola_id());

CREATE POLICY "Can insert own school transactions" ON public.financeiro_transacoes_importadas
FOR INSERT TO authenticated WITH CHECK (escola_id = public.current_tenant_escola_id());

CREATE POLICY "Can update own school transactions" ON public.financeiro_transacoes_importadas
FOR UPDATE TO authenticated USING (escola_id = public.current_tenant_escola_id()) WITH CHECK (escola_id = public.current_tenant_escola_id());

CREATE POLICY "Can delete own school transactions" ON public.financeiro_transacoes_importadas
FOR DELETE TO authenticated USING (escola_id = public.current_tenant_escola_id());
