import { NextResponse } from "next/server";
import { requireRoleInSchool } from "@/lib/authz";
import { resolveEscolaIdForUser } from "@/lib/tenant/resolveEscolaIdForUser";
import { supabaseServerTyped } from "@/lib/supabaseServer";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const alunoId = searchParams.get("aluno_id");
  const matriculaId = searchParams.get("matricula_id");
  if (!alunoId || !matriculaId) {
    return NextResponse.json({ ok: false, error: "aluno_id e matricula_id são obrigatórios" }, { status: 400 });
  }

  try {
    const supabase = await supabaseServerTyped<any>();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ ok: false, error: "Não autenticado" }, { status: 401 });

    const escolaId = await resolveEscolaIdForUser(supabase, user.id);
    if (!escolaId) return NextResponse.json({ ok: false, error: "Escola não identificada" }, { status: 403 });
    const authz = await requireRoleInSchool({
      supabase,
      escolaId,
      roles: ["secretaria", "secretaria_financeiro", "admin_financeiro", "admin", "admin_escola", "staff_admin"],
    });
    if (authz.error) return authz.error;

    const { data: matricula } = await supabase
      .from("matriculas")
      .select("id, aluno_id, ano_letivo, turma_id")
      .eq("id", matriculaId)
      .eq("aluno_id", alunoId)
      .eq("escola_id", escolaId)
      .maybeSingle();
    if (!matricula) return NextResponse.json({ ok: false, error: "Matrícula de origem não encontrada" }, { status: 404 });

    const { data: mensalidades, error } = await supabase
      .from("mensalidades")
      .select("id, mes_referencia, ano_referencia, valor_previsto, valor, valor_pago_total, data_vencimento, status, matricula_id")
      .eq("escola_id", escolaId)
      .eq("aluno_id", alunoId)
      .eq("matricula_id", matriculaId)
      .not("status", "in", "(pago,isento,cancelado)")
      .order("ano_referencia", { ascending: true })
      .order("mes_referencia", { ascending: true });
    if (error) throw error;

    return NextResponse.json({
      ok: true,
      matricula: { id: matricula.id, ano_letivo: matricula.ano_letivo, turma_id: matricula.turma_id },
      mensalidades: (mensalidades ?? [])
        .map((item: any) => ({
          id: item.id,
          mes: Number(item.mes_referencia ?? 0),
          ano: Number(item.ano_referencia ?? 0),
          valor: Math.max(Number(item.valor_previsto ?? item.valor ?? 0) - Number(item.valor_pago_total ?? 0), 0),
          vencimento: item.data_vencimento ?? undefined,
          status: item.status ?? "pendente",
        }))
        .filter((item: { valor: number }) => item.valor > 0),
    });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "Não foi possível carregar a dívida da matrícula" }, { status: 500 });
  }
}
