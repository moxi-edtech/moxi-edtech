-- Migration: durable WhatsApp agent inbox queue
-- Run: WHATSAPP-AGENT-QUEUE-20260829

CREATE TABLE IF NOT EXISTS public.whatsapp_agent_inbox_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES public.escolas(id) ON DELETE CASCADE,
  session_name text NOT NULL,
  communication_message_id uuid NOT NULL REFERENCES public.communication_messages(id) ON DELETE CASCADE,
  provider_message_id text NOT NULL,
  chat_id text NOT NULL,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'processing', 'processed', 'failed', 'dead_letter')),
  attempts integer NOT NULL DEFAULT 0 CHECK (attempts >= 0),
  available_at timestamptz NOT NULL DEFAULT now(),
  locked_at timestamptz NULL,
  locked_by text NULL,
  processed_at timestamptz NULL,
  last_error text NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_whatsapp_agent_inbox_message UNIQUE (session_name, provider_message_id),
  CONSTRAINT uq_whatsapp_agent_inbox_communication_message UNIQUE (communication_message_id)
);

CREATE INDEX IF NOT EXISTS idx_whatsapp_agent_inbox_claim
  ON public.whatsapp_agent_inbox_events (session_name, status, available_at, created_at);

CREATE INDEX IF NOT EXISTS idx_whatsapp_agent_inbox_chat
  ON public.whatsapp_agent_inbox_events (session_name, chat_id, created_at DESC);

REVOKE ALL ON public.whatsapp_agent_inbox_events FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.whatsapp_agent_inbox_events TO service_role;

CREATE OR REPLACE FUNCTION public.claim_whatsapp_agent_inbox(
  p_session_name text,
  p_limit integer DEFAULT 20,
  p_worker_id text DEFAULT NULL
)
RETURNS SETOF public.whatsapp_agent_inbox_events
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  WITH candidates AS (
    SELECT id
    FROM public.whatsapp_agent_inbox_events
    WHERE session_name = p_session_name
      AND status IN ('pending', 'failed')
      AND available_at <= now()
      AND attempts < 8
    ORDER BY available_at ASC, created_at ASC
    FOR UPDATE SKIP LOCKED
    LIMIT LEAST(GREATEST(COALESCE(p_limit, 20), 1), 50)
  )
  UPDATE public.whatsapp_agent_inbox_events AS event
     SET status = 'processing',
         attempts = event.attempts + 1,
         locked_at = now(),
         locked_by = NULLIF(trim(p_worker_id), ''),
         updated_at = now()
    FROM candidates
   WHERE event.id = candidates.id
  RETURNING event.*;
$$;

REVOKE ALL ON FUNCTION public.claim_whatsapp_agent_inbox(text, integer, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_whatsapp_agent_inbox(text, integer, text) TO service_role;
