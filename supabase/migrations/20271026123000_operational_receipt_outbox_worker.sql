-- Operational school receipts only. The unhomologated fiscal engine stays OFF.
-- New events are handled every minute; historical pending/failed/dead entries
-- are explicitly excluded pending per-payment audited reconciliation.
CREATE TABLE IF NOT EXISTS public.operational_receipt_worker_control (
  singleton boolean PRIMARY KEY DEFAULT true CHECK (singleton),
  started_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  enabled boolean NOT NULL DEFAULT true
);
ALTER TABLE public.operational_receipt_worker_control ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.operational_receipt_worker_control FROM PUBLIC, anon, authenticated, service_role;
INSERT INTO public.operational_receipt_worker_control (singleton, started_at, enabled)
VALUES (true, clock_timestamp(), true)
ON CONFLICT (singleton) DO NOTHING;

CREATE OR REPLACE FUNCTION public.process_operational_receipt_outbox(p_limit integer DEFAULT 20)
RETURNS TABLE (issued_count integer, skipped_count integer, failed_count integer)
LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO pg_catalog, public
AS $worker$
DECLARE
  v_cutover timestamptz;
  v_active boolean;
  v_event public.outbox_events%ROWTYPE;
  v_payment public.pagamentos%ROWTYPE;
  v_monthly public.mensalidades%ROWTYPE;
  v_aluno_nome text;
  v_aluno_bi text;
  v_document_id uuid;
  v_monthly_id uuid;
  v_payment_id uuid;
  v_rpc jsonb;
  v_key text;
  v_fingerprint text;
  v_hash text;
  v_numero integer;
  v_error text;
