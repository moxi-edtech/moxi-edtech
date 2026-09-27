import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { recordAuditServer } from "@/lib/audit";
import { requireApiTenantGuard } from "@/lib/api/requireApiTenantGuard";
import { HttpError } from "@/lib/errors";
import { emitirDocumentoFiscalViaAdapter } from "@/lib/fiscal/financeiroFiscalAdapter";
import {
  hasFiscalSourceAllocation,
  issueFiscalReceiptForPayment,
} from "@/lib/fiscal/paymentFiscalDocument";
import { requireFeature } from "@/lib/plan/requireFeature";
import type { Json } from "~types/supabase";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const PayloadSchema = z.object({
  mensalidadeId: z.string().uuid(),
  pagamentoId: z.string().uuid().optional(),
});

type ReciboResponse = {
  ok: true;
  doc_id: string;
  url_validacao: string | null;
  print: {
    escola_nome: string;
    aluno_nome: string;
    aluno_bi: string | null;
    classe_nome: string | null;
    curso_nome: string | null;
    turma_nome: string | null;
    logo_url: string | null;
    numero_sequencial: number | null;
    public_id: string | null;
    emitido_em: string;
    banco: string | null;
    titular_conta: string | null;
    iban: string | null;
    kwik_chave: string | null;
  } | null;
  fiscal: {
    numero_formatado: string;
    hash_control: string;
    key_version: number;
  } | null;
};

function jsonError(status: number, code: string, message: string) {
  return NextResponse.json({ ok: false, error: message, code }, { status });
}

async function buildPrintPayload(params: {
  supabase: any;
  escolaId: string;
  alunoId: string | null;
  documentoId: string;
}) {
  const { supabase, escolaId, alunoId, documentoId } = params;
  const [
    { data: escola },
    { data: aluno },
    { data: matricula },
    { data: fiscal },
  ] = await Promise.all([
    supabase
      .from("escolas")
      .select("nome,logo_url,dados_pagamento")
      .eq("id", escolaId)
      .maybeSingle(),
    alunoId
      ? supabase
          .from("alunos")
          .select("nome,nome_completo,bi_numero")
          .eq("id", alunoId)
          .maybeSingle()
      : Promise.resolve({ data: null }),
    alunoId
      ? supabase
          .from("matriculas")
          .select(`
            id,
            turmas (
              nome,
              classes ( nome ),
              cursos ( nome )
            )
          `)
          .eq("aluno_id", alunoId)
          .order("updated_at", { ascending: false })
          .limit(1)
          .maybeSingle()
      : Promise.resolve({ data: null }),
    supabase
      .from("fiscal_documentos")
      .select("numero,numero_formatado,created_at")
      .eq("id", documentoId)
      .maybeSingle(),
  ]);

  const dados = (escola?.dados_pagamento ?? {}) as Record<string, unknown>;
  const turma = (matricula as any)?.turmas ?? null;

  return {
    escola_nome: String(escola?.nome ?? "Escola"),
    aluno_nome: String(aluno?.nome_completo ?? aluno?.nome ?? "Aluno"),
    aluno_bi: typeof aluno?.bi_numero === "string" ? aluno.bi_numero : null,
    classe_nome:
      typeof turma?.classes?.nome === "string" ? turma.classes.nome : null,
    curso_nome:
      typeof turma?.cursos?.nome === "string" ? turma.cursos.nome : null,
    turma_nome: typeof turma?.nome === "string" ? turma.nome : null,
    logo_url: typeof escola?.logo_url === "string" ? escola.logo_url : null,
    numero_sequencial:
      typeof fiscal?.numero === "number" ? fiscal.numero : Number(fiscal?.numero) || null,
    public_id:
      typeof fiscal?.numero_formatado === "string"
        ? fiscal.numero_formatado
        : documentoId,
    emitido_em:
      typeof fiscal?.created_at === "string"
        ? fiscal.created_at
        : new Date().toISOString(),
    banco: typeof dados.banco === "string" ? dados.banco : null,
    titular_conta:
      typeof dados.titular_conta === "string" ? dados.titular_conta : null,
    iban: typeof dados.iban === "string" ? dados.iban : null,
    kwik_chave:
      typeof dados.kwik_chave === "string" ? dados.kwik_chave : null,
  };
}

