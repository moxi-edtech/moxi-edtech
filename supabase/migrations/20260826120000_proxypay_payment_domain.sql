-- ProxyPay RPS payment domain. Additive migration; existing manual/MCX flows remain unchanged.
CREATE TABLE IF NOT EXISTS public.school_payment_providers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES public.escolas(id) ON DELETE CASCADE,
  provider_type text NOT NULL CHECK (provider_type IN ('proxypay')),
  status text NOT NULL DEFAULT 'inactive' CHECK (status IN ('inactive','active','error')),
  environment text NOT NULL DEFAULT 'sandbox' CHECK (environment IN ('sandbox','production')),
  entity_code text,
  products_enabled jsonb NOT NULL DEFAULT '["rps"]'::jsonb,
  config jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (school_id, provider_type)
);

CREATE INDEX IF NOT EXISTS ix_school_payment_providers_school
  ON public.school_payment_providers (school_id, status);

CREATE TABLE IF NOT EXISTS public.payment_references (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES public.escolas(id) ON DELETE CASCADE,
  obligation_id uuid NOT NULL REFERENCES public.mensalidades(id) ON DELETE CASCADE,
  provider_id uuid NOT NULL REFERENCES public.school_payment_providers(id) ON DELETE RESTRICT,
  provider_reference_id text NOT NULL,
  entity text NOT NULL,
  reference text NOT NULL,
  amount numeric(14,2) NOT NULL CHECK (amount > 0),
  currency text NOT NULL DEFAULT 'AOA' CHECK (currency = 'AOA'),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','active','paid','expired','cancelled','failed')),
  expires_at timestamptz NOT NULL,
  provider_payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  paid_at timestamptz,
  UNIQUE (provider_id, provider_reference_id),
  UNIQUE (provider_id, reference)
);

CREATE UNIQUE INDEX IF NOT EXISTS ux_payment_references_active_obligation
  ON public.payment_references (school_id, obligation_id)
  WHERE status IN ('pending','active');
CREATE INDEX IF NOT EXISTS ix_payment_references_school_status
  ON public.payment_references (school_id, status, created_at DESC);

CREATE TABLE IF NOT EXISTS public.payment_provider_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES public.escolas(id) ON DELETE CASCADE,
  provider_id uuid NOT NULL REFERENCES public.school_payment_providers(id) ON DELETE RESTRICT,
  payment_reference_id uuid REFERENCES public.payment_references(id) ON DELETE SET NULL,
  obligation_id uuid REFERENCES public.mensalidades(id) ON DELETE SET NULL,
  provider_transaction_id text NOT NULL,
  amount numeric(14,2) NOT NULL,
  currency text NOT NULL DEFAULT 'AOA',
  paid_at timestamptz,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','matched','reconciled','manual_review','rejected')),
  raw_metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (provider_id, provider_transaction_id)
);

CREATE INDEX IF NOT EXISTS ix_payment_provider_transactions_school_status
  ON public.payment_provider_transactions (school_id, status, created_at DESC);

CREATE TABLE IF NOT EXISTS public.payment_provider_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_id uuid NOT NULL REFERENCES public.school_payment_providers(id) ON DELETE CASCADE,
  school_id uuid NOT NULL REFERENCES public.escolas(id) ON DELETE CASCADE,
  provider_event_id text,
  event_type text NOT NULL DEFAULT 'payment',
  idempotency_key text NOT NULL,
  payload_hash text NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  received_at timestamptz NOT NULL DEFAULT now(),
  processed_at timestamptz,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','processing','processed','manual_review','rejected','failed')),
  error_message text,
  UNIQUE (provider_id, idempotency_key)
);

CREATE INDEX IF NOT EXISTS ix_payment_provider_events_pending
  ON public.payment_provider_events (status, received_at);

ALTER TABLE public.school_payment_providers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_references ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_provider_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_provider_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS school_payment_providers_manage ON public.school_payment_providers;
CREATE POLICY school_payment_providers_manage ON public.school_payment_providers
  FOR ALL TO authenticated USING (public.can_manage_school(school_id))
  WITH CHECK (public.can_manage_school(school_id));
DROP POLICY IF EXISTS payment_references_manage ON public.payment_references;
CREATE POLICY payment_references_manage ON public.payment_references
  FOR ALL TO authenticated USING (public.can_manage_school(school_id))
  WITH CHECK (public.can_manage_school(school_id));
DROP POLICY IF EXISTS payment_provider_transactions_manage ON public.payment_provider_transactions;
CREATE POLICY payment_provider_transactions_manage ON public.payment_provider_transactions
  FOR ALL TO authenticated USING (public.can_manage_school(school_id))
  WITH CHECK (public.can_manage_school(school_id));
DROP POLICY IF EXISTS payment_provider_events_manage ON public.payment_provider_events;
CREATE POLICY payment_provider_events_manage ON public.payment_provider_events
  FOR ALL TO authenticated USING (public.can_manage_school(school_id))
  WITH CHECK (public.can_manage_school(school_id));
