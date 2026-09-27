import type { AgtPreparedDocument, AgtInvoiceDocument } from "@/lib/fiscal/agtInvoice";
import {
  addExact,
  cmpExact,
  equalRounded,
  exactToJsonNumber,
  mulExact,
  parseExactDecimal,
  roundExact,
  subExact,
  type DecimalInput,
  type ExactDecimal,
} from "@/lib/fiscal/decimal";

export type FiscalDocumentRow = {
  id: string;
  empresa_id: string;
  tipo_documento: string;
  numero_formatado: string;
  invoice_date: string;
  system_entry: string;
  cliente_nif: string | null;
  cliente_nome: string;
  moeda: string;
  taxa_cambio_aoa: number | string | null;
  total_liquido_aoa: number | string;
  total_impostos_aoa: number | string;
  total_bruto_aoa: number | string;
  documento_origem_id: string | null;
  rectifica_documento_id: string | null;
  agt_document_status: string;
  agt_rejected_document_id: string | null;
  agt_rejected_document_no: string | null;
  reference_reason: string | null;
  contingency_indicator: string;
  payload: Record<string, unknown>;
};

export type FiscalItemRow = {
  linha_no: number;
  descricao: string;
  quantidade: number | string;
  preco_unit: number | string;
  taxa_iva: number | string;
  total_liquido_aoa: number | string;
  total_impostos_aoa: number | string;
  tax_exemption_code: string | null;
  tax_exemption_reason?: string | null;
  product_code: string | null;
  product_number_code: string | null;
  tax_profile_code?: string | null;
  tax_profile_version?: number | string | null;
  tax_type?: string | null;
  tax_code?: string | null;
  tax_country_region?: string | null;
  operation_type?: string | null;
  unit_of_measure?: string | null;
  product_type?: string | null;
  unit_price_base?: number | string | null;
  settlement_amount?: number | string | null;
  total_liquido_moeda?: number | string | null;
  total_impostos_moeda?: number | string | null;
  total_bruto_moeda?: number | string | null;
};

export type OriginDocumentRow = {
  numero_formatado: string;
  invoice_date: string;
};

const LINE_DOCUMENT_TYPES = new Set(["FT", "FR", "FG", "GF", "NC", "ND"]);
const RECEIPT_DOCUMENT_TYPES = new Set(["RC", "RG", "AR"]);

export class AgtMappingError extends Error {
  constructor(public readonly code: string, message: string) {
    super(message);
    this.name = "AgtMappingError";
  }
}

function exact(
  value: number | string | null | undefined,
  field: string
): ExactDecimal {
  if (value === null || value === undefined) {
    throw new AgtMappingError("AGT_MAPPING_NUMBER_INVALID", `${field} inválido`);
  }
  try {
    return parseExactDecimal(value as DecimalInput, field);
  } catch {
    throw new AgtMappingError("AGT_MAPPING_NUMBER_INVALID", `${field} inválido`);
  }
}

function jsonExact(value: ExactDecimal, fixedScale?: number) {
  return exactToJsonNumber(value, fixedScale);
}

function jsonDecimal(
  value: number | string | null | undefined,
  field: string,
  fixedScale?: number
) {
  return jsonExact(exact(value, field), fixedScale);
}

function integerValue(value: unknown, field: string) {
  const raw =
    typeof value === "number"
      ? value.toString()
      : typeof value === "string"
        ? value.trim()
        : "";
  if (!/^\d+$/.test(raw)) {
    throw new AgtMappingError("AGT_MAPPING_INTEGER_INVALID", `${field} inválido`);
  }
  const parsed = JSON.parse(raw) as unknown;
  if (typeof parsed !== "number" || !Number.isSafeInteger(parsed)) {
    throw new AgtMappingError("AGT_MAPPING_INTEGER_INVALID", `${field} inválido`);
  }
  return parsed;
}

const ZERO = parseExactDecimal("0");

