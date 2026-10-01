import { createHash } from "node:crypto";

import { createClient } from "@supabase/supabase-js";

import { inngest } from "@/inngest/client";
import { buildSaftAoXml } from "@/lib/fiscal/saftAo";
import { SaftXsdValidationError, validateSaftXmlWithXsd } from "@/lib/fiscal/saftXsdValidator";
import type { Database, Json } from "~types/supabase";

type SaftHeaderConfig = {
  productId: string;
  productCompanyTaxId: string;
  productVersion: string;
  taxAccountingBasis: "F";
  softwareCertificateNumber: string;
};

type FiscalExportEvent = {
  export_id: string;
  empresa_id: string;
  periodo_inicio: string;
  periodo_fim: string;
  xsd_version: string;
  requested_by: string;
  request_id: string;
};

type FiscalEmpresaRow = Pick<
  Database["public"]["Tables"]["fiscal_empresas"]["Row"],
  "id" | "nome" | "nif" | "endereco" | "certificado_agt_numero" | "metadata"
>;

type FiscalDocumentoRow = {
  id: string;
  numero: number;
  numero_formatado: string;
  tipo_documento: string;
  invoice_date: string;
  system_entry: string;
  cliente_nome: string;
  cliente_nif: string | null;
  payload: Json | null;
  moeda: string;
  taxa_cambio_aoa: number | string | null;
  payment_mechanism: string | null;
  total_liquido_aoa: number | string;
  total_impostos_aoa: number | string;
  total_bruto_aoa: number | string;
  hash_control: string;
  saft_hash: string | null;
  saft_hash_control: number | null;
  saft_required: boolean;
  status: string;
  serie_id: string;
  documento_origem_id: string | null;
  rectifica_documento_id: string | null;
  created_by: string | null;
};

type FiscalDocumentoEventoRow = {
  documento_id: string;
  tipo_evento: string;
  payload: Json | null;
  created_at: string;
  created_by: string | null;
};

type FiscalDocumentoItemRow = {
  documento_id: string;
  linha_no: number;
  descricao: string;
  product_code: string;
  product_number_code: string | null;
  quantidade: number | string;
  preco_unit: number | string;
  taxa_iva: number | string;
  total_liquido_aoa: number | string;
  total_impostos_aoa: number | string;
  total_bruto_aoa: number | string;
  tax_exemption_code: string | null;
  tax_exemption_reason: string | null;
  tax_profile_code: string | null;
  tax_type: string | null;
  tax_code: string | null;
  tax_country_region: string | null;
  operation_type: string | null;
  unit_of_measure: string | null;
  product_type: string | null;
  unit_price_base: number | string | null;
  settlement_amount: number | string | null;
  total_liquido_moeda: number | string | null;
  total_impostos_moeda: number | string | null;
  total_bruto_moeda: number | string | null;
};

type OrderReference = {
  reference: string;
  origin_invoice_date?: string;
};

type SaftPaymentSourceDocument = {
  lineNo: number;
  sourceDocumentID: {
    OriginatingON: string;
    documentDate?: string | null;
    invoiceDate?: string | null;
  };
  creditAmount: number | string;
};

