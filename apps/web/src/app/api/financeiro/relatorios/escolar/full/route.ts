import { NextResponse } from "next/server";
import { resolveAnoLetivoScope } from "@/lib/financeiro/resolveAnoLetivoScope";
import { resolveEscolaIdForUser } from "@/lib/tenant/resolveEscolaIdForUser";
import { supabaseServerTyped } from "@/lib/supabaseServer";

export const dynamic = "force-dynamic";

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
    
    const baseUrl = new URL(req.url).origin;
    const commonParams = `?escolaId=${escolaId}&ano_letivo_id=${anoLetivoId || ""}&ano=${anoParam || ""}`;

    // Orquestrar chamadas para os endpoints individuais para garantir consistência
    // e evitar duplicação de lógica de negócio complexa.
    const [resumoRes, propinasRes, captacaoRes, despesasRes, fluxoRes, inadimplenciaRes] = await Promise.all([
      fetch(`${baseUrl}/api/financeiro/relatorios/resumo${commonParams}`, { cache: "no-store" }),
      fetch(`${baseUrl}/api/financeiro/relatorios/propinas${commonParams}`, { cache: "no-store" }),
      fetch(`${baseUrl}/api/financeiro/relatorios/captacao${commonParams}`, { cache: "no-store" }),
      fetch(`${baseUrl}/api/financeiro/relatorios/despesas${commonParams}`, { cache: "no-store" }),
      fetch(`${baseUrl}/api/financeiro/relatorios/fluxo-mensal${commonParams}`, { cache: "no-store" }),
      fetch(`${baseUrl}/api/financeiro/relatorios/inadimplencia-classe${commonParams}`, { cache: "no-store" }),
    ]);

    const [resumo, propinas, captacao, despesas, fluxo, inadimplencia] = await Promise.all([
      resumoRes.json(),
      propinasRes.json(),
      captacaoRes.json(),
      despesasRes.json(),
      fluxoRes.json(),
      inadimplenciaRes.json(),
    ]);

    return NextResponse.json({
      ok: true,
      resumo: resumo.resumo || null,
      propinas: {
        mensal: propinas.mensal || [],
        porTurma: propinas.porTurma || [],
      },
      captacao: captacao.items || [],
      despesas: {
        items: despesas.items || [],
        totalGeral: despesas.totalGeral || 0,
      },
      fluxoMensal: fluxo.items || [],
      inadimplenciaClasse: inadimplencia.items || [],
      periodo: resumo.periodo || null,
      anoLetivo: resumo.anoLetivo || null,
      anoLetivoId: resumo.anoLetivoId || null,
    });

  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Erro inesperado ao carregar relatório completo";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
