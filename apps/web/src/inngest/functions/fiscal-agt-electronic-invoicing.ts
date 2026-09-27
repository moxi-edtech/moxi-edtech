import { cron } from "inngest";
import { inngest } from "@/inngest/client";
import { supabaseServerRole } from "@/lib/supabaseServerRole";
import {
  AgtHttpError,
  getAgtInvoiceStatus,
  registerAgtInvoices,
} from "@/lib/fiscal/agtInvoice";
import { AgtMappingError, buildAgtPreparedDocument } from "@/lib/fiscal/agtInvoicePayload";
import type { Json } from "~types/supabase";

type SubmissionEvent = { submission_id: string };

const POLL_DELAYS = ["30s", "1m", "2m", "5m", "10m", "30m", "1h", "2h"] as const;

function asJson(value: unknown): Json {
  return value as Json;
}

function errorPayload(error: unknown) {
  if (error instanceof AgtHttpError) {
    return { code: error.message, http_status: error.httpStatus, payload: error.payload };
  }
  if (error instanceof AgtMappingError) {
    return { code: error.code, message: error.message };
  }
  return {
    code: error instanceof Error ? error.name : "UNKNOWN_ERROR",
    message: error instanceof Error ? error.message : String(error),
  };
}

async function loadSubmissionContext(submissionId: string) {
  const admin = supabaseServerRole() as any;
  const { data: submission, error: submissionError } = await admin
    .from("fiscal_agt_submissions")
    .select("*")
    .eq("id", submissionId)
    .single();
  if (submissionError || !submission) {
    throw new Error(submissionError?.message ?? "AGT_SUBMISSION_NOT_FOUND");
  }

  const { data: link, error: linkError } = await admin
    .from("fiscal_agt_submission_documentos")
    .select("*")
    .eq("submission_id", submissionId)
    .single();
  if (linkError || !link) {
    throw new Error(linkError?.message ?? "AGT_SUBMISSION_DOCUMENT_NOT_FOUND");
  }

  const { data: document, error: documentError } = await admin
    .from("fiscal_documentos")
    .select("id,empresa_id,tipo_documento,numero_formatado,invoice_date,system_entry,cliente_nif,cliente_nome,moeda,taxa_cambio_aoa,total_liquido_aoa,total_impostos_aoa,total_bruto_aoa,documento_origem_id,rectifica_documento_id,agt_document_status,agt_rejected_document_id,agt_rejected_document_no,reference_reason,contingency_indicator,payload,key_version,status")
    .eq("id", link.documento_id)
    .single();
  if (documentError || !document) {
    throw new Error(documentError?.message ?? "AGT_DOCUMENT_NOT_FOUND");
  }
  if (document.status !== "emitido") {
    throw new Error("AGT_DOCUMENT_NOT_EMITIDO");
  }

  const [{ data: items, error: itemsError }, { data: empresa, error: empresaError }, { data: key, error: keyError }] =
    await Promise.all([
      admin
        .from("fiscal_documento_itens")
        .select("linha_no,descricao,quantidade,preco_unit,taxa_iva,total_liquido_aoa,total_impostos_aoa,tax_exemption_code,tax_exemption_reason,product_code,product_number_code,tax_profile_code,tax_profile_version,tax_type,tax_code,tax_country_region,operation_type,unit_of_measure,product_type,unit_price_base,settlement_amount,total_liquido_moeda,total_impostos_moeda,total_bruto_moeda")
        .eq("documento_id", document.id)
        .order("linha_no", { ascending: true }),
      admin
        .from("fiscal_empresas")
        .select("id,nif")
        .eq("id", document.empresa_id)
        .single(),
      admin
        .from("fiscal_chaves")
        .select("private_key_ref,key_version,status")
        .eq("empresa_id", document.empresa_id)
        .eq("key_version", document.key_version)
        .eq("status", "active")
        .maybeSingle(),
    ]);

  if (itemsError || !Array.isArray(items)) throw new Error(itemsError?.message ?? "AGT_ITEMS_LOAD_FAILED");
  if (empresaError || !empresa?.nif) throw new Error(empresaError?.message ?? "AGT_EMPRESA_LOAD_FAILED");
  if (keyError || !key?.private_key_ref) throw new Error(keyError?.message ?? "AGT_TAXPAYER_KEY_MISSING");

  const originId = document.tipo_documento === "NC"
    ? document.rectifica_documento_id
    : document.documento_origem_id;
  let originDocument = null;
  let originValidationStatus: string | null = null;
  if (originId) {
    const [{ data: origin, error: originError }, { data: originState, error: originStateError }] =
      await Promise.all([
        admin
          .from("fiscal_documentos")
          .select("id,numero_formatado,invoice_date")
          .eq("id", originId)
          .maybeSingle(),
        admin
          .from("fiscal_agt_submission_documentos")
          .select("validation_status")
          .eq("documento_id", originId)
          .maybeSingle(),
      ]);
    if (originError) throw new Error(originError.message);
    if (originStateError) throw new Error(originStateError.message);
    originDocument = origin;
    originValidationStatus = originState?.validation_status ?? null;
  }

  let receiptSourceStates: Array<{
    documento_id: string;
    validation_status: string | null;
  }> = [];

  if (document.tipo_documento === "RC") {
    const { data: receiptLinks, error: receiptLinksError } = await admin
      .from("financeiro_recibo_alocacoes")
      .select("fiscal_documento_origem_id")
      .eq("recibo_documento_id", document.id)
      .order("created_at", { ascending: true });

    if (receiptLinksError) throw new Error(receiptLinksError.message);

    const sourceIds = Array.from(
      new Set(
        (receiptLinks ?? [])
          .map((row: { fiscal_documento_origem_id?: string | null }) =>
            row.fiscal_documento_origem_id ?? null
          )
          .filter((value: string | null): value is string => Boolean(value))
      )
    );

    if (sourceIds.length > 0) {
      const { data: sourceStatuses, error: sourceStatusError } = await admin
        .from("fiscal_agt_submission_documentos")
        .select("documento_id,validation_status")
        .in("documento_id", sourceIds);

      if (sourceStatusError) throw new Error(sourceStatusError.message);

      const statusByDocument = new Map(
        (sourceStatuses ?? []).map(
          (row: { documento_id: string; validation_status: string | null }) => [
            row.documento_id,
            row.validation_status,
          ]
        )
      );

      receiptSourceStates = sourceIds.map((documentoId) => ({
        documento_id: documentoId,
        validation_status: statusByDocument.get(documentoId) ?? null,
      }));
    }
  }

  return {
    submission,
    link,
    document,
    items,
    empresa,
    key,
    originDocument,
    originValidationStatus,
    receiptSourceStates,
  };
}

