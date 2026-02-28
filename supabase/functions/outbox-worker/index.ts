// supabase/functions/outbox-worker/index.ts
import { createClient } from "jsr:@supabase/supabase-js@2";
import { HANDLERS, OutboxEvent } from "./handlers/index.ts";

Deno.serve(async (req) => {
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  const workerId = crypto.randomUUID();

  // 1. Claim (busca e marca como processando) do lote de eventos
  const { data: events, error } = await supabase.rpc("outbox_claim", {
    batch_size: 25,
    worker_id: workerId,
  });

  if (error) {
    console.error(`[WORKER_ERROR] Falha ao buscar eventos: ${error.message}`);
    return new Response(JSON.stringify({ ok: false, error: error.message }), { status: 500 });
  }

  const results = [];

  for (const ev of (events as OutboxEvent[]) ?? []) {
    try {
      console.log(`[WORKER] Processando evento ${ev.id} do tipo ${ev.event_type}`);

      const handler = HANDLERS[ev.event_type];

      if (!handler) {
        throw new Error(`Nenhum handler registrado para event_type: ${ev.event_type}`);
      }

      // 2. Executa o handler específico do evento
      await handler(ev, supabase);

      // 3. Reporta sucesso e audita
      await supabase.rpc("outbox_report_result", { p_id: ev.id, p_ok: true, p_error: null });
      
      await supabase.rpc("create_audit", {
        action: "OUTBOX_SENT",
        entity: "outbox_events",
        entity_id: ev.id,
        metadata: {
          event_type: ev.event_type,
          escola_id: ev.escola_id,
        },
      });

      results.push({ id: ev.id, status: 'success' });

    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      console.error(`[WORKER_FAILURE] Erro no evento ${ev.id}: ${msg}`);

      // 4. Reporta falha para o retry/dead letter queue do DB
      await supabase.rpc("outbox_report_result", { p_id: ev.id, p_ok: false, p_error: msg });

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

      results.push({ id: ev.id, status: 'failed', error: msg });
    }
  }

  return new Response(JSON.stringify({ 
    ok: true, 
    claimed: (events ?? []).length,
    results 
  }), { status: 200 });
});
