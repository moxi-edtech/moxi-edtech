import { NextResponse } from "next/server";
import { z } from "zod";
import { supabaseServerTyped } from "@/lib/supabaseServer";
import { resolveEscolaIdForUser } from "@/lib/tenant/resolveEscolaIdForUser";
import { createAiAction } from "@/lib/server/ai/ai-actions";
import { validateAiAccess, updateAiUsageLog } from "@/lib/server/ai/ai-guards";
import {
  hashPhone,
  maskPhone,
  normalizeWhatsappPhone,
} from "@/lib/server/whatsappUtility";
import type { DBWithRPC } from "@/types/supabase-augment";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const saveSchema = z.object({
  schoolId: z.string().uuid(),
  title: z.string().trim().min(3).max(180),
  content: z.string().trim().min(3).max(4000),
  actionType: z.enum(["communication_draft", "finance_message", "school_summary", "help_navigation", "operational_recommendation"]),
  sourceModule: z.enum(["dashboard", "financeiro", "secretaria", "academico", "comunicacao", "classe_ai"]).default("classe_ai"),
  riskLevel: z.enum(["low", "medium", "high"]).default("low"),
  createWhatsappDraft: z.boolean().optional().default(false),
  whatsapp: z.object({
    recipientType: z.enum(["manual", "encarregado", "aluno", "professor"]).default("manual"),
    recipientName: z.string().trim().min(1).max(160),
    recipientPhone: z.string().trim().min(5).max(40),
    messageType: z.enum(["manual_message", "school_notice", "finance_charge", "document_ready", "ai_generated_draft"]).default("ai_generated_draft"),
  }).optional(),
  context: z.record(z.string(), z.unknown()).optional().default({}),
});

export async function POST(request: Request) {
  const parsed = saveSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: "Payload inválido." }, { status: 400 });
  }

  const supabase = await supabaseServerTyped<DBWithRPC>();
  const { data: userRes } = await supabase.auth.getUser();
  const user = userRes?.user ?? null;
  if (!user) return NextResponse.json({ ok: false, error: "Não autenticado." }, { status: 401 });

  const metaEscolaId = (user.app_metadata as { escola_id?: string | null } | null)?.escola_id ?? null;
  const schoolId = await resolveEscolaIdForUser(
    supabase,
    user.id,
    parsed.data.schoolId,
    metaEscolaId ? String(metaEscolaId) : null
  );
  if (!schoolId || schoolId !== parsed.data.schoolId) {
    return NextResponse.json({ ok: false, error: "Sem permissão para esta escola." }, { status: 403 });
  }

  const feature =
    parsed.data.createWhatsappDraft || parsed.data.actionType === "finance_message"
      ? "finance_message"
      : parsed.data.actionType === "communication_draft"
        ? "generate_communication"
        : "summary";
  const access = await validateAiAccess(schoolId, feature, "admin_ai_actions_save");
  if (!access.ok || !access.userId) {
    return NextResponse.json({ ok: false, error: access.error ?? "Sem permissão para salvar ação IA." }, { status: 403 });
  }

  try {
    const action = await createAiAction(supabase, {
      schoolId,
      createdBy: access.userId,
      actionType: parsed.data.actionType,
      sourceModule: parsed.data.sourceModule,
      title: parsed.data.title,
      summary: parsed.data.title,
      content: parsed.data.content,
      metadata: {
        ...parsed.data.context,
        channel: parsed.data.createWhatsappDraft ? "waha" : undefined,
        assistant_v3: true,
      },
      riskLevel: parsed.data.riskLevel,
      requiresApproval: parsed.data.riskLevel !== "low" || parsed.data.createWhatsappDraft,
      status: parsed.data.riskLevel !== "low" || parsed.data.createWhatsappDraft ? "review_required" : "draft",
    });

    let outbox = null;
    if (parsed.data.createWhatsappDraft) {
      if (!parsed.data.whatsapp) {
        return NextResponse.json({ ok: false, error: "Dados WhatsApp obrigatórios para rascunho." }, { status: 400 });
      }
      const phone = normalizeWhatsappPhone(parsed.data.whatsapp.recipientPhone);
      if (!phone) return NextResponse.json({ ok: false, error: "Telefone WhatsApp inválido." }, { status: 400 });

      const { data, error } = await (supabase as any)
        .from("communication_outbox")
        .insert({
          school_id: schoolId,
          created_by: access.userId,
          provider: "waha",
          channel: "whatsapp",
          message_type: parsed.data.whatsapp.messageType,
          source_module: "classe_ai",
          source_entity_type: "ai_actions",
          source_entity_id: action.id,
          recipient_type: parsed.data.whatsapp.recipientType,
          recipient_name: parsed.data.whatsapp.recipientName,
          recipient_phone_masked: maskPhone(phone),
          recipient_phone_hash: hashPhone(phone),
          title: parsed.data.title,
          body: parsed.data.content,
          metadata: { phone, ai_action_id: action.id, assistant_v3: true },
          status: "review_required",
          risk_level: parsed.data.riskLevel === "low" ? "medium" : parsed.data.riskLevel,
          requires_approval: true,
          idempotency_key: `assistant_v3:${action.id}`,
        })
        .select("id,status")
        .single();
      if (error) throw error;
      outbox = data;
    }

    await updateAiUsageLog(access.usageLogId, {
      status: "completed",
      inputPreview: parsed.data.title,
      outputPreview: parsed.data.content,
      provider: "local",
      model: "assistant-v3",
    });

    return NextResponse.json({ ok: true, action, outbox });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro ao salvar ação IA.";
    await updateAiUsageLog(access.usageLogId, {
      status: "error",
      inputPreview: parsed.data.title,
      errorMessage: message,
    });
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
