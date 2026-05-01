BEGIN;

-- 1. Adicionar colunas de controle de subscrição
ALTER TABLE public.centros_formacao
  ADD COLUMN IF NOT EXISTS trial_ends_at timestamptz,
  ADD COLUMN IF NOT EXISTS subscription_status text NOT NULL DEFAULT 'trial' 
    CHECK (subscription_status IN ('trial', 'active', 'past_due', 'expired', 'lifetime')),
  ADD COLUMN IF NOT EXISTS subscription_updated_at timestamptz DEFAULT now();

CREATE INDEX IF NOT EXISTS idx_centros_formacao_subscription_status
  ON public.centros_formacao(subscription_status);

CREATE INDEX IF NOT EXISTS idx_centros_formacao_trial_ends_at
  ON public.centros_formacao(trial_ends_at)
  WHERE subscription_status = 'trial';

-- 2. Função helper para verificar estado da subscrição (usada pelo middleware/filtros)
CREATE OR REPLACE FUNCTION public.formacao_get_subscription_info(p_escola_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_centro record;
  v_days_left integer;
  v_is_expired boolean;
BEGIN
  SELECT trial_ends_at, subscription_status, plano
    INTO v_centro
    FROM public.centros_formacao
   WHERE escola_id = p_escola_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('status', 'not_found');
  END IF;

  IF NOT (
    public.check_super_admin_role()
    OR public.user_has_role_in_school(
      p_escola_id,
      ARRAY['formacao_admin', 'formacao_secretaria', 'formacao_financeiro', 'formador', 'formando', 'super_admin', 'global_admin']::text[]
    )
  ) THEN
    RAISE EXCEPTION 'sem permissão para consultar subscrição';
  END IF;

  v_days_left := CASE
    WHEN v_centro.trial_ends_at IS NOT NULL 
    THEN ceil(extract(epoch from (v_centro.trial_ends_at - now())) / 86400)::int
    ELSE NULL
  END;

  v_is_expired := (v_centro.subscription_status = 'expired') 
    OR (v_centro.subscription_status = 'trial' AND v_centro.trial_ends_at < now());

  RETURN jsonb_build_object(
    'status', v_centro.subscription_status,
    'plano', v_centro.plano,
    'plan_tier', v_centro.plano,
    'trial_ends_at', v_centro.trial_ends_at,
    'days_left', GREATEST(0, v_days_left),
    'is_expired', coalesce(v_is_expired, false)
  );
END;
$$;

REVOKE ALL ON FUNCTION public.formacao_get_subscription_info(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.formacao_get_subscription_info(uuid) TO authenticated;

-- 3. Super Admin: prolongar trial sem alterar dados do centro.
CREATE OR REPLACE FUNCTION public.formacao_extend_trial(
  p_escola_id uuid,
  p_days integer DEFAULT 5
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_days integer := greatest(1, least(coalesce(p_days, 5), 30));
  v_result jsonb;
BEGIN
  IF p_escola_id IS NULL THEN
    RAISE EXCEPTION 'escola_id obrigatório';
  END IF;

  IF NOT public.check_super_admin_role() THEN
    RAISE EXCEPTION 'Somente Super Admin pode prolongar trial';
  END IF;

  UPDATE public.centros_formacao
     SET trial_ends_at = greatest(coalesce(trial_ends_at, now()), now()) + make_interval(days => v_days),
         subscription_status = 'trial',
         subscription_updated_at = now(),
         status = CASE WHEN status = 'suspenso' THEN 'ativo' ELSE status END,
         updated_at = now()
   WHERE escola_id = p_escola_id
   RETURNING jsonb_build_object(
     'escola_id', escola_id,
     'subscription_status', subscription_status,
     'trial_ends_at', trial_ends_at,
     'days_left', ceil(extract(epoch from (trial_ends_at - now())) / 86400)::int,
     'plano', plano,
     'plan_tier', plano,
     'status', status
   )
  INTO v_result;

  IF v_result IS NULL THEN
    RAISE EXCEPTION 'Centro não encontrado';
  END IF;

  RETURN v_result;
END;
$$;

REVOKE ALL ON FUNCTION public.formacao_extend_trial(uuid, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.formacao_extend_trial(uuid, integer) TO authenticated;

-- 3. Dar 7 dias de trial por defeito a centros novos sem data definida
UPDATE public.centros_formacao 
   SET trial_ends_at = created_at + interval '7 days'
 WHERE trial_ends_at IS NULL 
   AND subscription_status = 'trial';

COMMIT;
