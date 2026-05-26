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

    // Buscar matrículas do ano letivo
    const { data: matriculas, error } = await supabase
      .from("matriculas")
      .select(`
        id,
        created_at,
        data_matricula,
        origem_transicao_matricula_id,
        percentagem_desconto,
        motivo_desconto,
        turmas (
          id,
          nome,
          classe_id,
          classes (
            id,
            label
          )
        )
      `)
      .eq("escola_id", escolaId)
      .eq("ano_letivo", anoLetivo);

    if (error) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    }

    // Agrupar por classe
    const classesMap: Record<string, { 
      label: string; 
      matriculas: number; 
      confirmacoes: number; 
      bolsistas: number;
      total: number;
      detalhes_mensais: Record<string, { matriculas: number; confirmacoes: number; bolsistas: number }>
    }> = {};

    const dataInicio = anoScope?.dataInicio ? new Date(`${anoScope.dataInicio}T00:00:00`) : null;
    const dataFim = anoScope?.dataFim ? new Date(`${anoScope.dataFim}T23:59:59`) : null;

    (matriculas || []).forEach((m: any) => {
      const dataRef = m.data_matricula || m.created_at;
      const dataRefDate = dataRef ? new Date(dataRef) : null;
      if (
        dataRefDate &&
        dataInicio &&
        dataFim &&
        (dataRefDate < dataInicio || dataRefDate > dataFim)
      ) {
        return;
      }

      const classe = m.turmas?.classes?.label || "Sem Classe";
      const classeId = m.turmas?.classe_id || "sem-classe";
      
      if (!classesMap[classeId]) {
        classesMap[classeId] = { 
          label: classe, 
          matriculas: 0, 
          confirmacoes: 0, 
          bolsistas: 0,
          total: 0,
          detalhes_mensais: {}
        };
      }

      const isConfirmacao = m.origem_transicao_matricula_id !== null;
      const isBolsista = (Number(m.percentagem_desconto) > 0) || (!!m.motivo_desconto);
      
      const mes = dataRefDate ? dataRefDate.getMonth() + 1 : 0;
      const ano = dataRefDate ? dataRefDate.getFullYear() : 0;
      const mesKey = `${ano}-${String(mes).padStart(2, '0')}`;

      if (!classesMap[classeId].detalhes_mensais[mesKey]) {
        classesMap[classeId].detalhes_mensais[mesKey] = { matriculas: 0, confirmacoes: 0, bolsistas: 0 };
      }

      if (isConfirmacao) {
        classesMap[classeId].confirmacoes++;
        classesMap[classeId].detalhes_mensais[mesKey].confirmacoes++;
      } else {
        classesMap[classeId].matriculas++;
        classesMap[classeId].detalhes_mensais[mesKey].matriculas++;
      }

      if (isBolsista) {
        classesMap[classeId].bolsistas++;
        classesMap[classeId].detalhes_mensais[mesKey].bolsistas++;
      }

      classesMap[classeId].total++;
    });

    // Converter para array e ordenar por classe (se possível) ou nome
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
