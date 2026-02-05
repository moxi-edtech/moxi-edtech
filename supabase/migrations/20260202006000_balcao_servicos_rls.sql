ALTER TABLE public.servicos_escola ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.servico_pedidos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pagamento_intents ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS servicos_escola_select ON public.servicos_escola;
CREATE POLICY servicos_escola_select
ON public.servicos_escola
FOR SELECT
TO authenticated
USING (escola_id = current_tenant_escola_id());

DROP POLICY IF EXISTS servicos_escola_write_admin ON public.servicos_escola;
CREATE POLICY servicos_escola_write_admin
ON public.servicos_escola
FOR ALL
TO authenticated
USING (
  escola_id = current_tenant_escola_id()
  AND user_has_role_in_school(escola_id, array['admin','financeiro']::text[])
)
WITH CHECK (
  escola_id = current_tenant_escola_id()
  AND user_has_role_in_school(escola_id, array['admin','financeiro']::text[])
);

DROP POLICY IF EXISTS servico_pedidos_select_staff ON public.servico_pedidos;
CREATE POLICY servico_pedidos_select_staff
ON public.servico_pedidos
FOR SELECT
TO authenticated
USING (
  escola_id = current_tenant_escola_id()
  AND user_has_role_in_school(escola_id, array['admin','secretaria','financeiro']::text[])
);

DROP POLICY IF EXISTS servico_pedidos_insert_secretaria ON public.servico_pedidos;
CREATE POLICY servico_pedidos_insert_secretaria
ON public.servico_pedidos
FOR INSERT
TO authenticated
WITH CHECK (
  escola_id = current_tenant_escola_id()
  AND user_has_role_in_school(escola_id, array['admin','secretaria']::text[])
);

DROP POLICY IF EXISTS servico_pedidos_update_secretaria ON public.servico_pedidos;
CREATE POLICY servico_pedidos_update_secretaria
ON public.servico_pedidos
FOR UPDATE
TO authenticated
USING (
  escola_id = current_tenant_escola_id()
  AND user_has_role_in_school(escola_id, array['admin','secretaria']::text[])
)
WITH CHECK (
  escola_id = current_tenant_escola_id()
  AND user_has_role_in_school(escola_id, array['admin','secretaria']::text[])
);

DROP POLICY IF EXISTS pagamento_intents_select_staff ON public.pagamento_intents;
CREATE POLICY pagamento_intents_select_staff
ON public.pagamento_intents
FOR SELECT
TO authenticated
USING (
  escola_id = current_tenant_escola_id()
  AND user_has_role_in_school(escola_id, array['admin','secretaria','financeiro']::text[])
);

DROP POLICY IF EXISTS pagamento_intents_insert_staff ON public.pagamento_intents;
CREATE POLICY pagamento_intents_insert_staff
ON public.pagamento_intents
FOR INSERT
TO authenticated
WITH CHECK (
  escola_id = current_tenant_escola_id()
  AND user_has_role_in_school(escola_id, array['admin','secretaria','financeiro']::text[])
);

DROP POLICY IF EXISTS pagamento_intents_update_financeiro ON public.pagamento_intents;
CREATE POLICY pagamento_intents_update_financeiro
ON public.pagamento_intents
FOR UPDATE
TO authenticated
USING (
  escola_id = current_tenant_escola_id()
  AND user_has_role_in_school(escola_id, array['admin','financeiro']::text[])
)
WITH CHECK (
  escola_id = current_tenant_escola_id()
  AND user_has_role_in_school(escola_id, array['admin','financeiro']::text[])
);
