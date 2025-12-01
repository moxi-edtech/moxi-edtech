import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabaseServer";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const escolaId = searchParams.get("escola_id");
  const cursoId = searchParams.get("curso_id");
  const classeId = searchParams.get("classe_id");
  // O ano letivo idealmente vem da sessão ativa, aqui vamos assumir o enviado ou corrente
  const ano = searchParams.get("ano") ? parseInt(searchParams.get("ano")!) : new Date().getFullYear();

  if (!escolaId) return NextResponse.json({ ok: false, error: "Escola ID obrigatório" }, { status: 400 });

  try {
    const supabase = await supabaseServer();

    // Vamos tentar encontrar a regra de preço mais específica possível
    // A ordem de prioridade é:
    // 1. Específico (Curso + Classe)
    // 2. Por Curso (Todas as classes daquele curso)
    // 3. Por Classe (Todos os cursos daquela classe)
    // 4. Geral (Preço base da escola)

    let regraAplicada = null;
    let tipoRegra = "indefinido";

    // 1. Tenta Específico
    if (cursoId && classeId) {
      const { data } = await supabase
        .from("financeiro_tabelas")
        .select("*")
        .eq("escola_id", escolaId)
        .eq("ano_letivo", ano)
        .eq("curso_id", cursoId)
        .eq("classe_id", classeId)
        .maybeSingle();
      if (data) {
        regraAplicada = data;
        tipoRegra = "Específica (Curso + Classe)";
      }
    }

    // 2. Tenta Curso (se não achou específico)
    if (!regraAplicada && cursoId) {
      const { data } = await supabase
        .from("financeiro_tabelas")
        .select("*")
        .eq("escola_id", escolaId)
        .eq("ano_letivo", ano)
        .eq("curso_id", cursoId)
        .is("classe_id", null)
        .maybeSingle();
      if (data) {
        regraAplicada = data;
        tipoRegra = "Por Curso";
      }
    }

    // 3. Tenta Classe (se não achou curso)
    if (!regraAplicada && classeId) {
      const { data } = await supabase
        .from("financeiro_tabelas")
        .select("*")
        .eq("escola_id", escolaId)
        .eq("ano_letivo", ano)
        .is("curso_id", null)
        .eq("classe_id", classeId)
        .maybeSingle();
      if (data) {
        regraAplicada = data;
        tipoRegra = "Por Classe";
      }
    }

    // 4. Tenta Geral
    if (!regraAplicada) {
      const { data } = await supabase
        .from("financeiro_tabelas")
        .select("*")
        .eq("escola_id", escolaId)
        .eq("ano_letivo", ano)
        .is("curso_id", null)
        .is("classe_id", null)
        .maybeSingle();
      if (data) {
        regraAplicada = data;
        tipoRegra = "Tabela Geral";
      }
    }

    if (!regraAplicada) {
      return NextResponse.json(
        {
          ok: false,
          error: "Nenhuma tabela de preços encontrada para este cenário.",
          code: "NO_PRICE_TABLE",
        },
        { status: 404 },
      );
    }

    // Sucesso
    return NextResponse.json({
      ok: true,
      data: {
        valor_matricula: regraAplicada.valor_matricula,
        valor_mensalidade: regraAplicada.valor_mensalidade,
        dia_vencimento: regraAplicada.dia_vencimento,
        multa: regraAplicada.multa_atraso_percentual,
        origem_regra: tipoRegra,
      },
    });
  } catch (error: any) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }
}
