// apps/web/src/app/api/debug/aluno/[alunoId]/route.ts
// @kf2 allow-scan
import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabaseServer";
import { resolveEscolaIdForUser } from "@/lib/tenant/resolveEscolaIdForUser";

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
  
  // 2. Resolver escola_id por vínculo no backend
  const metadataEscolaId = (user.app_metadata as { escola_id?: string | null } | null)?.escola_id ?? null;
  const escolaId = await resolveEscolaIdForUser(supabase as any, user.id, undefined, metadataEscolaId);
  if (!escolaId) {
    return NextResponse.json({ step: "context", error: "Usuário sem escola associada" }, { status: 403 });
  }
  
  // 3. Buscar usando RPC que funciona na busca
  const { data: alunoRPC } = await supabase.rpc(
    "secretaria_list_alunos_kf2",
    {
      p_escola_id: escolaId,
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
    escolaId,
    alunoRPC: alunoRPC?.[0],
    existeNaBusca: !!alunoRPC?.[0]
  });
}
