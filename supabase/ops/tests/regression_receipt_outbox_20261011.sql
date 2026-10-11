-- Run only on a disposable PostgreSQL 17 instance.
\set ON_ERROR_STOP on
BEGIN;

CREATE TYPE public.outbox_status AS ENUM ('pending','processing','sent','failed','dead');
CREATE TABLE public.outbox_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  escola_id uuid NOT NULL,
  event_type text NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  status public.outbox_status NOT NULL DEFAULT 'pending',
  attempts integer NOT NULL DEFAULT 0,
  max_attempts integer NOT NULL DEFAULT 5,
  next_attempt_at timestamptz NOT NULL DEFAULT now(),
  processed_at timestamptz,
  last_error text,
  locked_at timestamptz,
  locked_by text
);
CREATE TABLE public.documentos_emitidos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  escola_id uuid NOT NULL,
  tipo text NOT NULL,
  mensalidade_id uuid,
  idempotency_key text,
  dados_snapshot jsonb NOT NULL DEFAULT '{}'::jsonb
);
CREATE UNIQUE INDEX ux_synthetic_receipt_idempotency
  ON public.documentos_emitidos(escola_id,idempotency_key)
  WHERE idempotency_key IS NOT NULL;

CREATE FUNCTION public.can_manage_school(uuid) RETURNS boolean
  LANGUAGE sql AS $$ SELECT true $$;

\ir ../../migrations/20261011133652_outbox_receipt_retry_gate.sql

DO $$
DECLARE
  v_school uuid := '00000000-0000-4000-8000-000000000001';
  v_event uuid;
  v_retry uuid;
BEGIN
  INSERT INTO public.outbox_events(escola_id,event_type)
  VALUES(v_school,'financeiro_recibo_pagamento')
  RETURNING id INTO v_event;

  IF (SELECT next_attempt_at IS NULL FROM public.outbox_events WHERE id=v_event) THEN
    RAISE EXCEPTION 'insert default regression';
  END IF;

  UPDATE public.outbox_events SET status='sent', processed_at=now(), next_attempt_at=now() WHERE id=v_event;
  IF (SELECT next_attempt_at IS NULL FROM public.outbox_events WHERE id=v_event) THEN
    RAISE EXCEPTION 'success next_attempt_at regression';
  END IF;

  UPDATE public.outbox_events SET status='failed', attempts=2, next_attempt_at=now() + interval '10 minutes' WHERE id=v_event;
  IF (SELECT next_attempt_at <= now() FROM public.outbox_events WHERE id=v_event) THEN
    RAISE EXCEPTION 'retry backoff regression';
  END IF;

  UPDATE public.outbox_events SET status='dead', attempts=5, next_attempt_at=now() WHERE id=v_event;
  IF (SELECT next_attempt_at IS NULL OR status<>'dead' FROM public.outbox_events WHERE id=v_event) THEN
    RAISE EXCEPTION 'terminal dead regression';
  END IF;

  BEGIN
    PERFORM public.retry_outbox_event(v_event);
    RAISE EXCEPTION 'receipt replay must be denied';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM NOT LIKE 'reprocessamento de recibo exige aprovação%' THEN
      RAISE;
    END IF;
  END;

  INSERT INTO public.outbox_events(escola_id,event_type,status,attempts)
  VALUES(v_school,'synthetic_notification','failed',5)
  RETURNING id INTO v_retry;

  PERFORM public.retry_outbox_event(v_retry);
  IF EXISTS(SELECT 1 FROM public.outbox_events
           WHERE id=v_retry AND (status<>'pending' OR attempts<>0 OR next_attempt_at IS NULL)) THEN
    RAISE EXCEPTION 'generic safe retry failed';
  END IF;
END $$;
COMMIT;

-- Reprocessamento gated: only the synthetic event with no existing receipt
-- may become pending. The event with a receipt stays dead.
INSERT INTO public.outbox_events(id,escola_id,event_type,status,attempts,payload)
VALUES
('00000000-0000-4000-8000-000000000011','00000000-0000-4000-8000-000000000001',
 'financeiro_recibo_pagamento','dead',5,'{"pagamento_id":"synthetic-retry"}'::jsonb),
('00000000-0000-4000-8000-000000000012','00000000-0000-4000-8000-000000000001',
 'financeiro_recibo_pagamento','dead',5,'{"pagamento_id":"synthetic-already-sent"}'::jsonb);
INSERT INTO public.documentos_emitidos(escola_id,tipo,idempotency_key,dados_snapshot)
VALUES('00000000-0000-4000-8000-000000000001','recibo',
 'pagamento_recibo:synthetic-already-sent','{"pagamento_id":"synthetic-already-sent"}'::jsonb);

\set event_id 00000000-0000-4000-8000-000000000011
\set approval OWNER_APPROVED_RECEIPT_REPLAY
\ir ../scripts/replay_receipt_outbox_GATED.sql

\set event_id 00000000-0000-4000-8000-000000000012
\ir ../scripts/replay_receipt_outbox_GATED.sql

DO $$
BEGIN
 IF (SELECT status::text FROM public.outbox_events
      WHERE id='00000000-0000-4000-8000-000000000011') <> 'pending' THEN
   RAISE EXCEPTION 'approved safe replay did not requeue';
 END IF;
 IF (SELECT status::text FROM public.outbox_events
      WHERE id='00000000-0000-4000-8000-000000000012') <> 'dead' THEN
   RAISE EXCEPTION 'duplicate receipt replay was not blocked';
 END IF;
 IF (SELECT count(*) FROM public.documentos_emitidos
      WHERE idempotency_key='pagamento_recibo:synthetic-already-sent') <> 1 THEN
   RAISE EXCEPTION 'duplicate receipt was created';
 END IF;
END $$;
