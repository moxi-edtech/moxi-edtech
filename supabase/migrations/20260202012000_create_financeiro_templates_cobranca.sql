CREATE TABLE IF NOT EXISTS public.financeiro_templates_cobranca (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  escola_id uuid NOT NULL,
  nome text NOT NULL,
  canal text NOT NULL CHECK (canal IN ('whatsapp','sms','email','push')),
  corpo text NOT NULL,
  criado_por uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_financeiro_templates_cobranca_escola
  ON public.financeiro_templates_cobranca (escola_id, created_at DESC);

ALTER TABLE public.financeiro_templates_cobranca ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS financeiro_templates_cobranca_select ON public.financeiro_templates_cobranca;
CREATE POLICY financeiro_templates_cobranca_select
ON public.financeiro_templates_cobranca
FOR SELECT
TO authenticated
USING (escola_id = current_tenant_escola_id());

DROP POLICY IF EXISTS financeiro_templates_cobranca_write ON public.financeiro_templates_cobranca;
CREATE POLICY financeiro_templates_cobranca_write
ON public.financeiro_templates_cobranca
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