export async function POST(req: NextRequest) {
  const idempotencyKey =
    req.headers.get("Idempotency-Key") ?? req.headers.get("idempotency-key");
  if (!idempotencyKey) {
    return jsonError(400, "IDEMPOTENCY_KEY_REQUIRED", "Idempotency-Key header é obrigatório.");
  }

  const parsed = PayloadSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return jsonError(400, "INVALID_PAYLOAD", "Payload inválido.");
  }

  try {
    const guard = await requireApiTenantGuard({
      productContext: "k12",
      requireTenantType: "k12",
      allowedRoles: [
        "secretaria",
        "financeiro",
        "secretaria_financeiro",
        "admin_financeiro",
        "admin",
        "admin_escola",
        "staff_admin",
        "super_admin",
        "global_admin",
      ],
    });
    if (!guard.ok) return guard.response;

    try {
      await requireFeature("fin_recibo_pdf");
    } catch (error) {
      if (error instanceof HttpError) {
        return jsonError(error.status, error.code, error.message);
      }
      throw error;
    }

    const supabase = guard.supabase as any;
    const escolaId = guard.tenantId;
    const user = guard.user;

    const { data: cached } = await supabase
      .from("idempotency_keys")
      .select("result")
      .eq("escola_id", escolaId)
      .eq("scope", "financeiro_recibo_emitir_v2")
      .eq("key", idempotencyKey)
      .maybeSingle();

    if (cached?.result) {
      return NextResponse.json(cached.result, { status: 200 });
    }

    const { data: mensalidade, error: mensalidadeError } = await supabase
      .from("mensalidades")
      .select("id,aluno_id,valor,valor_previsto")
      .eq("id", parsed.data.mensalidadeId)
      .eq("escola_id", escolaId)
      .maybeSingle();

    if (mensalidadeError || !mensalidade) {
      return jsonError(
        404,
        "MENSALIDADE_NOT_FOUND",
        mensalidadeError?.message ?? "Mensalidade não encontrada."
      );
    }

    const { data: reclassificacaoPendente } = await supabase
      .from("matricula_reclassificacoes")
      .select("id,tipo")
      .eq("escola_id", escolaId)
      .eq("aluno_id", mensalidade.aluno_id)
      .eq("status", "aguardando_destino")
      .limit(1)
      .maybeSingle();

    if (reclassificacaoPendente) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "Não é possível emitir recibo enquanto o aluno aguarda definição de destino académico.",
          code: "MATRICULA_AGUARDANDO_RECLASSIFICACAO",
          reclassificacao_tipo: reclassificacaoPendente.tipo,
        },
        { status: 409 }
      );
    }

    let paymentQuery = supabase
      .from("pagamentos")
      .select(
        "id,escola_id,mensalidade_id,aluno_id,valor_pago,status,created_at,fiscal_documento_id"
      )
      .eq("escola_id", escolaId)
      .eq("mensalidade_id", mensalidade.id);

    if (parsed.data.pagamentoId) {
      paymentQuery = paymentQuery.eq("id", parsed.data.pagamentoId);
    } else {
      paymentQuery = paymentQuery
        .in("status", ["settled", "concluido", "pago"])
        .order("created_at", { ascending: false })
        .limit(1);
    }

    const { data: paymentRows, error: paymentError } = await paymentQuery;
    if (paymentError) {
      return jsonError(500, "PAYMENT_LOOKUP_FAILED", paymentError.message);
    }

    const payment = Array.isArray(paymentRows)
      ? paymentRows[0]
      : paymentRows;

    if (!payment) {
      return jsonError(
        409,
        "SETTLED_PAYMENT_REQUIRED",
        "Nenhum pagamento liquidado foi encontrado para esta mensalidade."
      );
    }

    if (!["settled", "concluido", "pago"].includes(String(payment.status))) {
      return jsonError(
        409,
        "PAYMENT_NOT_SETTLED",
        "O pagamento ainda não foi liquidado; nenhum recibo fiscal pode ser emitido."
      );
    }

    let documentoId = payment.fiscal_documento_id as string | null;
    let numeroFormatado = "";
    let hashControl = "";
    let keyVersion = 0;

    if (documentoId) {
      const { data: existingDoc, error: existingDocError } = await supabase
        .from("fiscal_documentos")
        .select("id,numero_formatado,hash_control,key_version,status")
        .eq("id", documentoId)
        .maybeSingle();

      if (existingDocError || !existingDoc) {
        return jsonError(
          500,
          "PAYMENT_FISCAL_DOC_LOOKUP_FAILED",
          existingDocError?.message ?? "Documento fiscal associado não foi encontrado."
        );
      }

      numeroFormatado = existingDoc.numero_formatado;
      hashControl = existingDoc.hash_control;
      keyVersion = existingDoc.key_version;
    } else if (await hasFiscalSourceAllocation(payment.id)) {
      const rc = await issueFiscalReceiptForPayment({
        paymentId: payment.id,
        createdBy: user.id,
      });
      documentoId = rc.document.documento_id;
      numeroFormatado = rc.document.numero_formatado;
      hashControl = rc.document.hash_control;
      keyVersion = rc.document.key_version;
    } else {
      const origin = new URL(req.url).origin;
      const cookieHeader = req.headers.get("cookie");
      const valor = Number(payment.valor_pago ?? mensalidade.valor_previsto ?? mensalidade.valor ?? 0);
      if (!Number.isFinite(valor) || valor <= 0) {
        return jsonError(400, "PAYMENT_VALUE_INVALID", "Valor do pagamento é inválido.");
      }

      const fr = await emitirDocumentoFiscalViaAdapter({
        tipoFluxoFinanceiro: "immediate_payment",
        origemOperacao: "financeiro_pagamento_fr",
        origemId: payment.id,
        descricaoPrincipal: "Recebimento de mensalidade",
        itens: [{ descricao: "Propina", valor }],
        cliente: { nome: null, nif: null },
        escolaId,
        origin,
        cookieHeader,
        metadata: {
          pagamento_id: payment.id,
          mensalidade_id: mensalidade.id,
          aluno_id: mensalidade.aluno_id,
        },
      });

      documentoId = fr.documento_id;
      numeroFormatado = fr.numero_formatado;
      hashControl = fr.hash_control;
      keyVersion = fr.key_version;

      await supabase
        .from("pagamentos")
        .update({
          fiscal_documento_id: documentoId,
          status_fiscal: "ok",
          fiscal_error: null,
        })
        .eq("id", payment.id)
        .eq("escola_id", escolaId);
    }

    if (!documentoId) {
      return jsonError(
        500,
        "FISCAL_RECEIPT_INCONSISTENT",
        "A emissão fiscal não retornou documento."
      );
    }

    const print = await buildPrintPayload({
      supabase,
      escolaId,
      alunoId: mensalidade.aluno_id ?? null,
      documentoId,
    });

    const response: ReciboResponse = {
      ok: true,
      doc_id: documentoId,
      url_validacao: null,
      print,
      fiscal: {
        numero_formatado: numeroFormatado,
        hash_control: hashControl,
        key_version: keyVersion,
      },
    };

    await supabase.from("idempotency_keys").upsert(
      {
        escola_id: escolaId,
        scope: "financeiro_recibo_emitir_v2",
        key: idempotencyKey,
        result: response as unknown as Json,
      },
      { onConflict: "escola_id,scope,key" }
    );

    recordAuditServer({
      escolaId,
      portal: "financeiro",
      acao: "RECIBO_FISCAL_EMITIDO",
      entity: "fiscal_documentos",
      entityId: documentoId,
      details: {
        pagamento_id: payment.id,
        mensalidade_id: mensalidade.id,
        numero_formatado: numeroFormatado,
      },
    }).catch(() => null);

    return NextResponse.json(response, { status: 200 });
  } catch (error) {
    return jsonError(
      500,
      "FISCAL_RECEIPT_INTERNAL_ERROR",
      error instanceof Error ? error.message : "Erro interno na emissão do recibo fiscal."
    );
  }
}
