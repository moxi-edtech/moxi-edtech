-- Migration: Whatsapp Inbox V2.1
-- Timestamp: 20260627120000

CREATE TABLE IF NOT EXISTS public.communication_threads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES public.escolas(id) ON DELETE CASCADE,
  channel text NOT NULL CHECK (channel IN ('whatsapp')),
  provider text NOT NULL CHECK (provider IN ('waha', 'manual')),
  session_name_hash text NULL,
  contact_phone_hash text NOT NULL,
  contact_phone_masked text NOT NULL,
  contact_name text NULL,
  contact_role text NOT NULL CHECK (contact_role IN ('student', 'guardian', 'teacher', 'manual_contact', 'unknown')),
  linked_entity_type text NOT NULL CHECK (linked_entity_type IN ('student', 'guardian', 'teacher', 'manual_contact', 'unknown')),
  linked_entity_id uuid NULL,
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'pending', 'resolved', 'archived', 'blocked')),
  assigned_to uuid NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  last_message_preview text NULL,
  last_message_at timestamptz NULL,
  unread_count integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_comm_threads_school_phone_hash UNIQUE (school_id, contact_phone_hash)
);

CREATE TABLE IF NOT EXISTS public.communication_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id uuid NOT NULL REFERENCES public.communication_threads(id) ON DELETE CASCADE,
  school_id uuid NOT NULL REFERENCES public.escolas(id) ON DELETE CASCADE,
  direction text NOT NULL CHECK (direction IN ('inbound', 'outbound')),
  channel text NOT NULL DEFAULT 'whatsapp',
  provider text NOT NULL DEFAULT 'waha',
  provider_message_id text NULL,
  provider_event_id text NULL,
  sender_phone_hash text NOT NULL,
  sender_phone_masked text NOT NULL,
  recipient_phone_hash text NOT NULL,
  recipient_phone_masked text NOT NULL,
  body text NOT NULL,
  body_preview text NULL,
  body_sanitized text NULL,
  message_type text NOT NULL,
  status text NOT NULL DEFAULT 'received' CHECK (status IN ('received', 'queued', 'sending', 'sent', 'delivered', 'read', 'failed', 'deleted')),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  sent_by uuid NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  received_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_comm_threads_school_status_last_msg
  ON public.communication_threads (school_id, status, last_message_at DESC);

CREATE INDEX IF NOT EXISTS idx_comm_threads_phone_hash
  ON public.communication_threads (contact_phone_hash);

CREATE UNIQUE INDEX IF NOT EXISTS ux_comm_messages_provider_event_id
  ON public.communication_messages (provider_event_id)
  WHERE provider_event_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS ux_comm_messages_provider_message_id
  ON public.communication_messages (provider_message_id)
  WHERE provider_message_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_comm_messages_thread_id
  ON public.communication_messages (thread_id);

CREATE INDEX IF NOT EXISTS idx_comm_messages_school_id
  ON public.communication_messages (school_id);

-- RLS
ALTER TABLE public.communication_threads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.communication_messages ENABLE ROW LEVEL SECURITY;

-- Revoke all, grant minimums
REVOKE ALL ON public.communication_threads FROM anon, authenticated;
REVOKE ALL ON public.communication_messages FROM anon, authenticated;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.communication_threads TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.communication_messages TO authenticated;

GRANT ALL ON public.communication_threads TO service_role;
GRANT ALL ON public.communication_messages TO service_role;

-- Policies for communication_threads
CREATE POLICY communication_threads_select ON public.communication_threads
FOR SELECT TO authenticated
USING (
  public.user_has_role_in_school(
    school_id,
    ARRAY['admin','admin_escola','staff_admin','direcao','diretoria','secretaria','financeiro','admin_financeiro','secretaria_financeiro']::text[]
  )
);

CREATE POLICY communication_threads_insert ON public.communication_threads
FOR INSERT TO authenticated
WITH CHECK (
  public.user_has_role_in_school(
    school_id,
    ARRAY['admin','admin_escola','staff_admin','direcao','diretoria','secretaria','financeiro','admin_financeiro','secretaria_financeiro']::text[]
  )
);

CREATE POLICY communication_threads_update ON public.communication_threads
FOR UPDATE TO authenticated
USING (
  public.user_has_role_in_school(
    school_id,
    ARRAY['admin','admin_escola','staff_admin','direcao','diretoria','secretaria','financeiro','admin_financeiro','secretaria_financeiro']::text[]
  )
)
WITH CHECK (
  public.user_has_role_in_school(
    school_id,
    ARRAY['admin','admin_escola','staff_admin','direcao','diretoria','secretaria','financeiro','admin_financeiro','secretaria_financeiro']::text[]
  )
);

-- Policies for communication_messages
CREATE POLICY communication_messages_select ON public.communication_messages
FOR SELECT TO authenticated
USING (
  public.user_has_role_in_school(
    school_id,
    ARRAY['admin','admin_escola','staff_admin','direcao','diretoria','secretaria','financeiro','admin_financeiro','secretaria_financeiro']::text[]
  )
);

CREATE POLICY communication_messages_insert ON public.communication_messages
FOR INSERT TO authenticated
WITH CHECK (
  public.user_has_role_in_school(
    school_id,
    ARRAY['admin','admin_escola','staff_admin','direcao','diretoria','secretaria','financeiro','admin_financeiro','secretaria_financeiro']::text[]
  )
);

CREATE POLICY communication_messages_update ON public.communication_messages
FOR UPDATE TO authenticated
USING (
  public.user_has_role_in_school(
    school_id,
    ARRAY['admin','admin_escola','staff_admin','direcao','diretoria','secretaria','financeiro','admin_financeiro','secretaria_financeiro']::text[]
  )
)
WITH CHECK (
  public.user_has_role_in_school(
    school_id,
    ARRAY['admin','admin_escola','staff_admin','direcao','diretoria','secretaria','financeiro','admin_financeiro','secretaria_financeiro']::text[]
  )
);