function parsePaymentReceiptFromPayload(payload: Json | null): {
  sourceDocuments: SaftPaymentSourceDocument[];
} | null {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) return null;
  const paymentReceipt = (payload as Record<string, unknown>)["paymentReceipt"];
  if (!paymentReceipt || typeof paymentReceipt !== "object" || Array.isArray(paymentReceipt)) {
    return null;
  }

  const sources = (paymentReceipt as Record<string, unknown>)["sourceDocuments"];
  if (!Array.isArray(sources)) return null;

  const sourceDocuments = sources.map((source, index) => {
    if (!source || typeof source !== "object" || Array.isArray(source)) {
      throw new Error(`SAFT_SEMANTIC_ERROR: paymentReceipt.sourceDocuments[${index}] inválido.`);
    }
    const record = source as Record<string, unknown>;
    const sourceIdRaw = record["sourceDocumentID"];
    if (!sourceIdRaw || typeof sourceIdRaw !== "object" || Array.isArray(sourceIdRaw)) {
      throw new Error(`SAFT_SEMANTIC_ERROR: sourceDocumentID ausente no RC, linha ${index + 1}.`);
    }
    const sourceId = sourceIdRaw as Record<string, unknown>;
    return {
      lineNo: Number(record["lineNo"]),
      sourceDocumentID: {
        OriginatingON: String(sourceId["OriginatingON"] ?? ""),
        documentDate:
          typeof sourceId["documentDate"] === "string" ? sourceId["documentDate"] : null,
        invoiceDate:
          typeof sourceId["invoiceDate"] === "string" ? sourceId["invoiceDate"] : null,
      },
      creditAmount:
        typeof record["creditAmount"] === "string" || typeof record["creditAmount"] === "number"
          ? record["creditAmount"]
          : "",
    };
  });

  return { sourceDocuments };
}

function resolveSourceBilling(
  origin: string | null | undefined,
  payload: Json | null
): "P" | "I" | "M" {
  const payloadRecord =
    payload && typeof payload === "object" && !Array.isArray(payload)
      ? (payload as Record<string, unknown>)
      : {};
  const metadataRaw = payloadRecord.metadata;
  const metadata =
    metadataRaw && typeof metadataRaw === "object" && !Array.isArray(metadataRaw)
      ? (metadataRaw as Record<string, unknown>)
      : {};
  const explicit = String(metadata.saft_source_billing ?? "")
    .trim()
    .toUpperCase();

  if (explicit === "P" || explicit === "I" || explicit === "M") {
    return explicit;
  }

  const normalized = String(origin ?? "").trim().toLowerCase();
  if (normalized === "manual_recuperado" || normalized === "contingencia") {
    return "M";
  }

  // "integrado" é usado pelo adapter financeiro interno do KLASSE.
  // Integrações externas devem declarar metadata.saft_source_billing = "I".
  return "P";
}
const SAFT_PRODUCT_TYPES = new Set(["P", "S", "O", "E", "I"]);

function parseProductTypesFromPayload(
  payload: Json | null
): Map<number, "P" | "S" | "O" | "E" | "I"> {
  const result = new Map<number, "P" | "S" | "O" | "E" | "I">();
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) return result;
  const itens = (payload as Record<string, unknown>)["itens"];
  if (!Array.isArray(itens)) return result;

  itens.forEach((item, index) => {
    if (!item || typeof item !== "object" || Array.isArray(item)) return;
    const raw = String((item as Record<string, unknown>)["product_type"] ?? "")
      .trim()
      .toUpperCase();
    if (SAFT_PRODUCT_TYPES.has(raw)) {
      result.set(index + 1, raw as "P" | "S" | "O" | "E" | "I");
    }
  });

  return result;
}

type SaftLineMetadata = {
  unitOfMeasure: string | null;
  taxCode: "NOR" | "INT" | "RED" | "ISE" | "OUT" | "NS" | "NA" | null;
  taxCountryRegion: string | null;
};

const SAFT_TAX_CODES = new Set(["NOR", "INT", "RED", "ISE", "OUT", "NS", "NA"]);

function normalizeSaftTaxCode(value: unknown): SaftLineMetadata["taxCode"] {
  const raw = typeof value === "string" ? value.trim().toUpperCase() : "";
  return SAFT_TAX_CODES.has(raw)
    ? (raw as NonNullable<SaftLineMetadata["taxCode"]>)
    : null;
}

