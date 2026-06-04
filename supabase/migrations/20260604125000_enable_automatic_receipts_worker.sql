BEGIN;

-- Atualizar o worker do banco para processar também a geração de recibos
CREATE OR REPLACE FUNCTION public.process_outbox_batch_p0_v2(p_batch_size integer DEFAULT 20, p_max_retries integer DEFAULT 5)
 RETURNS TABLE(processed_count integer, failed_count integer)
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
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
        ORDER BY
          CASE oe2.event_type
            WHEN 'pagamento_registrado' THEN 1
            WHEN 'financeiro_recibo_pagamento' THEN 2
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
      -- Roteamento
      IF v_row.event_type = 'pagamento_registrado' THEN
        PERFORM public.update_financeiro_from_pagamento(
          jsonb_build_object(
            'id', v_row.id,
            'escola_id', v_row.escola_id,
            'event_type', v_row.event_type,
            'payload', v_row.payload
          )
        );

      ELSIF v_row.event_type = 'financeiro_recibo_pagamento' THEN
        -- Geração Automática de Recibo (V2)
        PERFORM public.emitir_recibo_system((v_row.payload->>'mensalidade_id')::uuid);

      ELSIF v_row.event_type = 'nota_lancada' THEN
        PERFORM public.update_pedagogico_from_nota(
          jsonb_build_object(
            'id', v_row.id,
            'escola_id', v_row.escola_id,
            'event_type', v_row.event_type,
            'payload', v_row.payload
          )
        );

      ELSIF v_row.event_type = 'presenca_lancada' THEN
        PERFORM public.update_secretaria_from_presenca(
          jsonb_build_object(
            'id', v_row.id,
            'escola_id', v_row.escola_id,
            'event_type', v_row.event_type,
            'payload', v_row.payload
          )
        );

      ELSIF v_row.event_type = 'matricula_criada' THEN
        PERFORM public.update_secretaria_from_matricula(
          jsonb_build_object(
            'id', v_row.id,
            'escola_id', v_row.escola_id,
            'event_type', v_row.event_type,
            'payload', v_row.payload
          )
        );

      END IF;

      UPDATE public.outbox_events
      SET
        status = 'sent'::public.outbox_status,
        processed_at = v_now,
        locked_at = NULL,
        locked_by = NULL,
        last_error = NULL
      WHERE id = v_row.id;

      v_processed := v_processed + 1;

    EXCEPTION WHEN OTHERS THEN
      UPDATE public.outbox_events
      SET
        status = CASE
          WHEN attempts >= p_max_retries THEN 'dead'::public.outbox_status
          ELSE 'failed'::public.outbox_status
        END,
        next_attempt_at = v_now + (INTERVAL '10 seconds' * power(2, GREATEST(attempts,1))),
        locked_at = NULL,
        locked_by = NULL,
        last_error = SQLERRM
      WHERE id = v_row.id;

      v_failed := v_failed + 1;
    END;
  END LOOP;

  RETURN QUERY SELECT v_processed, v_failed;
END;
$function$;

-- Garantir agendamento no pg_cron (a cada 1 minuto)
SELECT cron.schedule(
  'outbox-db-worker-1m',
  '* * * * *',
  'SELECT public.process_outbox_batch_p0_v2(50, 5);'
);

COMMIT;
