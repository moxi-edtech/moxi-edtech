import { NextResponse } from "next/server";
import { createHash } from "node:crypto";
import { z } from "zod";
import type { Json } from "~types/supabase";
import { supabaseServerTyped } from "@/lib/supabaseServer";
import { resolveEscolaIdForUser } from "@/lib/tenant/resolveEscolaIdForUser";
import { validateAiAccess, updateAiUsageLog } from "@/lib/server/ai/ai-guards";
import { isFastPathQuery, processKlasseBrainQuery } from "@/lib/assistant/klasse-brain";
import { hasAssistantPermission } from "@/lib/assistant/permission-registry";
import type { AssistantResponse } from "@/lib/assistant/klasse-brain";
import {
  upsertAiInsight,
  type AiInsightModule,
  type AiInsightSeverity,
} from "@/lib/server/ai/ai-insights";
import type { DBWithRPC } from "@/types/supabase-augment";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const assistantSchema = z.object({
  schoolId: z.string().trim().min(1),
  message: z.string().trim().optional(),
  intent: z.string().trim().optional(),
  context: z
    .object({
      module: z.enum([
        "dashboard",
        "financeiro",
        "secretaria",
        "academico",
        "comunicacao",
        "whatsapp",
        "classe_ai",
        "operacoes",
      ]),
      page: z.string().optional(),
      entityType: z
        .enum(["student", "guardian", "class", "teacher", "invoice", "notice", "none"])
        .optional(),
      entityId: z.string().optional(),
      capabilities: z.array(z.string()).optional(),
      selectedCount: z.number().optional(),
      readonly: z.boolean().optional(),
    })
    .optional(),
});

function withNoStore(response: NextResponse) {
  response.headers.set("Cache-Control", "no-store");
  return response;
}

const TOOL_INSIGHT_METADATA: Record<string, { title: string; module: AiInsightModule }> = {
  "finance-debt-by-class": { title: "Inadimplência por turma", module: "financeiro" },
  "finance-risk-summary": { title: "Resumo de risco financeiro", module: "financeiro" },
  "admissions-pending": { title: "Admissões pendentes", module: "secretaria" },
  "academic-grade-gaps": { title: "Lacunas de notas", module: "academico" },
  "academic-low-attendance": { title: "Risco de frequência", module: "academico" },
  "academic-pedagogical-risk": { title: "Radar de risco pedagógico", module: "academico" },
  "school-daily-briefing": { title: "Briefing diário", module: "direcao" },
};

