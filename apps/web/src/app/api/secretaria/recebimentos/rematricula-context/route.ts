import { NextResponse } from "next/server";
import { requireRoleInSchool } from "@/lib/authz";
import { resolveEscolaIdForUser } from "@/lib/tenant/resolveEscolaIdForUser";
import { supabaseServerTyped } from "@/lib/supabaseServer";
import { resolveAnoLetivoScope } from "@/lib/financeiro/resolveAnoLetivoScope";

type RawPaymentItem = {
  id?: string;
  tipo?: string;
  nome?: string;
  descricao?: string | null;
  codigo?: string | null;
  preco?: number;
  valor?: number;
  quantidade?: number;
};

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(request: Request) {
  try {
    const pagamentoId = new URL(request.url).searchParams.get("pagamento_id");
    if (!pagamentoId) {
      return NextResponse.json({ ok: false, error: "pagamento_id é obrigatório" }, { status: 400 });
    }

    const supabase = await supabaseServerTyped<any>();
    const { data: auth } = await supabase.auth.getUser();
    if (!auth.user) return NextResponse.json({ ok: false, error: "Não autenticado" }, { status: 401 });

    const escolaId = await resolveEscolaIdForUser(supabase, auth.user.id);
    if (!escolaId) return NextResponse.json({ ok: false, error: "Escola não identificada" }, { status: 403 });

    const authz = await requireRoleInSchool({
      supabase,
      escolaId,
      roles: ["secretaria", "secretaria_financeiro", "admin_financeiro", "admin", "admin_escola", "staff_admin"],
    });
    if (authz.error) return authz.error;

    const { data: intent } = await supabase
      .from("pagamento_intents")
      .select("id, aluno_id, servico_pedido_id, status, meta")
      .eq("id", pagamentoId)
      .eq("escola_id", escolaId)
      .maybeSingle();
    if (!intent) return NextResponse.json({ ok: false, error: "Pagamento não encontrado" }, { status: 404 });

    const { data: pedido } = await supabase
      .from("servico_pedidos")
      .select("id, aluno_id, matricula_id, servico_codigo, contexto")
      .eq("id", intent.servico_pedido_id)
      .eq("escola_id", escolaId)
      .maybeSingle();
    if (!pedido || pedido.servico_codigo !== "SERV_REMATRICULA") {
      return NextResponse.json({ ok: false, error: "O pagamento não é de rematrícula" }, { status: 409 });
    }

    const targetYear = Number(pedido.contexto?.ano_letivo ?? intent.meta?.ano_letivo ?? 0);
    const rawItems = Array.isArray(pedido.contexto?.itens_pagamento)
      ? pedido.contexto.itens_pagamento
      : Array.isArray(intent.meta?.itens_pagamento) ? intent.meta.itens_pagamento : [];
    const itensPagamento = (rawItems as RawPaymentItem[]).map((item) => ({
      id: String(item.id ?? ""),
      tipo: item.tipo === "mensalidade" ? "mensalidade" : "servico",
      nome: item.nome ?? item.descricao ?? "Serviço escolar",
      descricao: item.descricao ?? null,
      codigo: item.codigo ?? null,
      preco: Number(item.preco ?? item.valor ?? 0),
      quantidade: Number(item.quantidade ?? 1),
    })).filter((item: { id: string; preco: number }) => item.id && item.preco > 0);
    const targetScope = targetYear > 0
      ? await resolveAnoLetivoScope(supabase, escolaId, { ano: targetYear })
      : null;
    const { data: aluno } = await supabase
      .from("alunos")
      .select("id, nome, nome_completo, numero_processo")
      .eq("id", intent.aluno_id)
      .eq("escola_id", escolaId)
      .maybeSingle();

    let matriculaId = pedido.matricula_id ?? intent.meta?.matricula_id ?? null;
    if (!matriculaId && targetYear > 0) {
      const { data: origem } = await supabase
        .from("matriculas")
        .select("id")
        .eq("escola_id", escolaId)
        .eq("aluno_id", intent.aluno_id)
        .lt("ano_letivo", targetYear)
        .in("status", [
          "ativo",
          "ativa",
          "active",
          "concluido",
          "concluida",
          "aprovado",
          "aprovada",
          "reprovado",
          "reprovada",
          "transferido",
        ])
        .order("ano_letivo", { ascending: false })
        .limit(1)
        .maybeSingle();
      matriculaId = origem?.id ?? null;
    }

    if (!matriculaId || !targetScope?.id) {
      return NextResponse.json({ ok: false, error: "Não foi possível identificar a matrícula de origem e o ano destino" }, { status: 409 });
    }

    const { data: matricula } = await supabase
      .from("matriculas")
      .select("turma_id")
      .eq("id", matriculaId)
      .eq("escola_id", escolaId)
      .maybeSingle();
    const { data: turma } = matricula?.turma_id
      ? await supabase.from("turmas").select("nome, turma_codigo").eq("id", matricula.turma_id).eq("escola_id", escolaId).maybeSingle()
      : { data: null };

    return NextResponse.json({
      ok: true,
      rematricula: {
        pagamento_id: intent.id,
        pedido_id: pedido.id,
        aluno_id: intent.aluno_id,
        aluno_nome: aluno?.nome_completo ?? aluno?.nome ?? "Aluno",
        aluno_processo: aluno?.numero_processo ?? "-",
        matricula_id: matriculaId,
        ano_letivo_id: targetScope.id,
        ano_letivo: targetYear,
        turma_atual: turma?.turma_codigo ?? turma?.nome ?? null,
        itens_pagamento: itensPagamento,
        pagamento_validado: ["settled", "confirmed", "paid", "succeeded"].includes(String(intent.status).toLowerCase()),
      },
    });
  } catch (error) {
    console.error("[RECEBIMENTOS_REMATRICULA_CONTEXT]", error);
    return NextResponse.json({ ok: false, error: "Não foi possível preparar a rematrícula" }, { status: 500 });
  }
}