async function markSubmission(submissionId: string, patch: Record<string, unknown>) {
  const admin = supabaseServerRole() as any;
  const { error } = await admin
    .from("fiscal_agt_submissions")
    .update(patch)
    .eq("id", submissionId);
  if (error) throw new Error(error.message);
}

async function applyFinalStatus(params: {
  submissionId: string;
  documentNo: string;
  statusResult: Awaited<ReturnType<typeof getAgtInvoiceStatus>>;
}) {
  const admin = supabaseServerRole() as any;
  const result = params.statusResult;
  const docResult = (result.documentStatusList ?? []).find(
    (item) => item?.documentNo === params.documentNo
  );

  if (result.resultCode === 9) {
    await markSubmission(params.submissionId, {
      status: "cancelled",
      result_code: result.resultCode,
      status_response_payload: asJson(result.responsePayload),
      completed_at: new Date().toISOString(),
      next_check_at: null,
    });
    return { final: true, status: "cancelled" as const };
  }

  if (![0, 1, 2].includes(result.resultCode)) {
    await markSubmission(params.submissionId, {
      status: "processing",
      result_code: result.resultCode,
      status_response_payload: asJson(result.responsePayload),
      next_check_at: new Date(Date.now() + 60_000).toISOString(),
    });
    return { final: false, status: "processing" as const };
  }

  if (!docResult || !["V", "I"].includes(String(docResult.documentStatus))) {
    await markSubmission(params.submissionId, {
      status: "uncertain",
      result_code: result.resultCode,
      status_response_payload: asJson(result.responsePayload),
      error_code: "AGT_STATUS_DOCUMENT_RESULT_MISSING",
      error_message: "AGT concluiu o pedido sem devolver estado V/I para o documento esperado.",
      next_check_at: null,
    });
    return { final: true, status: "uncertain" as const };
  }

  const valid = docResult.documentStatus === "V";
  const finalStatus = valid ? "accepted" : "rejected";
  const now = new Date().toISOString();
  const { error: docUpdateError } = await admin.rpc("fiscal_agt_record_document_result", {
    p_submission_id: params.submissionId,
    p_document_no: params.documentNo,
    p_validation_status: valid ? "valid" : "invalid",
    p_error_list: asJson(Array.isArray(docResult.errorList) ? docResult.errorList : []),
    p_source: "obterEstado",
  });
  if (docUpdateError) throw new Error(docUpdateError.message);

  await markSubmission(params.submissionId, {
    status: finalStatus,
    result_code: result.resultCode,
    status_response_payload: asJson(result.responsePayload),
    completed_at: now,
    next_check_at: null,
    error_code: valid ? null : "AGT_DOCUMENT_INVALID",
    error_message: valid ? null : "Documento rejeitado na validação diferida da AGT.",
  });
  return { final: true, status: finalStatus as "accepted" | "rejected" };
}

