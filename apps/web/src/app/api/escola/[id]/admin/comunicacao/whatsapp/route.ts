import { NextResponse } from "next/server";
import crypto from "node:crypto";
import { z } from "zod";
import { supabaseServerTyped } from "@/lib/supabaseServer";
import {
  authorizeWhatsappUser,
  hashPhone,
  inferApproval,
  interpolateTemplate,
  isWahaEnabled,
  maskPhone,
  normalizeWhatsappPhone,
  sanitizeWahaSessionName,
  fetchWahaSessionStatus,
  userHasAnyRole,
  WHATSAPP_FINANCE_ROLES,
  withNoStore,
} from "@/lib/server/whatsappUtility";
import type { DBWithRPC } from "@/types/supabase-augment";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const createSchema = z.object({
  messageType: z.enum([
    "auth_provision_student",
    "school_notice",
    "finance_charge",
    "document_ready",
    "manual_message",
    "ai_generated_draft",
  ]),
  recipientType: z.enum(["encarregado", "aluno", "professor", "manual"]),
  recipientRefId: z.string().uuid().optional().nullable(),
  recipientName: z.string().trim().min(1).max(160),
  recipientPhone: z.string().trim().max(40).optional().nullable(),
  title: z.string().trim().max(160).optional().nullable(),
  body: z.string().trim().min(1).max(2000),
  templateKey: z.string().trim().max(120).optional().nullable(),
  variables: z.record(z.string(), z.string()).optional().default({}),
  sourceModule: z.string().trim().max(80).optional().nullable(),
  sourceEntityType: z.string().trim().max(80).optional().nullable(),
  sourceEntityId: z.string().uuid().optional().nullable(),
});

async function resolveRecipient(
  supabase: any,
  escolaId: string,
  payload: z.infer<typeof createSchema>
) {
  if (payload.recipientType === "manual") {
    return {
      id: null,
      name: payload.recipientName,
      phone: payload.recipientPhone || null,
      type: "manual",
    };
  }

  if (!payload.recipientRefId) throw new Error("Destinatário obrigatório.");

  if (payload.recipientType === "professor") {
    const { data, error } = await supabase
      .from("professores")
      .select("id,apelido,profile_id")
      .eq("id", payload.recipientRefId)
      .eq("escola_id", escolaId)
      .maybeSingle();
    if (error) throw error;
    if (!data) throw new Error("Professor não encontrado nesta escola.");
    const { data: profile } = data.profile_id
      ? await supabase.from("profiles").select("nome,telefone").eq("user_id", data.profile_id).maybeSingle()
      : { data: null };
    return {
      id: data.id,
      name: profile?.nome || data.apelido || payload.recipientName,
      phone: profile?.telefone || null,
      type: "professor",
    };
  }

  const { data, error } = await supabase
    .from("alunos")
    .select("id,nome,responsavel_nome,encarregado_nome,responsavel_contato,telefone_responsavel,encarregado_telefone")
    .eq("id", payload.recipientRefId)
    .eq("escola_id", escolaId)
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new Error("Aluno não encontrado nesta escola.");
  return {
    id: data.id,
    name: data.responsavel_nome || data.encarregado_nome || payload.recipientName || `Encarregado de ${data.nome}`,
    phone: data.responsavel_contato || data.telefone_responsavel || data.encarregado_telefone || null,
    type: payload.recipientType,
  };
}

async function loadProvider(supabase: any, escolaId: string) {
  const { data } = await supabase
    .from("school_notification_providers")
    .select("status,session_name,daily_limit,monthly_limit,updated_at,config")
    .eq("school_id", escolaId)
    .eq("provider_type", "whatsapp_waha")
    .maybeSingle();
  return data ?? null;
}

