import { NextResponse } from "next/server";
import { supabaseServerTyped } from "@/lib/supabaseServer";
import { resolveEscolaIdForUser } from "@/lib/tenant/resolveEscolaIdForUser";
import { requireRoleInSchool } from "@/lib/authz";
import { resolveTabelaPreco } from "@/lib/financeiro/tabela-preco";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const ALLOWED_ROLES = ["secretaria", "admin", "admin_escola", "staff_admin"] as const;

function buildFinanceiroMensagem(
  valorOrigem: number,
  valorDestino: number,
  origemDisponivel: boolean,
  destinoDisponivel: boolean
) {
  if (!origemDisponivel && !destinoDisponivel) {
    return "Sem tabela de preço definida para as turmas.";
  }
  if (!origemDisponivel) {
    return "Tabela atual não encontrada. Verifique preços da turma de origem.";
  }
  if (!destinoDisponivel) {
    return "Tabela da turma destino não encontrada. Verifique preços antes de transferir.";
  }
  if (valorOrigem === valorDestino) {
    return "Nenhuma alteração no valor da mensalidade.";
  }
  if (valorDestino > valorOrigem) {
    return "Turma destino com mensalidade maior. Avalie ajuste financeiro.";
  }
  return "Turma destino com mensalidade menor. Pode haver crédito a ajustar.";
}

export async function GET(request: Request, { params }: { params: Promise<{ matriculaId: string }> }) {
  try {
    const { matriculaId } = await params;
    const { searchParams } = new URL(request.url);
    const targetTurmaId = searchParams.get("target_turma_id");
    if (!targetTurmaId) {
      return NextResponse.json({ ok: false, error: "target_turma_id é obrigatório" }, { status: 400 });
    }

    const supabase = await supabaseServerTyped<any>();
    const { data: userRes } = await supabase.auth.getUser();
    const user = userRes?.user;
    if (!user) {
      return NextResponse.json({ ok: false, error: "Não autenticado" }, { status: 401 });
    }

    const { data: matricula, error: matriculaError } = await supabase
      .from("matriculas")
      .select("id, aluno_id, turma_id, escola_id, status")
      .eq("id", matriculaId)
      .maybeSingle();

    if (matriculaError || !matricula) {
      return NextResponse.json({ ok: false, error: "Matrícula não encontrada" }, { status: 404 });
    }

    const resolvedEscolaId = await resolveEscolaIdForUser(
      supabase as any,
      user.id,
      matricula.escola_id
    );
    if (!resolvedEscolaId || resolvedEscolaId !== matricula.escola_id) {
      return NextResponse.json({ ok: false, error: "Sem permissão" }, { status: 403 });
    }

    const { error: authError } = await requireRoleInSchool({
      supabase,
      escolaId: resolvedEscolaId,
      roles: [...ALLOWED_ROLES],
    });
    if (authError) return authError;

    const [originView, targetView] = await Promise.all([
      supabase
        .from("vw_turmas_para_matricula")
        .select("id, turno, capacidade_maxima, ocupacao_atual, curso_id, classe_id, ano_letivo")
        .eq("escola_id", resolvedEscolaId)
        .eq("id", matricula.turma_id)
        .maybeSingle(),
      supabase
        .from("vw_turmas_para_matricula")
        .select("id, turno, capacidade_maxima, ocupacao_atual, curso_id, classe_id, ano_letivo")
        .eq("escola_id", resolvedEscolaId)
        .eq("id", targetTurmaId)
        .maybeSingle(),
    ]);

    if (targetView.error || !targetView.data) {
      return NextResponse.json({ ok: false, error: "Turma destino não encontrada" }, { status: 404 });
    }

    const target = targetView.data as any;
    const origin = originView.data as any;
    const capacidade = Number(target.capacidade_maxima ?? 0);
    const ocupacao = Number(target.ocupacao_atual ?? 0);
    const vagasRestantes = capacidade > 0 ? Math.max(0, capacidade - ocupacao) : 0;
    const lotada = capacidade > 0 && ocupacao >= capacidade;
    const mudancaTurno = Boolean(origin?.turno && target.turno && origin.turno !== target.turno);

    const [origTabela, destTabela] = await Promise.all([
      resolveTabelaPreco(supabase as any, {
        escolaId: resolvedEscolaId,
        anoLetivo: origin?.ano_letivo ?? target.ano_letivo ?? new Date().getFullYear(),
        cursoId: origin?.curso_id ?? null,
        classeId: origin?.classe_id ?? null,
        allowMensalidadeFallback: true,
      }),
      resolveTabelaPreco(supabase as any, {
        escolaId: resolvedEscolaId,
        anoLetivo: target.ano_letivo ?? new Date().getFullYear(),
        cursoId: target.curso_id ?? null,
        classeId: target.classe_id ?? null,
        allowMensalidadeFallback: true,
      }),
    ]);

    const valorOrigem = Number(origTabela.tabela?.valor_mensalidade ?? 0);
    const valorDestino = Number(destTabela.tabela?.valor_mensalidade ?? 0);
    const origemDisponivel = Boolean(origTabela.tabela?.valor_mensalidade);
    const destinoDisponivel = Boolean(destTabela.tabela?.valor_mensalidade);
    const diferenca = valorDestino - valorOrigem;

    return NextResponse.json({
      allow: !lotada,
      lotada,
      vagas_restantes: vagasRestantes,
      mudanca_turno: mudancaTurno,
      financeiro: {
        altera_valor: origemDisponivel && destinoDisponivel && diferenca !== 0,
        valor_antigo: valorOrigem,
        valor_novo: valorDestino,
        diferenca,
        mensagem: buildFinanceiroMensagem(valorOrigem, valorDestino, origemDisponivel, destinoDisponivel),
      },
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
