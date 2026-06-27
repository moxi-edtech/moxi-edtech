import { NextResponse } from "next/server";
import crypto from "node:crypto";
import { supabaseServerTyped } from "@/lib/supabaseServer";
import {
  authorizeWhatsappUser,
  withNoStore,
  isWahaEnabled,
  maskPhone,
  hashPhone,
  normalizeWhatsappPhone
} from "@/lib/server/whatsappUtility";
import type { DBWithRPC } from "@/types/supabase-augment";

export const dynamic = "force-dynamic";
export const revalidate = 0;

// GET: load messages for a thread, and reset unread_count to 0
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string; threadId: string }> }
) {
  try {
    const { id, threadId } = await params;
    const supabase = await supabaseServerTyped<DBWithRPC>();
    const auth = await authorizeWhatsappUser(supabase, id);
    if (!auth.ok) {
      return withNoStore(NextResponse.json({ ok: false, error: auth.error }, { status: auth.status }));
    }

    // Verify thread belongs to school
    const { data: thread, error: threadError } = await supabase
      .from("communication_threads")
      .select("id, school_id")
      .eq("id", threadId)
      .eq("school_id", auth.auth.escolaId)
      .maybeSingle();

    if (threadError) throw threadError;
    if (!thread) {
      return withNoStore(NextResponse.json({ ok: false, error: "Conversa não encontrada." }, { status: 404 }));
    }

    // Reset unread_count
    await supabase
      .from("communication_threads")
      .update({ unread_count: 0, updated_at: new Date().toISOString() })
      .eq("id", threadId);

    // Get messages
    const { data: messages, error: messagesError } = await supabase
      .from("communication_messages")
      .select("*")
      .eq("thread_id", threadId)
      .order("created_at", { ascending: true })
      .limit(100);

    if (messagesError) throw messagesError;

    return withNoStore(NextResponse.json({ ok: true, data: { thread, messages: messages || [] } }));
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return withNoStore(NextResponse.json({ ok: false, error: message }, { status: 500 }));
  }
}

// PATCH: update thread status or assignment
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string; threadId: string }> }
) {
  try {
    const { id, threadId } = await params;
    const supabase = await supabaseServerTyped<DBWithRPC>();
    const auth = await authorizeWhatsappUser(supabase, id);
    if (!auth.ok) {
      return withNoStore(NextResponse.json({ ok: false, error: auth.error }, { status: auth.status }));
    }

    const body = await request.json().catch(() => ({}));
    const { status, assignedTo } = body;

    // Verify thread belongs to school
    const { data: thread, error: threadError } = await supabase
      .from("communication_threads")
      .select("id")
      .eq("id", threadId)
      .eq("school_id", auth.auth.escolaId)
      .maybeSingle();

    if (threadError) throw threadError;
    if (!thread) {
      return withNoStore(NextResponse.json({ ok: false, error: "Conversa não encontrada." }, { status: 404 }));
    }

    const updates: any = { updated_at: new Date().toISOString() };
    if (status !== undefined) {
      if (!["open", "pending", "resolved", "archived", "blocked"].includes(status)) {
        return withNoStore(NextResponse.json({ ok: false, error: "Status inválido." }, { status: 400 }));
      }
      updates.status = status;
    }
    if (assignedTo !== undefined) {
      updates.assigned_to = assignedTo;
    }

    const { data: updatedThread, error: updateError } = await supabase
      .from("communication_threads")
      .update(updates)
      .eq("id", threadId)
      .select()
      .single();

    if (updateError) throw updateError;

    // Log the thread update action
    await supabase.from("communication_logs").insert({
      school_id: auth.auth.escolaId,
      thread_id: threadId,
      event_type: status === "resolved" ? "thread_resolved" : status === "archived" ? "thread_archived" : "thread_updated",
      payload_sanitized: { status, assigned_to: assignedTo }
    });

    return withNoStore(NextResponse.json({ ok: true, data: updatedThread }));
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return withNoStore(NextResponse.json({ ok: false, error: message }, { status: 500 }));
  }
}

