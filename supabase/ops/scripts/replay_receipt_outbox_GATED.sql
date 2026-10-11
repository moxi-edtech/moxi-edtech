-- STOP: never execute in production without owner's explicit approval.
-- Dry run first on a disposable clone with synthetic data.
-- Usage after approval: psql -v event_id=<approved-uuid> -v approval=OWNER_APPROVED_RECEIPT_REPLAY -f this-file
-- Requires verified receipt consumer idempotency. No PII is emitted here.
\set ON_ERROR_STOP on
\if :{?event_id}
\else
  \echo 'Missing event_id'
  \quit 2
\endif
\if :{?approval}
\else
  \echo 'Missing approval'
  \quit 2
\endif
BEGIN;
SELECT set_config('klasse.receipt_replay_approval', :'approval', true);
DO $$
BEGIN
  IF current_setting('klasse.receipt_replay_approval', true) IS DISTINCT FROM 'OWNER_APPROVED_RECEIPT_REPLAY' THEN
    RAISE EXCEPTION 'Owner approval absent';
  END IF;
END $$;
-- Historical receipts and monthly receipts must be checked before replay.
-- Fail closed if one already exists: the document itself must never be emitted twice.
WITH candidate AS (
  SELECT e.id, e.escola_id, e.payload
    FROM public.outbox_events e
   WHERE e.id = :'event_id'::uuid
     AND e.event_type = 'financeiro_recibo_pagamento'
     AND e.status::text IN ('dead','failed')
   FOR UPDATE
), safe AS (
  SELECT c.id
    FROM candidate c
   WHERE NOT EXISTS (
     SELECT 1 FROM public.documentos_emitidos d
      WHERE d.escola_id = c.escola_id
        AND d.tipo = 'recibo'
        AND (
          (c.payload->>'mensalidade_id' IS NOT NULL
           AND d.mensalidade_id::text = c.payload->>'mensalidade_id')
          OR d.idempotency_key = 'pagamento_recibo:' || (c.payload->>'pagamento_id')
          OR d.dados_snapshot->>'pagamento_id' = c.payload->>'pagamento_id'
        )
   )
)
UPDATE public.outbox_events e
   SET status='pending', attempts=0, next_attempt_at=now(),
       processed_at=NULL, last_error=NULL, locked_at=NULL, locked_by=NULL
 WHERE e.id IN (SELECT id FROM safe)
RETURNING e.status::text AS new_status;
COMMIT;
