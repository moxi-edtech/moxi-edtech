-- BILL-018 — payment idempotency hardening.
--
-- IMPORTANT:
--   * This migration intentionally does NOT backfill public.pagamentos.idempotency_key.
--   * Historical NULL rows remain historical evidence.
--   * Enforcement is performed by the existing BEFORE INSERT guard, so only new rows
--     are required to carry a stable operation identity.
--   * Apply only after staging/readiness validation of every payment writer.

BEGIN;

DO $preflight$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema='public'
      AND table_name='pagamentos'
      AND column_name='idempotency_key'
  ) THEN
    RAISE EXCEPTION 'BILL018_PREFLIGHT: pagamentos.idempotency_key missing';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_indexes
    WHERE schemaname='public'
      AND tablename='pagamentos'
      AND indexname='ux_pagamentos_escola_idempotency'
  ) THEN
    RAISE EXCEPTION 'BILL018_PREFLIGHT: ux_pagamentos_escola_idempotency missing';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_trigger t
    JOIN pg_class c ON c.oid=t.tgrelid
    JOIN pg_namespace n ON n.oid=c.relnamespace
    WHERE n.nspname='public'
      AND c.relname='pagamentos'
      AND t.tgname='trg_pagamentos_financial_insert_guard'
      AND NOT t.tgisinternal
  ) THEN
    RAISE EXCEPTION 'BILL018_PREFLIGHT: payment INSERT guard trigger missing';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_trigger t
    JOIN pg_class c ON c.oid=t.tgrelid
    JOIN pg_namespace n ON n.oid=c.relnamespace
    WHERE n.nspname='public'
      AND c.relname='pagamentos'
      AND t.tgname='trg_pagamentos_financial_update_guard'
      AND NOT t.tgisinternal
  ) THEN
    RAISE EXCEPTION 'BILL018_PREFLIGHT: payment UPDATE guard trigger missing';
  END IF;
END
$preflight$;

CREATE OR REPLACE FUNCTION public.financeiro_guard_pagamento_insert()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'pg_catalog', 'public'
AS $function$
DECLARE
  v_idempotency_key text;
  v_external_ref text;
BEGIN
  -- Prefer the canonical column. Compatibility writers may supply the same
  -- identity in meta while they are being migrated.
  v_idempotency_key :=
    NULLIF(btrim(COALESCE(NEW.idempotency_key, '')), '');

  IF v_idempotency_key IS NULL THEN
    v_idempotency_key :=
      NULLIF(btrim(COALESCE(NEW.meta->>'idempotency_key', '')), '');
  END IF;

  -- pagamento_intents has a durable UUID identity and is safe to derive from.
  IF v_idempotency_key IS NULL
     AND NEW.pagamento_intent_id IS NOT NULL THEN
    v_idempotency_key := format('intent:%s', NEW.pagamento_intent_id);
  END IF;

  -- Provider-originated rows may use the provider transaction identity.
  -- Never derive from amount/date/student because equal legitimate payments
  -- must remain distinct operations.
  IF v_idempotency_key IS NULL THEN
    v_external_ref :=
      NULLIF(btrim(COALESCE(NEW.transacao_id_externo, '')), '');

    IF v_external_ref IS NOT NULL THEN
      v_idempotency_key := format('provider-tx:%s', v_external_ref);
    END IF;
  END IF;

  IF v_idempotency_key IS NULL THEN
    RAISE EXCEPTION
      'IDEMPOTENCY: novos pagamentos exigem idempotency_key estável';
  END IF;

  IF char_length(v_idempotency_key) > 200 THEN
    RAISE EXCEPTION
      'IDEMPOTENCY: idempotency_key excede 200 caracteres';
  END IF;

  NEW.idempotency_key := v_idempotency_key;

  IF current_user <> 'postgres'
     AND NEW.status IN ('settled','concluido','pago','confirmed','paid','succeeded') THEN
    RAISE EXCEPTION
      'IMMUTABILITY: pagamento liquidado deve ser criado/liquidado por RPC canónica';
  END IF;

  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.financeiro_guard_pagamento_update()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'pg_catalog', 'public'
AS $function$
BEGIN
  -- Operation identity is immutable even for SECURITY DEFINER payment writers.
  -- This also guarantees that historical NULL rows are never "backfilled" as
  -- a side effect of a later settlement/update.
  IF NEW.idempotency_key IS DISTINCT FROM OLD.idempotency_key THEN
    RAISE EXCEPTION
      'IMMUTABILITY: idempotency_key do pagamento não pode ser alterada';
  END IF;

  IF current_user <> 'postgres' THEN
    IF
      (to_jsonb(NEW) - ARRAY['status_fiscal','fiscal_documento_id','fiscal_error','updated_at']::text[])
      IS DISTINCT FROM
      (to_jsonb(OLD) - ARRAY['status_fiscal','fiscal_documento_id','fiscal_error','updated_at']::text[])
    THEN
      RAISE EXCEPTION
        'IMMUTABILITY: alterações financeiras do pagamento exigem RPC canónica';
    END IF;
  END IF;

  RETURN NEW;
END;
$function$;

-- These compatibility RPCs cannot satisfy a stable retry identity because
-- their signatures do not accept one. Repository call-site audit found no
-- active application caller and production has zero rows with
-- meta.origem='registrar_pagamento_compat'. Keep the functions for forensic
-- compatibility, but remove application execution rights.
REVOKE ALL PRIVILEGES
ON FUNCTION public.registrar_pagamento(uuid,text,text,numeric,date)
FROM PUBLIC, anon, authenticated, service_role;

REVOKE ALL PRIVILEGES
ON FUNCTION public.realizar_pagamento_balcao(uuid,uuid,jsonb,text,numeric)
FROM PUBLIC, anon, authenticated, service_role;

COMMENT ON COLUMN public.pagamentos.idempotency_key IS
  'BILL-018: stable identity required for every new payment; historical NULL rows are intentionally preserved.';

COMMENT ON FUNCTION public.financeiro_guard_pagamento_insert() IS
  'BILL-018: fail-closed idempotency guard for newly inserted payments.';

COMMENT ON FUNCTION public.financeiro_guard_pagamento_update() IS
  'BILL-018: payment financial guard plus immutable idempotency identity.';

COMMIT;
