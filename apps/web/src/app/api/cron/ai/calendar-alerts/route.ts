import { NextRequest, NextResponse } from "next/server";
import type { Json } from "~types/supabase";
import { supabaseServerRole } from "@/lib/supabaseServerRole";
import { runAcademicCalendarOperations } from "@/lib/assistant/data-copilot/tools/academic-calendar-operations";
import { upsertAiInsight } from "@/lib/server/ai/ai-insights";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function isAuthorized(request: NextRequest) {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) return process.env.NODE_ENV !== "production";
  return request.headers.get("authorization") === `Bearer ${secret}`
    || request.headers.get("x-vercel-cron") === "1";
}

export async function GET(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ ok: false, error: "Não autorizado" }, { status: 401 });
  }

  try {
    const supabase = supabaseServerRole();
    const { data: schools, error: schoolsError } = await supabase
      .from("anos_letivos")
      .select("escola_id")
      .eq("ativo", true)
      .order("escola_id", { ascending: true });
    if (schoolsError) throw schoolsError;

    const schoolIds = [...new Set((schools ?? []).map((row) => row.escola_id).filter(Boolean))];
    const dateKey = new Date().toISOString().slice(0, 10);
    const results: Array<{ schoolId: string; insightId?: string; status: "ok" | "skipped" | "error"; error?: string }> = [];

    for (const schoolId of schoolIds) {
      try {
        const response = await runAcademicCalendarOperations({
          schoolId,
          role: "admin",
          supabase,
        });
        if (!response) {
          results.push({ schoolId, status: "skipped" });
          continue;
        }

        const nextMarker = response.insight.evidence.find((item) => item.label === "Próximo marco")?.value ?? "sem-marco";
        const insight = await upsertAiInsight(supabase as any, {
          schoolId,
          generatedBy: null,
          toolId: "academic-calendar-operations",
          fingerprint: `academic-calendar-operations:${dateKey}:${nextMarker}`,
          title: "Próximo marco do calendário MED",
          severity: response.insight.severity ?? "medium",
          module: "academico",
          explanation: response.insight.diagnosis,
          evidence: response.insight.evidence as Json,
          recommendation: response.insight.recommendation,
          suggestedAction: (response.insight.actions[0] ?? null) as Json,
        });
        results.push({ schoolId, insightId: insight.id, status: "ok" });
      } catch (error) {
        results.push({
          schoolId,
          status: "error",
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    return NextResponse.json({
      ok: true,
      processed: schoolIds.length,
      succeeded: results.filter((result) => result.status === "ok").length,
      skipped: results.filter((result) => result.status === "skipped").length,
      failed: results.filter((result) => result.status === "error").length,
      results,
    });
  } catch (error) {
    return NextResponse.json({
      ok: false,
      error: error instanceof Error ? error.message : String(error),
    }, { status: 500 });
  }
}