function objectValue(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function textValue(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function resolveCustomerCountry(doc: FiscalDocumentRow) {
  const cliente = objectValue(doc.payload?.cliente);
  const raw = textValue(cliente.country).toUpperCase();
  if (/^[A-Z]{2}$/.test(raw)) return raw;
  if ((doc.cliente_nif ?? "") === "999999999") return "AO";
  throw new AgtMappingError(
    "AGT_MAPPING_CUSTOMER_COUNTRY_REQUIRED",
    "customerCountry ISO 3166-1 alpha-2 é obrigatório para cliente identificado"
  );
}

export function buildAgtPreparedDocument(input: {
  document: FiscalDocumentRow;
  items: FiscalItemRow[];
  taxRegistrationNumber: string;
  originDocument?: OriginDocumentRow | null;
}): AgtPreparedDocument {
  const doc = input.document;
  const payload = objectValue(doc.payload);
  const metadata = objectValue(payload.metadata);
  const withholdingCandidates = [
    payload.withholdingTaxList,
    payload.withholding_tax_list,
    metadata.withholdingTaxList,
    metadata.withholding_tax_list,
  ];
  const hasUnsupportedWithholding = withholdingCandidates.some(
    (value) =>
      value !== undefined &&
      value !== null &&
      !(Array.isArray(value) && value.length === 0)
  );
  if (hasUnsupportedWithholding) {
    throw new AgtMappingError(
      "AGT_MAPPING_WITHHOLDING_UNSUPPORTED",
      "Retenções/cativações existem no contrato AGT, mas o motor fiscal KLASSE ainda não as calcula; submissão bloqueada para evitar omissão silenciosa."
    );
  }

  const customerCountry = resolveCustomerCountry(doc);
  const customerTaxID = (doc.cliente_nif ?? "").trim() || "999999999";
  const documentStatusRaw = textValue(doc.agt_document_status).toUpperCase();
  if (!["N", "C"].includes(documentStatusRaw)) {
    throw new AgtMappingError(
      "AGT_MAPPING_DOCUMENT_STATUS_INVALID",
      `documentStatus canónico inválido: ${documentStatusRaw || "(vazio)"}`
    );
  }
  const documentStatus = documentStatusRaw as "N" | "C";
  const rejectedDocumentNo = textValue(doc.agt_rejected_document_no);
  const contingencyIndicator = textValue(doc.contingency_indicator).toUpperCase();

  if (!["N", "C"].includes(contingencyIndicator)) {
    throw new AgtMappingError(
      "AGT_MAPPING_CONTINGENCY_INVALID",
      `contingency_indicator canónico inválido: ${contingencyIndicator || "(vazio)"}`
    );
  }

  if (documentStatus === "C") {
    if (!doc.agt_rejected_document_id || !rejectedDocumentNo) {
      throw new AgtMappingError(
        "AGT_MAPPING_REJECTED_DOCUMENT_REQUIRED",
        "Documento de correcção AGT exige documento rejeitado canónico"
      );
    }
    if (rejectedDocumentNo === doc.numero_formatado) {
      throw new AgtMappingError(
        "AGT_MAPPING_REJECTED_DOCUMENT_NUMBER_REUSED",
        "Correcção de documento rejeitado deve usar novo número fiscal"
      );
    }
  } else if (doc.agt_rejected_document_id || rejectedDocumentNo) {
    throw new AgtMappingError(
      "AGT_MAPPING_REJECTED_DOCUMENT_UNEXPECTED",
      "Documento normal não pode transportar referência a documento rejeitado"
    );
  }

  if (RECEIPT_DOCUMENT_TYPES.has(doc.tipo_documento)) {
    if (doc.tipo_documento !== "RC") {
      throw new AgtMappingError(
        "AGT_MAPPING_RECEIPT_TYPE_UNSUPPORTED",
        `Tipo de recibo ${doc.tipo_documento} ainda não é emitido pelo KLASSE`
      );
    }

    if (input.items.length !== 0) {
      throw new AgtMappingError(
        "AGT_MAPPING_RECEIPT_LINES_FORBIDDEN",
        "RC não pode conter lines no contrato AGT actual"
      );
    }

    const receipt = objectValue(payload.paymentReceipt);
    const rawSources = Array.isArray(receipt.sourceDocuments)
      ? receipt.sourceDocuments
      : [];

    if (rawSources.length === 0) {
      throw new AgtMappingError(
        "AGT_MAPPING_RECEIPT_SOURCES_REQUIRED",
        "RC exige paymentReceipt.sourceDocuments"
      );
    }

    const sourceDocuments = rawSources.map((raw, index) => {
      const source = objectValue(raw);
      const sourceDocumentID = objectValue(source.sourceDocumentID);
      const lineNo = integerValue(source.lineNo, "lineNo");
      const originatingON = textValue(sourceDocumentID.OriginatingON);
      const documentDate = textValue(sourceDocumentID.documentDate);
      const creditAmount =
        source.creditAmount === undefined
          ? null
          : exact(source.creditAmount as number | string, "creditAmount");
      const debitAmount =
        source.debitAmount === undefined
          ? null
          : exact(source.debitAmount as number | string, "debitAmount");

      if (!Number.isInteger(lineNo) || lineNo !== index + 1) {
        throw new AgtMappingError(
          "AGT_MAPPING_RECEIPT_LINE_SEQUENCE_INVALID",
          "sourceDocuments deve iniciar em 1 e ser sequencial"
        );
      }
      if (!originatingON || originatingON.length > 60) {
        throw new AgtMappingError(
          "AGT_MAPPING_RECEIPT_ORIGIN_INVALID",
          "OriginatingON ausente ou maior que 60 caracteres"
        );
      }
      if (!/^\d{4}-\d{2}-\d{2}$/.test(documentDate)) {
        throw new AgtMappingError(
          "AGT_MAPPING_RECEIPT_ORIGIN_DATE_INVALID",
          "documentDate do documento origem é obrigatório"
        );
      }
      if ((creditAmount === null) === (debitAmount === null)) {
        throw new AgtMappingError(
          "AGT_MAPPING_RECEIPT_AMOUNT_SHAPE_INVALID",
          "sourceDocument deve conter exactamente um de creditAmount/debitAmount"
        );
      }

      return {
        lineNo,
        sourceDocumentID: {
          OriginatingON: originatingON,
          documentDate,
        },
        ...(creditAmount !== null ? { creditAmount: jsonExact(creditAmount, 2) } : {}),
        ...(debitAmount !== null ? { debitAmount: jsonExact(debitAmount, 2) } : {}),
      };
    });

    const rcTax = exact(doc.total_impostos_aoa, "total_impostos_aoa");
    const rcNet = exact(doc.total_liquido_aoa, "total_liquido_aoa");
    const rcGross = exact(doc.total_bruto_aoa, "total_bruto_aoa");

    if (!equalRounded(addExact(rcNet, rcTax), rcGross, 2)) {
      throw new AgtMappingError(
        "AGT_MAPPING_RECEIPT_TOTAL_MISMATCH",
        "Totais imutáveis do RC não fecham"
      );
    }

    const documentTotals: AgtInvoiceDocument["documentTotals"] = {
      taxPayable: jsonExact(rcTax, 2),
      netTotal: jsonExact(rcNet, 2),
      grossTotal: jsonExact(rcGross, 2),
    };

    const document: AgtInvoiceDocument = {
      documentNo: doc.numero_formatado,
      documentStatus,
      documentDate: doc.invoice_date,
      documentType: doc.tipo_documento,
      systemEntryDate: new Date(doc.system_entry).toISOString(),
      customerTaxID,
      customerCountry,
      companyName: doc.cliente_nome.slice(0, 200),
      paymentReceipt: { sourceDocuments },
      documentTotals,
    };

    if (documentStatus === "C") {
      document.rejectedDocumentNo = rejectedDocumentNo;
    }

    const signaturePayload = {
      documentNo: document.documentNo,
      taxRegistrationNumber: input.taxRegistrationNumber,
      documentType: document.documentType,
      documentDate: document.documentDate,
      customerTaxID: document.customerTaxID,
      customerCountry: document.customerCountry,
      companyName: document.companyName,
      documentTotals: document.documentTotals,
    };

    return { document, signaturePayload };
  }

  if (!LINE_DOCUMENT_TYPES.has(doc.tipo_documento)) {
    throw new AgtMappingError(
      "AGT_MAPPING_DOCUMENT_TYPE_UNSUPPORTED",
      `Tipo ${doc.tipo_documento} não é suportado pelo mapper AGT`
    );
  }

  if (input.items.length === 0) {
    throw new AgtMappingError("AGT_MAPPING_LINES_REQUIRED", "Documento sem linhas fiscais");
  }

  let netTotalExact = ZERO;
  let taxPayableExact = ZERO;
  const lines = input.items
    .slice()
    .sort((a, b) => a.linha_no - b.linha_no)
    .map((item, index) => {
      if (item.linha_no !== index + 1) {
        throw new AgtMappingError(
          "AGT_MAPPING_LINE_SEQUENCE_INVALID",
          "linhas fiscais fora de sequência"
        );
      }

      if (!item.tax_profile_code) {
        throw new AgtMappingError(
          "AGT_MAPPING_TAX_PROFILE_REQUIRED",
          `Linha ${item.linha_no} não possui tax_profile_code canónico.`
        );
      }

      if (item.tax_profile_version === null || item.tax_profile_version === undefined) {
        throw new AgtMappingError(
          "AGT_MAPPING_TAX_PROFILE_VERSION_REQUIRED",
          `Linha ${item.linha_no} não possui tax_profile_version canónico.`
        );
      }
      const taxProfileVersion = integerValue(
        item.tax_profile_version,
        "tax_profile_version"
      );
      if (taxProfileVersion <= 0) {
        throw new AgtMappingError(
          "AGT_MAPPING_TAX_PROFILE_VERSION_REQUIRED",
          `Linha ${item.linha_no} não possui tax_profile_version canónico.`
        );
      }

      const operationType = (item.operation_type ?? "").trim().toUpperCase();
      if (!["SE","SS","STP","SR","SIF","SHS","ST","SG","TB","AS","QT","RD"].includes(operationType)) {
        throw new AgtMappingError(
          "AGT_MAPPING_OPERATION_TYPE_INVALID",
          `operationType inválido: ${operationType || "(vazio)"}`
        );
      }

      const unitOfMeasure = (item.unit_of_measure ?? "").trim();
      if (!unitOfMeasure || unitOfMeasure.length > 20) {
        throw new AgtMappingError(
          "AGT_MAPPING_UNIT_INVALID",
          "unitOfMeasure ausente ou maior que 20 caracteres"
        );
      }

      const productCode = (item.product_code ?? item.product_number_code ?? "").trim();
      if (!productCode || productCode.length > 60) {
        throw new AgtMappingError(
          "AGT_MAPPING_PRODUCT_CODE_INVALID",
          "productCode ausente ou maior que 60"
        );
      }
      if (!item.descricao || item.descricao.length > 200) {
        throw new AgtMappingError(
          "AGT_MAPPING_DESCRIPTION_INVALID",
          "productDescription ausente ou maior que 200"
        );
      }

      const quantityExact = exact(item.quantidade, "quantity");
      const unitPriceExact = exact(item.preco_unit, "unitPrice");
      const unitPriceBaseExact = exact(item.unit_price_base, "unitPriceBase");
      const settlementExact = exact(item.settlement_amount ?? 0, "settlementAmount");
      const rateExact = exact(item.taxa_iva, "taxPercentage");
      const lineNetExact = exact(item.total_liquido_moeda, "total_liquido_moeda");
      const taxContributionExact = exact(
        item.total_impostos_moeda,
        "total_impostos_moeda"
      );
      const lineGrossExact = exact(item.total_bruto_moeda, "total_bruto_moeda");

      if (
        cmpExact(quantityExact, ZERO) <= 0 ||
        cmpExact(unitPriceExact, ZERO) < 0 ||
        cmpExact(unitPriceBaseExact, unitPriceExact) < 0 ||
        cmpExact(settlementExact, ZERO) < 0
      ) {
        throw new AgtMappingError(
          "AGT_MAPPING_CANONICAL_LINE_INVALID",
          "Linha fiscal canónica contém quantidade/preço/desconto inválido"
        );
      }

      const expectedSettlement = roundExact(
        mulExact(quantityExact, subExact(unitPriceBaseExact, unitPriceExact)),
        2
      );
      if (!equalRounded(expectedSettlement, settlementExact, 2)) {
        throw new AgtMappingError(
          "AGT_MAPPING_SETTLEMENT_MISMATCH",
          "settlementAmount diverge de quantity × (unitPriceBase - unitPrice)"
        );
      }

      if (!equalRounded(addExact(lineNetExact, taxContributionExact), lineGrossExact, 2)) {
        throw new AgtMappingError(
          "AGT_MAPPING_LINE_TOTAL_MISMATCH",
          "Totais canónicos da linha não fecham"
        );
      }

      const quantity = jsonExact(quantityExact);
      const unitPrice = jsonExact(unitPriceExact);
      const unitPriceBase = jsonExact(unitPriceBaseExact);
      const settlementAmount = jsonExact(settlementExact);
      const rate = jsonExact(rateExact);
      const lineNet = jsonExact(lineNetExact, 2);
      const taxContribution = jsonExact(taxContributionExact, 2);

      const taxType = (item.tax_type ?? "").trim().toUpperCase();
      if (!["IVA","IS","IEC","CEOC","NS"].includes(taxType)) {
        throw new AgtMappingError(
          "AGT_MAPPING_TAX_TYPE_INVALID",
          `taxType inválido: ${taxType || "(vazio)"}`
        );
      }

      const taxCode = (item.tax_code ?? "").trim().toUpperCase();
      const taxCountryRegion = (item.tax_country_region ?? "").trim().toUpperCase();
      if (!/^(?:[A-Z]{2}|AO-CAB)$/.test(taxCountryRegion)) {
        throw new AgtMappingError(
          "AGT_MAPPING_TAX_REGION_INVALID",
          `taxCountryRegion inválido: ${taxCountryRegion}`
        );
      }

      const tax: Record<string, unknown> = {
        taxType,
        taxCountryRegion,
        ...(taxCode ? { taxCode } : {}),
        taxPercentage: rate,
        taxContribution,
      };

      if (taxCode === "ISE" || taxType === "NS") {
        const exemption = (item.tax_exemption_code ?? "").trim();
        if (!/^.{3}$/.test(exemption)) {
          throw new AgtMappingError(
            "AGT_MAPPING_EXEMPTION_CODE_INVALID",
            "taxExemptionCode deve ter exactamente 3 caracteres para isenção/não sujeição"
          );
        }
        tax.taxExemptionCode = exemption;
      } else if (item.tax_exemption_code) {
        throw new AgtMappingError(
          "AGT_MAPPING_EXEMPTION_UNEXPECTED",
          "Linha tributável não pode transportar taxExemptionCode"
        );
      }

      netTotalExact = addExact(netTotalExact, lineNetExact);
      taxPayableExact = addExact(taxPayableExact, taxContributionExact);

      const line: Record<string, unknown> = {
        lineNumber: item.linha_no,
        operationType,
        productCode,
        productDescription: item.descricao,
        quantity,
        unitOfMeasure,
        unitPriceBase,
        unitPrice,
        taxes: [tax],
        settlementAmount,
      };

      if (doc.tipo_documento === "NC") {
        line.debitAmount = lineNet;
        if (!input.originDocument) {
          throw new AgtMappingError(
            "AGT_MAPPING_REFERENCE_REQUIRED",
            "NC exige documento fiscal de referência"
          );
        }
        line.referenceInfo = {
          reference: input.originDocument.numero_formatado,
          ...(doc.reference_reason?.trim()
            ? { reason: doc.reference_reason.trim() }
            : {}),
        };
      } else {
        line.creditAmount = lineNet;
        if (doc.tipo_documento === "ND") {
          if (!input.originDocument) {
            throw new AgtMappingError(
              "AGT_MAPPING_REFERENCE_REQUIRED",
              "ND emitida pelo KLASSE exige documento fiscal de referência"
            );
          }
          line.referenceInfo = {
            reference: input.originDocument.numero_formatado,
            ...(doc.reference_reason?.trim()
              ? { reason: doc.reference_reason.trim() }
              : {}),
          };
        }
      }

      if (doc.tipo_documento === "FG" || doc.tipo_documento === "GF") {
        const operationDate = textValue(metadata.operation_date);
        if (!/^\d{4}-\d{2}-\d{2}$/.test(operationDate)) {
          throw new AgtMappingError(
            "AGT_MAPPING_OPERATION_DATE_REQUIRED",
            `${doc.tipo_documento} exige metadata.operation_date no formato YYYY-MM-DD`
          );
        }
        line.operationDate = operationDate;
      }

      return line;
    });
  const netTotalRounded = roundExact(netTotalExact, 2);
  const taxPayableRounded = roundExact(taxPayableExact, 2);
  const grossTotalRounded = roundExact(
    addExact(netTotalRounded, taxPayableRounded),
    2
  );
  const documentTotals: AgtInvoiceDocument["documentTotals"] = {
    taxPayable: jsonExact(taxPayableRounded, 2),
    netTotal: jsonExact(netTotalRounded, 2),
    grossTotal: jsonExact(grossTotalRounded, 2),
  };
  const currency = doc.moeda.toUpperCase();
  if (currency !== "AOA") {
    const exchangeRateExact = exact(doc.taxa_cambio_aoa, "exchangeRate");
    if (cmpExact(exchangeRateExact, ZERO) <= 0) {
      throw new AgtMappingError(
        "AGT_MAPPING_FX_RATE_INVALID",
        "exchangeRate deve ser positivo para documento em moeda estrangeira"
      );
    }

    const localGrossExact = exact(doc.total_bruto_aoa, "total_bruto_aoa");
    if (cmpExact(localGrossExact, ZERO) <= 0) {
      throw new AgtMappingError(
        "AGT_MAPPING_FX_TOTAL_INVALID",
        "Contra-valor AOA persistido deve ser positivo"
      );
    }

    // O motor fiscal SQL é a única fonte do contravalor AOA. Não recalcular em JS.
    // A conversão para number acontece somente na fronteira JSON da AGT.
    documentTotals.currency = {
      currencyCode: currency,
      currencyAmount: jsonExact(localGrossExact, 2),
      exchangeRate: jsonExact(exchangeRateExact),
    };
  } else {
    const localNetExact = exact(doc.total_liquido_aoa, "total_liquido_aoa");
    const localTaxExact = exact(doc.total_impostos_aoa, "total_impostos_aoa");
    const localGrossExact = exact(doc.total_bruto_aoa, "total_bruto_aoa");
    if (
      !equalRounded(localNetExact, netTotalRounded, 2) ||
      !equalRounded(localTaxExact, taxPayableRounded, 2) ||
      !equalRounded(localGrossExact, grossTotalRounded, 2)
    ) {
      throw new AgtMappingError(
        "AGT_MAPPING_TOTAL_MISMATCH",
        "Totais AGT calculados divergem dos totais fiscais imutáveis do KLASSE"
      );
    }
  }

  const document: AgtInvoiceDocument = {
    documentNo: doc.numero_formatado,
    documentStatus,
    documentDate: doc.invoice_date,
    documentType: doc.tipo_documento,
    systemEntryDate: new Date(doc.system_entry).toISOString(),
    customerTaxID,
    customerCountry,
    companyName: doc.cliente_nome.slice(0, 200),
    lines,
    documentTotals,
  };
  if (documentStatus === "C") document.rejectedDocumentNo = rejectedDocumentNo;
  const eacCode = textValue(metadata.eac_code);
  if (eacCode) {
    if (!/^.{5}$/.test(eacCode)) {
      throw new AgtMappingError("AGT_MAPPING_EAC_CODE_INVALID", "eacCode deve ter 5 caracteres");
    }
    document.eacCode = eacCode;
  }
  const signaturePayload = {
    documentNo: document.documentNo,
    taxRegistrationNumber: input.taxRegistrationNumber,
    documentType: document.documentType,
    documentDate: document.documentDate,
    customerTaxID: document.customerTaxID,
    customerCountry: document.customerCountry,
    companyName: document.companyName,
    documentTotals: document.documentTotals,
  };
  return { document, signaturePayload };
}