function parseLineMetadataFromPayload(payload: Json | null): Map<number, SaftLineMetadata> {
  const result = new Map<number, SaftLineMetadata>();
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) return result;
  const itens = (payload as Record<string, unknown>)["itens"];
  if (!Array.isArray(itens)) return result;

  itens.forEach((item, index) => {
    if (!item || typeof item !== "object" || Array.isArray(item)) return;
    const record = item as Record<string, unknown>;
    const unit = typeof record.unit_of_measure === "string"
      ? record.unit_of_measure.trim()
      : "";
    const rawTaxCode = String(record.tax_code ?? "").trim().toUpperCase();
    const rawRegion = typeof record.tax_country_region === "string"
      ? record.tax_country_region.trim().toUpperCase()
      : "";

    result.set(index + 1, {
      unitOfMeasure: unit || null,
      taxCode: normalizeSaftTaxCode(rawTaxCode),
      taxCountryRegion: rawRegion || null,
    });
  });

  return result;
}

function parseSettlementAmountsFromPayload(
  payload: Json | null
): Map<number, number | string> {
  const result = new Map<number, number | string>();
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) return result;
  const payloadRecord = payload as Record<string, unknown>;
  const itens = payloadRecord["itens"];
  if (!Array.isArray(itens)) return result;

  itens.forEach((item, index) => {
    if (!item || typeof item !== "object" || Array.isArray(item)) return;
    const raw = (item as Record<string, unknown>)["settlement_amount"];
    if (typeof raw !== "number" && typeof raw !== "string") return;
    result.set(index + 1, raw);
  });

  return result;
}

type FiscalSaftExportRow = Pick<
  Database["public"]["Tables"]["fiscal_saft_exports"]["Row"],
  "id" | "empresa_id" | "periodo_inicio" | "periodo_fim" | "arquivo_storage_path" | "xsd_version" | "metadata" | "status"
>;

type ClienteAddressFromPayload = {
  address_detail: string | null;
  city: string | null;
  postal_code: string | null;
  country: string | null;
};

const FISCAL_SAFT_BUCKET = "fiscal-saft";
const AGT_PAYMENT_MECHANISMS = new Set(["NU", "TB", "CC", "MB"]);

function getSupabaseAdmin() {
  const url = (process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").trim();
  const key = (process.env.SUPABASE_SERVICE_ROLE_KEY ?? "").trim();

  if (!url || !key) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY ausente");
  }

  return createClient<Database>(url, key);
}

function parseClienteAddressFromPayload(payload: Json | null): ClienteAddressFromPayload {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return {
      address_detail: null,
      city: null,
      postal_code: null,
      country: null,
    };
  }

  const payloadRecord = payload as Record<string, unknown>;
  const cliente = payloadRecord["cliente"];
  if (!cliente || typeof cliente !== "object" || Array.isArray(cliente)) {
    return {
      address_detail: null,
      city: null,
      postal_code: null,
      country: null,
    };
  }

  const clienteRecord = cliente as Record<string, unknown>;
  const normalize = (value: unknown): string | null => {
    if (typeof value !== "string") return null;
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
  };

  return {
    address_detail: normalize(clienteRecord["address_detail"]),
    city: normalize(clienteRecord["city"]),
    postal_code: normalize(clienteRecord["postal_code"]),
    country: normalize(clienteRecord["country"]),
  };
}

