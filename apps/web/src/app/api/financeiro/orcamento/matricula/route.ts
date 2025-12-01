import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabaseServer";
import { resolveTabelaPreco } from "@/lib/financeiro/tabela-preco";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const escolaId = searchParams.get("escola_id");
  const cursoId = searchParams.get("curso_id");
  const classeId = searchParams.get("classe_id");
  // O ano letivo idealmente vem da sessão ativa, aqui vamos assumir o enviado ou corrente
  const ano = searchParams.get("ano")
    ? parseInt(searchParams.get("ano")!)
    : new Date().getFullYear();

  if (!escolaId) return NextResponse.json({ ok: false, error: "Escola ID obrigatório" }, { status: 400 });

  try {
    const supabase = await supabaseServer();

    const { tabela, origem } = await resolveTabelaPreco(supabase as any, {
      escolaId,
      anoLetivo: ano,
      cursoId,
      classeId,
    });

    if (!tabela) {
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
        valor_matricula: tabela.valor_matricula,
        valor_mensalidade: tabela.valor_mensalidade,
        dia_vencimento: tabela.dia_vencimento,
        multa: tabela.multa_atraso_percentual,
        origem_regra: origem,
      },
    });
  } catch (error: any) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }
}
