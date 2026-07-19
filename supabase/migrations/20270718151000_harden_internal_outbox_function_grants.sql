BEGIN;

-- RPCs invoked only by jobs, workers or Inngest with the service role.
REVOKE EXECUTE ON FUNCTION public.claim_communication_outbox(integer) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.claim_outbox_events(text, integer) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.cleanup_pautas_zip() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.increment_pautas_lote_job(uuid, boolean, boolean) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.outbox_claim(integer, text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.outbox_report_result(uuid, boolean, text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.outbox_requeue_stuck() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.process_outbox_batch(integer) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.claim_communication_outbox(integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.claim_outbox_events(text, integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.cleanup_pautas_zip() TO service_role;
GRANT EXECUTE ON FUNCTION public.increment_pautas_lote_job(uuid, boolean, boolean) TO service_role;
GRANT EXECUTE ON FUNCTION public.outbox_claim(integer, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.outbox_report_result(uuid, boolean, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.outbox_requeue_stuck() TO service_role;
GRANT EXECUTE ON FUNCTION public.process_outbox_batch(integer) TO service_role;

-- These RPCs are used by authenticated API routes; remove public/anonymous access only.
REVOKE EXECUTE ON FUNCTION public.mark_outbox_event_failed(uuid, text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.mark_outbox_event_processed(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.retry_outbox_event(uuid) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.mark_outbox_event_failed(uuid, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.mark_outbox_event_processed(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.retry_outbox_event(uuid) TO authenticated, service_role;

COMMIT;
