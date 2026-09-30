import { NextResponse } from "next/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

const admin = () => createAdminClient(process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL ?? "", process.env.SUPABASE_SERVICE_ROLE_KEY ?? "");
const sameAmount = (a: unknown, b: unknown) => Math.abs(Number(a) - Number(b)) < 0.005;

export async function POST(request: Request) {
  const expectedToken = process.env.PROXYPAY_WORKER_TOKEN || process.env.CRON_SECRET;
  const token = request.headers.get("x-job-token") || request.headers.get("authorization")?.replace("Bearer ", "");
  if (!expectedToken || token !== expectedToken) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const db = admin();
  const { data: event } = await db.from("payment_provider_events").select("id, provider_id, school_id, payload, status").eq("status", "pending").order("received_at", { ascending: true }).limit(1).maybeSingle();
  if (!event) return NextResponse.json({ ok: true, processed: 0 });
  await db.from("payment_provider_events").update({ status: "processing" }).eq("id", event.id).eq("status", "pending");
  try {
    const payload = (event.payload ?? {}) as Record<string, any>;
    const providerReferenceId = String(payload.reference_id ?? "");
    const providerTransactionId = String(payload.id ?? payload.transaction_id ?? "");
    const amount = Number(payload.amount ?? 0);
    if (!providerReferenceId || !providerTransactionId || !(amount > 0)) throw new Error("Evento ProxyPay inválido");
    const { data: reference } = await db.from("payment_references").select("id, school_id, provider_id, obligation_id, entity, reference, amount, status").eq("provider_id", event.provider_id).eq("school_id", event.school_id).eq("provider_reference_id", providerReferenceId).maybeSingle();
    if (!reference || reference.school_id !== event.school_id) throw new Error("Referência não pertence à escola");
    if (!sameAmount(reference.amount, amount)) {
      await db.from("payment_provider_transactions").upsert({ school_id: event.school_id, provider_id: event.provider_id, payment_reference_id: reference.id, obligation_id: reference.obligation_id, provider_transaction_id: providerTransactionId, amount, currency: "AOA", paid_at: payload.datetime ?? null, status: "manual_review", raw_metadata: payload }, { onConflict: "provider_id,provider_transaction_id" });
      await db.from("payment_provider_events").update({ status: "manual_review", processed_at: new Date().toISOString(), error_message: "Valor recebido divergente" }).eq("id", event.id);
      return NextResponse.json({ ok: true, status: "manual_review" });
    }
    const { data: obligation } = await db.from("mensalidades").select("id, escola_id, valor, valor_previsto, valor_pago_total, status").eq("id", reference.obligation_id).eq("escola_id", event.school_id).maybeSingle();
    const outstanding = obligation ? Number(obligation.valor_previsto ?? obligation.valor ?? 0) - Number(obligation.valor_pago_total ?? 0) : 0;
    if (!obligation || obligation.escola_id !== event.school_id || !sameAmount(outstanding, amount) || ["pago", "isento", "cancelado"].includes(String(obligation.status))) {
      await db.from("payment_provider_transactions").upsert({ school_id: event.school_id, provider_id: event.provider_id, payment_reference_id: reference.id, obligation_id: reference.obligation_id, provider_transaction_id: providerTransactionId, amount, currency: "AOA", paid_at: payload.datetime ?? null, status: "manual_review", raw_metadata: payload }, { onConflict: "provider_id,provider_transaction_id" });
      await db.from("payment_provider_events").update({ status: "manual_review", processed_at: new Date().toISOString(), error_message: "Obrigação inexistente, já liquidada ou saldo divergente" }).eq("id", event.id);
      return NextResponse.json({ ok: true, status: "manual_review" });
    }
    const dedupeKey = `proxypay:${providerTransactionId}`;
    const { data: intent, error: intentError } = await db.from("finance_payment_intents").upsert({ escola_id: event.school_id, mensalidade_id: obligation.id, amount, currency: "AOA", method: "referencia", external_ref: providerTransactionId, status: "pending", dedupe_key: dedupeKey }, { onConflict: "escola_id,dedupe_key" }).select("id").maybeSingle();
    if (intentError || !intent) throw new Error(intentError?.message || "Falha ao criar intent");
    const { error: confirmError } = await db.rpc("finance_confirm_payment", { p_intent_id: intent.id });
    if (confirmError) throw new Error(confirmError.message);
    await db.from("payment_provider_transactions").upsert({ school_id: event.school_id, provider_id: event.provider_id, payment_reference_id: reference.id, obligation_id: obligation.id, provider_transaction_id: providerTransactionId, amount, currency: "AOA", paid_at: payload.datetime ?? new Date().toISOString(), status: "reconciled", raw_metadata: payload }, { onConflict: "provider_id,provider_transaction_id" });
    await db.from("payment_references").update({ status: "paid", paid_at: payload.datetime ?? new Date().toISOString(), updated_at: new Date().toISOString() }).eq("id", reference.id).eq("school_id", event.school_id);
    await db.from("payment_provider_events").update({ status: "processed", processed_at: new Date().toISOString(), error_message: null }).eq("id", event.id);
    return NextResponse.json({ ok: true, status: "reconciled" });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro interno";
    await db.from("payment_provider_events").update({ status: "failed", error_message: message }).eq("id", event.id);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