function resolveSaftHeaderConfig(metadata?: Json | null): SaftHeaderConfig {
  const metadataRecord =
    metadata && typeof metadata === "object" && !Array.isArray(metadata)
      ? (metadata as Record<string, unknown>)
      : {};
  const snapshotRaw = metadataRecord.saft_header_config;
  const snapshot =
    snapshotRaw && typeof snapshotRaw === "object" && !Array.isArray(snapshotRaw)
      ? (snapshotRaw as Record<string, unknown>)
      : null;

  const productIdRaw = String(
    snapshot?.productId ?? process.env.SAFT_PRODUCT_ID ?? ""
  ).trim();
  const taxAccountingBasisRaw = String(
    snapshot?.taxAccountingBasis ?? process.env.SAFT_TAX_ACCOUNTING_BASIS ?? "F"
  ).trim().toUpperCase();
  const softwareCertificateNumberRaw = String(
    snapshot?.softwareCertificateNumber ??
      process.env.SAFT_SOFTWARE_CERTIFICATE_NUMBER ??
      "0"
  ).trim();
  const productCompanyTaxIdRaw = String(
    snapshot?.productCompanyTaxId ?? process.env.SAFT_PRODUCT_COMPANY_TAX_ID ?? ""
  ).trim();
  const productVersionRaw = String(
    snapshot?.productVersion ?? process.env.SAFT_PRODUCT_VERSION ?? "1.0.0"
  ).trim();

  if (!productIdRaw || !productIdRaw.includes("/")) {
    throw new Error("SAFT_PRODUCT_ID inválido. Use o formato 'NomeAplicacao/NomeProdutorSoftware'.");
  }

  if (taxAccountingBasisRaw !== "F") {
    throw new Error(
      "SAFT_ACCOUNTING_NOT_SUPPORTED: KLASSE não possui plano de contas e movimentos de dupla entrada; use F para Facturação."
    );
  }

  if (!/^\d+\/AGT\/\d{4}$|^0$/.test(softwareCertificateNumberRaw)) {
    throw new Error(
      "SAFT_SOFTWARE_CERTIFICATE_NUMBER inválido. Use '0' ou NNN/AGT/AAAA."
    );
  }

  if (productCompanyTaxIdRaw.length < 10 || productCompanyTaxIdRaw.length > 20) {
    throw new Error("SAFT_PRODUCT_COMPANY_TAX_ID inválido ou ausente.");
  }

  if (!productVersionRaw || productVersionRaw.length > 30) {
    throw new Error("SAFT_PRODUCT_VERSION inválido.");
  }

  return {
    productId: productIdRaw,
    productCompanyTaxId: productCompanyTaxIdRaw,
    productVersion: productVersionRaw,
    taxAccountingBasis: "F" as const,
    softwareCertificateNumber: softwareCertificateNumberRaw,
  };
}

function resolveSaftSourceId(userId: string | null | undefined) {
  const compact = String(userId ?? "").replace(/-/g, "").trim();
  return compact ? `U${compact.slice(0, 29)}` : "KLASSE-SYSTEM";
}

function parsePaymentMechanism(value: string | null) {
  if (!value) return null;
  const normalized = value.trim().toUpperCase();
  return AGT_PAYMENT_MECHANISMS.has(normalized)
    ? (normalized as "NU" | "TB" | "CC" | "MB")
    : null;
}

function resolveStoragePath({
  exportId,
  empresaId,
  periodoInicio,
  periodoFim,
  currentPath,
}: {
  exportId: string;
  empresaId: string;
  periodoInicio: string;
  periodoFim: string;
  currentPath: string | null;
}) {
  const normalized = currentPath?.trim() ?? "";
  if (normalized.length > 0) return normalized;

  return [
    "fiscal",
    "saft",
    empresaId,
    `${periodoInicio}_${periodoFim}_${exportId}.xml`,
  ].join("/");
}

async function ensureBucket(supabase: ReturnType<typeof getSupabaseAdmin>) {
  const { data: bucket } = await supabase.storage.getBucket(FISCAL_SAFT_BUCKET);
  if (!bucket) {
    await supabase.storage.createBucket(FISCAL_SAFT_BUCKET, { public: false });
  }
}

