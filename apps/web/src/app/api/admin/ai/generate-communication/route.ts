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

const communicationSchema = z.object({
  schoolId: z.string().uuid(),
  title: z.string().trim().min(3).max(180),
  audience: z.string().trim().min(2).max(120).default("comunidade escolar"),
  topic: z.string().trim().min(3).max(600),
  tone: z.enum(["formal", "cordial", "urgente"]).optional().default("cordial"),
  context: z.object({
    module: z.enum(["dashboard", "financeiro", "secretaria", "academico", "comunicacao", "classe_ai"]).default("comunicacao"),
    page: z.string().trim().max(120).optional(),
    entityType: z.string().trim().max(80).optional(),
    entityId: z.string().trim().max(120).optional(),
  }).optional(),
});

export async function POST(req: Request) {
  const parsed = communicationSchema.safeParse(await req.json().catch(() => null));
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

  const access = await validateAiAccess(schoolId, "generate_communication", "admin_ai_generate_communication");
  if (!access.ok || !access.userId) {
    return NextResponse.json({ ok: false, error: access.error ?? "Sem permissão para usar KLASSE AI." }, { status: 403 });
  }

  const prompt = [
    "És o KLASSE AI, assistente administrativo para escolas em Angola.",
    "Cria um comunicado curto, claro e pronto para revisão humana.",
    "Não incluas dados pessoais. Usa placeholders quando necessário.",
    `Público: ${parsed.data.audience}.`,
    `Tom: ${parsed.data.tone}.`,
    `Assunto: ${parsed.data.topic}.`,
    "Responde apenas com o comunicado.",
  ].join("\n");

  const fallback = `Prezados(as),\n\nInformamos sobre ${parsed.data.topic}.\n\nPedimos a atenção de todos e permanecemos à disposição para esclarecimentos.\n\nCom os melhores cumprimentos.`;

  try {
    const result = await generateAiText({ prompt, fallback, temperature: 0.3 });
    const action = await createAiAction(supabase, {
      schoolId,
      createdBy: access.userId,
      actionType: "communication_draft",
      sourceModule: parsed.data.context?.module ?? "comunicacao",
      sourceEntityType: parsed.data.context?.entityType ?? null,
      sourceEntityId: parsed.data.context?.entityId ?? null,
      title: parsed.data.title,
      summary: `Comunicado para ${parsed.data.audience}`,
      content: result.text,
      metadata: {
        page: parsed.data.context?.page ?? null,
        audience: parsed.data.audience,
        tone: parsed.data.tone,
        provider: result.provider,
        model: result.model,
      },
      riskLevel: "medium",
      requiresApproval: true,
      status: "review_required",
    });

    await updateAiUsageLog(access.usageLogId, {
      status: "completed",
      inputPreview: parsed.data.topic,
      outputPreview: result.text,
      tokensInput: result.tokensInput,
      tokensOutput: result.tokensOutput,
      provider: result.provider,
      model: result.model,
    });

    return NextResponse.json({ ok: true, content: result.text, action, fallback: result.fallback });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro ao gerar comunicado.";
    await updateAiUsageLog(access.usageLogId, {
      status: "error",
      inputPreview: parsed.data.topic,
      outputPreview: null,
      errorMessage: message,
    });
    return NextResponse.json({ ok: false, error: message }, { status: 502 });
  }
}
