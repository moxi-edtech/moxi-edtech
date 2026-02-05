import { NextResponse } from "next/server";
import { supabaseServerTyped } from "@/lib/supabaseServer";
import { applyKf2ListInvariants } from "@/lib/kf2";
import { resolveEscolaIdForUser } from "@/lib/tenant/resolveEscolaIdForUser";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const supabase = await supabaseServerTyped<any>();
    const { data: userRes } = await supabase.auth.getUser();
    const user = userRes?.user;
    if (!user) {
      return NextResponse.json({ ok: false, error: "Não autenticado" }, { status: 401 });
    }

    const metaEscolaId = (user.app_metadata as { escola_id?: string | null } | null)?.escola_id ?? null;
    const escolaId = await resolveEscolaIdForUser(
      supabase,
      user.id,
      null,
      metaEscolaId ? String(metaEscolaId) : null
    );
    if (!escolaId) {
      return NextResponse.json({ ok: false, error: "Perfil sem escola vinculada" }, { status: 400 });
    }

    const since = new Date();
    since.setDate(since.getDate() - 30);

    let query = supabase
      .from("vw_financeiro_cobrancas_diario")
      .select("dia, enviadas, respondidas, pagos, valor_recuperado")
      .eq("escola_id", escolaId)
      .gte("dia", since.toISOString().slice(0, 10))
      .order("dia", { ascending: true });

    query = applyKf2ListInvariants(query, {
      defaultLimit: 50,
      order: [{ column: "dia", ascending: true }],
    });

    const { data, error } = await query;

    if (error) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 400 });
    }

    const rows = (data ?? []) as Array<{
      dia: string;
      enviadas: number | null;
      respondidas: number | null;
      pagos: number | null;
      valor_recuperado: number | null;
    }>;

    const resumo = rows.reduce(
      (acc, row) => {
        acc.totalEnviadas += Number(row.enviadas ?? 0);
        acc.totalRespondidas += Number(row.respondidas ?? 0);
        acc.totalPagos += Number(row.pagos ?? 0);
        acc.valorRecuperado += Number(row.valor_recuperado ?? 0);
        return acc;
      },
      { totalEnviadas: 0, totalRespondidas: 0, totalPagos: 0, valorRecuperado: 0 }
    );

    const historico = rows.map((row) => ({
      data: row.dia,
      enviadas: Number(row.enviadas ?? 0),
      respondidas: Number(row.respondidas ?? 0),
      pagos: Number(row.pagos ?? 0),
    }));

    const taxaResposta =
      resumo.totalEnviadas > 0 ? (resumo.totalRespondidas / resumo.totalEnviadas) * 100 : 0;
    const taxaConversao =
      resumo.totalEnviadas > 0 ? (resumo.totalPagos / resumo.totalEnviadas) * 100 : 0;

    return NextResponse.json(
      {
        ok: true,
        resumo: {
          totalEnviadas: resumo.totalEnviadas,
          totalRespondidas: resumo.totalRespondidas,
          totalPagos: resumo.totalPagos,
          taxaResposta,
          taxaConversao,
        valorRecuperado: resumo.valorRecuperado,
      },
      historico,
      },
      { status: 200 }
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
