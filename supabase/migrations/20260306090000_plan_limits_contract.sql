CREATE TABLE IF NOT EXISTS public.app_plan_limits (
  plan public.app_plan_tier PRIMARY KEY,
  price_mensal_kz integer NOT NULL,
  max_alunos integer,
  max_admin_users integer,
  max_storage_gb integer,
  professores_ilimitados boolean NOT NULL DEFAULT true,
  api_enabled boolean NOT NULL DEFAULT false,
  multi_campus boolean NOT NULL DEFAULT false,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.app_plan_limits ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS app_plan_limits_read ON public.app_plan_limits;
CREATE POLICY app_plan_limits_read ON public.app_plan_limits
  FOR SELECT
  USING (true);

INSERT INTO public.app_plan_limits (
  plan,
  price_mensal_kz,
  max_alunos,
  max_admin_users,
  max_storage_gb,
  professores_ilimitados,
  api_enabled,
  multi_campus
) VALUES
  ('essencial', 80000, 600, 10, 5, true, false, false),
  ('profissional', 140000, 1500, 30, 20, true, false, false),
  ('premium', 0, NULL, NULL, 100, true, true, true)
ON CONFLICT (plan) DO UPDATE SET
  price_mensal_kz = EXCLUDED.price_mensal_kz,
  max_alunos = EXCLUDED.max_alunos,
  max_admin_users = EXCLUDED.max_admin_users,
  max_storage_gb = EXCLUDED.max_storage_gb,
  professores_ilimitados = EXCLUDED.professores_ilimitados,
  api_enabled = EXCLUDED.api_enabled,
  multi_campus = EXCLUDED.multi_campus,
  updated_at = now();
