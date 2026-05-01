BEGIN;

CREATE TABLE IF NOT EXISTS public.super_admin_commercial_settings (
  id boolean PRIMARY KEY DEFAULT true CHECK (id = true),
  banco text,
  titular_conta text,
  iban text,
  numero_conta text,
  kwik_chave text,
  email_comercial text,
  telefone_comercial text,
  whatsapp_comercial text,
  link_pagamento text,
  lembrete_trial_template text NOT NULL DEFAULT 'Olá {{centro_nome}}, o período de teste do seu centro termina em {{dias_restantes}} dia(s). Para manter o acesso aos dados e à operação, regularize a subscrição. Dados de pagamento: {{dados_pagamento}}',
  lembrete_expirado_template text NOT NULL DEFAULT 'Olá {{centro_nome}}, o período de teste terminou. Os dados estão preservados, mas o acesso operacional precisa de regularização. Dados de pagamento: {{dados_pagamento}}',
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid REFERENCES auth.users(id)
);

ALTER TABLE public.super_admin_commercial_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS super_admin_commercial_settings_select ON public.super_admin_commercial_settings;
CREATE POLICY super_admin_commercial_settings_select
  ON public.super_admin_commercial_settings
  FOR SELECT TO authenticated
  USING (public.check_super_admin_role());

DROP POLICY IF EXISTS super_admin_commercial_settings_mutation ON public.super_admin_commercial_settings;
CREATE POLICY super_admin_commercial_settings_mutation
  ON public.super_admin_commercial_settings
  FOR ALL TO authenticated
  USING (public.check_super_admin_role())
  WITH CHECK (public.check_super_admin_role());

INSERT INTO public.super_admin_commercial_settings (id)
VALUES (true)
ON CONFLICT (id) DO NOTHING;

COMMIT;
