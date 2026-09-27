import "server-only";

import type { AgtPreparedDocument, AgtInvoiceDocument } from "@/lib/fiscal/agtInvoice";

type FiscalDocumentRow = {
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
  payload: Record<string, unknown>;
};

type FiscalItemRow = {
  linha_no: number;
  descricao: string;
  quantidade: number | string;
  preco_unit: number | string;
  taxa_iva: number | string;
  total_liquido_aoa: number | string;
  total_impostos_aoa: number | string;
  tax_exemption_code: string | null;
  product_code: string | null;
  product_number_code: string | null;
};

type OriginDocumentRow = {
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

function decimal(value: number | string | null | undefined, field: string) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    throw new AgtMappingError("AGT_MAPPING_NUMBER_INVALID", `${field} inválido`);
  }
  return parsed;
}

function round2(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function ceil2(value: number) {
  return Math.ceil((value - Number.EPSILON) * 100) / 100;
}

function trunc2(value: number) {
  return Math.trunc((value + Number.EPSILON) * 100) / 100;
}

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

function resolveTaxCode(rate: number, payloadItem: Record<string, unknown>) {
  const explicit = textValue(payloadItem.tax_code).toUpperCase();
  if (explicit) {
    if (!["NOR", "INT", "RED", "ISE", "OUT"].includes(explicit)) {
      throw new AgtMappingError("AGT_MAPPING_TAX_CODE_INVALID", `tax_code inválido: ${explicit}`);
    }
    if (rate === 0 && explicit !== "ISE") {
      throw new AgtMappingError(
        "AGT_MAPPING_TAX_CODE_RATE_MISMATCH",
        "IVA a 0% exige tax_code ISE no modelo actual do KLASSE"
      );
    }
    if (rate > 0 && explicit === "ISE") {
      throw new AgtMappingError(
        "AGT_MAPPING_TAX_CODE_RATE_MISMATCH",
        "tax_code ISE não pode ser usado com taxa IVA superior a 0%"
      );
    }
    return explicit;
  }
  if (rate === 14) return "NOR";
  if (rate === 0) return "ISE";
  throw new AgtMappingError(
    "AGT_MAPPING_TAX_CODE_REQUIRED",
    `tax_code é obrigatório para taxa IVA ${rate}`
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
  const payloadItems = Array.isArray(payload.itens) ? payload.itens : [];
  const customerCountry = resolveCustomerCountry(doc);
  const customerTaxID = (doc.cliente_nif ?? "").trim() || "999999999";
  const documentStatusRaw = textValue(metadata.agt_document_status).toUpperCase();
  const documentStatus: "N" | "C" = documentStatusRaw === "C" ? "C" : "N";
  const rejectedDocumentNo = textValue(metadata.agt_rejected_document_no);

  if (documentStatus === "C" && !rejectedDocumentNo) {
    throw new AgtMappingError(
      "AGT_MAPPING_REJECTED_DOCUMENT_REQUIRED",
      "Documento de correcção AGT exige agt_rejected_document_no"
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
      const lineNo = Number(source.lineNo);
      const originatingON = textValue(sourceDocumentID.OriginatingON);
      const documentDate = textValue(sourceDocumentID.documentDate);
      const creditAmount =
        source.creditAmount === undefined ? null : decimal(source.creditAmount as number | string, "creditAmount");
      const debitAmount =
        source.debitAmount === undefined ? null : decimal(source.debitAmount as number | string, "debitAmount");

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
        ...(creditAmount !== null ? { creditAmount: round2(creditAmount) } : {}),
        ...(debitAmount !== null ? { debitAmount: round2(debitAmount) } : {}),
      };
    });

    const documentTotals: AgtInvoiceDocument["documentTotals"] = {
      taxPayable: round2(decimal(doc.total_impostos_aoa, "total_impostos_aoa")),
      netTotal: round2(decimal(doc.total_liquido_aoa, "total_liquido_aoa")),
      grossTotal: round2(decimal(doc.total_bruto_aoa, "total_bruto_aoa")),
    };

    if (
      Math.abs(
        round2(documentTotals.netTotal + documentTotals.taxPayable) -
          documentTotals.grossTotal
      ) > 0.01
    ) {
      throw new AgtMappingError(
        "AGT_MAPPING_RECEIPT_TOTAL_MISMATCH",
        "Totais imutáveis do RC não fecham"
      );
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

  let netTotal = 0;
  let taxPayable = 0;
  const lines = input.items
    .slice()
    .sort((a, b) => a.linha_no - b.linha_no)
    .map((item, index) => {
      if (item.linha_no !== index + 1) {
        throw new AgtMappingError("AGT_MAPPING_LINE_SEQUENCE_INVALID", "linhas fiscais fora de sequência");
      }
      const payloadItem = objectValue(payloadItems[index]);
      const operationType = textValue(payloadItem.operation_type).toUpperCase() || "SE";
      if (!["SE","SS","STP","SR","SIF","SHS","ST","SG","TB","AS","QT","RD"].includes(operationType)) {
        throw new AgtMappingError("AGT_MAPPING_OPERATION_TYPE_INVALID", `operationType inválido: ${operationType}`);
      }
      const unitOfMeasure = textValue(payloadItem.unit_of_measure) || "UN";
      if (unitOfMeasure.length > 20) {
        throw new AgtMappingError("AGT_MAPPING_UNIT_TOO_LONG", "unitOfMeasure excede 20 caracteres");
      }
      const productCode = (item.product_code ?? item.product_number_code ?? "").trim();
      if (!productCode || productCode.length > 60) {
        throw new AgtMappingError("AGT_MAPPING_PRODUCT_CODE_INVALID", "productCode ausente ou maior que 60");
      }
      if (!item.descricao || item.descricao.length > 200) {
        throw new AgtMappingError("AGT_MAPPING_DESCRIPTION_INVALID", "productDescription ausente ou maior que 200");
      }
      const quantity = decimal(item.quantidade, "quantity");
      const unitPrice = decimal(item.preco_unit, "unitPrice");
      const settlementAmount = decimal(payloadItem.settlement_amount as number | string | undefined ?? 0, "settlementAmount");
      if (settlementAmount !== 0) {
        throw new AgtMappingError(
          "AGT_MAPPING_DISCOUNT_NOT_SUPPORTED",
          "Documento com settlementAmount diferente de zero requer cálculo fiscal de descontos antes da submissão AGT"
        );
      }
      const rate = decimal(item.taxa_iva, "taxPercentage");
      const baseRaw = quantity * unitPrice;
      const lineNet = doc.tipo_documento === "NC" ? ceil2(baseRaw) : trunc2(baseRaw);
      const taxContribution = ceil2(baseRaw * rate / 100);
      netTotal += lineNet;
      taxPayable += taxContribution;
      const taxCode = resolveTaxCode(rate, payloadItem);
      const taxCountryRegion =
        textValue(payloadItem.tax_country_region).toUpperCase() || "AO";
      if (!/^(?:[A-Z]{2}|AO-CAB)$/.test(taxCountryRegion)) {
        throw new AgtMappingError(
          "AGT_MAPPING_TAX_REGION_INVALID",
          `taxCountryRegion inválido: ${taxCountryRegion}`
        );
      }
      const tax: Record<string, unknown> = {
        taxType: "IVA",
        taxCountryRegion,
        taxCode,
        taxPercentage: rate,
        taxContribution,
      };
      if (taxCode === "ISE") {
        const exemption = (item.tax_exemption_code ?? "").trim();
        if (exemption.length !== 3) {
          throw new AgtMappingError(
            "AGT_MAPPING_EXEMPTION_CODE_INVALID",
            "taxExemptionCode deve ter exactamente 3 caracteres quando IVA é isento"
          );
        }
        tax.taxExemptionCode = exemption;
      }
      const line: Record<string, unknown> = {
        lineNumber: item.linha_no,
        operationType,
        productCode,
        productDescription: item.descricao,
        quantity,
        unitOfMeasure,
        unitPriceBase: unitPrice,
        unitPrice,
        taxes: [tax],
        settlementAmount,
      };
      if (doc.tipo_documento === "NC") {
        line.debitAmount = lineNet;
        if (!input.originDocument) {
          throw new AgtMappingError("AGT_MAPPING_REFERENCE_REQUIRED", "NC exige documento fiscal de referência");
        }
        line.referenceInfo = { reference: input.originDocument.numero_formatado };
      } else {
        line.creditAmount = lineNet;
        if (input.originDocument && doc.tipo_documento === "ND") {
          line.referenceInfo = { reference: input.originDocument.numero_formatado };
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

  netTotal = round2(netTotal);
  taxPayable = round2(taxPayable);
  const grossTotal = round2(netTotal + taxPayable);
  const documentTotals: AgtInvoiceDocument["documentTotals"] = {
    taxPayable,
    netTotal,
    grossTotal,
  };
  const currency = doc.moeda.toUpperCase();
  if (currency !== "AOA") {
    const exchangeRate = decimal(doc.taxa_cambio_aoa, "exchangeRate");
    documentTotals.currency = {
      currencyCode: currency,
      currencyAmount: round2(grossTotal * exchangeRate),
      exchangeRate,
    };
    const localGross = round2(decimal(doc.total_bruto_aoa, "total_bruto_aoa"));
    if (Math.abs(localGross - documentTotals.currency.currencyAmount) > 0.01) {
      throw new AgtMappingError(
        "AGT_MAPPING_FX_TOTAL_MISMATCH",
        "Contra-valor AOA calculado diverge do total fiscal local"
      );
    }
  } else {
    const localNet = round2(decimal(doc.total_liquido_aoa, "total_liquido_aoa"));
    const localTax = round2(decimal(doc.total_impostos_aoa, "total_impostos_aoa"));
    const localGross = round2(decimal(doc.total_bruto_aoa, "total_bruto_aoa"));
    if (Math.abs(localNet - netTotal) > 0.01 || Math.abs(localTax - taxPayable) > 0.01 || Math.abs(localGross - grossTotal) > 0.01) {
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
