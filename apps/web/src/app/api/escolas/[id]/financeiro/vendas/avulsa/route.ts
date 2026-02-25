import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { supabaseServer } from "@/lib/supabaseServer";
import { hasPermission } from "@/lib/permissions";
import { resolveEscolaIdForUser } from "@/lib/tenant/resolveEscolaIdForUser";
import { recordAuditServer } from "@/lib/audit";
import { emitirEvento } from "@/lib/eventos/emitirEvento";
import type { Database } from "~types/supabase";

const BodySchema = z.object({
  aluno_id: z.string().uuid("aluno_id inválido"),
  valor: z.number().positive(),
  descricao: z.string().trim().min(1),
  metodo: z.string().trim().min(1).optional(),
  pago_imediato: z.boolean().default(false),
  matricula_id: z.string().uuid().optional(),
  comprovativo_url: z.string().url().optional(),
});

const normalizeMetodoPagamento = (
  raw?: string
): Database["public"]["Enums"]["metodo_pagamento_enum"] | null => {
  const value = raw?.toLowerCase().trim();
  if (!value) return null;
  if (["cash", "dinheiro", "numerario"].includes(value)) return "numerario";
  if (["tpa", "multicaixa", "mcx", "mcx_express"].includes(value)) return "multicaixa";
  if (["transfer", "transferencia"].includes(value)) return "transferencia";
  if (["deposito", "dep"].includes(value)) return "deposito";
  return null;
};

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { id: escolaId } = await context.params;
  try {
    const idempotencyKey =
      req.headers.get("Idempotency-Key") ?? req.headers.get("idempotency-key");
    if (!idempotencyKey) {
      return NextResponse.json(
        { ok: false, error: "Idempotency-Key header é obrigatório" },
        { status: 400 }
      );
    }

    const json = await req.json().catch(() => null);
    const parse = BodySchema.safeParse(json);
    if (!parse.success) {
      const msg = parse.error.issues?.[0]?.message || "Dados inválidos";
      return NextResponse.json({ ok: false, error: msg }, { status: 400 });
    }
    const body = parse.data;

    const s = await supabaseServer();
    const { data: sess } = await s.auth.getUser();
    const user = sess?.user;
    if (!user) return NextResponse.json({ ok: false, error: "Não autenticado" }, { status: 401 });

    const resolvedEscolaId = await resolveEscolaIdForUser(s, user.id, escolaId);
    if (!resolvedEscolaId || resolvedEscolaId !== escolaId) {
      return NextResponse.json({ ok: false, error: "Sem permissão" }, { status: 403 });
    }

    const { data: vinc } = await s
      .from("escola_users")
      .select("papel")
      .eq("escola_id", escolaId)
      .eq("user_id", user.id)
      .limit(1);
    const papel = (vinc?.[0] as { papel?: string | null })?.papel ?? null;
    if (!hasPermission(papel, "registrar_pagamento")) {
      return NextResponse.json({ ok: false, error: "Sem permissão" }, { status: 403 });
    }

    const { data: profCheck } = await s
      .from("profiles")
      .select("escola_id")
      .eq("user_id", user.id)
      .maybeSingle();
    if (!profCheck || profCheck.escola_id !== escolaId) {
      return NextResponse.json({ ok: false, error: "Perfil não vinculado à escola" }, { status: 403 });
    }

    const { data: existingPagamento } = await s
      .from("pagamentos")
      .select("id, referencia, meta")
      .eq("escola_id", escolaId)
      .contains("meta", { idempotency_key: idempotencyKey })
      .maybeSingle();
    if (existingPagamento) {
      const referencia = (existingPagamento as { referencia?: string | null }).referencia ?? null;
      const lancamentoId = referencia?.startsWith("venda_avulsa:")
        ? referencia.split(":")[1]
        : null;
      return NextResponse.json({
        ok: true,
        pagamento_id: (existingPagamento as { id: string }).id,
        lancamento_id: lancamentoId,
        idempotent: true,
      });
    }

    const metodoPagamento = normalizeMetodoPagamento(body.metodo);
    const lancRes = await s
      .from("financeiro_lancamentos")
      .insert({
        escola_id: escolaId,
        aluno_id: body.aluno_id,
        matricula_id: body.matricula_id ?? null,
        tipo: "debito",
        origem: "venda_avulsa",
        descricao: body.descricao,
        valor_original: body.valor,
        status: body.pago_imediato ? "pago" : "pendente",
        data_pagamento: body.pago_imediato ? new Date().toISOString() : null,
        metodo_pagamento: body.pago_imediato ? metodoPagamento : null,
        comprovativo_url: body.comprovativo_url ?? null,
        created_by: user.id,
      })
      .select("id")
      .single();

    if (lancRes.error || !lancRes.data) {
      return NextResponse.json(
        { ok: false, error: lancRes.error?.message || "Falha ao registrar venda" },
        { status: 400 }
      );
    }

    const lancamentoId = (lancRes.data as { id: string }).id;
    const referencia = `venda_avulsa:${lancamentoId}`;
    const pagamentoRes = await s
      .from("pagamentos")
      .insert({
        escola_id: escolaId,
        aluno_id: body.aluno_id,
        valor_pago: body.valor,
        status: body.pago_imediato ? "pago" : "pendente",
        metodo: body.metodo ?? undefined,
        reference: referencia,
        referencia,
        evidence_url: body.comprovativo_url ?? undefined,
        meta: { idempotency_key: idempotencyKey, origem: "venda_avulsa" },
      })
      .select("id")
      .single();

    if (pagamentoRes.error || !pagamentoRes.data) {
      await s
        .from("financeiro_lancamentos")
        .delete()
        .eq("id", lancamentoId)
        .eq("escola_id", escolaId);
      return NextResponse.json(
        { ok: false, error: pagamentoRes.error?.message || "Falha ao registrar pagamento" },
        { status: 400 }
      );
    }

    try {
      await s.rpc("refresh_all_materialized_views");
    } catch {}

    recordAuditServer({
      escolaId,
      portal: "financeiro",
      acao: "VENDA_AVULSA_REGISTRADA",
      entity: "pagamento",
      entityId: (pagamentoRes.data as { id: string }).id,
      details: {
        lancamento_id: lancamentoId,
        valor: body.valor,
        metodo: body.metodo ?? null,
        pago_imediato: body.pago_imediato,
      },
    }).catch(() => null);

    if (body.pago_imediato) {
      try {
        const { data: alunoRow } = await s
          .from("alunos")
          .select("nome, nome_completo")
          .eq("id", body.aluno_id)
          .maybeSingle();

        const alunoNome = alunoRow?.nome_completo || alunoRow?.nome || "Aluno";
        const valorFormatado = new Intl.NumberFormat("pt-AO", {
          style: "currency",
          currency: "AOA",
        }).format(body.valor);

        await emitirEvento(s, {
          escola_id: escolaId,
          tipo: "pagamento.confirmado",
          payload: {
            aluno_id: body.aluno_id,
            aluno_nome: alunoNome,
            valor: body.valor,
            valor_formatado: valorFormatado,
            metodo: body.metodo ?? "numerario",
            apto_matricula: false,
          },
          actor_id: user.id,
          actor_role: "admin",
          entidade_tipo: "pagamento",
          entidade_id: (pagamentoRes.data as { id: string }).id,
        });
      } catch (eventError) {
        console.warn("[vendas/avulsa] falha ao emitir evento:", eventError);
      }
    }

    return NextResponse.json({
      ok: true,
      lancamento_id: lancamentoId,
      pagamento_id: (pagamentoRes.data as { id: string }).id,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
