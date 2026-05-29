import { NextResponse } from "next/server";
import { supabaseServerTyped } from "@/lib/supabaseServer";
import { resolveAnoLetivoScope } from "@/lib/financeiro/resolveAnoLetivoScope";
import { resolveEscolaIdForUser } from "@/lib/tenant/resolveEscolaIdForUser";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    const supabase = await supabaseServerTyped<any>();
    const { data: userRes } = await supabase.auth.getUser();

    if (!userRes?.user) {
      return NextResponse.json({ ok: false, error: "Não autenticado" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const requestedEscolaId = searchParams.get("escolaId") || searchParams.get("escola_id") || null;
    const escolaId = await resolveEscolaIdForUser(supabase, userRes.user.id, requestedEscolaId);
    if (!escolaId) {
      return NextResponse.json({ ok: false, error: "Perfil sem escola vinculada" }, { status: 400 });
    }

    const anoLetivoId =
      searchParams.get("ano_letivo_id") ||
      searchParams.get("session_id") ||
      searchParams.get("sessionId") ||
      null;
    const anoParam = searchParams.get("ano");
    const anoScope = await resolveAnoLetivoScope(supabase, escolaId, {
      anoLetivoId,
      ano: anoParam ? parseInt(anoParam, 10) : null,
    });
    const anoLetivo = anoScope?.ano ?? new Date().getFullYear();

    // Buscar dados agregados da MV de Captação
    const { data: rows, error } = await supabase
      .from("vw_relatorio_financeiro_escolar_capitacao_mensal")
      .select("*")
      .eq("escola_id", escolaId)
      .eq("ano_letivo", anoLetivo);

    if (error) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    }

    // Agrupar por classe para o formato esperado pelo frontend
    const classesMap: Record<string, { 
      label: string; 
      matriculas: number; 
      confirmacoes: number; 
      bolsistas: number;
      total: number;
      detalhes_mensais: Record<string, { matriculas: number; confirmacoes: number; bolsistas: number }>
    }> = {};

    (rows || []).forEach((row: any) => {
      const classeId = row.classe_id;
      const mesKey = row.mes_ref.slice(0, 7); // yyyy-mm

      if (!classesMap[classeId]) {
        classesMap[classeId] = { 
          label: row.classe_label, 
          matriculas: 0, 
          confirmacoes: 0, 
          bolsistas: 0,
          total: 0,
          detalhes_mensais: {}
        };
      }

      classesMap[classeId].matriculas += row.matriculas_qtd;
      classesMap[classeId].confirmacoes += row.confirmacoes_qtd;
      classesMap[classeId].bolsistas += row.bolsistas_qtd;
      classesMap[classeId].total += row.total_qtd;

      classesMap[classeId].detalhes_mensais[mesKey] = {
        matriculas: row.matriculas_qtd,
        confirmacoes: row.confirmacoes_qtd,
        bolsistas: row.bolsistas_qtd
      };
    });

    // Converter para array e ordenar por label
    const items = Object.values(classesMap).sort((a, b) => a.label.localeCompare(b.label));

    return NextResponse.json({
      ok: true,
      anoLetivo,
      anoLetivoId: anoScope?.id ?? null,
      periodo: {
        inicio: anoScope?.dataInicio ?? null,
        fim: anoScope?.dataFim ?? null,
      },
      items
    });
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err.message }, { status: 500 });
  }
}
