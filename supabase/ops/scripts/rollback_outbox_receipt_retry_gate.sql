-- Tested inverse of migration 20261011133652, for owner-approved incident rollback.
-- WARNING: restores the legacy retry_outbox_event implementation which still
-- refers to obsolete next_run_at, and therefore breaks the generic retry RPC.
-- Prefer rolling forward with a separate reviewed migration, if possible.
-- Never execute automatically in production.
CREATE OR REPLACE FUNCTION public.retry_outbox_event(p_event_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_escola_id uuid;
BEGIN
  SELECT escola_id INTO v_escola_id
  FROM public.outbox_events
  WHERE id = p_event_id;

  IF v_escola_id IS NULL THEN
    RAISE EXCEPTION 'Outbox event não encontrado';
  END IF;

  IF NOT public.can_manage_school(v_escola_id) THEN
    RAISE EXCEPTION 'sem permissão para escola %', v_escola_id;
  END IF;

  UPDATE public.outbox_events
     SET status = 'pending',
         next_run_at = now(),
         last_error = NULL
   WHERE id = p_event_id;
END;
$function$;

-- Production already uses now() as the insert default. No destructive DDL.
ALTER TABLE public.outbox_events ALTER COLUMN next_attempt_at SET DEFAULT now();
