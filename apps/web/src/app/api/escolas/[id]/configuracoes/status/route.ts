import { NextResponse, NextRequest } from "next/server";
import { supabaseServer } from "@/lib/supabaseServer";
import { resolveEscolaIdForUser } from "@/lib/tenant/resolveEscolaIdForUser";
import { requireRoleInSchool } from "@/lib/authz";

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
    const s = await supabaseServer();
    const { data: auth } = await s.auth.getUser();
    const user = auth?.user;
    if (!user) {
      return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
    }

    const resolvedEscolaId = await resolveEscolaIdForUser(s as any, user.id, escolaId);
    if (!resolvedEscolaId || resolvedEscolaId !== escolaId) {
      return NextResponse.json({ error: "Sem permissão" }, { status: 403 });
    }

    const { error: roleError } = await requireRoleInSchool({
      supabase: s as any,
      escolaId: resolvedEscolaId,
      roles: ["admin", "admin_escola", "staff_admin"],
    });
    if (roleError) return roleError;

    // 1. Check Identidade (nome e nif na tabela escolas)
    const { data: escolaData, error: escolaError } = await (s as any)
      .from("escolas")
      .select("nome, nif")
      .eq("id", escolaId)
      .order("created_at", { ascending: false })
      .limit(1)
      .single();

    if (escolaError) throw new Error("Erro ao buscar dados da escola.");
    const identidadeCompleta = !!(escolaData?.nome && escolaData?.nif);

    // 2. Check Academico (pelo menos 1 curso)
    const { data: cursoRow, error: cursoError } = await (s as any)
      .from("cursos")
      .select("id")
      .eq("escola_id", escolaId)
      .limit(1)
      .maybeSingle();

    if (cursoError) throw new Error("Erro ao verificar estrutura académica.");
    const academicoCompleto = Boolean(cursoRow);

    // 3. Check Financeiro (pelo menos 1 tabela de preço)
    const { data: financeiroRow, error: financeiroError } = await (s as any)
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
