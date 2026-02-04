import { NextResponse } from "next/server";
import { z } from "zod";
import { supabaseServerTyped } from "@/lib/supabaseServer";
import { resolveEscolaIdForUser } from "@/lib/tenant/resolveEscolaIdForUser";

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
      p_settle_meta: parsed.data.settle_meta ?? {},
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

    return NextResponse.json({ ok: true, data });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
