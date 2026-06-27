CREATE OR REPLACE FUNCTION public.claim_outbox_events(p_topic text DEFAULT NULL::text, p_limit integer DEFAULT 20)
RETURNS SETOF public.outbox_events
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public
AS $$
BEGIN
  RETURN QUERY
  WITH candidate AS (
    SELECT id
    FROM public.outbox_events
    WHERE status IN ('pending', 'failed')
      AND coalesce(next_attempt_at, created_at) <= now()
      AND attempts < max_attempts
      AND (p_topic IS NULL OR event_type = p_topic)
    ORDER BY created_at
    LIMIT GREATEST(1, LEAST(p_limit, 50))
    FOR UPDATE SKIP LOCKED
  )
  UPDATE public.outbox_events o
     SET status = 'processing',
         attempts = o.attempts + 1,
         locked_at = now(),
         locked_by = 'outbox_worker'
   WHERE o.id IN (SELECT id FROM candidate)
  RETURNING o.*;
END;
$$;
