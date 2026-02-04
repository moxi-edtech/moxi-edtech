import { NextResponse } from "next/server";
import { z } from "zod";
import { supabaseServer } from "@/lib/supabaseServer";
import { resolveEscolaIdForUser } from "@/lib/tenant/resolveEscolaIdForUser";

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

    const start = toMonthStart(normalizeDate(parsed.data.range_start));
    const end = toMonthStart(normalizeDate(parsed.data.range_end));

    let kpisQuery = supabase
      .from("vw_financeiro_kpis_mes")
      .select("escola_id, mes_ref, previsto_total, realizado_total, inadimplencia_total")
      .eq("escola_id", escolaId);

    if (start) kpisQuery = kpisQuery.gte("mes_ref", start);
    if (end) kpisQuery = kpisQuery.lte("mes_ref", end);

    const { data: kpis, error: kpisError } = await kpisQuery;
    if (kpisError) {
      return NextResponse.json({ ok: false, error: kpisError.message }, { status: 500 });
    }

    const previsto = (kpis ?? []).reduce(
      (acc: number, row: any) => acc + Number(row.previsto_total ?? 0),
      0
    );
    const realizado = (kpis ?? []).reduce(
      (acc: number, row: any) => acc + Number(row.realizado_total ?? 0),
      0
    );
    const inadimplencia = (kpis ?? []).reduce(
      (acc: number, row: any) => acc + Number(row.inadimplencia_total ?? 0),
      0
    );

    const percentRealizado = previsto ? Math.round((realizado / previsto) * 100) : 0;

    const { data: dashboardRow } = await supabase
      .from("vw_financeiro_dashboard")
      .select("alunos_inadimplentes, alunos_em_dia")
      .eq("escola_id", escolaId)
      .maybeSingle();

    const alunosInadimplentesCount = Number(dashboardRow?.alunos_inadimplentes ?? 0);
    const alunosEmDia = Number(dashboardRow?.alunos_em_dia ?? 0);

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
