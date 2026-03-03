import { NextResponse } from "next/server";
import { z } from "zod";
import { supabaseServerTyped } from "@/lib/supabaseServer";
import { resolveEscolaIdForUser } from "@/lib/tenant/resolveEscolaIdForUser";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const QuerySchema = z.object({
  days: z.coerce.number().int().min(1).max(365).default(30),
});

export async function GET(req: Request) {
  try {
    const supabase = await supabaseServerTyped<any>();
    const { data: auth } = await supabase.auth.getUser();
    const user = auth?.user;
    if (!user) return NextResponse.json({ ok: false, error: "Não autenticado" }, { status: 401 });

    const escolaId = await resolveEscolaIdForUser(supabase as any, user.id);
    if (!escolaId) return NextResponse.json({ ok: false, error: "Escola inválida" }, { status: 403 });

    const url = new URL(req.url);
    const parsed = QuerySchema.safeParse({ days: url.searchParams.get("days") ?? 30 });
    if (!parsed.success) return NextResponse.json({ ok: false, error: parsed.error.issues[0]?.message ?? "Parâmetros inválidos" }, { status: 400 });

    const sinceIso = new Date(Date.now() - parsed.data.days * 24 * 60 * 60 * 1000).toISOString();

    const { data: jobs, error } = await supabase
      .from("fechamento_academico_jobs")
      .select("run_id,estado,created_at,finished_at,counters,errors,fechamento_tipo")
      .eq("escola_id", escolaId)
      .gte("created_at", sinceIso)
      .order("created_at", { ascending: false })
      .limit(500);

    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 400 });

    const rows = jobs ?? [];
    const done = rows.filter((j) => j.estado === "DONE");
    const failed = rows.filter((j) => j.estado === "FAILED");
    const processing = rows.filter((j) => !["DONE", "FAILED"].includes(String(j.estado)));

    const durationsMs = done
      .map((j) => {
        const start = j.created_at ? Date.parse(String(j.created_at)) : NaN;
        const end = j.finished_at ? Date.parse(String(j.finished_at)) : NaN;
        if (Number.isNaN(start) || Number.isNaN(end) || end < start) return null;
        return end - start;
      })
      .filter((v): v is number => typeof v === "number");

    const avgDurationMs = durationsMs.length ? Math.round(durationsMs.reduce((a, b) => a + b, 0) / durationsMs.length) : null;

    const totals = rows.reduce(
      (acc, j) => {
        const c = (j.counters || {}) as Record<string, any>;
        acc.total_matriculas += Number(c.total_matriculas ?? 0);
        acc.matriculas_finalizadas += Number(c.matriculas_finalizadas ?? 0);
        acc.historicos_gerados += Number(c.historicos_gerados ?? 0);
        return acc;
      },
      { total_matriculas: 0, matriculas_finalizadas: 0, historicos_gerados: 0 }
    );

    const stageFailures = new Map<string, number>();
    rows.forEach((j) => {
      const errs = Array.isArray(j.errors) ? j.errors : [];
      errs.forEach((e: any) => {
        const stage = String(e?.stage ?? "UNKNOWN");
        stageFailures.set(stage, (stageFailures.get(stage) ?? 0) + 1);
      });
    });

    const topFailureStages = Array.from(stageFailures.entries())
      .map(([stage, count]) => ({ stage, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    const successRate = rows.length ? Number(((done.length / rows.length) * 100).toFixed(2)) : 0;

    return NextResponse.json({
      ok: true,
      window_days: parsed.data.days,
      summary: {
        total_runs: rows.length,
        done_runs: done.length,
        failed_runs: failed.length,
        processing_runs: processing.length,
        success_rate_percent: successRate,
        avg_duration_ms: avgDurationMs,
        avg_duration_minutes: avgDurationMs ? Number((avgDurationMs / 60000).toFixed(2)) : null,
      },
      totals,
      by_tipo: {
        fechar_trimestre: rows.filter((j) => j.fechamento_tipo === "fechar_trimestre").length,
        fechar_ano: rows.filter((j) => j.fechamento_tipo === "fechar_ano").length,
      },
      top_failure_stages: topFailureStages,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
