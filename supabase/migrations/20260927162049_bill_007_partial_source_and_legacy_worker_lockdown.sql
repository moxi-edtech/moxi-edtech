BEGIN;

CREATE OR REPLACE FUNCTION public.financeiro_require_source_for_partial_settlement()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'pg_catalog','public'
AS $bill$
DECLARE
  v_m public.mensalidades%ROWTYPE;
  v_expected numeric(18,2);
  v_paid numeric(18,2);
  v_outstanding numeric(18,2);
  v_source_ok boolean := false;
BEGIN
  IF NEW.mensalidade_id IS NULL
     OR NEW.status NOT IN ('settled','concluido','pago')
     OR (TG_OP='UPDATE' AND OLD.status IN ('settled','concluido','pago')) THEN
    RETURN NEW;
  END IF;

  SELECT * INTO v_m
  FROM public.mensalidades
  WHERE id=NEW.mensalidade_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'DATA: mensalidade associada não encontrada';
  END IF;

  v_expected := round(COALESCE(v_m.valor_previsto,v_m.valor,0)::numeric,2);
  v_paid := round(COALESCE(v_m.valor_pago_total,0)::numeric,2);
  v_outstanding := GREATEST(round(v_expected-v_paid,2),0);

  IF round(COALESCE(NEW.valor_pago,0)::numeric,2) < v_outstanding - 0.01 THEN
    IF v_m.fiscal_documento_id IS NOT NULL THEN
      SELECT EXISTS (
        SELECT 1
        FROM public.fiscal_documentos d
        WHERE d.id=v_m.fiscal_documento_id
          AND d.tipo_documento IN ('FT','ND')
          AND d.status='emitido'
      ) INTO v_source_ok;
    END IF;

    IF NOT v_source_ok THEN
      RAISE EXCEPTION
        'STATE: pagamento parcial exige FT/ND fiscal de origem emitida antes da liquidação';
    END IF;
  END IF;

  RETURN NEW;
END;
$bill$;

DROP TRIGGER IF EXISTS trg_pagamentos_partial_requires_source
ON public.pagamentos;

CREATE TRIGGER trg_pagamentos_partial_requires_source
BEFORE INSERT OR UPDATE OF status ON public.pagamentos
FOR EACH ROW EXECUTE FUNCTION public.financeiro_require_source_for_partial_settlement();

REVOKE EXECUTE ON FUNCTION public.financeiro_require_source_for_partial_settlement()
FROM PUBLIC, anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.process_outbox_batch_p0_v2(
  p_batch_size integer DEFAULT 20,
  p_max_retries integer DEFAULT 5
)
RETURNS TABLE(processed_count integer, failed_count integer)
LANGUAGE plpgsql
SET search_path TO 'public'
AS $bill$
DECLARE
  v_now timestamptz := now();
  v_processed integer := 0;
  v_failed integer := 0;
  v_row record;
BEGIN
  FOR v_row IN
    WITH claimed AS (
      UPDATE public.outbox_events oe
      SET
        status = 'processing'::public.outbox_status,
        locked_at = v_now,
        locked_by = 'db_worker_' || pg_backend_pid()::text,
        attempts = oe.attempts + 1
      WHERE oe.id IN (
        SELECT oe2.id
        FROM public.outbox_events oe2
        WHERE oe2.status IN ('pending'::public.outbox_status, 'failed'::public.outbox_status)
          AND oe2.next_attempt_at <= v_now
          AND oe2.attempts < p_max_retries
          AND oe2.event_type <> 'financeiro_recibo_pagamento'
        ORDER BY
          CASE oe2.event_type
            WHEN 'pagamento_registrado' THEN 1
            WHEN 'matricula_criada' THEN 3
            ELSE 4
          END,
          oe2.created_at
        LIMIT p_batch_size
        FOR UPDATE SKIP LOCKED
      )
      RETURNING oe.id, oe.escola_id, oe.event_type, oe.payload
    )
    SELECT * FROM claimed
  LOOP
    BEGIN
      IF v_row.event_type = 'pagamento_registrado' THEN
        PERFORM public.update_financeiro_from_pagamento(
          jsonb_build_object(
            'id',v_row.id,'escola_id',v_row.escola_id,
            'event_type',v_row.event_type,'payload',v_row.payload
          )
        );
      ELSIF v_row.event_type = 'nota_lancada' THEN
        PERFORM public.update_pedagogico_from_nota(
          jsonb_build_object(
            'id',v_row.id,'escola_id',v_row.escola_id,
            'event_type',v_row.event_type,'payload',v_row.payload
          )
        );
      ELSIF v_row.event_type = 'presenca_lancada' THEN
        PERFORM public.update_secretaria_from_presenca(
          jsonb_build_object(
            'id',v_row.id,'escola_id',v_row.escola_id,
            'event_type',v_row.event_type,'payload',v_row.payload
          )
        );
      ELSIF v_row.event_type = 'matricula_criada' THEN
        PERFORM public.update_secretaria_from_matricula(
          jsonb_build_object(
            'id',v_row.id,'escola_id',v_row.escola_id,
            'event_type',v_row.event_type,'payload',v_row.payload
          )
        );
      END IF;

      UPDATE public.outbox_events
      SET status='sent'::public.outbox_status,
          processed_at=v_now,locked_at=NULL,locked_by=NULL,last_error=NULL
      WHERE id=v_row.id;

      v_processed := v_processed+1;
    EXCEPTION WHEN OTHERS THEN
      UPDATE public.outbox_events
      SET status=CASE
          WHEN attempts >= p_max_retries THEN 'dead'::public.outbox_status
          ELSE 'failed'::public.outbox_status
        END,
        next_attempt_at=v_now + (INTERVAL '10 seconds' * power(2,GREATEST(attempts,1))),
        locked_at=NULL,locked_by=NULL,last_error=SQLERRM
      WHERE id=v_row.id;

      v_failed := v_failed+1;
    END;
  END LOOP;

  RETURN QUERY SELECT v_processed,v_failed;
END;
$bill$;

COMMIT;