async function attachPersistedInsight(params: {
  result: AssistantResponse;
  query: string;
  schoolId: string;
  userId: string;
  supabase: Awaited<ReturnType<typeof supabaseServerTyped<DBWithRPC>>>;
}) {
  const { result } = params;
  if (result.mode !== "data_query" || !result.insight || !result.toolId) return result;

  const metadata = TOOL_INSIGHT_METADATA[result.toolId] ?? {
    title: "Diagnóstico KLASSE IA",
    module: "direcao" as const,
  };
  const dateKey = new Date().toISOString().slice(0, 10);
  const queryHash = createHash("sha256")
    .update(params.query.toLowerCase().trim())
    .digest("hex")
    .slice(0, 16);
  const severity: AiInsightSeverity = result.insight.severity
    ?? (result.insight.actions.some((action) => action.riskLevel === "high") ? "high" : "medium");
  const insight = await upsertAiInsight(params.supabase, {
    schoolId: params.schoolId,
    generatedBy: params.userId,
    toolId: result.toolId,
    fingerprint: `${result.toolId}:${dateKey}:${queryHash}`,
    title: metadata.title,
    severity,
    module: metadata.module,
    explanation: result.insight.diagnosis,
    evidence: result.insight.evidence as Json,
    recommendation: result.insight.recommendation,
    suggestedAction: (result.insight.actions[0] ?? null) as Json,
  });

  return { ...result, aiInsightId: insight.id };
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const parsed = assistantSchema.safeParse(body);

  if (!parsed.success) {
    return withNoStore(
      NextResponse.json({ ok: false, error: "Payload inválido ou campos obrigatórios em falta." }, { status: 400 })
    );
  }

  const { schoolId, message, context } = parsed.data;
  const query = message || "";

  const supabase = await supabaseServerTyped<DBWithRPC>();
  const { data: userRes } = await supabase.auth.getUser();
  const user = userRes?.user ?? null;

  if (!user) {
    return withNoStore(NextResponse.json({ ok: false, error: "Não autenticado." }, { status: 401 }));
  }

  const metaEscolaId = (user.app_metadata as { escola_id?: string | null } | null)?.escola_id ?? null;
  const resolvedEscolaId = await resolveEscolaIdForUser(
    supabase,
    user.id,
    schoolId,
    metaEscolaId ? String(metaEscolaId) : null
  );

  if (!resolvedEscolaId) {
    return withNoStore(
      NextResponse.json({ ok: false, error: "Sem permissão para esta escola." }, { status: 403 })
    );
  }

  // Get user role inside this school
  const { data: roleRes, error: roleError } = await supabase
    .from("escola_users")
    .select("papel")
    .eq("escola_id", resolvedEscolaId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (roleError || !roleRes) {
    return withNoStore(
      NextResponse.json({ ok: false, error: "Usuário não possui vínculo com esta escola." }, { status: 403 })
    );
  }

  const role = String(roleRes.papel ?? "").trim().toLowerCase();

  // Validate assistant view permission
  if (!hasAssistantPermission(role, "assistant.view")) {
    return withNoStore(
      NextResponse.json({ ok: false, error: "Seu perfil não tem permissão para usar o assistente KLASSE." }, { status: 403 })
    );
  }

  const isFastPath = isFastPathQuery(query, context);

  if (isFastPath) {
    // Fast path: Process locally and return instantly without checking/charging AI credits
    console.log(`[Fast Path] Consulta local processada para papel "${role}".`);
    const rawResult = await processKlasseBrainQuery({
      schoolId: resolvedEscolaId,
      role,
      query,
      context,
    });
    const result = await attachPersistedInsight({
      result: rawResult,
      query,
      schoolId: resolvedEscolaId,
      userId: user.id,
      supabase,
    });
    return withNoStore(NextResponse.json(result));
  }

  // Smart path: Validate AI limits and lock a credit slot
  console.log("[Smart Path] Validando cotas de IA para consulta contextual.");
  const access = await validateAiAccess(resolvedEscolaId, "summary", "admin_ai_assistant");

  if (!access.ok || !access.userId) {
    // If quota limits exceeded or AI is disabled, fallback safely to local help search
    console.warn(`[Smart Path Warning] Acesso IA negado (${access.error}). Respondendo com fallback.`);
    const rawResult = await processKlasseBrainQuery({
      schoolId: resolvedEscolaId,
      role,
      query,
      context,
    });
    const result = await attachPersistedInsight({
      result: rawResult,
      query,
      schoolId: resolvedEscolaId,
      userId: user.id,
      supabase,
    });
    if (result.mode === "data_query") {
      return withNoStore(NextResponse.json(result));
    }
    // Override mode to fallback
    return withNoStore(NextResponse.json({
      ...result,
      mode: "fallback",
      answer: `[Cota de IA excedida ou desativada] ${result.answer}`
    }));
  }

  try {
    // Call process query passing usageLogId to update token counts/status
    const rawResult = await processKlasseBrainQuery({
      schoolId: resolvedEscolaId,
      role,
      query,
      context,
      allowedFeatures: access.settings?.allowed_features,
      usageLogId: access.usageLogId,
    });
    const result = await attachPersistedInsight({
      result: rawResult,
      query,
      schoolId: resolvedEscolaId,
      userId: user.id,
      supabase,
    });

    return withNoStore(NextResponse.json(result));
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erro ao processar resposta do assistente.";
    await updateAiUsageLog(access.usageLogId, {
      status: "error",
      inputPreview: query,
      outputPreview: null,
      errorMessage: message,
    });
    return withNoStore(
      NextResponse.json({ ok: false, error: message }, { status: 502 })
    );
  }
}
