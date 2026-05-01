BEGIN;

ALTER TABLE public.app_plan_limits
  ADD COLUMN IF NOT EXISTS price_anual_kz integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS trial_days integer NOT NULL DEFAULT 7,
  ADD COLUMN IF NOT EXISTS discount_percent numeric(5,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS promo_label text,
  ADD COLUMN IF NOT EXISTS promo_ends_at timestamptz;

ALTER TABLE public.app_plan_limits
  DROP CONSTRAINT IF EXISTS app_plan_limits_price_mensal_nonnegative,
  DROP CONSTRAINT IF EXISTS app_plan_limits_price_anual_nonnegative,
  DROP CONSTRAINT IF EXISTS app_plan_limits_trial_days_range,
  DROP CONSTRAINT IF EXISTS app_plan_limits_discount_percent_range;

ALTER TABLE public.app_plan_limits
  ADD CONSTRAINT app_plan_limits_price_mensal_nonnegative CHECK (price_mensal_kz >= 0),
  ADD CONSTRAINT app_plan_limits_price_anual_nonnegative CHECK (price_anual_kz >= 0),
  ADD CONSTRAINT app_plan_limits_trial_days_range CHECK (trial_days >= 0 AND trial_days <= 365),
  ADD CONSTRAINT app_plan_limits_discount_percent_range CHECK (discount_percent >= 0 AND discount_percent <= 100);

UPDATE public.app_plan_limits
SET price_anual_kz = price_mensal_kz * 12
WHERE price_anual_kz = 0
  AND price_mensal_kz > 0;

COMMENT ON COLUMN public.app_plan_limits.price_anual_kz IS 'Preço anual SaaS em Kz configurável pelo Super Admin.';
COMMENT ON COLUMN public.app_plan_limits.trial_days IS 'Dias padrão de trial para novas assinaturas deste plano.';
COMMENT ON COLUMN public.app_plan_limits.discount_percent IS 'Desconto promocional global aplicado no preço do plano.';
COMMENT ON COLUMN public.app_plan_limits.promo_label IS 'Nome público/interno da promoção ativa do plano.';
COMMENT ON COLUMN public.app_plan_limits.promo_ends_at IS 'Data final da promoção global do plano.';

CREATE TABLE IF NOT EXISTS public.formacao_plan_settings (
  plan text PRIMARY KEY CHECK (plan IN ('basic', 'pro', 'enterprise')),
  price_mensal_kz integer NOT NULL DEFAULT 0 CHECK (price_mensal_kz >= 0),
  price_anual_kz integer NOT NULL DEFAULT 0 CHECK (price_anual_kz >= 0),
  trial_days integer NOT NULL DEFAULT 7 CHECK (trial_days >= 0 AND trial_days <= 365),
  discount_percent numeric(5,2) NOT NULL DEFAULT 0 CHECK (discount_percent >= 0 AND discount_percent <= 100),
  promo_label text,
  promo_ends_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO public.formacao_plan_settings (plan, price_mensal_kz, price_anual_kz, trial_days)
VALUES
  ('basic', 45000, 540000, 7),
  ('pro', 95000, 1140000, 7),
  ('enterprise', 0, 0, 14)
ON CONFLICT (plan) DO NOTHING;

UPDATE public.formacao_plan_settings
SET price_mensal_kz = 45000,
    price_anual_kz = 540000,
    updated_at = now()
WHERE plan = 'basic';

UPDATE public.formacao_plan_settings
SET price_mensal_kz = 95000,
    price_anual_kz = 1140000,
    updated_at = now()
WHERE plan = 'pro';

ALTER TABLE public.formacao_plan_settings ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'formacao_plan_settings'
      AND policyname = 'super_admin_all_formacao_plan_settings'
  ) THEN
    CREATE POLICY super_admin_all_formacao_plan_settings
      ON public.formacao_plan_settings
      FOR ALL
      USING (public.check_super_admin_role())
      WITH CHECK (public.check_super_admin_role());
  END IF;
END $$;

COMMENT ON TABLE public.formacao_plan_settings IS 'Configuração comercial dos planos do produto KLASSE Formação.';

COMMIT;
