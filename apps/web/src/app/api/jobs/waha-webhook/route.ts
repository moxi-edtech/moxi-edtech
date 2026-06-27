import crypto from "node:crypto";
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import {
  normalizeWhatsappPhone,
  hashPhone,
  maskPhone,
  resolveCommunicationContactByPhone
} from "@/lib/server/whatsappUtility";

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

  // Handle message received (inbound)
  if (eventType === "message.received") {
    const messagePayload = payload?.payload;
    const fromMe = Boolean(messagePayload?.fromMe);

    if (!fromMe) {
      const from = String(messagePayload?.from || "").trim();
      const to = String(messagePayload?.to || "").trim();

      const senderPhone = from.split("@")[0].replace(/\D/g, "");
      const recipientPhone = to.split("@")[0].replace(/\D/g, "");

      if (senderPhone) {
        const normalizedSender = normalizeWhatsappPhone(senderPhone);
        if (normalizedSender) {
          const senderPhoneHash = hashPhone(normalizedSender) || "";
          const senderPhoneMasked = maskPhone(normalizedSender) || "";

          const normalizedRecipient = normalizeWhatsappPhone(recipientPhone) || "";
          const recipientPhoneHash = hashPhone(normalizedRecipient) || "";
          const recipientPhoneMasked = maskPhone(normalizedRecipient) || "";

          // Resolve contact in school
          const contactInfo = await resolveCommunicationContactByPhone(
            admin,
            provider.school_id,
            normalizedSender
          );

          // Find or create thread
          const bodyText = String(messagePayload?.body || "").trim();
          const isMedia = messagePayload?.hasMedia || ["image", "video", "document", "audio", "voice", "sticker"].includes(messagePayload?.type);
          const finalBody = isMedia ? (bodyText || "📎 Mensagem com anexo recebida (visualização não disponível)") : bodyText;
          const bodyPreview = finalBody.slice(0, 100);

          const { data: existingThread } = await admin
            .from("communication_threads")
            .select("id, unread_count, status, linked_entity_type, linked_entity_id, contact_name, contact_role")
            .eq("school_id", provider.school_id)
            .eq("contact_phone_hash", senderPhoneHash)
            .maybeSingle();

          let threadId: string;
          let currentRole = contactInfo.contactRole;
          let currentEntityType = contactInfo.linkedEntityType;
          let currentEntityId = contactInfo.linkedEntityId;
          let currentName = contactInfo.contactName;

          if (existingThread) {
            threadId = existingThread.id;
            if (existingThread.linked_entity_type !== "unknown") {
              currentEntityType = existingThread.linked_entity_type;
              currentEntityId = existingThread.linked_entity_id;
              currentRole = existingThread.contact_role;
              currentName = existingThread.contact_name;
            }

            await admin
              .from("communication_threads")
              .update({
                last_message_preview: bodyPreview,
                last_message_at: new Date().toISOString(),
                unread_count: existingThread.unread_count + 1,
                status: existingThread.status === "archived" || existingThread.status === "resolved" ? "open" : existingThread.status,
                linked_entity_type: currentEntityType,
                linked_entity_id: currentEntityId,
                contact_role: currentRole,
                contact_name: currentName || senderPhoneMasked,
                updated_at: new Date().toISOString()
              })
              .eq("id", threadId);
          } else {
            const { data: newThread, error: createErr } = await admin
              .from("communication_threads")
              .insert({
                school_id: provider.school_id,
                channel: "whatsapp",
                provider: "waha",
                contact_phone_hash: senderPhoneHash,
                contact_phone_masked: senderPhoneMasked,
                contact_name: currentName || senderPhoneMasked,
                contact_role: currentRole,
                linked_entity_type: currentEntityType,
                linked_entity_id: currentEntityId,
                status: "open",
                last_message_preview: bodyPreview,
                last_message_at: new Date().toISOString(),
                unread_count: 1
              })
              .select("id")
              .single();

            if (createErr) throw createErr;
            threadId = newThread.id;
          }

          // Create message
          await admin
            .from("communication_messages")
            .insert({
              thread_id: threadId,
              school_id: provider.school_id,
              direction: "inbound",
              channel: "whatsapp",
              provider: "waha",
              provider_message_id: providerMessageId,
              provider_event_id: payload?.id || providerMessageId,
              sender_phone_hash: senderPhoneHash,
              sender_phone_masked: senderPhoneMasked,
              recipient_phone_hash: recipientPhoneHash,
              recipient_phone_masked: recipientPhoneMasked,
              body: finalBody,
              body_preview: bodyPreview,
              body_sanitized: finalBody,
              message_type: messagePayload?.type || "text",
              status: "received",
              metadata: { raw_phone: normalizedSender },
              received_at: new Date().toISOString()
            });
        }
      }
    }
  }

  // Handle message sent (outbound)
  if (eventType === "message.sent" || (eventType === "message.received" && payload?.payload?.fromMe)) {
    const messagePayload = payload?.payload;
    const to = String(messagePayload?.to || "").trim();
    const from = String(messagePayload?.from || "").trim();

    const recipientPhone = to.split("@")[0].replace(/\D/g, "");
    const senderPhone = from.split("@")[0].replace(/\D/g, "");

    if (recipientPhone) {
      const normalizedRecipient = normalizeWhatsappPhone(recipientPhone);
      if (normalizedRecipient) {
        const recipientPhoneHash = hashPhone(normalizedRecipient) || "";
        const recipientPhoneMasked = maskPhone(normalizedRecipient) || "";

        const normalizedSender = normalizeWhatsappPhone(senderPhone) || "";
        const senderPhoneHash = hashPhone(normalizedSender) || "";
        const senderPhoneMasked = maskPhone(normalizedSender) || "";

        const { data: thread } = await admin
          .from("communication_threads")
          .select("id")
          .eq("school_id", provider.school_id)
          .eq("contact_phone_hash", recipientPhoneHash)
          .maybeSingle();

        if (thread) {
          const bodyText = String(messagePayload?.body || "").trim();
          const bodyPreview = bodyText.slice(0, 100);

          await admin
            .from("communication_threads")
            .update({
              last_message_preview: bodyPreview,
              last_message_at: new Date().toISOString(),
              updated_at: new Date().toISOString()
            })
            .eq("id", thread.id);

          const { data: existingMsg } = await admin
            .from("communication_messages")
            .select("id")
            .eq("provider_message_id", providerMessageId)
            .maybeSingle();

          if (!existingMsg) {
            await admin
              .from("communication_messages")
              .insert({
                thread_id: thread.id,
                school_id: provider.school_id,
                direction: "outbound",
                channel: "whatsapp",
                provider: "waha",
                provider_message_id: providerMessageId,
                provider_event_id: payload?.id || providerMessageId,
                sender_phone_hash: senderPhoneHash,
                sender_phone_masked: senderPhoneMasked,
                recipient_phone_hash: recipientPhoneHash,
                recipient_phone_masked: recipientPhoneMasked,
                body: bodyText,
                body_preview: bodyPreview,
                body_sanitized: bodyText,
                message_type: messagePayload?.type || "text",
                status: "sent",
                received_at: new Date().toISOString()
              });
          }
        }
      }
    }
  }

  return NextResponse.json({ ok: true });
}
