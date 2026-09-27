import "server-only";

import { queueAgtDocumentSubmission } from "@/lib/fiscal/agtSubmissionQueue";
import { signFiscalCanonicalString } from "@/lib/fiscal/kmsSigner";
import { supabaseServerRole } from "@/lib/supabaseServerRole";
import type { Json } from "~types/supabase";

type EmitReceiptRpcResult = {
  ok?: boolean;
  idempotent?: boolean;
  documento_id?: string;
  empresa_id?: string;
  numero_formatado?: string;
  hash_control?: string;
  key_version?: number;
  status?: string;
  canonical_string?: string;
};

export async function emitFiscalReceiptForPayment(pagamentoId: string) {
  const admin = supabaseServerRole() as any;

  const { data: emitted, error: emitError } = await admin.rpc(
    "fiscal_emitir_recibo_pagamento",
    { p_pagamento_id: pagamentoId }
  );

  if (emitError) throw new Error(emitError.message);

  const result = emitted as EmitReceiptRpcResult;
  if (!result?.documento_id || !result.empresa_id) {
    throw new Error("FISCAL_RC_RPC_INCONSISTENT");
  }

  let documentoId = result.documento_id;
  let status = result.status ?? "pendente_assinatura";

  if (status === "pendente_assinatura") {
    if (!result.canonical_string || !result.hash_control || !result.key_version) {
      throw new Error("FISCAL_RC_SIGNATURE_CONTEXT_MISSING");
    }

    const { data: keyRow, error: keyError } = await admin
      .from("fiscal_chaves")
      .select("private_key_ref")
      .eq("empresa_id", result.empresa_id)
      .eq("key_version", result.key_version)
      .eq("status", "active")
      .maybeSingle();

    if (keyError || !keyRow?.private_key_ref) {
      throw new Error(keyError?.message ?? "FISCAL_RC_KMS_KEY_MISSING");
    }

    const signature = await signFiscalCanonicalString(result.canonical_string, {
      privateKeyRef: keyRow.private_key_ref,
    });

    const { data: finalized, error: finalizeError } = await admin.rpc(
      "fiscal_finalizar_assinatura",
      {
        p_documento_id: documentoId,
        p_assinatura_base64: signature,
        p_hash_control: result.hash_control,
        p_canonical_string: result.canonical_string,
      }
    );

    if (finalizeError) throw new Error(finalizeError.message);
    if (!finalized?.documento_id) {
      throw new Error("FISCAL_RC_FINALIZE_INCONSISTENT");
    }

    documentoId = finalized.documento_id;
    status = finalized.status ?? "emitido";
  }

  const { data: payment, error: paymentError } = await admin
    .from("pagamentos")
    .select("id,escola_id,created_by,settled_by")
    .eq("id", pagamentoId)
    .single();

  if (paymentError || !payment) {
    throw new Error(paymentError?.message ?? "PAYMENT_NOT_FOUND_AFTER_RC");
  }

  const now = new Date().toISOString();

  const [{ error: paymentUpdateError }, { error: linkUpdateError }] =
    await Promise.all([
      admin
        .from("pagamentos")
        .update({
          status_fiscal: "ok",
          fiscal_documento_id: documentoId,
          fiscal_error: null,
        })
        .eq("id", pagamentoId),
      admin
        .from("financeiro_fiscal_links")
        .update({
          fiscal_documento_id: documentoId,
          status: "ok",
          fiscal_error: null,
          updated_at: now,
        })
        .eq("origem_tipo", "financeiro_pagamento_rc")
        .eq("origem_id", pagamentoId),
    ]);

  if (paymentUpdateError) throw new Error(paymentUpdateError.message);
  if (linkUpdateError) throw new Error(linkUpdateError.message);

  let agtSubmission: Record<string, unknown> | null = null;
  if (status === "emitido") {
    try {
      agtSubmission = (await queueAgtDocumentSubmission({
        documentoId,
        createdBy: payment.settled_by ?? payment.created_by ?? null,
      })) as Record<string, unknown>;
    } catch (error) {
      agtSubmission = {
        queued: false,
        error: error instanceof Error ? error.message : String(error),
      };

      await admin
        .from("pagamentos")
        .update({
          status_fiscal: "pending",
          fiscal_error:
            error instanceof Error ? error.message : "AGT_QUEUE_DISPATCH_FAILED",
        })
        .eq("id", pagamentoId);
    }
  }

  return {
    ok: true,
    idempotent: result.idempotent ?? false,
    pagamento_id: pagamentoId,
    documento_id: documentoId,
    numero_formatado: result.numero_formatado ?? null,
    status,
    agt_submission: agtSubmission as Json | null,
  };
}
