-- OWNER-GATED. NEVER run without separately verified provider/channel evidence.
-- Default invocation is READ-ONLY DRY-RUN. Prints only event ID and counts.
-- psql -X -v ON_ERROR_STOP=1 -v event_id=<UUID> -f this-file
-- Writing requires ALL:
--   -v run_write=true
--   -v owner_approval=OWNER_APPROVED_RECEIPT_REPLAY
--   -v classification=NUNCA_ENTREGUE
--   -v evidence_ref=<opaque-operator-approved-reference>
-- Manual prerequisite: out-of-band proof that no delivery or document exists
-- for this exact payment in every integrated provider. Never trust absence of
-- local communication rows as proof of non-delivery.
\set ON_ERROR_STOP on
\if :{?event_id}
\else
  \echo 'BLOCKED: an event ID is required'
  \quit 2
\endif
\if :{?run_write}
\else
  \set run_write false
\endif
\if :run_write
  \if :{?classification}
  \else
    \echo 'BLOCKED: classification must be supplied'
    \quit 2
  \endif
  \if :{?evidence_ref}
  \else
    \echo 'BLOCKED: external non-delivery evidence must be supplied'
    \quit 2
  \endif
  \if :{?owner_approval}
  \else
    \echo 'BLOCKED: owner approval missing'
    \quit 2
  \endif
  BEGIN;
  SELECT set_config('klasse.replay_classification', :'classification', true);
  SELECT set_config('klasse.replay_evidence_ref', :'evidence_ref', true);
  SELECT set_config('klasse.replay_owner_approval', :'owner_approval', true);
  SELECT set_config('klasse.replay_event_id', :'event_id', true);
  DO $gate$
  DECLARE candidate public.outbox_events%ROWTYPE;
          payment_ref text;
  BEGIN
    IF current_setting('klasse.replay_owner_approval',true) IS DISTINCT FROM 'OWNER_APPROVED_RECEIPT_REPLAY'
      OR current_setting('klasse.replay_classification',true) IS DISTINCT FROM 'NUNCA_ENTREGUE'
      OR length(btrim(current_setting('klasse.replay_evidence_ref',true))) < 12
    THEN RAISE EXCEPTION 'Proof/approval gate not satisfied'; END IF;
    SELECT * INTO candidate FROM public.outbox_events
      WHERE id=current_setting('klasse.replay_event_id')::uuid
        AND event_type='financeiro_recibo_pagamento'
        AND status::text IN ('failed','dead')
      FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Event not eligible for reprocessing'; END IF;
    payment_ref:=candidate.payload->>'pagamento_id';
    IF payment_ref IS NULL THEN RAISE EXCEPTION 'Missing payment identity'; END IF;
    IF EXISTS (
      SELECT 1 FROM public.documentos_emitidos d
       WHERE d.escola_id=candidate.escola_id AND d.tipo='recibo'
         AND (d.dados_snapshot->>'pagamento_id'=payment_ref
              OR d.idempotency_key='pagamento_recibo:'||payment_ref
              OR (candidate.payload->>'mensalidade_id' IS NOT NULL
                  AND d.mensalidade_id::text=candidate.payload->>'mensalidade_id'))
    ) THEN
      RAISE EXCEPTION 'Receipt exists: cannot replay';
    END IF;
    IF EXISTS (
      SELECT 1 FROM public.communication_outbox c
        WHERE c.school_id=candidate.escola_id AND c.delivered_at IS NOT NULL
          AND (c.source_entity_id::text=payment_ref
               OR c.metadata->>'pagamento_id'=payment_ref)
    ) THEN RAISE EXCEPTION 'Recorded delivery: cannot replay'; END IF;

    CREATE SCHEMA IF NOT EXISTS private;
    CREATE TABLE IF NOT EXISTS private.receipt_outbox_replay_backups (
      event_id uuid PRIMARY KEY,
      original_row jsonb NOT NULL,
      reason_ref text NOT NULL,
      captured_at timestamptz NOT NULL DEFAULT now()
    );
    REVOKE ALL ON private.receipt_outbox_replay_backups FROM PUBLIC,anon,authenticated;
    INSERT INTO private.receipt_outbox_replay_backups(event_id,original_row,reason_ref)
    VALUES(candidate.id,to_jsonb(candidate),current_setting('klasse.replay_evidence_ref'))
    ON CONFLICT(event_id) DO NOTHING;
    IF NOT FOUND THEN RAISE EXCEPTION 'Event already replayed before: blocked'; END IF;
    UPDATE public.outbox_events SET
       status='pending',attempts=0,next_attempt_at=now(),processed_at=NULL,
       last_error=NULL,locked_at=NULL,locked_by=NULL
    WHERE id=candidate.id;
  END $gate$;
  COMMIT;
\else
  SELECT e.id,e.status::text AS current_status,e.attempts,e.max_attempts,
     (SELECT count(*) FROM public.documentos_emitidos d
        WHERE d.escola_id=e.escola_id AND d.tipo='recibo'
          AND (d.idempotency_key='pagamento_recibo:'||(e.payload->>'pagamento_id')
             OR d.dados_snapshot->>'pagamento_id'=e.payload->>'pagamento_id')
     ) AS matching_receipts,
     'DRY_RUN_NO_CHANGE' AS result
  FROM public.outbox_events e
  WHERE e.id=:'event_id'::uuid AND e.event_type='financeiro_recibo_pagamento';
\endif
