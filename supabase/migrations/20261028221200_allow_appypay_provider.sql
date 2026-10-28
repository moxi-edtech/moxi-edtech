BEGIN;
ALTER TABLE public.school_payment_providers
  DROP CONSTRAINT school_payment_providers_provider_type_check;
ALTER TABLE public.school_payment_providers
  ADD CONSTRAINT school_payment_providers_provider_type_check
  CHECK (provider_type IN ('proxypay', 'appypay'));
COMMIT;
