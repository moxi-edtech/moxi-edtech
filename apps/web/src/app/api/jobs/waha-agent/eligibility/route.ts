import crypto from "node:crypto";
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { hashPhone, normalizeWhatsappPhone } from "@/lib/server/whatsappUtility";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

function getAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  return url && key ? createClient(url, key) : null;
}

function validSignature(request: Request, session: string, phone: string) {
  const secret = process.env.AGENT_GATE_SECRET || process.env.WAHA_WEBHOOK_SECRET;
  const received = request.headers.get("x-agent-signature") || "";
  if (!secret || !received) return false;
  const expected = crypto.createHmac("sha256", secret).update(`${session}\n${phone}`).digest("hex");
  const left = Buffer.from(received);
  const right = Buffer.from(expected);
  return left.length === right.length && crypto.timingSafeEqual(left, right);
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const session = (url.searchParams.get("session") || "").trim();
  const phone = normalizeWhatsappPhone(url.searchParams.get("phone"));
  if (!session || !phone || !validSignature(request, session, phone)) {
    return NextResponse.json({ ok: false, eligible: false, reason: "invalid_agent_request" }, { status: 401 });
  }

  const admin = getAdminClient();
  if (!admin) return NextResponse.json({ ok: false, eligible: false, reason: "server_misconfigured" }, { status: 500 });

  const { data: provider, error: providerError } = await admin
    .from("school_notification_providers")
    .select("school_id")
    .eq("provider_type", "whatsapp_waha")
    .eq("session_name", session)
    .maybeSingle();
  if (providerError) return NextResponse.json({ ok: false, eligible: false, reason: "provider_lookup_failed" }, { status: 500 });
  if (!provider?.school_id) return NextResponse.json({ ok: false, eligible: false, reason: "unknown_session" }, { status: 404 });

  const phoneHash = hashPhone(phone);
  if (!phoneHash) return NextResponse.json({ ok: false, eligible: false, reason: "invalid_phone" }, { status: 400 });

  const { data: thread, error: threadError } = await admin
    .from("communication_threads")
    .select("status, assigned_to")
    .eq("school_id", provider.school_id)
    .eq("contact_phone_hash", phoneHash)
    .maybeSingle();
  if (threadError) return NextResponse.json({ ok: false, eligible: false, reason: "thread_lookup_failed" }, { status: 500 });
  if (!thread) return NextResponse.json({ ok: true, eligible: true, reason: "new_thread" });

  const status = String(thread.status || "open");
  if (thread.assigned_to) return NextResponse.json({ ok: true, eligible: false, reason: "assigned_to_human" });
  if (["pending", "resolved", "archived", "blocked"].includes(status)) {
    return NextResponse.json({ ok: true, eligible: false, reason: `human_status_${status}` });
  }

  const { count: manualReplyCount, error: manualReplyError } = await admin
    .from("communication_outbox")
    .select("id", { count: "exact", head: true })
    .eq("school_id", provider.school_id)
    .eq("recipient_phone_hash", phoneHash)
    .eq("source_module", "whatsapp_inbox")
    .in("status", ["queued", "sending", "sent", "delivered", "read"]);
  if (manualReplyError) return NextResponse.json({ ok: false, eligible: false, reason: "manual_reply_lookup_failed" }, { status: 500 });
  if ((manualReplyCount || 0) > 0) return NextResponse.json({ ok: true, eligible: false, reason: "manual_reply_exists" });

  return NextResponse.json({ ok: true, eligible: true, reason: "open_unassigned" });
}
