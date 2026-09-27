import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { recordAuditServer } from "@/lib/audit";
import { requireApiTenantGuard } from "@/lib/api/requireApiTenantGuard";
import { HttpError } from "@/lib/errors";
import {
  PaymentFiscalError,
  processSettledPaymentFiscal,
} from "@/lib/fiscal/paymentFiscalDocument";
import { requireFeature } from "@/lib/plan/requireFeature";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

const PayloadSchema = z
  .object({
    pagamentoId: z.string().uuid().optional(),
    mensalidadeId: z.string().uuid().optional(),
  })
  .refine((value) => Boolean(value.pagamentoId || value.mensalidadeId), {
    message: "Informe pagamentoId ou mensalidadeId.",
  });

function jsonError(status: number, code: string, message: string) {
  return NextResponse.json({ ok: false, error: message, code }, { status });
}

export async function POST(req: NextRequest) {
  const idempotencyKey =
    req.headers.get("Idempotency-Key") ?? req.headers.get("idempotency-key");
  if (!idempotencyKey) {
    return jsonError(400, "IDEMPOTENCY_KEY_REQUIRED", "Idempotency-Key header é obrigatório.");
  }

  const parsed = PayloadSchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return jsonError(
      400,
      "INVALID_PAYLOAD",
      parsed.error.issues?.[0]?.message ?? "Payload inválido."
    );
  }

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

  let pagamento: any = null;

  if (parsed.data.pagamentoId) {
    const { data, error } = await supabase
      .from("pagamentos")
      .select(
        "id,escola_id,aluno_id,mensalidade_id,valor_pago,status,metodo,reference,settled_at,created_at,fiscal_documento_id"
      )
      .eq("id", parsed.data.pagamentoId)
      .eq("escola_id", escolaId)
      .maybeSingle();

    if (error) return jsonError(500, "PAYMENT_LOOKUP_FAILED", error.message);
    pagamento = data;
  } else {
    const { data, error } = await supabase
      .from("pagamentos")
      .select(
        "id,escola_id,aluno_id,mensalidade_id,valor_pago,status,metodo,reference,settled_at,created_at,fiscal_documento_id"
      )
      .eq("escola_id", escolaId)
      .eq("mensalidade_id", parsed.data.mensalidadeId)
      .in("status", ["settled", "concluido", "pago"])
      .order("settled_at", { ascending: false, nullsFirst: false })
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) return jsonError(500, "PAYMENT_LOOKUP_FAILED", error.message);
    pagamento = data;
  }

  if (!pagamento) {
    return jsonError(
      404,
      "SETTLED_PAYMENT_NOT_FOUND",
      "Nenhum pagamento liquidado foi encontrado para emitir o documento."
    );
  }

  if (!["settled", "concluido", "pago"].includes(String(pagamento.status))) {
    return jsonError(
      409,
      "PAYMENT_NOT_SETTLED",
      "O pagamento ainda não está liquidado."
    );
  }

  if (pagamento.mensalidade_id) {
    const { data: reclassificacaoPendente } = await supabase
      .from("matricula_reclassificacoes")
      .select("id,tipo")
      .eq("escola_id", escolaId)
      .eq("aluno_id", pagamento.aluno_id)
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
  }

  try {
    const fiscal = await processSettledPaymentFiscal({
      paymentId: pagamento.id,
      createdBy: user.id,
    });

    if (fiscal.kind === "FR_QUEUED" || !fiscal.document) {
      return NextResponse.json(
        {
          ok: true,
          pending: true,
          code: "FISCAL_FR_QUEUED",
          pagamento_id: pagamento.id,
          message:
            "O pagamento está liquidado e a emissão FR foi colocada na fila fiscal.",
          reprocess: fiscal.reprocess,
        },
        { status: 202 }
      );
    }

    const documentoId = fiscal.document.documento_id;

    const [
      { data: documento, error: documentError },
      { data: escola },
      { data: aluno },
      { data: matricula },
    ] = await Promise.all([
      supabase
        .from("fiscal_documentos")
        .select(
          "id,tipo_documento,numero,numero_formatado,created_at,invoice_date,total_bruto_aoa,hash_control,key_version,status"
        )
        .eq("id", documentoId)
        .eq("empresa_id", fiscal.document.empresa_id)
        .single(),
      supabase
        .from("escolas")
        .select("nome,logo_url,dados_pagamento")
        .eq("id", escolaId)
        .maybeSingle(),
      pagamento.aluno_id
        ? supabase
            .from("alunos")
            .select("nome,nome_completo,bi_numero")
            .eq("id", pagamento.aluno_id)
            .maybeSingle()
        : Promise.resolve({ data: null }),
      pagamento.aluno_id
        ? supabase
            .from("matriculas")
            .select(
              "turmas(nome,classes(nome),cursos(nome))"
            )
            .eq("aluno_id", pagamento.aluno_id)
            .order("updated_at", { ascending: false })
            .limit(1)
            .maybeSingle()
        : Promise.resolve({ data: null }),
    ]);

    if (documentError || !documento) {
      return jsonError(
        500,
        "FISCAL_DOCUMENT_LOOKUP_FAILED",
        documentError?.message ?? "Documento fiscal emitido não encontrado."
      );
    }

    const dadosPagamento =
      escola?.dados_pagamento &&
      typeof escola.dados_pagamento === "object" &&
      !Array.isArray(escola.dados_pagamento)
        ? (escola.dados_pagamento as Record<string, unknown>)
        : {};

    const turma = (matricula as any)?.turmas ?? null;
    const print = {
      escola_nome: escola?.nome ?? "Escola",
      aluno_nome: aluno?.nome_completo ?? aluno?.nome ?? "Aluno",
      aluno_bi: aluno?.bi_numero ?? null,
      classe_nome: turma?.classes?.nome ?? null,
      curso_nome: turma?.cursos?.nome ?? null,
      turma_nome: turma?.nome ?? null,
      logo_url: escola?.logo_url ?? null,
      numero_sequencial:
        typeof documento.numero === "number" ? documento.numero : Number(documento.numero),
      public_id: documento.id,
      emitido_em: documento.created_at ?? documento.invoice_date,
      banco:
        typeof dadosPagamento.banco === "string" ? dadosPagamento.banco : null,
      titular_conta:
        typeof dadosPagamento.titular_conta === "string"
          ? dadosPagamento.titular_conta
          : null,
      iban:
        typeof dadosPagamento.iban === "string" ? dadosPagamento.iban : null,
      kwik_chave:
        typeof dadosPagamento.kwik_chave === "string"
          ? dadosPagamento.kwik_chave
          : null,
    };

    recordAuditServer({
      escolaId,
      portal: "financeiro",
      acao: "RECIBO_FISCAL_EMITIDO",
      entity: "fiscal_documentos",
      entityId: documento.id,
      details: {
        pagamento_id: pagamento.id,
        mensalidade_id: pagamento.mensalidade_id,
        tipo_documento: documento.tipo_documento,
        numero_formatado: documento.numero_formatado,
        idempotency_key: idempotencyKey,
      },
    }).catch(() => null);

    return NextResponse.json({
      ok: true,
      doc_id: documento.id,
      pagamento_id: pagamento.id,
      url_validacao: null,
      print,
      fiscal: {
        tipo_documento: documento.tipo_documento,
        numero_formatado: documento.numero_formatado,
        hash_control: documento.hash_control,
        key_version: documento.key_version,
        status: documento.status,
        agt_submission: fiscal.agtSubmission,
      },
    });
  } catch (error) {
    if (error instanceof PaymentFiscalError) {
      const status =
        error.code === "PAYMENT_NOT_SETTLED"
          ? 409
          : error.code === "PAYMENT_FR_REQUIRED"
            ? 202
            : 500;
      return jsonError(status, error.code, error.message);
    }

    return jsonError(
      500,
      "FISCAL_RECEIPT_EMIT_FAILED",
      error instanceof Error ? error.message : "Falha ao emitir documento fiscal."
    );
  }
}
