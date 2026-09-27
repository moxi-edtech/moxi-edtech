import "server-only";

import { inngest } from "@/inngest/client";
import { queueAgtDocumentSubmission } from "@/lib/fiscal/agtSubmissionQueue";
import { signFiscalCanonicalString } from "@/lib/fiscal/kmsSigner";
import { supabaseServerRole } from "@/lib/supabaseServerRole";

type FiscalReceiptResult = {
  ok: boolean;
  idempotent?: boolean;
  documento_id: string;
  empresa_id: string;
  numero?: number;
  numero_formatado: string;
  hash_control: string;
  key_version: number;
  status: string;
  canonical_string?: string | null;
};

export class PaymentFiscalError extends Error {
  constructor(public readonly code: string, message: string) {
    super(message);
    this.name = "PaymentFiscalError";
  }
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

export async function hasFiscalSourceAllocation(paymentId: string) {
  const admin = supabaseServerRole() as any;
  const { data, error } = await admin
    .from("financeiro_pagamento_alocacoes")
    .select("id,fiscal_documento_origem_id,natureza")
    .eq("pagamento_id", paymentId)
    .eq("natureza", "aplicacao")
    .not("fiscal_documento_origem_id", "is", null)
    .limit(1)
    .maybeSingle();

  if (error) throw new PaymentFiscalError("PAYMENT_ALLOCATION_LOOKUP_FAILED", error.message);
  return Boolean(data?.fiscal_documento_origem_id);
}

export async function issueFiscalReceiptForPayment(input: {
  paymentId: string;
  createdBy?: string | null;
}) {
  const admin = supabaseServerRole() as any;

  const { data: existingPayment, error: paymentError } = await admin
    .from("pagamentos")
    .select("id,escola_id,status,fiscal_documento_id,status_fiscal,created_by,settled_by")
    .eq("id", input.paymentId)
    .maybeSingle();

  if (paymentError || !existingPayment) {
    throw new PaymentFiscalError(
      "PAYMENT_NOT_FOUND",
      paymentError?.message ?? "Pagamento não encontrado."
    );
  }

  if (!["settled", "concluido", "pago"].includes(existingPayment.status)) {
    throw new PaymentFiscalError(
      "PAYMENT_NOT_SETTLED",
      "O pagamento ainda não está liquidado."
    );
  }

  if (existingPayment.fiscal_documento_id) {
    const { data: existingDoc, error: existingDocError } = await admin
      .from("fiscal_documentos")
      .select("id,empresa_id,numero,numero_formatado,hash_control,key_version,status,canonical_string")
      .eq("id", existingPayment.fiscal_documento_id)
      .maybeSingle();

    if (existingDocError) {
      throw new PaymentFiscalError("PAYMENT_FISCAL_DOC_LOOKUP_FAILED", existingDocError.message);
    }
    if (existingDoc) {
      return {
        kind: existingDoc.numero_formatado?.startsWith("RC ") ? "RC" as const : "EXISTING" as const,
        document: {
          ok: true,
          idempotent: true,
          documento_id: existingDoc.id,
          empresa_id: existingDoc.empresa_id,
          numero: existingDoc.numero,
          numero_formatado: existingDoc.numero_formatado,
          hash_control: existingDoc.hash_control,
          key_version: existingDoc.key_version,
          status: existingDoc.status,
          canonical_string: existingDoc.canonical_string,
        } satisfies FiscalReceiptResult,
        agtSubmission: null,
      };
    }
  }

  const hasSource = await hasFiscalSourceAllocation(input.paymentId);
  if (!hasSource) {
    throw new PaymentFiscalError(
      "PAYMENT_FR_REQUIRED",
      "Pagamento sem documento fiscal origem deve seguir o fluxo FR."
    );
  }

  const { data: rpcData, error: rpcError } = await admin.rpc(
    "fiscal_emitir_recibo_pagamento",
    { p_pagamento_id: input.paymentId }
  );

  if (rpcError) {
    throw new PaymentFiscalError("FISCAL_RC_EMIT_FAILED", rpcError.message);
  }

  const emitted = asRecord(rpcData) as Partial<FiscalReceiptResult>;
  if (emitted.ok !== true || !emitted.documento_id || !emitted.empresa_id) {
    throw new PaymentFiscalError(
      "FISCAL_RC_EMIT_INCONSISTENT",
      "Resposta inconsistente ao criar RC fiscal."
    );
  }

  let finalDoc = emitted as FiscalReceiptResult;

  if (emitted.status === "pendente_assinatura") {
    if (!emitted.canonical_string || !emitted.hash_control || !emitted.key_version) {
      throw new PaymentFiscalError(
        "FISCAL_RC_PENDING_INCONSISTENT",
        "RC pendente sem canonical string/hash/key version."
      );
    }

    const { data: keyRow, error: keyError } = await admin
      .from("fiscal_chaves")
      .select("private_key_ref,status")
      .eq("empresa_id", emitted.empresa_id)
      .eq("key_version", emitted.key_version)
      .eq("status", "active")
      .maybeSingle();

    if (keyError || !keyRow?.private_key_ref) {
      throw new PaymentFiscalError(
        "FISCAL_RC_KEY_MISSING",
        keyError?.message ?? "Chave fiscal activa não encontrada."
      );
    }

    const assinatura = await signFiscalCanonicalString(emitted.canonical_string, {
      privateKeyRef: keyRow.private_key_ref,
    });

    const { data: finalized, error: finalizeError } = await admin.rpc(
      "fiscal_finalizar_assinatura",
      {
        p_documento_id: emitted.documento_id,
        p_assinatura_base64: assinatura,
        p_hash_control: emitted.hash_control,
        p_canonical_string: emitted.canonical_string,
      }
    );

    if (finalizeError) {
      throw new PaymentFiscalError("FISCAL_RC_FINALIZE_FAILED", finalizeError.message);
    }

    const finalizedRecord = asRecord(finalized);
    if (finalizedRecord.ok !== true || !finalizedRecord.documento_id) {
      throw new PaymentFiscalError(
        "FISCAL_RC_FINALIZE_INCONSISTENT",
        "Resposta inconsistente ao finalizar RC."
      );
    }

    finalDoc = {
      ...finalDoc,
      ...finalizedRecord,
      empresa_id: emitted.empresa_id,
      canonical_string: emitted.canonical_string,
    } as FiscalReceiptResult;
  }

  const actorId =
    input.createdBy ??
    existingPayment.settled_by ??
    existingPayment.created_by ??
    null;

  await admin
    .from("pagamentos")
    .update({
      status_fiscal: "ok",
      fiscal_documento_id: finalDoc.documento_id,
      fiscal_error: null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", input.paymentId);

  await admin
    .from("financeiro_fiscal_links")
    .update({
      status: "ok",
      fiscal_documento_id: finalDoc.documento_id,
      fiscal_error: null,
      updated_at: new Date().toISOString(),
    })
    .eq("origem_tipo", "financeiro_pagamento_rc")
    .eq("origem_id", input.paymentId);

  let agtSubmission: Record<string, unknown> | null = null;
  try {
    agtSubmission = await queueAgtDocumentSubmission({
      documentoId: finalDoc.documento_id,
      createdBy: actorId,
    });
  } catch (error) {
    agtSubmission = {
      queued: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }

  return {
    kind: "RC" as const,
    document: finalDoc,
    agtSubmission,
  };
}

export async function enqueueFrReprocessForPayment(input: {
  paymentId: string;
  createdBy?: string | null;
}) {
  const admin = supabaseServerRole() as any;
  const { data: payment, error: paymentError } = await admin
    .from("pagamentos")
    .select("id,escola_id,status,created_by,settled_by,fiscal_documento_id")
    .eq("id", input.paymentId)
    .maybeSingle();

  if (paymentError || !payment) {
    throw new PaymentFiscalError(
      "PAYMENT_NOT_FOUND",
      paymentError?.message ?? "Pagamento não encontrado."
    );
  }

  if (!["settled", "concluido", "pago"].includes(payment.status)) {
    throw new PaymentFiscalError("PAYMENT_NOT_SETTLED", "Pagamento ainda não liquidado.");
  }

  if (payment.fiscal_documento_id) {
    return {
      queued: false,
      idempotent: true,
      documento_id: payment.fiscal_documento_id,
    };
  }

  const today = new Date().toISOString().slice(0, 10);
  const { data: bindings, error: bindingError } = await admin
    .from("fiscal_escola_bindings")
    .select("empresa_id,is_primary,effective_from,effective_to")
    .eq("escola_id", payment.escola_id)
    .lte("effective_from", today)
    .or(`effective_to.is.null,effective_to.gte.${today}`)
    .order("is_primary", { ascending: false })
    .limit(2);

  if (bindingError) {
    throw new PaymentFiscalError("FISCAL_BINDING_LOOKUP_FAILED", bindingError.message);
  }
  if (!bindings?.length) {
    throw new PaymentFiscalError(
      "FISCAL_EMPRESA_CONTEXT_REQUIRED",
      "Escola sem empresa fiscal activa."
    );
  }

  const empresaId = bindings[0].empresa_id;
  const originType = "financeiro_pagamentos_registrar";
  const originId = payment.id;
  const idempotencyKey = `financeiro_pagamentos_registrar:${payment.id}`;

  const { data: existingLink } = await admin
    .from("financeiro_fiscal_links")
    .select("id,status,fiscal_documento_id")
    .eq("origem_tipo", originType)
    .eq("origem_id", originId)
    .maybeSingle();

  if (existingLink?.fiscal_documento_id) {
    return {
      queued: false,
      idempotent: true,
      documento_id: existingLink.fiscal_documento_id,
    };
  }

  if (!existingLink) {
    const { error: linkError } = await admin
      .from("financeiro_fiscal_links")
      .insert({
        escola_id: payment.escola_id,
        empresa_id: empresaId,
        origem_tipo: originType,
        origem_id: originId,
        fiscal_documento_id: null,
        status: "pending",
        idempotency_key: idempotencyKey,
        payload_snapshot: {
          pagamento_id: payment.id,
          source: "bill_007_payment_outbox",
        },
        fiscal_error: null,
      });

    if (linkError && linkError.code !== "23505") {
      throw new PaymentFiscalError("FISCAL_LINK_CREATE_FAILED", linkError.message);
    }
  }

  const actorId =
    input.createdBy ??
    payment.settled_by ??
    payment.created_by ??
    null;

  const { data: existingJobs } = await admin
    .from("fiscal_reprocess_jobs")
    .select("id,status")
    .eq("escola_id", payment.escola_id)
    .eq("empresa_id", empresaId)
    .in("status", ["queued", "processing"])
    .contains("metadata", { payment_id: payment.id })
    .limit(1);

  let jobId = existingJobs?.[0]?.id ?? null;
  if (!jobId) {
    const { data: insertedJob, error: jobError } = await admin
      .from("fiscal_reprocess_jobs")
      .insert({
        escola_id: payment.escola_id,
        empresa_id: empresaId,
        status: "queued",
        requested_by: actorId,
        metadata: {
          payment_id: payment.id,
          source: "bill_007_payment_outbox",
        },
      })
      .select("id")
      .single();

    if (jobError || !insertedJob) {
      throw new PaymentFiscalError(
        "FISCAL_REPROCESS_JOB_CREATE_FAILED",
        jobError?.message ?? "Falha ao criar job fiscal."
      );
    }
    jobId = insertedJob.id;
  }

  await inngest.send({
    name: "fiscal/financeiro-reprocess.requested",
    data: {
      job_id: jobId,
      escola_id: payment.escola_id,
      empresa_id: empresaId,
      requested_by: actorId,
      request_id: crypto.randomUUID(),
    },
  });

  return {
    queued: true,
    idempotent: Boolean(existingJobs?.length),
    job_id: jobId,
  };
}

export async function processSettledPaymentFiscal(input: {
  paymentId: string;
  createdBy?: string | null;
}) {
  if (await hasFiscalSourceAllocation(input.paymentId)) {
    return issueFiscalReceiptForPayment(input);
  }

  const queued = await enqueueFrReprocessForPayment(input);
  return {
    kind: "FR_QUEUED" as const,
    document: null,
    agtSubmission: null,
    reprocess: queued,
  };
}
