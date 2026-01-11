import { NextRequest, NextResponse } from "next/server";
import { supabaseServerTyped } from "@/lib/supabaseServer";
import { resolveTabelaPreco } from "@/lib/financeiro/tabela-preco";
import type { Database } from "~types/supabase";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest, ctx: { params: Promise<{ matriculaId: string }> }) {
  const { matriculaId } = await ctx.params;
  const targetTurmaId = new URL(req.url).searchParams.get("target_turma_id") || "";

  if (!matriculaId || !targetTurmaId) {
    return NextResponse.json({ error: "matriculaId e target_turma_id são obrigatórios" }, { status: 400 });
  }

  const supabase = await supabaseServerTyped<Database>();
  const { data: userRes } = await supabase.auth.getUser();
  const user = userRes?.user;
  if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, escola_id, current_escola_id")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  const userRole = (profile as any)?.role as string | undefined;
  const isAdmin = ["admin", "super_admin", "global_admin"].includes((userRole || "").toLowerCase());

  const { data: matricula, error: matErr } = await supabase
    .from("matriculas")
    .select("id, aluno_id, turma_id, ano_letivo, escola_id, turmas(curso_id, classe_id, turno)")
    .eq("id", matriculaId)
    .maybeSingle();

  if (matErr || !matricula) {
    return NextResponse.json({ error: matErr?.message || "Matrícula não encontrada" }, { status: 404 });
  }

  const escolaId = (matricula as any).escola_id as string;

  const { data: targetTurma, error: turmaErr } = await supabase
    .from("turmas")
    .select("id, escola_id, capacidade_maxima, turno, curso_id, classe_id, ano_letivo")
    .eq("id", targetTurmaId)
    .maybeSingle();

  if (turmaErr || !targetTurma) {
    return NextResponse.json({ error: turmaErr?.message || "Turma destino não encontrada" }, { status: 404 });
  }

  if ((targetTurma as any).escola_id !== escolaId) {
    return NextResponse.json({ error: "Turma de destino não pertence à mesma escola" }, { status: 400 });
  }

  const { count: ocupacao } = await supabase
    .from("matriculas")
    .select("id", { count: "exact", head: true })
    .eq("turma_id", targetTurmaId)
    .neq("status", "transferido");

  const capacidade = Number((targetTurma as any).capacidade_maxima) || 0;
  const vagas = Math.max(0, capacidade ? capacidade - (ocupacao ?? 0) : 0);
  const lotada = capacidade > 0 ? vagas <= 0 : false;

  const currentTurma = (matricula as any).turmas as any;
  const turnoAtual = (currentTurma?.turno || "").toString().trim().toUpperCase();
  const turnoNovo = ((targetTurma as any).turno || "").toString().trim().toUpperCase();
  const mudancaTurno = turnoAtual && turnoNovo ? turnoAtual !== turnoNovo : false;

  const anoLetivo = (targetTurma as any).ano_letivo || (matricula as any).ano_letivo;

  const resolverPreco = async (cursoId?: string | null, classeId?: string | null) => {
    try {
      const { tabela } = await resolveTabelaPreco(supabase as any, {
        escolaId,
        anoLetivo,
        cursoId: cursoId || undefined,
        classeId: classeId || undefined,
        allowMensalidadeFallback: true,
      });
      return Number((tabela as any)?.valor_mensalidade || 0);
    } catch {
      return 0;
    }
  };

  const valorAtual = await resolverPreco(currentTurma?.curso_id, currentTurma?.classe_id);
  const valorNovo = await resolverPreco((targetTurma as any).curso_id, (targetTurma as any).classe_id);
  const diferenca = valorNovo - valorAtual;

  const mensagemFinanceira = diferenca > 0
    ? `A mensalidade aumentará ${diferenca.toLocaleString('pt-AO')} Kz.`
    : diferenca < 0
      ? `A mensalidade reduzirá ${Math.abs(diferenca).toLocaleString('pt-AO')} Kz.`
      : "Mensalidade permanece igual.";

  const allow = lotada ? isAdmin : true;

  return NextResponse.json({
    allow,
    lotada,
    vagas_restantes: vagas,
    mudanca_turno: mudancaTurno,
    financeiro: {
      altera_valor: diferenca !== 0,
      valor_antigo: valorAtual,
      valor_novo: valorNovo,
      diferenca,
      mensagem: mensagemFinanceira,
    },
  });
}
