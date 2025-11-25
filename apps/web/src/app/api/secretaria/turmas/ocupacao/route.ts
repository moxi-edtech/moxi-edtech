import { NextResponse } from "next/server";
import { supabaseServerTyped } from "@/lib/supabaseServer";

type OcupacaoRow = {
  id: string;
  escola_id: string;
  nome: string | null;
  codigo: string | null;
  classe: string | null;
  turno: string | null;
  sala: string | null;
  capacidade_maxima: number | null;
  total_matriculas_ativas: number | null;
  ocupacao_percentual: number | null;
  status_ocupacao: string | null;
};

export async function GET(req: Request) {
  try {
    const supabase = await supabaseServerTyped<any>();
    const { data: userRes } = await supabase.auth.getUser();
    const user = userRes?.user;

    if (!user) {
      return NextResponse.json({ ok: false, error: "Não autenticado" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const classeFilter = searchParams.get("classe");
    const turnoFilter = searchParams.get("turno");
    const statusFilter = searchParams.get("status");
    const minPercent = searchParams.get("minPercent");
    const maxPercent = searchParams.get("maxPercent");

    let query = supabase
      .from("vw_ocupacao_turmas")
      .select(
        `
        id,
        escola_id,
        nome,
        codigo,
        classe,
        turno,
        sala,
        capacidade_maxima,
        total_matriculas_ativas,
        ocupacao_percentual,
        status_ocupacao
      `
      )
      .order("classe", { ascending: true })
      .order("turno", { ascending: true })
      .order("nome", { ascending: true });

    if (classeFilter) {
      query = query.eq("classe", classeFilter);
    }

    if (turnoFilter) {
      query = query.eq("turno", turnoFilter);
    }

    if (statusFilter) {
      query = query.eq("status_ocupacao", statusFilter);
    }

    if (minPercent) {
      query = query.gte("ocupacao_percentual", Number(minPercent));
    }

    if (maxPercent) {
      query = query.lte("ocupacao_percentual", Number(maxPercent));
    }

    const { data, error } = await query;

    if (error) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    }

    const rows = (data ?? []) as OcupacaoRow[];

    const gruposMap = new Map<
      string,
      {
        classe: string | null;
        turno: string | null;
        capacidade_total: number;
        matriculas_ativas_total: number;
        ocupacao_media: number;
        turmas: OcupacaoRow[];
      }
    >();

    for (const row of rows) {
      const key = `${row.classe ?? "—"}::${row.turno ?? "—"}`;
      const existing = gruposMap.get(key);

      const capacidade = row.capacidade_maxima ?? 0;
      const ativos = row.total_matriculas_ativas ?? 0;

      if (!existing) {
        gruposMap.set(key, {
          classe: row.classe,
          turno: row.turno,
          capacidade_total: capacidade,
          matriculas_ativas_total: ativos,
          ocupacao_media: capacidade > 0 ? (ativos / capacidade) * 100 : 0,
          turmas: [row],
        });
      } else {
        existing.capacidade_total += capacidade;
        existing.matriculas_ativas_total += ativos;
        existing.ocupacao_media =
          existing.capacidade_total > 0
            ? (existing.matriculas_ativas_total / existing.capacidade_total) * 100
            : 0;
        existing.turmas.push(row);
      }
    }

    const grupos = Array.from(gruposMap.values()).map((g) => ({
      ...g,
      ocupacao_media: Math.round(g.ocupacao_media * 10) / 10,
    }));

    return NextResponse.json({
      ok: true,
      total_turmas: rows.length,
      grupos,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
