// @kf2 allow-scan
import { NextResponse } from "next/server";
import { z } from "zod";
import { supabaseServer } from "@/lib/supabaseServer";
import { resolveEscolaIdForUser } from "@/lib/tenant/resolveEscolaIdForUser";
import { resolveAcademicYearContext } from "@/lib/academic-year/context";
import type { Database } from "~types/supabase";
import {
  exactMoney,
  moneyToJson,
  percentFromExact,
  safeCount,
  sumExact,
} from "@/lib/financeiro/exact";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const querySchema = z.object({
  range_start: z.string().optional(),
  range_end: z.string().optional(),
  ano_letivo_id: z.string().uuid().optional(),
});

const normalizeDate = (value?: string | null) => {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString().slice(0, 10);
};

const toMonthStart = (value: string | null) => {
  if (!value) return null;
  return `${value.slice(0, 7)}-01`;
};

export async function GET(request: Request) {
  try {
    const supabase = await supabaseServer();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ ok: false, error: "Não autenticado" }, { status: 401 });
    }

    const escolaId = await resolveEscolaIdForUser(supabase as any, user.id);
    if (!escolaId) {
      return NextResponse.json({ ok: false, error: "Escola não identificada" }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const parsed = querySchema.safeParse({
      range_start: searchParams.get("range_start") || undefined,
      range_end: searchParams.get("range_end") || undefined,
      ano_letivo_id: searchParams.get("ano_letivo_id") || undefined,
    });

    if (!parsed.success) {
      return NextResponse.json({ ok: false, error: "Parâmetros inválidos" }, { status: 400 });
    }

    const academicContext = await resolveAcademicYearContext(supabase, {
      userId: user.id,
      requestedAcademicYearId: parsed.data.ano_letivo_id,
      operation: "READ",
    });
    const { data: academicYearRow, error: academicYearError } = academicContext
      ? await supabase
          .from("anos_letivos")
          .select("data_inicio, data_fim")
          .eq("id", academicContext.anoLetivoId)
          .eq("escola_id", escolaId)
          .maybeSingle()
      : { data: null, error: null };
    if (academicYearError) {
      return NextResponse.json({ ok: false, error: academicYearError.message }, { status: 500 });
    }
    const academicStart = academicYearRow?.data_inicio ?? null;
    const academicEnd = academicYearRow?.data_fim ?? null;

    const start = toMonthStart(normalizeDate(parsed.data.range_start));
    const end = toMonthStart(normalizeDate(parsed.data.range_end));

    let kpisQuery = (supabase as any)
      .from("vw_financeiro_kpis_mes_ano")
      .select("escola_id, mes_ref, previsto_total, realizado_total, inadimplencia_total")
      .eq("escola_id", escolaId)
      .eq("ano_letivo_id", academicContext?.anoLetivoId ?? "");

    if (start) kpisQuery = kpisQuery.gte("mes_ref", start);
    if (end) kpisQuery = kpisQuery.lte("mes_ref", end);
    if (academicStart) kpisQuery = kpisQuery.gte("mes_ref", academicStart);
    if (academicEnd) kpisQuery = kpisQuery.lte("mes_ref", academicEnd);

    const { data: kpis, error: kpisError } = await kpisQuery;
    if (kpisError) {
      return NextResponse.json({ ok: false, error: kpisError.message }, { status: 500 });
    }

    const previstoExact = sumExact(
      (kpis ?? []).map((row: { previsto_total: number | string | null }) => row.previsto_total ?? "0"),
      "previsto_total"
    );
    const realizadoExact = sumExact(
      (kpis ?? []).map((row: { realizado_total: number | string | null }) => row.realizado_total ?? "0"),
      "realizado_total"
    );
    const inadimplenciaExact = sumExact(
      (kpis ?? []).map((row: { inadimplencia_total: number | string | null }) => row.inadimplencia_total ?? "0"),
      "inadimplencia_total"
    );

    const previsto = moneyToJson(previstoExact);
    const realizado = moneyToJson(realizadoExact);
    const inadimplencia = moneyToJson(inadimplenciaExact);
    const percentRealizado = percentFromExact(realizadoExact, previstoExact, 0);

    const { data: dashboardRow } = await (supabase as any)
      .from("vw_financeiro_dashboard_ano")
      .select("alunos_inadimplentes, alunos_em_dia")
      .eq("escola_id", escolaId)
      .eq("ano_letivo_id", academicContext?.anoLetivoId ?? "")
      .maybeSingle();

    const { count: inadimplentesCount } = await (supabase as any)
      .from("vw_financeiro_inadimplencia_top_ano")
      .select("aluno_id", { count: "exact", head: true })
      .eq("escola_id", escolaId)
      .eq("ano_letivo_id", academicContext?.anoLetivoId ?? "");

    const alunosInadimplentesCount = safeCount(
      inadimplentesCount ?? dashboardRow?.alunos_inadimplentes ?? 0,
      "alunos_inadimplentes"
    );
    const alunosEmDia = safeCount(
      dashboardRow?.alunos_em_dia ?? 0,
      "alunos_em_dia"
    );

    return NextResponse.json({
      ok: true,
      data: {
        previsto,
        realizado,
        inadimplencia,
        percent_realizado: percentRealizado,
        alunos_inadimplentes: alunosInadimplentesCount,
        alunos_em_dia: alunosEmDia,
      },
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
