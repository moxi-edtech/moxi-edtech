CREATE TABLE IF NOT EXISTS public.outbox_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  escola_id uuid NOT NULL,
  topic text NOT NULL,
  request_id uuid NOT NULL,
  idempotency_key text NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'pending',
  attempts int NOT NULL DEFAULT 0,
  max_attempts int NOT NULL DEFAULT 5,
  next_run_at timestamptz NOT NULL DEFAULT now(),
  locked_at timestamptz,
  locked_by text,
  created_at timestamptz NOT NULL DEFAULT now(),
  processed_at timestamptz,
  last_error text
);

CREATE INDEX IF NOT EXISTS idx_outbox_events_status_run
  ON public.outbox_events (status, next_run_at, created_at);

CREATE INDEX IF NOT EXISTS idx_outbox_events_topic_status
  ON public.outbox_events (topic, status, created_at);

CREATE UNIQUE INDEX IF NOT EXISTS ux_outbox_events_idempotency
  ON public.outbox_events (idempotency_key);

ALTER TABLE public.outbox_events ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'outbox_events'
      AND policyname = 'outbox_events_insert'
  ) THEN
    CREATE POLICY outbox_events_insert
      ON public.outbox_events
      FOR INSERT
      TO authenticated
      WITH CHECK (public.can_manage_school(escola_id));
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.enqueue_outbox_event(
  p_escola_id uuid,
  p_topic text,
  p_payload jsonb,
  p_request_id uuid DEFAULT gen_random_uuid(),
  p_idempotency_key text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id uuid;
BEGIN
  IF NOT public.can_manage_school(p_escola_id) THEN
    RAISE EXCEPTION 'sem permissão para escola %', p_escola_id;
  END IF;

  INSERT INTO public.outbox_events (escola_id, topic, request_id, idempotency_key, payload)
  VALUES (
    p_escola_id,
    p_topic,
    p_request_id,
    COALESCE(p_idempotency_key, p_topic || ':' || p_request_id::text),
    p_payload
  )
  ON CONFLICT DO NOTHING
  RETURNING id INTO v_id;

  IF v_id IS NULL THEN
    SELECT id
      INTO v_id
      FROM public.outbox_events
     WHERE idempotency_key = COALESCE(p_idempotency_key, p_topic || ':' || p_request_id::text);
  END IF;

  RETURN v_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.claim_outbox_events(
  p_topic text DEFAULT NULL,
  p_limit int DEFAULT 20
)
RETURNS SETOF public.outbox_events
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  WITH candidate AS (
    SELECT id
    FROM public.outbox_events
    WHERE status IN ('pending', 'failed')
      AND next_run_at <= now()
      AND attempts < max_attempts
      AND (p_topic IS NULL OR topic = p_topic)
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

CREATE OR REPLACE FUNCTION public.retry_outbox_event(
  p_event_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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
$$;

CREATE OR REPLACE FUNCTION public.outbox_requeue_stuck()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.outbox_events
     SET status = 'pending',
         next_run_at = now()
   WHERE status = 'processing'
     AND attempts < 5
     AND created_at < now() - interval '10 minutes';
END;
$$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_namespace WHERE nspname = 'cron') THEN
    IF NOT EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'outbox_requeue_stuck') THEN
      PERFORM cron.schedule(
        'outbox_requeue_stuck',
        '*/5 * * * *',
        'SELECT public.outbox_requeue_stuck();'
      );
    END IF;
  END IF;
END $$;
