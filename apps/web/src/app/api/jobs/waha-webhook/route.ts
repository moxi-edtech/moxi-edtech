import crypto from "node:crypto";
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

function getAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key);
}

function timingSafeEqual(a: string, b: string) {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && crypto.timingSafeEqual(left, right);
}

function validateSignature(request: Request, rawBody: string) {
  const secret = process.env.WAHA_WEBHOOK_SECRET;
  if (!secret) return false;

  const header =
    request.headers.get("x-waha-signature") ||
    request.headers.get("x-hub-signature-256") ||
    request.headers.get("x-signature") ||
    "";
  const received = header.replace(/^sha256=/, "").trim();
  if (!received) return false;

  const expected = crypto.createHmac("sha256", secret).update(rawBody).digest("hex");
  return timingSafeEqual(received, expected);
}

function readPath(payload: unknown, path: string[]) {
  let current = payload as any;
  for (const key of path) current = current?.[key];
  return current;
}

function extractProviderMessageId(payload: unknown) {
  const candidates = [
    readPath(payload, ["provider_message_id"]),
    readPath(payload, ["messageId"]),
    readPath(payload, ["id"]),
    readPath(payload, ["payload", "id"]),
    readPath(payload, ["payload", "_data", "id", "_serialized"]),
    readPath(payload, ["payload", "id", "_serialized"]),
  ];
  for (const candidate of candidates) {
    if (typeof candidate === "string" && candidate.trim()) return candidate.trim();
  }
  return null;
}

function normalizeEventType(payload: any) {
  return String(payload?.event || payload?.type || payload?.event_type || "unknown").toLowerCase();
}

function statusForEvent(eventType: string) {
  if (eventType.includes("read")) return "read";
  if (eventType.includes("delivered")) return "delivered";
  if (eventType.includes("failed") || eventType.includes("ack.failed")) return "failed";
  if (eventType.includes("sent") || eventType.includes("ack.server")) return "sent";
  return null;
}

function sanitizePayload(payload: any) {
  return {
    event: payload?.event || payload?.type || null,
    session: payload?.session || payload?.sessionName || null,
    provider_message_id: extractProviderMessageId(payload),
    ack: readPath(payload, ["payload", "ack"]) ?? null,
  };
}

export async function POST(request: Request) {
  const rawBody = await request.text();
  if (!validateSignature(request, rawBody)) {
    return NextResponse.json({ ok: false, error: "Invalid webhook signature" }, { status: 401 });
  }

  const admin = getAdminClient();
  if (!admin) return NextResponse.json({ ok: false, error: "Server misconfigured" }, { status: 500 });

  let payload: any;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON" }, { status: 400 });
  }

  const eventType = normalizeEventType(payload);
  const sessionName = String(payload?.session || payload?.sessionName || readPath(payload, ["payload", "session"]) || "").trim();
  if (!sessionName) return NextResponse.json({ ok: false, error: "Missing session" }, { status: 400 });

  const { data: provider, error: providerError } = await admin
    .from("school_notification_providers")
    .select("school_id,session_name")
    .eq("provider_type", "whatsapp_waha")
    .eq("session_name", sessionName)
    .maybeSingle();

  if (providerError) throw providerError;
  if (!provider?.school_id) return NextResponse.json({ ok: false, error: "Unknown session" }, { status: 404 });

  const providerMessageId = extractProviderMessageId(payload);
  const nextStatus = statusForEvent(eventType);
  let outboxId: string | null = null;

  if (providerMessageId) {
    const { data: outbox } = await admin
      .from("communication_outbox")
      .select("id,status")
      .eq("school_id", provider.school_id)
      .eq("provider_message_id", providerMessageId)
      .maybeSingle();

    if (outbox?.id) {
      outboxId = outbox.id;
      if (nextStatus) {
        const timestampField =
          nextStatus === "delivered" ? "delivered_at" :
          nextStatus === "read" ? "read_at" :
          nextStatus === "failed" ? "failed_at" :
          "sent_at";
        await admin
          .from("communication_outbox")
          .update({
            status: nextStatus,
            [timestampField]: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            last_error: nextStatus === "failed" ? "Falha reportada pelo WAHA" : null,
          })
          .eq("id", outbox.id);
      }
    }
  }

  await admin.from("communication_logs").insert({
    outbox_id: outboxId,
    school_id: provider.school_id,
    event_type: eventType,
    provider: "waha",
    provider_event_id: providerMessageId,
    payload_sanitized: sanitizePayload(payload),
  });

  if (eventType.includes("session.connected") || eventType.includes("session.status")) {
    await admin
      .from("school_notification_providers")
      .update({ status: eventType.includes("connected") ? "connected" : "pending_qr", updated_at: new Date().toISOString() })
      .eq("provider_type", "whatsapp_waha")
      .eq("session_name", sessionName);
  }

  if (eventType.includes("session.disconnected") || eventType.includes("session.failed")) {
    await admin
      .from("school_notification_providers")
      .update({ status: "failed", updated_at: new Date().toISOString() })
      .eq("provider_type", "whatsapp_waha")
      .eq("session_name", sessionName);
  }

  return NextResponse.json({ ok: true });
}