// POST: send manual response (creates communication_outbox entry)
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string; threadId: string }> }
) {
  try {
    const { id, threadId } = await params;
    const supabase = await supabaseServerTyped<DBWithRPC>();
    const auth = await authorizeWhatsappUser(supabase, id);
    if (!auth.ok) {
      return withNoStore(NextResponse.json({ ok: false, error: auth.error }, { status: auth.status }));
    }

    if (!isWahaEnabled()) {
      return withNoStore(NextResponse.json({ ok: false, error: "WhatsApp experimental está desativado." }, { status: 403 }));
    }

    const body = await request.json().catch(() => ({}));
    const { responseText } = body;
    if (!responseText || !String(responseText).trim()) {
      return withNoStore(NextResponse.json({ ok: false, error: "A resposta não pode ser vazia." }, { status: 400 }));
    }

    // Verify thread belongs to school
    const { data: thread, error: threadError } = await supabase
      .from("communication_threads")
      .select("*")
      .eq("id", threadId)
      .eq("school_id", auth.auth.escolaId)
      .maybeSingle();

    if (threadError) throw threadError;
    if (!thread) {
      return withNoStore(NextResponse.json({ ok: false, error: "Conversa não encontrada." }, { status: 404 }));
    }

    // Verify provider status is connected
    const { data: provider } = await supabase
      .from("school_notification_providers")
      .select("status, session_name")
      .eq("school_id", auth.auth.escolaId)
      .eq("provider_type", "whatsapp_waha")
      .maybeSingle();

    if (!provider || provider.status !== "connected") {
      return withNoStore(NextResponse.json({ ok: false, error: "WhatsApp da escola está desconectado." }, { status: 409 }));
    }

    // Try to resolve the raw phone number
    let rawPhone: string | null = null;

    // 1. Check message metadata in the thread
    const { data: messages } = await supabase
      .from("communication_messages")
      .select("metadata")
      .eq("thread_id", threadId)
      .eq("direction", "inbound")
      .order("created_at", { ascending: false })
      .limit(10);

    if (messages) {
      for (const m of messages) {
        const metadata = m.metadata as any;
        if (metadata && metadata.raw_phone) {
          rawPhone = String(metadata.raw_phone);
          break;
        }
      }
    }

    // 2. If not resolved from message metadata, try to resolve from entity in the DB
    if (!rawPhone && thread.linked_entity_id && thread.linked_entity_type !== "unknown") {
      if (thread.linked_entity_type === "student") {
        const { data: student } = await supabase
          .from("alunos")
          .select("telefone, telefone_responsavel, encarregado_telefone, responsavel_contato")
          .eq("id", thread.linked_entity_id)
          .maybeSingle();
        if (student) {
          rawPhone = student.telefone || student.telefone_responsavel || student.encarregado_telefone || student.responsavel_contato || null;
        }
      } else if (thread.linked_entity_type === "guardian") {
        const { data: guardian } = await supabase
          .from("encarregados")
          .select("telefone")
          .eq("id", thread.linked_entity_id)
          .maybeSingle();
        if (guardian) {
          rawPhone = guardian.telefone || null;
        }
      } else if (thread.linked_entity_type === "teacher") {
        const { data: teacher } = await supabase
          .from("professores")
          .select("profiles(telefone)")
          .eq("id", thread.linked_entity_id)
          .maybeSingle();
        if (teacher && teacher.profiles) {
          rawPhone = (teacher.profiles as any).telefone || null;
        }
      }
    }

    const normalizedPhone = normalizeWhatsappPhone(rawPhone);
    if (!normalizedPhone) {
      return withNoStore(NextResponse.json({ ok: false, error: "Não foi possível resolver o telefone de destino para envio." }, { status: 400 }));
    }

    const idempotencyKey = `manual_reply:${threadId}:${crypto.randomUUID()}`;

    // Create entry in communication_outbox
    const { data: outbox, error: outboxError } = await supabase
      .from("communication_outbox")
      .insert({
        school_id: auth.auth.escolaId,
        created_by: auth.auth.userId,
        provider: "waha",
        channel: "whatsapp",
        message_type: "manual_message",
        source_module: "whatsapp_inbox",
        source_entity_type: thread.linked_entity_type !== "unknown" ? thread.linked_entity_type : null,
        source_entity_id: thread.linked_entity_id || null,
        recipient_type: thread.linked_entity_type !== "unknown" ? thread.linked_entity_type : "manual",
        recipient_ref_id: thread.linked_entity_id || null,
        recipient_name: thread.contact_name || thread.contact_phone_masked,
        recipient_phone_masked: thread.contact_phone_masked,
        recipient_phone_hash: thread.contact_phone_hash,
        title: "Resposta Manual",
        body: responseText,
        metadata: { phone: normalizedPhone },
        status: "queued",
        risk_level: "low",
        requires_approval: false,
        idempotency_key: idempotencyKey,
        queued_at: new Date().toISOString()
      })
      .select()
      .single();

    if (outboxError) throw outboxError;

    // Log the outbound queue event
    await supabase.from("communication_logs").insert({
      school_id: auth.auth.escolaId,
      thread_id: threadId,
      outbox_id: outbox.id,
      event_type: "outbound_queued",
      provider: "waha",
      payload_sanitized: { outbox_id: outbox.id, status: outbox.status }
    });

    return withNoStore(NextResponse.json({ ok: true, data: outbox }));
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return withNoStore(NextResponse.json({ ok: false, error: message }, { status: 500 }));
  }
}