export const fiscalSaftExport = inngest.createFunction(
  { id: "fiscal-saft-export", triggers: [{ event: "fiscal/saft-export.requested" }] },
  async ({ event, step }) => {
    const data = event.data as FiscalExportEvent;
    const supabase = getSupabaseAdmin();

    const exportRow = await step.run("load-export-row", async () => {
      const { data: row, error } = await supabase
        .from("fiscal_saft_exports")
        .select("id, empresa_id, periodo_inicio, periodo_fim, arquivo_storage_path, xsd_version, metadata, status")
        .eq("id", data.export_id)
        .maybeSingle<FiscalSaftExportRow>();

      if (error) throw new Error(error.message || "Falha ao carregar exportação SAF-T");
      if (!row) throw new Error("Exportação SAF-T não encontrada");
      return row;
    });

    if (exportRow.status === "validated") {
      return {
        ok: true,
        idempotent: true,
        export_id: exportRow.id,
        status: "validated",
      };
    }

    await step.run("set-processing", async () => {
      const metadata = ((exportRow.metadata ?? {}) as Record<string, unknown>);
      const nextMetadata: Json = {
        ...metadata,
        worker: {
          state: "processing",
          started_at: new Date().toISOString(),
          request_id: data.request_id,
        },
      };

      const { error } = await supabase
        .from("fiscal_saft_exports")
        .update({ status: "processing", metadata: nextMetadata })
        .eq("id", data.export_id);

      if (error) throw new Error(error.message || "Falha ao marcar exportação SAF-T como processing");
    });

    try {
      await ensureBucket(supabase);

      const [empresaRes, docsRes] = await Promise.all([
        supabase
          .from("fiscal_empresas")
          .select("id, nome, nif, endereco, certificado_agt_numero, metadata")
          .eq("id", exportRow.empresa_id)
          .maybeSingle<FiscalEmpresaRow>(),
        supabase
          .from("fiscal_documentos")
          .select(
            "id, numero, numero_formatado, tipo_documento, invoice_date, system_entry, cliente_nome, cliente_nif, payload, total_liquido_aoa, total_impostos_aoa, total_bruto_aoa, hash_control, saft_hash, saft_hash_control, saft_required, status, serie_id, documento_origem_id, rectifica_documento_id, created_by"
            + ", moeda, taxa_cambio_aoa, payment_mechanism"
          )
          .eq("empresa_id", exportRow.empresa_id)
          .in("status", ["emitido", "anulado", "rectificado"])
          .gte("invoice_date", exportRow.periodo_inicio)
          .lte("invoice_date", exportRow.periodo_fim)
          .order("invoice_date", { ascending: true })
          .order("numero", { ascending: true })
          .order("id", { ascending: true })
          .returns<FiscalDocumentoRow[]>(),
      ]);

      if (empresaRes.error) throw new Error(empresaRes.error.message || "Falha ao obter empresa fiscal");
      if (!empresaRes.data) throw new Error("Empresa fiscal não encontrada");
      if (docsRes.error) throw new Error(docsRes.error.message || "Falha ao obter documentos fiscais");

      const empresa = empresaRes.data;
      const documentoRows = docsRes.data ?? [];
      const documentoIds = documentoRows.map((doc) => doc.id);

      const itemMap = new Map<string, FiscalDocumentoItemRow[]>();
      if (documentoIds.length > 0) {
        const { data: itens, error: itensError } = await supabase
          .from("fiscal_documento_itens")
          .select(
            "documento_id, linha_no, descricao, quantidade, preco_unit, taxa_iva, total_liquido_aoa, total_impostos_aoa, total_bruto_aoa"
            + ", product_code, product_number_code, tax_exemption_code, tax_exemption_reason"
            + ", tax_profile_code, tax_type, tax_code, tax_country_region, operation_type, unit_of_measure, product_type"
            + ", unit_price_base, settlement_amount, total_liquido_moeda, total_impostos_moeda, total_bruto_moeda"
          )
          .in("documento_id", documentoIds)
          .order("documento_id", { ascending: true })
          .order("linha_no", { ascending: true })
          .returns<FiscalDocumentoItemRow[]>();

        if (itensError) throw new Error(itensError.message || "Falha ao obter itens fiscais");

        for (const item of itens ?? []) {
          const current = itemMap.get(item.documento_id) ?? [];
          current.push(item);
          itemMap.set(item.documento_id, current);
        }
      }

      const cancellationByDocumentId = new Map<
        string,
        { created_at: string; motivo: string | null; created_by: string | null }
      >();
      if (documentoIds.length > 0) {
        const { data: cancellationEvents, error: cancellationEventsError } = await supabase
          .from("fiscal_documentos_eventos")
          .select("documento_id, tipo_evento, payload, created_at, created_by")
          .in("documento_id", documentoIds)
          .eq("tipo_evento", "ANULADO")
          .order("created_at", { ascending: false })
          .returns<FiscalDocumentoEventoRow[]>();

        if (cancellationEventsError) {
          throw new Error(
            cancellationEventsError.message ||
              "Falha ao obter eventos de anulação para SAF-T."
          );
        }

        for (const event of cancellationEvents ?? []) {
          if (cancellationByDocumentId.has(event.documento_id)) continue;
          const payload =
            event.payload && typeof event.payload === "object" && !Array.isArray(event.payload)
              ? (event.payload as Record<string, unknown>)
              : {};
          const motivo =
            typeof payload.motivo === "string" && payload.motivo.trim()
              ? payload.motivo.trim()
              : null;
          cancellationByDocumentId.set(event.documento_id, {
            created_at: event.created_at,
            motivo,
            created_by: event.created_by,
          });
        }
      }

      const serieIds = Array.from(new Set(documentoRows.map((doc) => doc.serie_id)));
      const serieById = new Map<
        string,
        { origem_documento: string; prefixo: string; agt_series_code: string | null }
      >();
      if (serieIds.length > 0) {
        const { data: series, error: seriesError } = await supabase
          .from("fiscal_series")
          .select("id, origem_documento, prefixo, agt_series_code")
          .in("id", serieIds);

        if (seriesError) {
          throw new Error(seriesError.message || "Falha ao obter origem das séries SAF-T.");
        }

        for (const serie of series ?? []) {
          serieById.set(String(serie.id), {
            origem_documento: String(serie.origem_documento ?? "interno"),
            prefixo: String(serie.prefixo ?? ""),
            agt_series_code:
              typeof serie.agt_series_code === "string" && serie.agt_series_code.trim()
                ? serie.agt_series_code.trim()
                : null,
          });
        }
      }

      const headerConfig = resolveSaftHeaderConfig(exportRow.metadata);
      const generatedAtIso = new Date().toISOString();
      const documentoNumeroById = new Map(
        documentoRows.map((doc) => [doc.id, { numero_formatado: doc.numero_formatado, invoice_date: doc.invoice_date }])
      );
      const referencedIds = Array.from(
        new Set(
          documentoRows
            .map((doc) => doc.documento_origem_id ?? doc.rectifica_documento_id)
            .filter((value): value is string => Boolean(value))
        )
      ).filter((id) => !documentoNumeroById.has(id));

      if (referencedIds.length > 0) {
        const { data: referencedDocs, error: referencedDocsError } = await supabase
          .from("fiscal_documentos")
          .select("id, numero_formatado, invoice_date")
          .in("id", referencedIds)
          .eq("empresa_id", exportRow.empresa_id);

        if (referencedDocsError) {
          throw new Error(referencedDocsError.message || "Falha ao obter documentos de referência para SAF-T.");
        }

        for (const ref of referencedDocs ?? []) {
          if (!ref?.id || !ref?.numero_formatado || !ref?.invoice_date) continue;
          documentoNumeroById.set(ref.id, {
            numero_formatado: String(ref.numero_formatado),
            invoice_date: String(ref.invoice_date),
          });
        }
      }

      const empresaMetadata =
        empresa.metadata && typeof empresa.metadata === "object" && !Array.isArray(empresa.metadata)
          ? (empresa.metadata as Record<string, unknown>)
          : {};
      const metadataString = (key: string) => {
        const value = empresaMetadata[key];
        return typeof value === "string" && value.trim() ? value.trim() : null;
      };

      const saftInput = {
        empresa: {
          id: empresa.id,
          nome: empresa.nome,
          nif: empresa.nif,
          endereco: empresa.endereco,
          registoComercial: metadataString("registo_comercial"),
          cidade: metadataString("cidade"),
          provincia: metadataString("provincia"),
          codigoPostal: metadataString("codigo_postal"),
          certificadoAgtNumero: empresa.certificado_agt_numero,
        },
        periodoInicio: exportRow.periodo_inicio,
        periodoFim: exportRow.periodo_fim,
        header: headerConfig,
        generatedAtIso,
        documentos: documentoRows.map((doc) => ({
          ...parseClienteAddressFromPayload(doc.payload),
          ...doc,
          ...(function () {
            const settlements = parseSettlementAmountsFromPayload(doc.payload);
            const productTypes = parseProductTypesFromPayload(doc.payload);
            const lineMetadata = parseLineMetadataFromPayload(doc.payload);
            const fallbackProductType =
              doc.tipo_documento === "GR" || doc.tipo_documento === "GT"
                ? ("P" as const)
                : ("S" as const);
            return {
          itens:
            itemMap.get(doc.id)?.map((item) => {
              const settlementAmount =
                item.settlement_amount ??
                settlements.get(Number(item.linha_no)) ??
                null;
              return {
                ...item,
                product_code: String(item.product_code ?? ""),
                product_number_code: item.product_number_code ? String(item.product_number_code) : null,
                product_type:
                  (item.product_type as "P" | "S" | "O" | "E" | "I" | null) ??
                  productTypes.get(Number(item.linha_no)) ??
                  fallbackProductType,
                unit_of_measure:
                  item.unit_of_measure ??
                  lineMetadata.get(Number(item.linha_no))?.unitOfMeasure ??
                  "UN",
                tax_code:
                  normalizeSaftTaxCode(item.tax_code) ??
                  lineMetadata.get(Number(item.linha_no))?.taxCode ??
                  null,
                tax_country_region:
                  item.tax_country_region ??
                  lineMetadata.get(Number(item.linha_no))?.taxCountryRegion ??
                  "AO",
                quantidade: item.quantidade,
                preco_unit: item.preco_unit,
                taxa_iva: item.taxa_iva,
                total_liquido_aoa: item.total_liquido_aoa,
                total_impostos_aoa: item.total_impostos_aoa,
                total_bruto_aoa: item.total_bruto_aoa,
                settlement_amount: settlementAmount,
                tax_exemption_code: item.tax_exemption_code,
                tax_exemption_reason: item.tax_exemption_reason,
              };
            }) ?? [],
            };
          })(),
          saft_hash: doc.saft_hash,
          saft_hash_control:
            doc.saft_hash_control == null ? null : Number(doc.saft_hash_control),
          saft_required: Boolean(doc.saft_required),
          status_date:
            cancellationByDocumentId.get(doc.id)?.created_at ?? null,
          status_reason:
            cancellationByDocumentId.get(doc.id)?.motivo ?? null,
          source_id: resolveSaftSourceId(doc.created_by),
          status_source_id: resolveSaftSourceId(
            cancellationByDocumentId.get(doc.id)?.created_by ?? doc.created_by
          ),
          source_billing: resolveSourceBilling(
            serieById.get(doc.serie_id)?.origem_documento,
            doc.payload
          ),
          series_sort_key:
            serieById.get(doc.serie_id)?.agt_series_code ??
            serieById.get(doc.serie_id)?.prefixo ??
            doc.serie_id,
          payment_receipt: parsePaymentReceiptFromPayload(doc.payload),
          order_references: (() => {
            const refs: OrderReference[] = [];
            const sourceId = doc.documento_origem_id ?? doc.rectifica_documento_id;
            if (!sourceId) return refs;
            const source = documentoNumeroById.get(sourceId);
            if (!source) return refs;
            refs.push({
              reference: source.numero_formatado,
              origin_invoice_date: source.invoice_date,
            });
            return refs;
          })(),
          moeda: String(doc.moeda ?? "AOA").toUpperCase(),
          taxa_cambio_aoa: doc.taxa_cambio_aoa,
          payment_mechanism: parsePaymentMechanism(doc.payment_mechanism),
          total_liquido_aoa: doc.total_liquido_aoa,
          total_impostos_aoa: doc.total_impostos_aoa,
          total_bruto_aoa: doc.total_bruto_aoa,
        })),
      };

      const { xml, summary } = buildSaftAoXml(saftInput);

      const xsdValidation = await validateSaftXmlWithXsd({
        xml,
        xsdVersion: exportRow.xsd_version,
      });

      const checksumSha256 = createHash("sha256").update(xml).digest("hex");

      const storagePath = resolveStoragePath({
        exportId: exportRow.id,
        empresaId: exportRow.empresa_id,
        periodoInicio: exportRow.periodo_inicio,
        periodoFim: exportRow.periodo_fim,
        currentPath: exportRow.arquivo_storage_path,
      });

      const { error: uploadError } = await supabase.storage
        .from(FISCAL_SAFT_BUCKET)
        .upload(storagePath, xml, {
          upsert: true,
          contentType: "application/xml",
        });

      if (uploadError) throw new Error(uploadError.message || "Falha ao gravar XML SAF-T no storage");

      const baseMetadata = (exportRow.metadata ?? {}) as Record<string, unknown>;
      const nextMetadata: Json = {
        ...baseMetadata,
        generated_at: generatedAtIso,
        summary,
        semantic_validation: {
          ok: true,
          contract: "SAFT_AO_FACTURACAO",
          tax_accounting_basis: "F",
          rules_version: "BILL-008-2026-09-27",
          reconciled_totals: true,
          source_documents_ordered: true,
          payment_sources_required: true,
          software_validation_number: headerConfig.softwareCertificateNumber,
          hash_mode:
            headerConfig.softwareCertificateNumber === "0"
              ? "UNVALIDATED_ZERO"
              : "RSA_1024_SHA1_CHAIN",
        },
        xsd_validation: xsdValidation,
        worker: {
          state: "completed",
          finished_at: new Date().toISOString(),
        },
      };

      const { error: updateError } = await supabase
        .from("fiscal_saft_exports")
        .update({
          arquivo_storage_path: storagePath,
          checksum_sha256: checksumSha256,
          status: "validated",
          metadata: nextMetadata,
        })
        .eq("id", exportRow.id);

      if (updateError) throw new Error(updateError.message || "Falha ao finalizar exportação SAF-T");

      if (documentoRows.length > 0) {
        const eventPayload: Json = {
          export_id: exportRow.id,
          periodo_inicio: exportRow.periodo_inicio,
          periodo_fim: exportRow.periodo_fim,
          checksum_sha256: checksumSha256,
        };

        const events: Database["public"]["Tables"]["fiscal_documentos_eventos"]["Insert"][] =
          documentoRows.map((doc) => ({
            empresa_id: exportRow.empresa_id,
            documento_id: doc.id,
            tipo_evento: "SAFT_EXPORTADO",
            payload: eventPayload,
            created_by: data.requested_by,
          }));

        await supabase.from("fiscal_documentos_eventos").insert(events);
      }

      return {
        ok: true,
        export_id: exportRow.id,
        documentos_total: documentoRows.length,
      };
    } catch (error) {
      let xsdPayload: Record<string, unknown> | null = null;
      let message = error instanceof Error ? error.message : "Erro interno ao processar exportação SAF-T(AO).";

      if (error instanceof SaftXsdValidationError) {
        message = error.message;
        xsdPayload = {
          code: error.code,
          validator: error.validator,
          xsdVersion: error.xsdVersion,
          xsdPath: error.xsdPath,
          validatedAt: error.validatedAt,
          output: error.output,
          failures: error.failures,
        };
      }

      const baseMetadata = (exportRow.metadata ?? {}) as Record<string, unknown>;
      const failedMetadata = {
        ...baseMetadata,
        worker: {
          state: "failed",
          failed_at: new Date().toISOString(),
          error: message,
        },
        ...(xsdPayload ? { xsd_validation: xsdPayload } : {}),
      } as unknown as Json;

      await supabase
        .from("fiscal_saft_exports")
        .update({ status: "failed", metadata: failedMetadata, checksum_sha256: "failed" })
        .eq("id", exportRow.id);

      throw error;
    }
  }
);
