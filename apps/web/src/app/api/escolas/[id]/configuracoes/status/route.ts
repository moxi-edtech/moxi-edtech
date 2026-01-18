import { NextResponse, NextRequest } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { type Database } from "~types/supabase";

// Initialize Supabase admin client
const supabaseAdmin = createClient<Database>(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const params = await context.params;
  const escolaId = params.id;

  if (!escolaId) {
    return NextResponse.json({ error: "Escola ID é obrigatório." }, { status: 400 });
  }

  try {
    // 1. Check Identidade (nome e nif na tabela escolas)
    const { data: escolaData, error: escolaError } = await supabaseAdmin
      .from("escolas")
      .select("nome, nif")
      .eq("id", escolaId)
      .order("created_at", { ascending: false })
      .limit(1)
      .single();

    if (escolaError) throw new Error("Erro ao buscar dados da escola.");
    const identidadeCompleta = !!(escolaData?.nome && escolaData?.nif);

    // 2. Check Academico (pelo menos 1 curso)
    const { count: cursoCount, error: cursoError } = await supabaseAdmin
      .from("cursos")
      .select("id", { count: "exact", head: true })
      .eq("escola_id", escolaId);

    if (cursoError) throw new Error("Erro ao verificar estrutura académica.");
    const academicoCompleto = (cursoCount ?? 0) > 0;

    // 3. Check Financeiro (pelo menos 1 tabela de preço)
    const { count: financeiroCount, error: financeiroError } = await supabaseAdmin
      .from("financeiro_tabelas")
      .select("id", { count: "exact", head: true })
      .eq("escola_id", escolaId);
      
    if (financeiroError) throw new Error("Erro ao verificar configuração financeira.");
    const financeiroCompleto = (financeiroCount ?? 0) > 0;

    // Build the final status object
    const configStatus = {
      identidadeCompleta,
      academicoCompleto,
      financeiroCompleto,
    };

    return NextResponse.json({
      ok: true,
      configStatus,
    });

  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
