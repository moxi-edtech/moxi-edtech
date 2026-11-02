BEGIN;
-- Only fictitious AppyPay sandbox sessions; no FK or trigger touches real ledgers.
CREATE TABLE public.whatsapp_appypay_test_sessions (
  id uuid PRIMARY KEY,
  school_id uuid NOT NULL CHECK (school_id = 'f406f5a7-a077-431c-b118-297224925726'::uuid),
  token_hash text NOT NULL UNIQUE CHECK (token_hash ~ '^[a-f0-9]{64}$'),
  flow_id text NOT NULL CHECK (flow_id = '2328444514659033'),
  phone_id text NOT NULL CHECK (phone_id = '1295106843688961'),
  state text NOT NULL DEFAULT 'ready' CHECK (state IN ('ready', 'issuing', 'issued', 'simulating', 'paid')),
  reference_payload jsonb NOT NULL,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (expires_at > created_at AND expires_at <= created_at + interval '31 minutes'),
  CHECK (coalesce(
    jsonb_typeof(reference_payload) = 'object'
    AND reference_payload->'amount' = '100'::jsonb
    AND reference_payload->>'currency' = 'AOA'
    AND reference_payload->>'school_id' = school_id::text
    AND reference_payload->>'obligation_id' = id::text
    AND reference_payload->>'reference' ~ '^[0-9]{9}$'
    AND jsonb_typeof(reference_payload->'provider_payload') = 'object', false))
);
CREATE INDEX ix_whatsapp_appypay_test_expiry ON public.whatsapp_appypay_test_sessions(expires_at);
CREATE UNIQUE INDEX ux_whatsapp_appypay_test_charge
  ON public.whatsapp_appypay_test_sessions ((reference_payload->>'provider_reference_id'))
  WHERE state IN ('issued', 'simulating', 'paid');
ALTER TABLE public.whatsapp_appypay_test_sessions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.whatsapp_appypay_test_sessions FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT, INSERT, UPDATE ON public.whatsapp_appypay_test_sessions TO service_role;
COMMENT ON TABLE public.whatsapp_appypay_test_sessions IS
  'Private server-only sandbox fixtures, fixed 100 AOA; no real obligations or student identifiers. No client policies by design.';
COMMIT;
