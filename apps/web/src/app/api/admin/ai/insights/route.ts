import { NextResponse } from "next/server";
import { z } from "zod";
import type { Json } from "~types/supabase";
import { supabaseServerTyped } from "@/lib/supabaseServer";
import { resolveEscolaIdForUser } from "@/lib/tenant/resolveEscolaIdForUser";
import { schoolDailyBriefingTool } from "@/lib/assistant/data-copilot/tools/school-daily-briefing";
import { canAccessAiActions, getUserAiRole } from "@/lib/server/ai/ai-actions";
import {
  AI_INSIGHT_MODULES,
  AI_INSIGHT_SEVERITIES,
  AI_INSIGHT_STATUSES,
  upsertAiInsight,
} from "@/lib/server/ai/ai-insights";
import type { DBWithRPC } from "@/types/supabase-augment";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const listSchema = z.object({
  schoolId: z.string().uuid(),
  id: z.string().uuid().optional(),
  status: z.enum(AI_INSIGHT_STATUSES).optional(),
  module: z.enum(AI_INSIGHT_MODULES).optional(),
  severity: z.enum(AI_INSIGHT_SEVERITIES).optional(),
  limit: z.coerce.number().int().min(1).max(50).default(30),
});

const generateSchema = z.object({
  schoolId: z.string().uuid(),
});

async function authorize(schoolId: string) {
  const supabase = await supabaseServerTyped<DBWithRPC>();
  const { data: userResult } = await supabase.auth.getUser();
  const user = userResult.user;
  if (!user) return { error: "Não autenticado.", status: 401 } as const;

  const metadataSchoolId = (user.app_metadata as { escola_id?: string | null } | null)?.escola_id;
  const resolvedSchoolId = await resolveEscolaIdForUser(
    supabase,
    user.id,
    schoolId,
    metadataSchoolId ? String(metadataSchoolId) : null,
  );
  if (resolvedSchoolId !== schoolId) {
    return { error: "Sem permissão para esta escola.", status: 403 } as const;
  }

  const role = await getUserAiRole(supabase, schoolId, user.id);
  if (!canAccessAiActions(role)) {
    return { error: "Sem permissão para os insights do KLASSE IA.", status: 403 } as const;
  }

  return { supabase, user, role } as const;
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const parsed = listSchema.safeParse({
    schoolId: url.searchParams.get("schoolId"),
    id: url.searchParams.get("id") || undefined,
    status: url.searchParams.get("status") || undefined,
    module: url.searchParams.get("module") || undefined,
    severity: url.searchParams.get("severity") || undefined,
    limit: url.searchParams.get("limit") || undefined,
  });
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: "Filtros inválidos." }, { status: 400 });
  }

  const access = await authorize(parsed.data.schoolId);
  if ("error" in access) {
    return NextResponse.json({ ok: false, error: access.error }, { status: access.status });
  }

  let query = access.supabase
    .from("ai_insights")
    .select("*")
    .eq("school_id", parsed.data.schoolId)
    .order("last_detected_at", { ascending: false })
    .order("id", { ascending: false })
    .limit(parsed.data.limit);

  if (parsed.data.status) query = query.eq("status", parsed.data.status);
  if (parsed.data.id) query = query.eq("id", parsed.data.id);
  if (parsed.data.module) query = query.eq("module", parsed.data.module);
  if (parsed.data.severity) query = query.eq("severity", parsed.data.severity);

  const { data, error } = await query;
  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, insights: data ?? [] });
}

export async function POST(req: Request) {
  const parsed = generateSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: "Payload inválido." }, { status: 400 });
  }

  const access = await authorize(parsed.data.schoolId);
  if ("error" in access) {
    return NextResponse.json({ ok: false, error: access.error }, { status: access.status });
  }

  const response = await schoolDailyBriefingTool.run({
    schoolId: parsed.data.schoolId,
    role: access.role,
    query: "O que merece minha atenção hoje?",
    context: { module: "dashboard", page: "klasse-ai-cockpit" },
  });
  if (!response) {
    return NextResponse.json({ ok: false, error: "Não foi possível gerar o briefing diário." }, { status: 422 });
  }

  const dateKey = new Date().toISOString().slice(0, 10);
  const insight = await upsertAiInsight(access.supabase, {
    schoolId: parsed.data.schoolId,
    generatedBy: access.user.id,
    toolId: schoolDailyBriefingTool.id,
    fingerprint: `${schoolDailyBriefingTool.id}:${dateKey}`,
    title: "O que merece atenção hoje",
    severity: response.insight.severity ?? "medium",
    module: "direcao",
    explanation: response.insight.diagnosis,
    evidence: response.insight.evidence as Json,
    recommendation: response.insight.recommendation,
    suggestedAction: (response.insight.actions[0] ?? null) as Json,
  });

  return NextResponse.json({ ok: true, insight, response });
}
