ALTER TABLE public.pagamento_intents
  ADD COLUMN IF NOT EXISTS idempotency_key text;

CREATE OR REPLACE FUNCTION public.financeiro_payment_intent_idempotency_guard()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'pg_catalog','public'
AS $function$
BEGIN
  IF NEW.servico_pedido_id IS NULL THEN
    RAISE EXCEPTION 'DATA: pagamento_intent exige servico_pedido_id para identidade idempotente';
  END IF;

  IF nullif(btrim(coalesce(NEW.idempotency_key,'')),'') IS NULL THEN
    NEW.idempotency_key := 'service-intent:' || NEW.servico_pedido_id::text;
  END IF;

  IF char_length(NEW.idempotency_key) > 200 THEN
    RAISE EXCEPTION 'DATA: idempotency_key excede 200 caracteres';
  END IF;

  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_pagamento_intents_idempotency
  ON public.pagamento_intents;
CREATE TRIGGER trg_pagamento_intents_idempotency
BEFORE INSERT OR UPDATE OF servico_pedido_id,idempotency_key
ON public.pagamento_intents
FOR EACH ROW
EXECUTE FUNCTION public.financeiro_payment_intent_idempotency_guard();

UPDATE public.pagamento_intents
SET idempotency_key='service-intent:' || servico_pedido_id::text
WHERE idempotency_key IS NULL
  AND servico_pedido_id IS NOT NULL;

ALTER TABLE public.pagamento_intents
  ALTER COLUMN idempotency_key SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS ux_pagamento_intents_escola_idempotency
  ON public.pagamento_intents(escola_id,idempotency_key);

REVOKE ALL ON FUNCTION public.financeiro_payment_intent_idempotency_guard()
  FROM PUBLIC,anon,authenticated,service_role;
