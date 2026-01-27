// apps/web/src/app/api/debug/aluno/[alunoId]/route.ts
import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabaseServer";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ alunoId: string }> }
) {
  const { alunoId } = await params;
  const supabase = await supabaseServer();
  
  const { data: { user } } = await supabase.auth.getUser();
  
  // 1. Verificar usuário
  if (!user) {
    return NextResponse.json({ step: "auth", error: "Não autenticado" });
  }
  
  // 2. Tentar obter escola_id de múltiplas fontes
  const metadataEscolaId = user.user_metadata?.escola_id || user.app_metadata?.escola_id;
  
  // 3. Buscar aluno SEM filtro de escola (apenas para debug)
  const { data: alunoRaw, error: alunoError } = await supabase
    .from("alunos")
    .select("*")
    .eq("id", alunoId)
    .single();
  
  // 4. Buscar usando RPC que funciona na busca
  const { data: alunoRPC } = await supabase.rpc(
    "secretaria_list_alunos_kf2",
    {
      p_escola_id: metadataEscolaId,
      p_search: "",
      p_status: "ativo",
      p_page: 1,
      p_page_size: 1,
      p_extra_filter: `id = '${alunoId}'`
    }
  );
  
  return NextResponse.json({
    step: "debug",
    userId: user.id,
    userEmail: user.email,
    metadataEscolaId,
    alunoRaw,
    alunoRawError: alunoError,
    alunoRPC: alunoRPC?.[0],
    existeNaBusca: !!alunoRPC?.[0]
  });
}