export const fiscalAgtElectronicInvoicing = inngest.createFunction(
  {
    id: "fiscal-agt-electronic-invoicing",
    triggers: [{ event: "fiscal/agt-submit.requested" }],
    retries: 3,
  },
  async ({ event, step }) => {
    const data = event.data as SubmissionEvent;

    const context = await step.run("load-context", async () => {
      return loadSubmissionContext(data.submission_id);
    });

    if (["accepted", "rejected", "cancelled", "mapping_error"].includes(context.submission.status)) {
      return { ok: true, terminal: true, status: context.submission.status };
    }

    if (
      ["NC", "ND"].includes(context.document.tipo_documento) &&
      context.originDocument &&
      context.originValidationStatus !== "valid"
    ) {
      await step.run("wait-reference-validation", async () => {
        await markSubmission(data.submission_id, {
          status: "processing",
          error_code: "AGT_REFERENCE_DOCUMENT_NOT_VALIDATED",
          error_message:
            "Documento correctivo aguarda validação AGT do documento de referência.",
          next_check_at: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
        });
      });

      return {
        ok: true,
        terminal: false,
        status: "processing",
        reason: "reference_document_not_validated",
      };
    }

    if (context.document.tipo_documento === "RC") {
      const unresolvedSources = context.receiptSourceStates.filter(
        (source) => source.validation_status !== "valid"
      );

      if (
        context.receiptSourceStates.length === 0 ||
        unresolvedSources.length > 0
      ) {
        await step.run("wait-receipt-source-validation", async () => {
          await markSubmission(data.submission_id, {
            status: "processing",
            error_code: "AGT_SOURCE_DOCUMENT_NOT_VALIDATED",
            error_message:
              context.receiptSourceStates.length === 0
                ? "RC sem vínculos de documentos origem."
                : `RC aguarda validação AGT de ${unresolvedSources.length} documento(s) origem.`,
            next_check_at: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
          });
        });

        return {
          ok: true,
          terminal: false,
          status: "processing",
          reason: "source_document_not_validated",
        };
      }
    }

    let prepared;
    try {
      prepared = buildAgtPreparedDocument({
        document: context.document,
        items: context.items,
        taxRegistrationNumber: context.empresa.nif,
        originDocument: context.originDocument,
      });
    } catch (error) {
      if (error instanceof AgtMappingError) {
        await step.run("mark-mapping-error", async () => {
          await markSubmission(data.submission_id, {
            status: "mapping_error",
            error_code: error.code,
            error_message: error.message,
            completed_at: new Date().toISOString(),
            next_check_at: null,
          });
        });
        return { ok: false, terminal: true, status: "mapping_error", error: errorPayload(error) };
      }
      throw error;
    }

    let requestID = context.submission.request_id as string | null;
    if (!requestID) {
      const register = await step.run("register-invoice", async () => {
        await markSubmission(data.submission_id, {
          status: "submitting",
          attempt_count: Number(context.submission.attempt_count ?? 0) + 1,
          error_code: null,
          error_message: null,
        });
        try {
          const result = await registerAgtInvoices({
            submissionUuid: context.submission.submission_uuid,
            submissionTimeStamp: context.submission.created_at,
            taxRegistrationNumber: context.empresa.nif,
            taxpayerPrivateKeyRef: context.key.private_key_ref,
            documents: [prepared],
          });
          await markSubmission(data.submission_id, {
            status: "submitted",
            request_id: result.requestID,
            request_payload: asJson(result.requestPayload),
            response_payload: asJson(result.responsePayload),
            submitted_at: new Date().toISOString(),
            next_check_at: new Date(Date.now() + 30_000).toISOString(),
          });
          return { requestID: result.requestID };
        } catch (error) {
          const knownRejected = error instanceof AgtHttpError && error.httpStatus >= 400 && error.httpStatus < 500;
          if (knownRejected && error instanceof AgtHttpError) {
            const responseObject =
              error.payload && typeof error.payload === "object" && !Array.isArray(error.payload)
                ? (error.payload as { errorList?: unknown[] })
                : null;
            const documentErrors = Array.isArray(responseObject?.errorList)
              ? responseObject!.errorList!.filter((entry) => {
                  if (!entry || typeof entry !== "object" || Array.isArray(entry)) return false;
                  return String((entry as { documentNo?: unknown }).documentNo ?? "") ===
                    context.link.document_no;
                })
              : [];

            if (documentErrors.length > 0) {
              const { error: resultError } = await admin.rpc(
                "fiscal_agt_record_document_result",
                {
                  p_submission_id: data.submission_id,
                  p_document_no: context.link.document_no,
                  p_validation_status: "invalid",
                  p_error_list: asJson(documentErrors),
                  p_source: "registarFactura",
                }
              );
              if (resultError) throw new Error(resultError.message);
            }
          }
          await markSubmission(data.submission_id, {
            status: knownRejected ? "rejected" : "uncertain",
            response_payload: error instanceof AgtHttpError ? asJson(error.payload) : null,
            error_code: error instanceof AgtHttpError ? error.message : "AGT_REGISTER_OUTCOME_UNCERTAIN",
            error_message: error instanceof Error ? error.message : String(error),
            completed_at: knownRejected ? new Date().toISOString() : null,
            next_check_at: knownRejected ? null : new Date(Date.now() + 60_000).toISOString(),
          });
          throw error;
        }
      });
      requestID = register.requestID;
    }

    for (let index = 0; index < POLL_DELAYS.length; index += 1) {
      await step.sleep(`wait-status-${index}`, POLL_DELAYS[index]);
      const poll = await step.run(`poll-status-${index}`, async () => {
        try {
          const result = await getAgtInvoiceStatus({
            requestID: requestID!,
            taxRegistrationNumber: context.empresa.nif,
            taxpayerPrivateKeyRef: context.key.private_key_ref,
          });
          const admin = supabaseServerRole() as any;
          await admin
            .from("fiscal_agt_submissions")
            .update({ poll_count: Number(context.submission.poll_count ?? 0) + index + 1 })
            .eq("id", data.submission_id);
          return { kind: "result" as const, result };
        } catch (error) {
          if (error instanceof AgtHttpError && [422, 429].includes(error.httpStatus)) {
            await markSubmission(data.submission_id, {
              status: "processing",
              error_code: `AGT_STATUS_HTTP_${error.httpStatus}`,
              error_message: JSON.stringify(error.payload).slice(0, 1000),
              next_check_at: new Date(Date.now() + 60_000).toISOString(),
            });
            return { kind: "retry" as const };
          }
          throw error;
        }
      });
      if (poll.kind === "retry") continue;
      const applied = await step.run(`apply-status-${index}`, async () => {
        return applyFinalStatus({
          submissionId: data.submission_id,
          documentNo: context.link.document_no,
          statusResult: poll.result,
        });
      });
      if (applied.final) {
        return { ok: applied.status === "accepted", terminal: true, status: applied.status, requestID };
      }
    }

    await step.run("leave-processing", async () => {
      await markSubmission(data.submission_id, {
        status: "processing",
        next_check_at: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
        error_code: null,
        error_message: null,
      });
    });
    return { ok: true, terminal: false, status: "processing", requestID };
  }
);


export const fiscalAgtReconcileSweep = inngest.createFunction(
  {
    id: "fiscal-agt-reconcile-sweep",
    triggers: [cron("*/15 * * * *")],
    retries: 2,
  },
  async ({ step }) => {
    const now = new Date().toISOString();
    const submissions = await step.run("load-due-submissions", async () => {
      const admin = supabaseServerRole() as any;
      const { data, error } = await admin
        .from("fiscal_agt_submissions")
        .select("id,status,next_check_at,created_at")
        .in("status", ["prepared", "submitted", "processing", "uncertain"])
        .or(`next_check_at.is.null,next_check_at.lte.${now}`)
        .order("created_at", { ascending: true })
        .limit(50);

      if (error) throw new Error(error.message);
      return data ?? [];
    });

    if (submissions.length === 0) {
      return { ok: true, dispatched: 0 };
    }

    await step.sendEvent(
      "dispatch-due-agt-submissions",
      submissions.map((submission: { id: string }) => ({
        name: "fiscal/agt-submit.requested",
        id: `agt-reconcile-${submission.id}-${now.slice(0, 16)}`,
        data: { submission_id: submission.id },
      }))
    );

    return { ok: true, dispatched: submissions.length };
  }
);