BEGIN
  issued_count := 0;
  skipped_count := 0;
  failed_count := 0;

  SELECT c.started_at, c.enabled INTO v_cutover, v_active
    FROM public.operational_receipt_worker_control c WHERE c.singleton;
  IF NOT FOUND OR NOT v_active THEN
    RETURN NEXT;
    RETURN;
  END IF;

  -- Locking each event prevents overlapping cron invocations from double-claiming.
  -- The pre-cutover backlog must be reconciled, not automatically fiscalized.
  FOR v_event IN
    SELECT e.*
      FROM public.outbox_events e
     WHERE e.event_type = 'financeiro_recibo_pagamento'
       AND e.status IN ('pending', 'failed')
       AND e.created_at >= v_cutover
       AND e.next_attempt_at <= clock_timestamp()
       AND e.attempts < e.max_attempts
     ORDER BY e.created_at, e.id
     LIMIT LEAST(GREATEST(COALESCE(p_limit, 20), 1), 50)
     FOR UPDATE OF e SKIP LOCKED
  LOOP
    UPDATE public.outbox_events e
       SET status = 'processing', attempts = e.attempts + 1,
           locked_at = clock_timestamp(), locked_by = 'operational_receipt_pg_cron'
     WHERE e.id = v_event.id;
    BEGIN
      -- Always use the persisted payment and tenant, never only event metadata.
      v_payment_id := NULLIF(v_event.payload->>'pagamento_id', '')::uuid;
      IF v_payment_id IS NULL THEN
        RAISE EXCEPTION 'RECEIPT_PAYMENT_ID_REQUIRED';
      END IF;

      SELECT p.* INTO v_payment FROM public.pagamentos p
       WHERE p.id = v_payment_id FOR SHARE;
      IF NOT FOUND THEN
        RAISE EXCEPTION 'RECEIPT_PAYMENT_NOT_FOUND';
      END IF;
      IF v_payment.escola_id IS DISTINCT FROM v_event.escola_id THEN
        RAISE EXCEPTION 'RECEIPT_TENANT_MISMATCH';
      END IF;
      v_monthly_id := NULLIF(v_event.payload->>'mensalidade_id', '')::uuid;
      IF v_payment.mensalidade_id IS DISTINCT FROM v_monthly_id THEN
        RAISE EXCEPTION 'RECEIPT_MONTHLY_ID_MISMATCH';
      END IF;
      IF v_payment.status = 'voided' THEN
        UPDATE public.outbox_events
           SET status = 'dead', last_error = 'RECEIPT_PAYMENT_VOIDED',
               locked_at = NULL, locked_by = NULL,
               next_attempt_at = clock_timestamp()
         WHERE id = v_event.id;
        skipped_count := skipped_count + 1;
        CONTINUE;
      END IF;
      IF v_payment.status NOT IN ('settled','concluido') THEN
        RAISE EXCEPTION 'RECEIPT_PAYMENT_NOT_SETTLED:%', v_payment.status;
      END IF;
      -- Intermediate items have one consolidated receipt issued by checkout.
      IF v_payment.meta->'emitir_recibo' = 'false'::jsonb THEN
        UPDATE public.outbox_events
           SET status = 'sent', processed_at = clock_timestamp(),
               last_error = NULL, locked_at = NULL, locked_by = NULL,
               next_attempt_at = clock_timestamp()
         WHERE id = v_event.id;
        skipped_count := skipped_count + 1;
        CONTINUE;
      END IF;

      IF v_payment.mensalidade_id IS NOT NULL THEN
        SELECT m.* INTO v_monthly FROM public.mensalidades m
         WHERE m.id = v_payment.mensalidade_id;
        IF NOT FOUND OR v_monthly.escola_id IS DISTINCT FROM v_payment.escola_id
          OR v_monthly.aluno_id IS DISTINCT FROM v_payment.aluno_id THEN
          RAISE EXCEPTION 'RECEIPT_MONTHLY_SCOPE_MISMATCH';
        END IF;
        v_rpc := public.emitir_recibo_system(v_monthly.id);
        IF COALESCE(v_rpc->>'ok','false') <> 'true' THEN
          RAISE EXCEPTION 'RECEIPT_MONTHLY_RPC_REJECTED:%', COALESCE(v_rpc->>'erro','unknown');
        END IF;
      ELSE
        -- A service receipt is unique by school and settled payment.
        IF v_payment.aluno_id IS NULL OR v_payment.valor_pago <= 0 THEN
          RAISE EXCEPTION 'RECEIPT_SERVICE_INVALID_PAYMENT';
        END IF;
        SELECT a.nome, a.bi_numero INTO v_aluno_nome, v_aluno_bi
          FROM public.alunos a
         WHERE a.id = v_payment.aluno_id AND a.escola_id = v_payment.escola_id;
        IF NOT FOUND THEN
          RAISE EXCEPTION 'RECEIPT_SERVICE_STUDENT_SCOPE_MISMATCH';
        END IF;

        v_key := 'pagamento_recibo:' || v_payment.id::text;
        SELECT d.id INTO v_document_id FROM public.documentos_emitidos d
         WHERE d.escola_id = v_payment.escola_id AND d.tipo = 'recibo'
           AND (d.idempotency_key = v_key
                OR d.dados_snapshot->>'pagamento_id' = v_payment.id::text)
         LIMIT 1;
        IF v_document_id IS NULL THEN
          v_fingerprint := encode(sha256(convert_to(
            'pagamento_recibo:v1:' || v_payment.escola_id::text || ':' || v_payment.id::text,
            'UTF8')), 'hex');
          v_hash := encode(sha256(convert_to(
            v_payment.id::text || ':' || clock_timestamp()::text, 'UTF8')), 'hex');
          v_numero := public.next_documento_numero(v_payment.escola_id);
          INSERT INTO public.documentos_emitidos (
            escola_id, aluno_id, mensalidade_id, numero_sequencial,
            tipo, idempotency_key, idempotency_fingerprint,
            dados_snapshot, created_by, hash_validacao
          ) VALUES (
            v_payment.escola_id, v_payment.aluno_id, NULL, v_numero,
            'recibo', v_key, v_fingerprint,
            jsonb_build_object(
              'origem', 'pagamento_auto',
              'pagamento_id', v_payment.id,
              'aluno_id', v_payment.aluno_id,
              'aluno_nome', v_aluno_nome,
              'aluno_bi', v_aluno_bi,
              'numero_sequencial', v_numero,
              'tipo_comprovativo', CASE
                WHEN lower(COALESCE(v_payment.meta->>'tipo_comprovativo','')) LIKE '%confirm%'
                     OR lower(COALESCE(v_payment.meta->>'origem','')) LIKE '%rematric%'
                THEN 'confirmacao' ELSE 'pagamento' END,
              'itens_pagamento', COALESCE(v_payment.meta->'itens_pagamento',
                                         v_payment.meta->'itens',
                                         jsonb_build_array(jsonb_build_object(
                                           'descricao', COALESCE(v_payment.meta->>'descricao_item','Serviço escolar'),
                                           'valor', v_payment.valor_pago))),
              'valor_pago', v_payment.valor_pago,
              'data_pagamento', v_payment.data_pagamento,
              'metodo', v_payment.metodo,
              'reference', v_payment.reference,
              'hash_validacao', v_hash
            ), NULL, v_hash
          );
        END IF;
      END IF;

      UPDATE public.outbox_events
         SET status = 'sent', processed_at = clock_timestamp(),
             last_error = NULL, next_attempt_at = clock_timestamp(),
             locked_at = NULL, locked_by = NULL
       WHERE id = v_event.id;
      issued_count := issued_count + 1;
    EXCEPTION WHEN OTHERS THEN
      v_error := left(SQLSTATE || ':' || SQLERRM, 900);
      UPDATE public.outbox_events e
         SET status = CASE WHEN e.attempts >= e.max_attempts
                           THEN 'dead'::public.outbox_status
                           ELSE 'failed'::public.outbox_status END,
             last_error = v_error,
             processed_at = NULL,
             next_attempt_at = clock_timestamp()
               + (interval '1 minute' * LEAST(60, power(2, GREATEST(e.attempts, 1))::integer)),
             locked_at = NULL, locked_by = NULL
       WHERE id = v_event.id;
      failed_count := failed_count + 1;
    END;
  END LOOP;
  RETURN NEXT;
END;
$worker$;

REVOKE ALL ON FUNCTION public.process_operational_receipt_outbox(integer)
  FROM PUBLIC, anon, authenticated, service_role;
-- Only the database-owned pg_cron job (postgres) can execute this function.
SELECT cron.schedule(
  'operational-receipts-1m',
  '* * * * *',
  'SELECT * FROM public.process_operational_receipt_outbox(20);'
);
