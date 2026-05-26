import { NextResponse } from "next/server";
import { resolveAnoLetivoScope } from "@/lib/financeiro/resolveAnoLetivoScope";
import { applyKf2ListInvariants } from "@/lib/kf2";
import { supabaseServerTyped } from "@/lib/supabaseServer";
import { resolveEscolaIdForUser } from "@/lib/tenant/resolveEscolaIdForUser";

export const dynamic = "force-dynamic";

function isMissingReadModelError(error: unknown): boolean {
  const code = typeof error === "object" && error !== null && "code" in error
    ? String((error as { code?: unknown }).code ?? "")
    : "";
  const message = typeof error === "object" && error !== null && "message" in error
    ? String((error as { message?: unknown }).message ?? "")
    : "";

  return (
    code === "42P01" ||
    code === "PGRST205" ||
    /does not exist|relation .* does not exist|schema cache|Could not find .* in the schema cache/i.test(message)
  );
}

export async function GET(req: Request) {
  try {
    const supabase = await supabaseServerTyped<any>();
    const { data: userRes } = await supabase.auth.getUser();

    if (!userRes?.user) {
      return NextResponse.json({ ok: false, error: "Não autenticado" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const requestedEscolaId =
      searchParams.get("escolaId") ||
      searchParams.get("escola_id") ||
      null;
    const escolaId = await resolveEscolaIdForUser(
      supabase,
      userRes.user.id,
      requestedEscolaId
    );
    if (!escolaId) {
      return NextResponse.json({ ok: false, error: "Perfil sem escola vinculada" }, { status: 400 });
    }

    const anoLetivoId =
      searchParams.get("ano_letivo_id") ||
      searchParams.get("session_id") ||
      searchParams.get("sessionId") ||
      null;
    const anoParam = searchParams.get("ano");
    const mesRef = searchParams.get("mes_ref");
    const anoScope = await resolveAnoLetivoScope(supabase, escolaId, {
      anoLetivoId,
      ano: anoParam ? parseInt(anoParam, 10) : null,
    });

    if (!anoScope?.id) {
      return NextResponse.json({ ok: false, error: "Ano letivo não encontrado" }, { status: 400 });
    }

    let query = supabase
      .from("vw_relatorio_financeiro_escolar_inadimplencia_classe")
      .select("escola_id, ano_letivo_id, ano_letivo, mes_ref, classe_id, classe_label, qtd_em_atraso, valor_unitario_medio, total_em_atraso, qtd_parciais, total_parcial_em_aberto")
      .eq("escola_id", escolaId)
      .eq("ano_letivo_id", anoScope.id);

    if (mesRef) {
      query = query.eq("mes_ref", mesRef);
    }

    query = applyKf2ListInvariants(query, {
      defaultLimit: 200,
      order: [
        { column: "mes_ref", ascending: true },
        { column: "classe_label", ascending: true },
      ],
      tieBreakerColumn: "classe_id",
    });

    const { data, error } = await query;

    if (error) {
      if (isMissingReadModelError(error)) {
        return NextResponse.json(
          {
            ok: true,
            anoLetivo: anoScope.ano,
            anoLetivoId: anoScope.id,
            periodo: { inicio: anoScope.dataInicio, fim: anoScope.dataFim },
            items: [],
            warning: "Read model de inadimplência por classe indisponível; retornado vazio.",
          },
          { status: 200 }
        );
      }

      return NextResponse.json(
        { ok: false, error: "Erro ao carregar inadimplência por classe", details: error.message },
        { status: 500 }
      );
    }

    const items = (data ?? []).map((row) => ({
      mesRef: row.mes_ref,
      classeId: row.classe_id,
      classeLabel: row.classe_label,
      qtdEmAtraso: Number(row.qtd_em_atraso ?? 0),
      valorUnitarioMedio: Number(row.valor_unitario_medio ?? 0),
      totalEmAtraso: Number(row.total_em_atraso ?? 0),
      qtdParciais: Number(row.qtd_parciais ?? 0),
      totalParcialEmAberto: Number(row.total_parcial_em_aberto ?? 0),
    }));

    return NextResponse.json(
      {
        ok: true,
        anoLetivo: anoScope.ano,
        anoLetivoId: anoScope.id,
        periodo: {
          inicio: anoScope.dataInicio,
          fim: anoScope.dataFim,
        },
        items,
      },
      { status: 200 }
    );
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Erro inesperado";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
