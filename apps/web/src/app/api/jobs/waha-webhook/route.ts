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

function hashWhatsappIdentity(value: string) {
  const pepper = process.env.WHATSAPP_PHONE_HASH_PEPPER || process.env.NEXTAUTH_SECRET || "klasse-phone-hash";
  return crypto.createHmac("sha256", pepper).update("waha-identity:" + value).digest("hex");
}

function maskWhatsappIdentity(value: string) {
  const [user, server] = value.split("@");
  return `${user.slice(0, 3)}***${user.slice(-2)}@${server || "unknown"}`;
}

function validateSignature(request: Request, rawBody: string) {
  const secret = process.env.WAHA_WEBHOOK_SECRET;
  if (!secret) return false;

  const header =
    request.headers.get("x-webhook-hmac") ||
    request.headers.get("x-waha-signature") ||
    request.headers.get("x-hub-signature-256") ||
    request.headers.get("x-signature") ||
    "";
  const algorithmHeader = request.headers.get("x-webhook-hmac-algorithm") || "sha512";
  const algorithm = algorithmHeader.toLowerCase() === "sha256" ? "sha256" : algorithmHeader.toLowerCase() === "sha512" ? "sha512" : "";
  const received = header.replace(/^sha(?:256|512)=/i, "").trim();
  if (!received || !algorithm) return false;

  const expected = crypto.createHmac(algorithm, secret).update(rawBody).digest("hex");
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
    readPath(payload, ["payload", "_data", "id", "id"]),
    readPath(payload, ["payload", "id", "_serialized"]),
  ];
  for (const candidate of candidates) {
    if (typeof candidate === "string" && candidate.trim()) return candidate.trim();
  }
  return null;
}

function extractMessageBody(payload: unknown) {
  const candidates = [
    readPath(payload, ["payload", "body"]),
    readPath(payload, ["data", "body"]),
    readPath(payload, ["body"]),
    readPath(payload, ["payload", "text", "body"]),
    readPath(payload, ["payload", "caption"]),
    readPath(payload, ["payload", "_data", "body"]),
    readPath(payload, ["payload", "_data", "caption"]),
    readPath(payload, ["data", "_data", "body"]),
    readPath(payload, ["_data", "body"]),
  ];
  return candidates.find((value) => typeof value === "string" && value.trim())?.trim() || "";
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
  const message = payload?.payload || payload?.data || payload;
  const data = message?._data || message;
  return {
    event: payload?.event || payload?.type || null,
    session: payload?.session || payload?.sessionName || null,
    provider_message_id: extractProviderMessageId(payload),
    ack: readPath(payload, ["payload", "ack"]) ?? null,
    from_me: Boolean(message?.fromMe ?? data?.fromMe ?? data?.id?.fromMe),
    has_from: Boolean(message?.from || data?.from),
    has_to: Boolean(message?.to || data?.to),
    has_body: Boolean(extractMessageBody(payload)),
    payload_keys: Object.keys(message || {}).slice(0, 20),
    data_keys: Object.keys(data || {}).slice(0, 20),
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
  if (eventType === "message" || eventType === "message.received") {
    const messagePayload = payload?.payload || payload?.data || payload;
    const messageData = messagePayload?._data;
    const fromMe = Boolean(messagePayload?.fromMe ?? messageData?.fromMe);

    if (!fromMe) {
      const from = String(messagePayload?.from || messageData?.from || "").trim();
      const to = String(messagePayload?.to || messageData?.to || "").trim();

      const senderPhone = from.split("@")[0].replace(/\D/g, "");
      const recipientPhone = to.split("@")[0].replace(/\D/g, "");
      const senderIsLid = from.endsWith("@lid");
      const recipientIsLid = to.endsWith("@lid");

      if (senderPhone || senderIsLid) {
        const normalizedSender = normalizeWhatsappPhone(senderPhone);
        if (normalizedSender || senderIsLid) {
          const senderPhoneHash = normalizedSender ? hashPhone(normalizedSender) || "" : hashWhatsappIdentity(from);
          const senderPhoneMasked = normalizedSender ? maskPhone(normalizedSender) || "" : maskWhatsappIdentity(from);

          const normalizedRecipient = normalizeWhatsappPhone(recipientPhone) || "";
          const recipientPhoneHash = normalizedRecipient ? hashPhone(normalizedRecipient) || "" : recipientIsLid ? hashWhatsappIdentity(to) : "";
          const recipientPhoneMasked = normalizedRecipient ? maskPhone(normalizedRecipient) || "" : recipientIsLid ? maskWhatsappIdentity(to) : "";

          // LID is an opaque WhatsApp identity, not a phone number. Only run
          // phone-based contact resolution when WAHA provides a valid phone.
          const contactInfo = normalizedSender
            ? await resolveCommunicationContactByPhone(
                admin,
                provider.school_id,
                normalizedSender
              )
            : {
                linkedEntityType: "unknown" as const,
                linkedEntityId: null,
                contactName: null,
                contactRole: "unknown" as const,
              };

          // Build the thread update before claiming it atomically. A separate
          // SELECT followed by INSERT races when WAHA retries/delivers the
          // same chat concurrently and violates the unique thread key.
          const bodyText = extractMessageBody(payload);
          const messageType = messagePayload?.type || messageData?.type || "text";
          const isMedia = messagePayload?.hasMedia || messageData?.hasMedia || ["image", "video", "document", "audio", "voice", "sticker"].includes(messageType);
          const finalBody = isMedia ? (bodyText || "📎 Mensagem com anexo recebida (visualização não disponível)") : bodyText;
          const bodyPreview = finalBody.slice(0, 100);

          const { data: thread, error: threadError } = await admin.rpc(
            "upsert_communication_thread_for_inbound",
            {
              p_school_id: provider.school_id,
              p_contact_phone_hash: senderPhoneHash,
              p_contact_phone_masked: senderPhoneMasked,
              p_contact_name: contactInfo.contactName || senderPhoneMasked,
              p_contact_role: contactInfo.contactRole,
              p_linked_entity_type: contactInfo.linkedEntityType,
              p_linked_entity_id: contactInfo.linkedEntityId,
              p_body_preview: bodyPreview,
              p_received_at: new Date().toISOString(),
            },
          );

          if (threadError) throw threadError;
          if (!thread?.id) throw new Error("Thread upsert returned no thread");
          const threadId = thread.id;

          // Create message
          const { data: insertedMessage, error: messageInsertError } = await admin
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
              message_type: messageType,
              status: "received",
              metadata: { raw_phone: normalizedSender },
              received_at: new Date().toISOString()
            })
            .select("id")
            .single();

          if (messageInsertError) throw messageInsertError;

          if (insertedMessage?.id && providerMessageId) {
            const { error: queueError } = await admin
              .from("whatsapp_agent_inbox_events")
              .insert({
                school_id: provider.school_id,
                session_name: sessionName,
                communication_message_id: insertedMessage.id,
                provider_message_id: providerMessageId,
                chat_id: from,
                status: "pending",
                available_at: new Date().toISOString()
              });

            if (queueError && queueError.code !== "23505") throw queueError;
          }
        }
      }
    }
  }

  // Handle message sent (outbound)
  if (eventType === "message.sent" || eventType === "message.received" || (eventType === "message" && payload?.payload?.fromMe)) {
    const messagePayload = payload?.payload || payload?.data || payload;
    const messageData = messagePayload?._data;
    const to = String(messagePayload?.to || messageData?.to || "").trim();
    const from = String(messagePayload?.from || messageData?.from || "").trim();

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
          const bodyText = extractMessageBody(payload);
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
