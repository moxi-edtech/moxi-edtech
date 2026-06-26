import { NextResponse } from "next/server";
import { z } from "zod";
import { supabaseServerTyped } from "@/lib/supabaseServer";
import { resolveEscolaIdForUser } from "@/lib/tenant/resolveEscolaIdForUser";
import { createAiAction } from "@/lib/server/ai/ai-actions";
import { updateAiUsageLog, validateAiAccess } from "@/lib/server/ai/ai-guards";
import { generateAiText } from "@/lib/server/ai/text-generation";
import type { DBWithRPC } from "@/types/supabase-augment";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const financeMessageSchema = z.object({
  schoolId: z.string().uuid(),
  title: z.string().trim().min(3).max(180).optional(),
  scenario: z.string().trim().min(3).max(800),
  amountLabel: z.string().trim().max(80).optional(),
  dueDateLabel: z.string().trim().max(80).optional(),
  recipientLabel: z.string().trim().max(120).optional(),
  sourceEntityType: z.string().trim().max(80).optional(),
  sourceEntityId: z.string().trim().max(120).optional(),
  context: z.object({
    page: z.string().trim().max(120).optional(),
  }).optional(),
});

export async function POST(req: Request) {
  const parsed = financeMessageSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: "Payload inválido." }, { status: 400 });
  }

  const supabase = await supabaseServerTyped<DBWithRPC>();
  const { data: userRes } = await supabase.auth.getUser();
  const user = userRes?.user ?? null;
  if (!user) {
    return NextResponse.json({ ok: false, error: "Não autenticado." }, { status: 401 });
  }

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

  const access = await validateAiAccess(schoolId, "finance_message", "admin_ai_finance_message");
  if (!access.ok || !access.userId) {
    return NextResponse.json({ ok: false, error: access.error ?? "Sem permissão para usar KLASSE AI." }, { status: 403 });
  }

  const recipient = parsed.data.recipientLabel || "[Encarregado]";
  const amount = parsed.data.amountLabel || "[Valor]";
  const dueDate = parsed.data.dueDateLabel || "[Data de vencimento]";
  const prompt = [
    "És o KLASSE AI, assistente administrativo para escolas em Angola.",
    "Prepara uma mensagem financeira cordial para revisão humana.",
    "Não uses nomes reais se não forem fornecidos. Não inventes valores nem datas.",
    "Mantém placeholders entre colchetes para dados sensíveis ou ausentes.",
    `Destinatário: ${recipient}.`,
    `Valor: ${amount}.`,
    `Vencimento: ${dueDate}.`,
    `Contexto: ${parsed.data.scenario}.`,
    "Responde apenas com a mensagem final.",
  ].join("\n");

  const fallback = `Caro(a) ${recipient},\n\nRecordamos que existe uma pendência financeira no valor de ${amount}, com vencimento em ${dueDate}. Pedimos, por favor, a regularização ou contacto com a secretaria financeira para esclarecimentos.\n\nCom os melhores cumprimentos.`;

  try {
    const result = await generateAiText({ prompt, fallback, temperature: 0.2 });
    const action = await createAiAction(supabase, {
      schoolId,
      createdBy: access.userId,
      actionType: "finance_message",
      sourceModule: "financeiro",
      sourceEntityType: parsed.data.sourceEntityType ?? null,
      sourceEntityId: parsed.data.sourceEntityId ?? null,
      title: parsed.data.title ?? "Rascunho de cobrança",
      summary: "Mensagem financeira preparada para revisão manual.",
      content: result.text,
      metadata: {
        page: parsed.data.context?.page ?? null,
        recipient_label: recipient,
        amount_label: amount,
        due_date_label: dueDate,
        provider: result.provider,
        model: result.model,
      },
      riskLevel: "high",
      requiresApproval: true,
      status: "review_required",
    });

    await updateAiUsageLog(access.usageLogId, {
      status: "completed",
      inputPreview: parsed.data.scenario,
      outputPreview: result.text,
      tokensInput: result.tokensInput,
      tokensOutput: result.tokensOutput,
      provider: result.provider,
      model: result.model,
    });

    return NextResponse.json({ ok: true, content: result.text, action, fallback: result.fallback });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro ao gerar mensagem financeira.";
    await updateAiUsageLog(access.usageLogId, {
      status: "error",
      inputPreview: parsed.data.scenario,
      outputPreview: null,
      errorMessage: message,
    });
    return NextResponse.json({ ok: false, error: message }, { status: 502 });
  }
}
