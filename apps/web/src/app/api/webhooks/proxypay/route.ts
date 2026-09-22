import { NextResponse } from "next/server";
import crypto from "node:crypto";
import { createClient as createAdminClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

export async function POST(request: Request) {
  const providerId = new URL(request.url).searchParams.get("providerId");
  if (!providerId) return NextResponse.json({ error: "providerId ausente" }, { status: 400 });
  const admin = createAdminClient(process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL ?? "", process.env.SUPABASE_SERVICE_ROLE_KEY ?? "");
  const { data: provider } = await admin.from("school_payment_providers").select("id, school_id, status, config").eq("id", providerId).eq("provider_type", "proxypay").maybeSingle();
  if (!provider || provider.status !== "active") return NextResponse.json({ error: "provider inválido" }, { status: 404 });
  const raw = await request.text();
  const config = (provider.config ?? {}) as { api_key?: string; apiKey?: string };
  const apiKey = process.env.PROXYPAY_API_KEY?.trim() || config.api_key?.trim() || config.apiKey?.trim();
  const signature = request.headers.get("x-signature") ?? "";
  if (!apiKey || !signature) return NextResponse.json({ error: "assinatura ausente" }, { status: 401 });
  const expected = crypto.createHmac("sha256", apiKey).update(raw, "utf8").digest("hex");
  if (signature.length !== expected.length || !crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) return NextResponse.json({ error: "assinatura inválida" }, { status: 401 });
  let payload: Record<string, unknown>;
  try { payload = JSON.parse(raw) as Record<string, unknown>; } catch { return NextResponse.json({ error: "payload inválido" }, { status: 400 }); }
  const eventId = String(payload.id ?? payload.transaction_id ?? "");
  if (!eventId) return NextResponse.json({ error: "evento sem id" }, { status: 400 });
  const payloadHash = crypto.createHash("sha256").update(raw, "utf8").digest("hex");
  const { error } = await admin.from("payment_provider_events").upsert({ provider_id: provider.id, school_id: provider.school_id, provider_event_id: eventId, event_type: "payment", idempotency_key: `proxypay:${eventId}`, payload_hash: payloadHash, payload, status: "pending" }, { onConflict: "provider_id,idempotency_key", ignoreDuplicates: true });
  if (error) return NextResponse.json({ error: "evento não persistido" }, { status: 500 });
  return new NextResponse(null, { status: 204 });
}
