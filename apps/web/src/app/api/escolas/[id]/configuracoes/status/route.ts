import { NextResponse, NextRequest } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { type Database } from "~types/supabase";

const getSupabaseAdmin = () => {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseKey) {
    throw new Error("Supabase env não configurado.");
  }

  return createClient<Database>(supabaseUrl, supabaseKey);
};

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  let supabaseAdmin;

  try {
    supabaseAdmin = getSupabaseAdmin();
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

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
    const { data: cursoRow, error: cursoError } = await supabaseAdmin
      .from("cursos")
      .select("id")
      .eq("escola_id", escolaId)
      .limit(1)
      .maybeSingle();

    if (cursoError) throw new Error("Erro ao verificar estrutura académica.");
    const academicoCompleto = Boolean(cursoRow);

    // 3. Check Financeiro (pelo menos 1 tabela de preço)
    const { data: financeiroRow, error: financeiroError } = await supabaseAdmin
      .from("financeiro_tabelas")
      .select("id")
      .eq("escola_id", escolaId)
      .limit(1)
      .maybeSingle();
      
    if (financeiroError) throw new Error("Erro ao verificar configuração financeira.");
    const financeiroCompleto = Boolean(financeiroRow);

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
