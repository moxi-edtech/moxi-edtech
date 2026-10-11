-- Prepared-only migration. DO NOT apply on production without owner approval.
-- The column is already NOT NULL DEFAULT now() on the production database.
-- Reassert the insert default; keep the NOT NULL constraint unchanged.
ALTER TABLE public.outbox_events
  ALTER COLUMN next_attempt_at SET DEFAULT now();

-- Legacy retry_outbox_event referred to a nonexistent next_run_at column.
-- Preserve role validation and SECURITY DEFINER; receipt replay requires a
-- separately approved runbook, not the generic user-facing retry RPC.
CREATE OR REPLACE FUNCTION public.retry_outbox_event(p_event_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_escola_id uuid;
  v_event_type text;
  v_status text;
BEGIN
  SELECT escola_id, event_type, status::text
    INTO v_escola_id, v_event_type, v_status
    FROM public.outbox_events
   WHERE id = p_event_id
   FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Outbox event não encontrado';
  END IF;

  IF NOT public.can_manage_school(v_escola_id) THEN
    RAISE EXCEPTION 'sem permissão para escola';
  END IF;

  IF v_event_type = 'financeiro_recibo_pagamento' THEN
    RAISE EXCEPTION 'reprocessamento de recibo exige aprovação operacional separada';
  END IF;

  IF v_status NOT IN ('failed', 'dead') THEN
    RAISE EXCEPTION 'somente eventos failed/dead podem ser retomados';
  END IF;

  UPDATE public.outbox_events
     SET status = 'pending',
         attempts = 0,
         next_attempt_at = now(),
         processed_at = NULL,
         last_error = NULL,
         locked_at = NULL,
         locked_by = NULL
   WHERE id = p_event_id;
END;
$function$;
