import { NextResponse } from "next/server";
import { z } from "zod";
import { supabaseServerTyped } from "@/lib/supabaseServer";
import { resolveEscolaIdForUser } from "@/lib/tenant/resolveEscolaIdForUser";
import {
  AI_ACTION_MODULES,
  AI_ACTION_STATUSES,
  AI_ACTION_TYPES,
  AI_RISK_LEVELS,
  canAccessAiActions,
  getUserAiRole,
  type AiActionModule,
  type AiActionStatus,
  type AiActionType,
  type AiRiskLevel,
} from "@/lib/server/ai/ai-actions";
import type { DBWithRPC } from "@/types/supabase-augment";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const querySchema = z.object({
  schoolId: z.string().uuid(),
  status: z.enum(AI_ACTION_STATUSES as [AiActionStatus, ...AiActionStatus[]]).optional(),
  actionType: z.enum(AI_ACTION_TYPES as [AiActionType, ...AiActionType[]]).optional(),
  module: z.enum(AI_ACTION_MODULES as [AiActionModule, ...AiActionModule[]]).optional(),
  riskLevel: z.enum(AI_RISK_LEVELS as [AiRiskLevel, ...AiRiskLevel[]]).optional(),
  createdBy: z.string().uuid().optional(),
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
});

export async function GET(req: Request) {
  const url = new URL(req.url);
  const parsed = querySchema.safeParse({
    schoolId: url.searchParams.get("schoolId"),
    status: url.searchParams.get("status") || undefined,
    actionType: url.searchParams.get("type") || undefined,
    module: url.searchParams.get("module") || undefined,
    riskLevel: url.searchParams.get("risk") || undefined,
    createdBy: url.searchParams.get("createdBy") || undefined,
    from: url.searchParams.get("from") || undefined,
    to: url.searchParams.get("to") || undefined,
  });

  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: "Filtros inválidos." }, { status: 400 });
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

  const role = await getUserAiRole(supabase, schoolId, user.id);
  if (!canAccessAiActions(role)) {
    return NextResponse.json({ ok: false, error: "Sem permissão para a Central de Ações IA." }, { status: 403 });
  }

  let query = (supabase)
    .from("ai_actions")
    .select("*")
    .eq("school_id", schoolId)
    .order("created_at", { ascending: false })
    .limit(100);

  if (parsed.data.status) query = query.eq("status", parsed.data.status);
  if (parsed.data.actionType) query = query.eq("action_type", parsed.data.actionType);
  if (parsed.data.module) query = query.eq("source_module", parsed.data.module);
  if (parsed.data.riskLevel) query = query.eq("risk_level", parsed.data.riskLevel);
  if (parsed.data.createdBy) query = query.eq("created_by", parsed.data.createdBy);
  if (parsed.data.from) query = query.gte("created_at", parsed.data.from);
  if (parsed.data.to) query = query.lte("created_at", parsed.data.to);

  const { data, error } = await query;
  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }

  const summary = (data ?? []).reduce(
    (acc, item) => {
      acc.total += 1;
      acc.byStatus[item.status] = (acc.byStatus[item.status] ?? 0) + 1;
      acc.byType[item.action_type] = (acc.byType[item.action_type] ?? 0) + 1;
      return acc;
    },
    { total: 0, byStatus: {} as Record<string, number>, byType: {} as Record<string, number> }
  );

  return NextResponse.json({ ok: true, actions: data ?? [], summary });
}
