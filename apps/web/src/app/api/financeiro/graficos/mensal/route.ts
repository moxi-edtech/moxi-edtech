import { NextResponse } from "next/server";
import { createRouteClient } from "@/lib/supabase/route-client";
import type { SupabaseClient } from "@supabase/supabase-js";
import { applyKf2ListInvariants } from "@/lib/kf2";
import { resolveEscolaIdForUser } from "@/lib/tenant/resolveEscolaIdForUser";
import type { Database } from "~types/supabase";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);

    const anoParam = searchParams.get("ano");
    const ano = anoParam ? parseInt(anoParam, 10) : new Date().getFullYear();

    const supabase = await createRouteClient();
    const { data: userRes } = await supabase.auth.getUser();
    const user = userRes?.user;
    if (!user) {
      return NextResponse.json({ ok: false, error: "Não autenticado" }, { status: 401 });
    }

    const metaEscolaId =
      (user.app_metadata as { escola_id?: string | null } | null)?.escola_id ?? null;
    const escolaId = await resolveEscolaIdForUser(
      supabase as unknown as SupabaseClient<Database>,
      user.id,
      null,
      metaEscolaId ? String(metaEscolaId) : null
    );
    if (!escolaId) {
      return NextResponse.json(
        { ok: false, error: "Perfil sem escola vinculada" },
        { status: 400 }
      );
    }

    let query = supabase
      .from("vw_total_em_aberto_por_mes")
      .select("escola_id, ano, mes, total_aberto")
      .eq("escola_id", escolaId)
      .eq("ano", ano)
      .order("mes", { ascending: true });

    query = applyKf2ListInvariants(query, { defaultLimit: 50 });

    const { data, error } = await query;

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
    const series = (data ?? [])
      .filter(
        (row): row is { escola_id: string; ano: number; mes: number; total_aberto: number } =>
          Boolean(row.escola_id) &&
          Number.isFinite(row.ano ?? NaN) &&
          Number.isFinite(row.mes ?? NaN)
      )
      .map((row) => ({
        escolaId: row.escola_id,
        ano: row.ano,
        mes: row.mes,
        labelMes: `${String(row.mes).padStart(2, "0")}/${row.ano}`,
        totalEmAberto: Number(row.total_aberto ?? 0),
      }));

    return NextResponse.json(
      {
        ok: true,
        ano,
        series,
      },
      { status: 200 }
    );
  } catch (err: unknown) {
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
