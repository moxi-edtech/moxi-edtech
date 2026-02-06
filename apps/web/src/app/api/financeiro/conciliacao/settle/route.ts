import { NextResponse } from "next/server";
import { z } from "zod";
import { supabaseServerTyped } from "@/lib/supabaseServer";
import { resolveEscolaIdForUser } from "@/lib/tenant/resolveEscolaIdForUser";
import { recordAuditServer } from "@/lib/audit";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const payloadSchema = z
  .object({
    pagamento_id: z.string().uuid().optional(),
    transacao_id: z.string().uuid().optional(),
    aluno_id: z.string().uuid().optional(),
    mensalidade_id: z.string().uuid().optional(),
    settle_meta: z.record(z.any()).optional(),
  })
  .refine((data) => data.pagamento_id || data.transacao_id, {
    message: "pagamento_id ou transacao_id é obrigatório",
  });

export async function POST(request: Request) {
  try {
    const idempotencyKey =
      request.headers.get("Idempotency-Key") ?? request.headers.get("idempotency-key");
    if (!idempotencyKey) {
      return NextResponse.json(
        { ok: false, error: "Idempotency-Key header é obrigatório" },
        { status: 400 }
      );
    }

    const supabase = await supabaseServerTyped<any>();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ ok: false, error: "Não autenticado" }, { status: 401 });
    }

    const escolaId = await resolveEscolaIdForUser(supabase, user.id);
    if (!escolaId) {
      return NextResponse.json({ ok: false, error: "Escola não identificada" }, { status: 403 });
    }

    const body = await request.json().catch(() => null);
    const parsed = payloadSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { ok: false, error: parsed.error.issues?.[0]?.message || "Payload inválido" },
        { status: 400 }
      );
    }

    const { data: existingPagamento } = await supabase
      .from("pagamentos")
      .select("id, status, meta")
      .eq("escola_id", escolaId)
      .contains("meta", { idempotency_key: idempotencyKey })
      .maybeSingle();
    if (existingPagamento) {
      return NextResponse.json({ ok: true, data: existingPagamento, idempotent: true });
    }

    if (parsed.data.pagamento_id) {
      const { data: pagamentoAtual } = await supabase
        .from("pagamentos")
        .select("id, status, meta")
        .eq("escola_id", escolaId)
        .eq("id", parsed.data.pagamento_id)
        .maybeSingle();
      const settleMetaKey = (pagamentoAtual as any)?.meta?.settle_meta?.idempotency_key;
      if ((pagamentoAtual as any)?.status === "settled" && settleMetaKey === idempotencyKey) {
        return NextResponse.json({ ok: true, data: pagamentoAtual, idempotent: true });
      }
      if ((pagamentoAtual as any)?.status === "settled") {
        return NextResponse.json(
          { ok: false, error: "Pagamento já conciliado" },
          { status: 409 }
        );
      }
    }

    let pagamentoId = parsed.data.pagamento_id ?? null;

    if (!pagamentoId && parsed.data.transacao_id) {
      const { data: transacao, error: transacaoError } = await supabase
        .from("financeiro_transacoes_importadas")
        .select("id, valor, referencia, banco, conta, import_id")
        .eq("escola_id", escolaId)
        .eq("id", parsed.data.transacao_id)
        .single();

      if (transacaoError || !transacao) {
        return NextResponse.json({ ok: false, error: "Transação não encontrada" }, { status: 404 });
      }

      const { data: upload } = await supabase
        .from("conciliacao_uploads")
        .select("file_path")
        .eq("escola_id", escolaId)
        .eq("id", transacao.import_id)
        .maybeSingle();

      const metodo = transacao.referencia ? "tpa" : "transfer";
      const evidenceUrl = metodo === "transfer" ? upload?.file_path ?? null : null;

      if (!parsed.data.aluno_id) {
        return NextResponse.json({ ok: false, error: "Aluno obrigatório para conciliação" }, { status: 400 });
      }

      const { data: pagamento, error: pagamentoError } = await supabase.rpc(
        "financeiro_registrar_pagamento_secretaria",
        {
          p_escola_id: escolaId,
          p_aluno_id: parsed.data.aluno_id,
          p_mensalidade_id: parsed.data.mensalidade_id ?? null,
          p_valor: transacao.valor,
          p_metodo: metodo,
          p_reference: transacao.referencia ?? null,
          p_evidence_url: evidenceUrl,
          p_gateway_ref: null,
          p_meta: {
            origem: "conciliacao",
            idempotency_key: idempotencyKey,
            transacao_id: transacao.id,
            banco: transacao.banco,
            conta: transacao.conta,
          },
        }
      );

      if (pagamentoError || !pagamento?.id) {
        return NextResponse.json({ ok: false, error: pagamentoError?.message || "Falha ao criar pagamento" }, { status: 500 });
      }

      pagamentoId = pagamento.id;
    }

    const { data, error } = await supabase.rpc("financeiro_settle_pagamento", {
      p_escola_id: escolaId,
      p_pagamento_id: pagamentoId,
      p_settle_meta: {
        ...(parsed.data.settle_meta ?? {}),
        idempotency_key: idempotencyKey,
      },
    });

    if (!error && parsed.data.transacao_id) {
      await supabase
        .from("financeiro_transacoes_importadas")
        .update({ status: "conciliado" })
        .eq("escola_id", escolaId)
        .eq("id", parsed.data.transacao_id);
    }

    if (error) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    }

    recordAuditServer({
      escolaId,
      portal: "financeiro",
      acao: "PAGAMENTO_CONCILIADO",
      entity: "pagamento",
      entityId: pagamentoId,
      details: {
        transacao_id: parsed.data.transacao_id ?? null,
        settle_meta: parsed.data.settle_meta ?? {},
      },
    }).catch(() => null);

    return NextResponse.json({ ok: true, data });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
