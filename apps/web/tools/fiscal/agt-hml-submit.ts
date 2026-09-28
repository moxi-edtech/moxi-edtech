import { setTimeout as sleep } from "node:timers/promises";

import {
  AgtHttpError,
  getAgtInvoiceStatus,
  registerAgtInvoices,
} from "../../src/lib/fiscal/agtInvoice";
import { resolveAgtConfig } from "../../src/lib/fiscal/agtConfig";
import { assertAgtHomologationEnvironment } from "../../src/lib/fiscal/agtContract";
import { buildAgtPreparedDocument } from "../../src/lib/fiscal/mapper";
import { supabaseServerRole } from "../../src/lib/supabaseServerRole";

const ACK = "SUBMIT_REAL_HML_DOCUMENT";

function requiredEnv(name: string) {
  const value = process.env[name]?.trim() ?? "";
  if (!value) throw new Error(`AGT_HML_PROBE_CONFIG_MISSING:${name}`);
  return value;
}

function assertUuid(value: string) {
  if (
    !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      value,
    )
  ) {
    throw new Error("AGT_HML_PROBE_SUBMISSION_UUID_INVALID");
  }
}

async function main() {
  if (process.env.FISCAL_AGT_HML_PROBE_ACK?.trim() !== ACK) {
    throw new Error("AGT_HML_PROBE_ACK_REQUIRED");
  }

  const cfg = resolveAgtConfig();
  assertAgtHomologationEnvironment({
    environment: cfg.environment,
    baseUrl: cfg.baseUrl,
  });

  const documentId = requiredEnv("FISCAL_AGT_HML_DOCUMENT_ID");
  const submissionUuid = requiredEnv("FISCAL_AGT_HML_SUBMISSION_UUID");
  const submissionTimeStamp = requiredEnv(
    "FISCAL_AGT_HML_SUBMISSION_TIMESTAMP",
  );
  assertUuid(submissionUuid);

  if (Number.isNaN(Date.parse(submissionTimeStamp))) {
    throw new Error("AGT_HML_PROBE_SUBMISSION_TIMESTAMP_INVALID");
  }

  const admin = supabaseServerRole() as any;

  const { data: document, error: documentError } = await admin
    .from("fiscal_documentos")
    .select(
      "id,empresa_id,tipo_documento,numero_formatado,invoice_date,system_entry,cliente_nif,cliente_nome,moeda,taxa_cambio_aoa,total_liquido_aoa,total_impostos_aoa,total_bruto_aoa,documento_origem_id,rectifica_documento_id,agt_document_status,agt_rejected_document_id,agt_rejected_document_no,reference_reason,contingency_indicator,payload,key_version,status",
    )
    .eq("id", documentId)
    .single();

  if (documentError || !document) {
    throw new Error(
      `AGT_HML_PROBE_DOCUMENT_NOT_FOUND:${documentError?.message ?? ""}`,
    );
  }

  if (!["FT", "FR"].includes(String(document.tipo_documento))) {
    throw new Error("AGT_HML_PROBE_BASELINE_TYPE_MUST_BE_FT_OR_FR");
  }

  if (document.status !== "emitido") {
    throw new Error("AGT_HML_PROBE_DOCUMENT_NOT_EMITIDO");
  }

  const [
    { data: items, error: itemsError },
    { data: company, error: companyError },
    { data: key, error: keyError },
  ] = await Promise.all([
    admin
      .from("fiscal_documento_itens")
      .select(
        "linha_no,descricao,quantidade,preco_unit,taxa_iva,total_liquido_aoa,total_impostos_aoa,tax_exemption_code,tax_exemption_reason,product_code,product_number_code,tax_profile_code,tax_profile_version,tax_type,tax_code,tax_country_region,operation_type,unit_of_measure,product_type,unit_price_base,settlement_amount,total_liquido_moeda,total_impostos_moeda,total_bruto_moeda",
      )
      .eq("documento_id", document.id)
      .order("linha_no", { ascending: true }),
    admin
      .from("fiscal_empresas")
      .select("id,nif,certificado_agt_numero")
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

  if (itemsError || !Array.isArray(items) || items.length === 0) {
    throw new Error(
      `AGT_HML_PROBE_ITEMS_INVALID:${itemsError?.message ?? ""}`,
    );
  }
  if (companyError || !company?.nif) {
    throw new Error(
      `AGT_HML_PROBE_COMPANY_INVALID:${companyError?.message ?? ""}`,
    );
  }
  if (!company.certificado_agt_numero?.trim()) {
    throw new Error("AGT_HML_PROBE_CERTIFICATE_BINDING_MISSING");
  }
  if (company.certificado_agt_numero.trim() !== cfg.softwareValidationNumber) {
    throw new Error("AGT_HML_PROBE_CERTIFICATE_BINDING_MISMATCH");
  }
  if (keyError || !key?.private_key_ref) {
    throw new Error(
      `AGT_HML_PROBE_TAXPAYER_KEY_MISSING:${keyError?.message ?? ""}`,
    );
  }

  const prepared = buildAgtPreparedDocument({
    document,
    items,
    taxRegistrationNumber: company.nif,
  });

  process.stdout.write(
    `${JSON.stringify({
      phase: "prepared",
      environment: cfg.environment,
      host: new URL(cfg.baseUrl).hostname,
      softwareInfoMode: cfg.softwareInfoMode,
      submissionUuid,
      submissionTimeStamp,
      documentNo: prepared.document.documentNo,
      documentType: prepared.document.documentType,
      networkRequestSent: false,
    })}\n`,
  );

  let register;
  try {
    register = await registerAgtInvoices({
      submissionUuid,
      submissionTimeStamp,
      taxRegistrationNumber: company.nif,
      taxpayerPrivateKeyRef: key.private_key_ref,
      expectedSoftwareValidationNumber: company.certificado_agt_numero,
      softwareInfoMode: cfg.softwareInfoMode,
      documents: [prepared],
    });
  } catch (error) {
    if (error instanceof AgtHttpError) {
      process.stderr.write(
        `${JSON.stringify({
          phase: "register",
          ok: false,
          submissionUuid,
          submissionTimeStamp,
          softwareInfoMode: cfg.softwareInfoMode,
          httpStatus: error.httpStatus,
          response: error.payload,
          networkRequestSent: true,
          retryRule:
            "Preserve the same submission UUID and timestamp until the outcome is resolved.",
        })}\n`,
      );
    }
    throw error;
  }

  process.stdout.write(
    `${JSON.stringify({
      phase: "register",
      ok: true,
      submissionUuid,
      submissionTimeStamp,
      softwareInfoMode: cfg.softwareInfoMode,
      requestID: register.requestID,
      errorList: register.errorList,
      networkRequestSent: true,
    })}\n`,
  );

  const pollDelayMsRaw =
    process.env.FISCAL_AGT_HML_POLL_DELAY_MS?.trim() || "30000";
  const pollDelayMs = Number.parseInt(pollDelayMsRaw, 10);
  if (
    !Number.isSafeInteger(pollDelayMs) ||
    pollDelayMs < 5000 ||
    pollDelayMs > 300000
  ) {
    throw new Error("AGT_HML_PROBE_POLL_DELAY_INVALID");
  }

  await sleep(pollDelayMs);

  try {
    const status = await getAgtInvoiceStatus({
      requestID: register.requestID,
      taxRegistrationNumber: company.nif,
      taxpayerPrivateKeyRef: key.private_key_ref,
      expectedSoftwareValidationNumber: company.certificado_agt_numero,
      softwareInfoMode: cfg.softwareInfoMode,
    });

    process.stdout.write(
      `${JSON.stringify({
        phase: "status",
        ok: true,
        requestID: status.requestID,
        resultCode: status.resultCode,
        documentStatusList: status.documentStatusList ?? [],
        requestErrorList: status.requestErrorList ?? [],
        successRequestID: status.successRequestID ?? null,
      })}\n`,
    );
  } catch (error) {
    if (error instanceof AgtHttpError && [422, 429].includes(error.httpStatus)) {
      process.stdout.write(
        `${JSON.stringify({
          phase: "status",
          ok: true,
          transient: true,
          requestID: register.requestID,
          httpStatus: error.httpStatus,
          response: error.payload,
        })}\n`,
      );
      return;
    }
    throw error;
  }
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  process.stderr.write(
    `${JSON.stringify({
      ok: false,
      error: message,
    })}\n`,
  );
  process.exitCode = 1;
});
