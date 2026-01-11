// supabase/functions/outbox-worker/index.ts
import { createClient } from "jsr:@supabase/supabase-js@2";

Deno.serve(async (req) => {
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  const workerId = crypto.randomUUID();

  const { data: events, error } = await supabase.rpc("outbox_claim", {
    batch_size: 25,
    worker_id: workerId,
  });

  if (error) return new Response(JSON.stringify({ ok: false, error: error.message }), { status: 500 });

  for (const ev of events ?? []) {
    try {
      // TODO: process by ev.event_type
      // await handle(ev)

      // Example of handling event types
      switch (ev.event_type) {
        case "AUTH_PROVISION_USER":
          // Logic for provisioning user
          console.log(`Processing AUTH_PROVISION_USER for event ID: ${ev.id}`);
          // Simulate some work
          await new Promise(resolve => setTimeout(resolve, 100));
          break;
        case "WHATSAPP_SEND":
          // Logic for sending WhatsApp message
          console.log(`Processing WHATSAPP_SEND for event ID: ${ev.id}`);
          await new Promise(resolve => setTimeout(resolve, 100));
          break;
        default:
          console.warn(`Unknown event_type: ${ev.event_type} for event ID: ${ev.id}`);
          // Optionally, report as failed if unknown
          throw new Error(`Unknown event_type: ${ev.event_type}`);
      }

      await supabase.rpc("outbox_report_result", { p_id: ev.id, p_ok: true, p_error: null });
      // TODO: supabase.rpc("create_audit", {... OUTBOX_SENT ...})
      // Assuming create_audit exists and logs action, entity, entity_id, etc.
      await supabase.rpc("create_audit", {
        action: "OUTBOX_SENT",
        entity: "outbox_events",
        entity_id: ev.id,
        metadata: {
          event_type: ev.event_type,
          escola_id: ev.escola_id,
        },
      });

    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      await supabase.rpc("outbox_report_result", { p_id: ev.id, p_ok: false, p_error: msg });
      // TODO: audit OUTBOX_FAILED/DEAD (você pode consultar status depois do report)
      // To get the final status after report_result, we'd need another query or modify report_result to return it.
      // For simplicity, we'll log as FAILED here. If it became DEAD, another audit will be needed.
      await supabase.rpc("create_audit", {
        action: "OUTBOX_FAILED",
        entity: "outbox_events",
        entity_id: ev.id,
        metadata: {
          event_type: ev.event_type,
          escola_id: ev.escola_id,
          error: msg,
        },
      });
    }
  }

  return new Response(JSON.stringify({ ok: true, claimed: (events ?? []).length }), { status: 200 });
});
