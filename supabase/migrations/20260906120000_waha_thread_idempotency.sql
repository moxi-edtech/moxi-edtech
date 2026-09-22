-- Make WAHA inbound thread creation atomic.
-- The previous SELECT-then-INSERT flow could race on
-- uq_comm_threads_school_phone_hash when WAHA delivered/retried events concurrently.

CREATE OR REPLACE FUNCTION public.upsert_communication_thread_for_inbound(
  p_school_id uuid,
  p_contact_phone_hash text,
  p_contact_phone_masked text,
  p_contact_name text,
  p_contact_role text,
  p_linked_entity_type text,
  p_linked_entity_id uuid,
  p_body_preview text,
  p_received_at timestamptz
)
RETURNS public.communication_threads
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_thread public.communication_threads;
BEGIN
  INSERT INTO public.communication_threads (
    school_id,
    channel,
    provider,
    contact_phone_hash,
    contact_phone_masked,
    contact_name,
    contact_role,
    linked_entity_type,
    linked_entity_id,
    status,
    last_message_preview,
    last_message_at,
    unread_count,
    updated_at
  )
  VALUES (
    p_school_id,
    'whatsapp',
    'waha',
    p_contact_phone_hash,
    p_contact_phone_masked,
    p_contact_name,
    p_contact_role,
    p_linked_entity_type,
    p_linked_entity_id,
    'open',
    p_body_preview,
    p_received_at,
    1,
    p_received_at
  )
  ON CONFLICT (school_id, contact_phone_hash) DO UPDATE
  SET
    contact_phone_masked = EXCLUDED.contact_phone_masked,
    contact_name = CASE
      WHEN communication_threads.linked_entity_type <> 'unknown'
        THEN communication_threads.contact_name
      ELSE COALESCE(EXCLUDED.contact_name, communication_threads.contact_name)
    END,
    contact_role = CASE
      WHEN communication_threads.linked_entity_type <> 'unknown'
        THEN communication_threads.contact_role
      ELSE EXCLUDED.contact_role
    END,
    linked_entity_type = CASE
      WHEN communication_threads.linked_entity_type <> 'unknown'
        THEN communication_threads.linked_entity_type
      ELSE EXCLUDED.linked_entity_type
    END,
    linked_entity_id = CASE
      WHEN communication_threads.linked_entity_type <> 'unknown'
        THEN communication_threads.linked_entity_id
      ELSE EXCLUDED.linked_entity_id
    END,
    status = CASE
      WHEN communication_threads.status IN ('archived', 'resolved') THEN 'open'
      ELSE communication_threads.status
    END,
    last_message_preview = EXCLUDED.last_message_preview,
    last_message_at = EXCLUDED.last_message_at,
    unread_count = communication_threads.unread_count + 1,
    updated_at = EXCLUDED.updated_at
  RETURNING * INTO v_thread;

  RETURN v_thread;
END;
$$;

REVOKE ALL ON FUNCTION public.upsert_communication_thread_for_inbound(
  uuid, text, text, text, text, text, uuid, text, timestamptz
) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.upsert_communication_thread_for_inbound(
  uuid, text, text, text, text, text, uuid, text, timestamptz
) TO service_role;
