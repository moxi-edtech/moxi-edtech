import { NextResponse } from "next/server";
import { createRouteClient } from "@/lib/supabase/route-client";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);

    const anoParam = searchParams.get("ano");
    const ano = anoParam ? parseInt(anoParam, 10) : new Date().getFullYear();

    const supabase = await createRouteClient();

    const { data, error } = await supabase
      .from("v_total_em_aberto_por_mes")
      .select("escola_id, ano, mes, total_aberto")
      .eq("ano", ano)
      .order("mes", { ascending: true });

    if (error) {
      console.error("[financeiro/graficos/mensal] error", error);
      return NextResponse.json(
        {
          ok: false,
          error: "Erro ao carregar totais em aberto por mês.",
          details: error.message,
        },
        { status: 500 }
      );
    }

    // Normalização para o gráfico
    const series = (data ?? []).map((row: any) => ({
      escolaId: row.escola_id,
      ano: row.ano,
      mes: row.mes,
      labelMes: `${String(row.mes).padStart(2, "0")}/${row.ano}`,
      totalEmAberto: Number(row.total_aberto),
    }));

    return NextResponse.json(
      {
        ok: true,
        ano,
        series,
      },
      { status: 200 }
    );
  } catch (err: any) {
    console.error("[financeiro/graficos/mensal] fatal", err);
    return NextResponse.json(
      {
        ok: false,
        error: "Erro inesperado ao carregar gráfico financeiro mensal.",
      },
      { status: 500 }
    );
  }
}