async function templateAllowedForUser(supabase: any, escolaId: string, allowedRoles: unknown) {
  if (!Array.isArray(allowedRoles) || allowedRoles.length === 0) return true;
  const roles = allowedRoles.map((role) => String(role)).filter(Boolean);
  if (roles.length === 0) return true;
  return userHasAnyRole(supabase, escolaId, roles);
}

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const supabase = await supabaseServerTyped<DBWithRPC>();
    const auth = await authorizeWhatsappUser(supabase, id);
    if (!auth.ok) return withNoStore(NextResponse.json({ ok: false, error: auth.error }, { status: auth.status }));

    const url = new URL(request.url);
    const status = url.searchParams.get("status");
    const limit = Math.max(1, Math.min(Number(url.searchParams.get("limit") ?? 50), 50));

    const provider = await loadProvider(supabase as any, auth.auth.escolaId);
    const session = await fetchWahaSessionStatus(provider?.session_name ?? null);

    let outboxQuery = (supabase as any)
      .from("communication_outbox")
      .select("id,message_type,recipient_type,recipient_name,recipient_phone_masked,title,body,template_key,status,risk_level,requires_approval,retry_count,last_error,created_at,approved_at,queued_at,sending_at,sent_at,failed_at,cancelled_at,provider_message_id")
      .eq("school_id", auth.auth.escolaId)
      .order("created_at", { ascending: false })
      .limit(limit);

    if (status && status !== "all") outboxQuery = outboxQuery.eq("status", status);
    const { data: outboxRows, error: outboxError } = await outboxQuery;
    if (outboxError) throw outboxError;

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const { data: summaryRows } = await (supabase as any)
      .from("communication_outbox")
      .select("status,created_at,sent_at,failed_at")
      .eq("school_id", auth.auth.escolaId)
      .gte("created_at", today.toISOString())
      .limit(500);

    const { data: templates } = await (supabase as any)
      .from("communication_templates")
      .select("key,title,category,body,required_variables,risk_level,requires_approval,allowed_roles")
      .eq("active", true)
      .order("category", { ascending: true })
      .order("title", { ascending: true });

    const { data: logs } = await (supabase as any)
      .from("communication_logs")
      .select("id,outbox_id,event_type,provider,provider_event_id,payload_sanitized,created_at")
      .eq("school_id", auth.auth.escolaId)
      .order("created_at", { ascending: false })
      .limit(50);

    const queueCount = (summaryRows || []).filter((row: any) => ["approved", "queued", "sending"].includes(row.status)).length;
    const sentToday = (summaryRows || []).filter((row: any) => ["sent", "delivered", "read"].includes(row.status)).length;
    const failedToday = (summaryRows || []).filter((row: any) => row.status === "failed").length;

    return withNoStore(
      NextResponse.json({
        ok: true,
        data: {
          experimentalEnabled: isWahaEnabled(),
          provider: provider
            ? {
                status: provider.status,
                sessionNameMasked: sanitizeWahaSessionName(provider.session_name),
                dailyLimit: provider.daily_limit,
                monthlyLimit: provider.monthly_limit,
                updatedAt: provider.updated_at,
              }
            : null,
          session,
          canManageSession: auth.auth.canManageSession,
          summary: {
            queueCount,
            sentToday,
            failedToday,
            lastSyncAt: new Date().toISOString(),
          },
          outbox: outboxRows || [],
          templates: templates || [],
          logs: logs || [],
        },
      })
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return withNoStore(NextResponse.json({ ok: false, error: message }, { status: 500 }));
  }
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const supabase = await supabaseServerTyped<DBWithRPC>();
    const auth = await authorizeWhatsappUser(supabase, id);
    if (!auth.ok) return withNoStore(NextResponse.json({ ok: false, error: auth.error }, { status: auth.status }));
    if (!isWahaEnabled()) return withNoStore(NextResponse.json({ ok: false, error: "WhatsApp KLASSE está desativado neste ambiente." }, { status: 403 }));

    const parsed = createSchema.safeParse(await request.json());
    if (!parsed.success) return withNoStore(NextResponse.json({ ok: false, error: "Payload inválido." }, { status: 400 }));

    if (parsed.data.messageType === "finance_charge") {
      const allowed = await userHasAnyRole(supabase, auth.auth.escolaId, WHATSAPP_FINANCE_ROLES);
      if (!allowed) return withNoStore(NextResponse.json({ ok: false, error: "Sem permissão para mensagens financeiras." }, { status: 403 }));
    }

    const provider = await loadProvider(supabase as any, auth.auth.escolaId);
    if (!provider || provider.status !== "connected") {
      return withNoStore(NextResponse.json({ ok: false, error: "WhatsApp da escola está desconectado." }, { status: 409 }));
    }

    const recipient = await resolveRecipient(supabase as any, auth.auth.escolaId, parsed.data);
    const phone = normalizeWhatsappPhone(recipient.phone);
    if (!phone) return withNoStore(NextResponse.json({ ok: false, error: "Telefone WhatsApp inválido." }, { status: 400 }));

    let template: any = null;
    if (parsed.data.templateKey) {
      const { data, error } = await (supabase as any)
        .from("communication_templates")
        .select("key,title,body,risk_level,requires_approval,allowed_roles")
        .eq("key", parsed.data.templateKey)
        .eq("active", true)
        .maybeSingle();
      if (error) throw error;
      if (!data) return withNoStore(NextResponse.json({ ok: false, error: "Template não encontrado." }, { status: 404 }));
      template = data;
      const allowed = await templateAllowedForUser(supabase as any, auth.auth.escolaId, template.allowed_roles);
      if (!allowed) return withNoStore(NextResponse.json({ ok: false, error: "Sem permissão para usar este template." }, { status: 403 }));
    }

    const body = template ? interpolateTemplate(template.body, parsed.data.variables) : parsed.data.body;
    const riskLevel = template?.risk_level || (parsed.data.messageType === "finance_charge" ? "high" : "low");
    const requiresApproval = inferApproval(riskLevel, parsed.data.messageType, Boolean(template?.requires_approval));
    const nextStatus = requiresApproval ? "review_required" : "queued";
    const now = new Date().toISOString();
    const idempotencyKey = `${parsed.data.messageType}:${parsed.data.recipientType}:${recipient.id || phone}:${crypto.randomUUID()}`;

    const { data, error } = await (supabase as any)
      .from("communication_outbox")
      .insert({
        school_id: auth.auth.escolaId,
        created_by: auth.auth.userId,
        provider: "waha",
        channel: "whatsapp",
        message_type: parsed.data.messageType,
        source_module: parsed.data.sourceModule || "comunicacao",
        source_entity_type: parsed.data.sourceEntityType || null,
        source_entity_id: parsed.data.sourceEntityId || null,
        recipient_type: parsed.data.recipientType,
        recipient_ref_id: recipient.id || null,
        recipient_name: recipient.name,
        recipient_phone_masked: maskPhone(phone),
        recipient_phone_hash: hashPhone(phone),
        title: parsed.data.title || template?.title || "Mensagem WhatsApp",
        body,
        template_key: template?.key || parsed.data.templateKey || null,
        metadata: { phone, variables: parsed.data.variables },
        status: nextStatus,
        risk_level: riskLevel,
        requires_approval: requiresApproval,
        idempotency_key: idempotencyKey,
        queued_at: nextStatus === "queued" ? now : null,
      })
      .select("id,status,requires_approval")
      .single();

    if (error) throw error;

    await (supabase as any).from("communication_logs").insert({
      outbox_id: data.id,
      school_id: auth.auth.escolaId,
      event_type: "outbox.created",
      provider: "waha",
      payload_sanitized: { status: data.status, message_type: parsed.data.messageType },
    });

    return withNoStore(NextResponse.json({ ok: true, data }));
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return withNoStore(NextResponse.json({ ok: false, error: message }, { status: 500 }));
  }
}
