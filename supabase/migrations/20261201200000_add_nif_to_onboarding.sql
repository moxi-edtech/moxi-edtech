BEGIN;

-- Adicionar campo NIF à tabela de onboarding_requests
ALTER TABLE public.onboarding_requests
  ADD COLUMN IF NOT EXISTS escola_nif text;

COMMENT ON COLUMN public.onboarding_requests.escola_nif IS 'NIF oficial da instituição para provisionamento.';

COMMIT;
