import {
  absExact,
  addExact,
  cmpExact,
  divExact,
  exactToFixed,
  exactToJsonNumber,
  mulExact,
  parseExactDecimal,
  subExact,
  type DecimalInput,
  type ExactDecimal,
} from "@/lib/fiscal/decimal";

type SaftEmpresa = {
  id: string;
  nome: string;
  nif: string;
  endereco: string | null;
  registoComercial: string | null;
  cidade: string | null;
  provincia: string | null;
  codigoPostal: string | null;
  certificadoAgtNumero: string | null;
};

type SaftDocumentoItem = {
  linha_no: number;
  descricao: string;
  product_code: string;
  product_number_code: string | null;
  product_type?: "P" | "S" | "O" | "E" | "I";
  unit_of_measure?: string | null;
  tax_code?: "NOR" | "INT" | "RED" | "ISE" | "OUT" | "NS" | "NA" | null;
  tax_country_region?: string | null;
  quantidade: number | string;
  preco_unit: number | string;
  taxa_iva: number | string;
  total_liquido_aoa: number | string;
  total_impostos_aoa: number | string;
  total_bruto_aoa: number | string;
  settlement_amount?: number | string | null;
  tax_exemption_code?: string | null;
  tax_exemption_reason?: string | null;
};

type SaftOrderReference = {
  reference: string;
  reason?: string | null;
  origin_document_id?: string | null;
  origin_invoice_date?: string | null;
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

type SaftDocumento = {
  id: string;
  numero: number;
  numero_formatado: string;
  tipo_documento: string;
  invoice_date: string;
  system_entry: string;
  cliente_nome: string;
  cliente_nif: string | null;
  address_detail: string | null;
  city: string | null;
  postal_code: string | null;
  country: string | null;
  moeda: string;
  taxa_cambio_aoa: number | string | null;
  payment_mechanism: "NU" | "TB" | "CC" | "MB" | null;
  total_liquido_aoa: number | string;
  total_impostos_aoa: number | string;
  total_bruto_aoa: number | string;
  hash_control: string;
  saft_hash: string | null;
  saft_hash_control: number | null;
  saft_required: boolean;
  status: string;
  status_date: string | null;
  status_reason: string | null;
  source_id: string;
  status_source_id: string;
  source_billing: "P" | "I" | "M";
  series_sort_key: string;
  order_references?: SaftOrderReference[];
  payment_receipt?: {
    sourceDocuments: SaftPaymentSourceDocument[];
  } | null;
  itens: SaftDocumentoItem[];
};

type SaftCustomer = {
  nome: string;
  nif: string | null;
  address_detail: string | null;
  city: string | null;
  postal_code: string | null;
  country: string | null;
};

type SaftProduct = {
  code: string;
  description: string;
  numberCode: string;
  type: "P" | "S" | "O" | "E" | "I";
};

const CONSUMIDOR_FINAL_NIF = "999999999";
const CONSUMIDOR_FINAL_NOME = "Consumidor final";
const DESCONHECIDO = "Desconhecido";

type BuildSaftAoXmlInput = {
  empresa: SaftEmpresa;
  periodoInicio: string;
  periodoFim: string;
  header: {
    productId: string;
    productCompanyTaxId: string;
    productVersion: string;
    taxAccountingBasis: "F";
    softwareCertificateNumber: string;
  };
  generatedAtIso: string;
  documentos: SaftDocumento[];
};

type BuildSaftAoXmlOutput = {
  xml: string;
  summary: {
    totalDocumentos: number;
    totalItens: number;
    totalLiquidoAoa: number;
    totalImpostosAoa: number;
    totalBrutoAoa: number;
    taxAccountingBasis: "F";
    sections: {
      salesInvoices: { entries: number; totalDebit: number; totalCredit: number };
      workingDocuments: { entries: number; totalDebit: number; totalCredit: number };
      movementOfGoods: { lines: number; totalQuantityIssued: number };
      payments: { entries: number; totalDebit: number; totalCredit: number };
      taxTableEntries: number;
    };
  };
};

const SAFT_AO_NAMESPACE = "urn:OECD:StandardAuditFile-Tax:AO_1.01_01";

function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function asExact(value: DecimalInput | ExactDecimal, field: string): ExactDecimal {
  if (
    typeof value === "object" &&
    value !== null &&
    "coefficient" in value &&
    "scale" in value
  ) {
    return value as ExactDecimal;
  }
  try {
    return parseExactDecimal(value as DecimalInput, field);
  } catch {
    throw new Error(`SAFT_SEMANTIC_ERROR: ${field} inválido.`);
  }
}

function formatMoney(value: DecimalInput | ExactDecimal): string {
  return exactToFixed(asExact(value, "money"), 4);
}

function formatMoney2(value: DecimalInput | ExactDecimal): string {
  return exactToFixed(asExact(value, "money"), 2);
}

function formatExchangeRate(value: DecimalInput | ExactDecimal): string {
  return exactToFixed(asExact(value, "exchangeRate"), 8);
}

function resolveUnitPriceAoa(item: SaftDocumentoItem): ExactDecimal {
  const quantity = asExact(item.quantidade, "quantidade");
  const net = asExact(item.total_liquido_aoa, "total_liquido_aoa");
  if (cmpExact(quantity, parseExactDecimal("0")) <= 0 || cmpExact(net, parseExactDecimal("0")) < 0) {
    throw new Error(
      `SAFT_SEMANTIC_ERROR: linha ${item.linha_no} possui quantidade/líquido inválido.`
    );
  }
  return divExact(net, quantity, 8);
}

function resolveSettlementAmountAoa(
  item: SaftDocumentoItem,
  doc: Pick<SaftDocumento, "moeda" | "taxa_cambio_aoa">
): ExactDecimal | null {
  if (item.settlement_amount === null || item.settlement_amount === undefined) {
    return null;
  }
  const settlement = asExact(item.settlement_amount, "SettlementAmount");
  if (cmpExact(settlement, parseExactDecimal("0")) < 0) {
    throw new Error(
      `SAFT_SEMANTIC_ERROR: SettlementAmount negativo na linha ${item.linha_no}.`
    );
  }
  if (doc.moeda.toUpperCase() === "AOA") return settlement;

  if (doc.taxa_cambio_aoa === null || doc.taxa_cambio_aoa === undefined) {
    throw new Error(
      `SAFT_SEMANTIC_ERROR: taxa de câmbio inválida para SettlementAmount na linha ${item.linha_no}.`
    );
  }
  const exchangeRate = asExact(doc.taxa_cambio_aoa, "taxa_cambio_aoa");
  if (cmpExact(exchangeRate, parseExactDecimal("0")) <= 0) {
    throw new Error(
      `SAFT_SEMANTIC_ERROR: taxa de câmbio inválida para SettlementAmount na linha ${item.linha_no}.`
    );
  }
  return mulExact(settlement, exchangeRate);
}

function integerValue(value: unknown, field: string): number {
  const raw =
    typeof value === "number"
      ? value.toString()
      : typeof value === "string"
        ? value.trim()
        : "";
  if (!/^\d+$/.test(raw)) {
    throw new Error(`SAFT_SEMANTIC_ERROR: ${field} inteiro inválido.`);
  }
  const parsed = JSON.parse(raw) as unknown;
  if (typeof parsed !== "number" || !Number.isSafeInteger(parsed)) {
    throw new Error(`SAFT_SEMANTIC_ERROR: ${field} inteiro inválido.`);
  }
  return parsed;
}

function assertPositiveExchangeRate(doc: SaftDocumento): ExactDecimal | null {
  if (doc.moeda.toUpperCase() === "AOA") return null;
  if (doc.taxa_cambio_aoa === null || doc.taxa_cambio_aoa === undefined) {
    throw new Error(
      `SAFT_BUILD_ERROR: ExchangeRate obrigatório e positivo para documento ${doc.numero_formatado}.`
    );
  }
  const rate = asExact(doc.taxa_cambio_aoa, "taxa_cambio_aoa");
  if (cmpExact(rate, parseExactDecimal("0")) <= 0) {
    throw new Error(
      `SAFT_BUILD_ERROR: ExchangeRate obrigatório e positivo para documento ${doc.numero_formatado}.`
    );
  }
  return rate;
}

function currencyAmountAoaToDocumentCurrency(doc: SaftDocumento): ExactDecimal {
  const rate = assertPositiveExchangeRate(doc);
  if (!rate) return asExact(doc.total_bruto_aoa, "total_bruto_aoa");
  return divExact(asExact(doc.total_bruto_aoa, "total_bruto_aoa"), rate, 8);
}

function resolveSourceBilling(sourceBilling: SaftDocumento["source_billing"]): "P" | "I" | "M" {
  return sourceBilling;
}

function resolveCustomerIdentity(doc: SaftDocumento) {
  const nif = doc.cliente_nif?.trim();
  if (!nif || nif === CONSUMIDOR_FINAL_NIF) {
    return {
      id: `NIF-${CONSUMIDOR_FINAL_NIF}`,
      nif: CONSUMIDOR_FINAL_NIF,
      nome: CONSUMIDOR_FINAL_NOME,
    };
  }

  const id = `NIF-${nif}`;
  if (id.length > 30) {
    throw new Error(
      `SAFT_SEMANTIC_ERROR: CustomerID excede 30 caracteres para NIF ${nif}.`
    );
  }

  return {
    id,
    nif,
    nome: doc.cliente_nome.trim() || CONSUMIDOR_FINAL_NOME,
  };
}

function sortDocumentsForSaft(docs: SaftDocumento[]) {
  return [...docs].sort((a, b) => {
    const type = normalizeTipoDocumento(a.tipo_documento).localeCompare(
      normalizeTipoDocumento(b.tipo_documento)
    );
    if (type !== 0) return type;

    const series = a.series_sort_key.localeCompare(b.series_sort_key);
    if (series !== 0) return series;

    if (a.numero !== b.numero) return a.numero - b.numero;
    return a.id.localeCompare(b.id);
  });
}

const SALES_INVOICE_TYPES = new Set([
  "FT",
  "FR",
  "GF",
  "FG",
  "AC",
  "AR",
  "ND",
  "NC",
  "AF",
  "TV",
  "RP",
  "RE",
  "CS",
  "LD",
  "RA",
] as const);

const WORK_DOCUMENT_TYPES = new Set(["PP"] as const);
const MOVEMENT_TYPES = new Set(["GR", "GT"] as const);
const PAYMENT_TYPES = new Set(["RC"] as const);

function normalizeTipoDocumento(tipoDocumento: string): string {
  return tipoDocumento.trim().toUpperCase();
}

function isSalesInvoiceTipo(tipoDocumento: string): boolean {
  const normalized = normalizeTipoDocumento(tipoDocumento);
  return SALES_INVOICE_TYPES.has(
    normalized as (typeof SALES_INVOICE_TYPES extends Set<infer T> ? T : never)
  );
}

function isWorkDocumentTipo(tipoDocumento: string): boolean {
  const normalized = normalizeTipoDocumento(tipoDocumento);
  return WORK_DOCUMENT_TYPES.has(
    normalized as (typeof WORK_DOCUMENT_TYPES extends Set<infer T> ? T : never)
  );
}

function isMovementTipo(tipoDocumento: string): boolean {
  const normalized = normalizeTipoDocumento(tipoDocumento);
  return MOVEMENT_TYPES.has(normalized as (typeof MOVEMENT_TYPES extends Set<infer T> ? T : never));
}

function isPaymentTipo(tipoDocumento: string): boolean {
  const normalized = normalizeTipoDocumento(tipoDocumento);
  return PAYMENT_TYPES.has(normalized as (typeof PAYMENT_TYPES extends Set<infer T> ? T : never));
}

function resolveSalesInvoiceType(tipoDocumento: string): string {
  const normalized = normalizeTipoDocumento(tipoDocumento);
  if (SALES_INVOICE_TYPES.has(normalized as (typeof SALES_INVOICE_TYPES extends Set<infer T> ? T : never))) {
    return normalized;
  }

  throw new Error(
    `SAFT_BUILD_ERROR: tipo_documento '${normalized}' não suportado em SalesInvoices.`
  );
}

function resolveInvoiceStatus(docStatus: string): "N" | "A" | "R" | "S" {
  const normalized = docStatus.trim().toLowerCase();
  if (normalized === "anulado") return "A";
  return "N";
}

function resolveWorkStatus(docStatus: string): "N" | "A" | "F" {
  const normalized = docStatus.trim().toLowerCase();
  if (normalized === "anulado") return "A";
  return "N";
}

function resolveMovementStatus(docStatus: string): "N" | "T" | "A" | "F" | "R" {
  const normalized = docStatus.trim().toLowerCase();
  if (normalized === "anulado") return "A";
  return "N";
}

function resolvePaymentStatus(docStatus: string): "N" | "A" {
  const normalized = docStatus.trim().toLowerCase();
  if (normalized === "anulado") return "A";
  return "N";
}

function resolveDocumentStatusDate(doc: SaftDocumento): string {
  if (doc.status.trim().toLowerCase() === "anulado") {
    const statusDate = doc.status_date?.trim();
    if (!statusDate) {
      throw new Error(
        `SAFT_SEMANTIC_ERROR: documento anulado ${doc.numero_formatado} sem data do evento de anulação.`
      );
    }
    return statusDate;
  }
  return doc.system_entry;
}

function buildDocumentStatusReasonXml(doc: SaftDocumento, indent: string): string {
  if (doc.status.trim().toLowerCase() !== "anulado") return "";
  const reason = doc.status_reason?.trim();
  if (!reason) {
    throw new Error(
      `SAFT_SEMANTIC_ERROR: documento anulado ${doc.numero_formatado} sem motivo de anulação.`
    );
  }
  return `${indent}<Reason>${escapeXml(reason)}</Reason>`;
}

function resolveWorkType(tipoDocumento: string): string {
  const normalized = normalizeTipoDocumento(tipoDocumento);
  if (normalized === "PP") return "PP";
  throw new Error(`SAFT_BUILD_ERROR: tipo_documento '${normalized}' não suportado em WorkingDocuments.`);
}

function resolveMovementType(tipoDocumento: string): string {
  const normalized = normalizeTipoDocumento(tipoDocumento);
  if (normalized === "GR" || normalized === "GT") return normalized;
  throw new Error(`SAFT_BUILD_ERROR: tipo_documento '${normalized}' não suportado em MovementOfGoods.`);
}

function resolvePaymentType(tipoDocumento: string): string {
  const normalized = normalizeTipoDocumento(tipoDocumento);
  if (normalized === "RC") return "RC";
  throw new Error(`SAFT_BUILD_ERROR: tipo_documento '${normalized}' não suportado em Payments.`);
}

function resolveTaxCode(item: Pick<SaftDocumentoItem, "taxa_iva" | "tax_code">): string {
  const explicit = item.tax_code?.trim().toUpperCase();
  if (explicit) {
    if (!["NOR", "INT", "RED", "ISE", "OUT", "NS", "NA"].includes(explicit)) {
      throw new Error(`SAFT_SEMANTIC_ERROR: TaxCode inválido: ${explicit}.`);
    }
    return explicit;
  }

  const taxaIva = asExact(item.taxa_iva, "taxa_iva");
  if (cmpExact(taxaIva, parseExactDecimal("0")) <= 0) return "ISE";
  if (cmpExact(taxaIva, parseExactDecimal("5")) <= 0) return "RED";
  if (cmpExact(taxaIva, parseExactDecimal("14")) < 0) return "INT";
  return "NOR";
}

function resolveTaxCountryRegion(item: Pick<SaftDocumentoItem, "tax_country_region">): string {
  const region = item.tax_country_region?.trim().toUpperCase() || "AO";
  if (!/^[A-Z]{2}(?:-[A-Z0-9]{1,6})?$/.test(region)) {
    throw new Error(`SAFT_SEMANTIC_ERROR: TaxCountryRegion inválido: ${region}.`);
  }
  return region;
}

function resolveUnitOfMeasure(item: Pick<SaftDocumentoItem, "unit_of_measure">): string {
  const unit = item.unit_of_measure?.trim() || "UN";
  if (!unit || unit.length > 20) {
    throw new Error(`SAFT_SEMANTIC_ERROR: UnitOfMeasure inválida: ${unit}.`);
  }
  return unit;
}

function resolveTaxDescription(code: string, taxaIva: DecimalInput | ExactDecimal, region: string): string {
  const label =
    code === "ISE" ? "IVA isento" :
    code === "RED" ? "IVA taxa reduzida" :
    code === "INT" ? "IVA taxa intermédia" :
    code === "NOR" ? "IVA taxa normal" :
    code === "NS" ? "Não sujeito" :
    code === "OUT" ? "Outros" :
    "Não aplicável";
  return `${label} ${exactToFixed(asExact(taxaIva, "taxa_iva"), 2)}% ${region}`;
}

function assertMoneyClose(
  label: string,
  actual: DecimalInput | ExactDecimal,
  expected: DecimalInput | ExactDecimal,
  tolerance: DecimalInput = "0.02"
) {
  const actualExact = asExact(actual, `${label}:actual`);
  const expectedExact = asExact(expected, `${label}:expected`);
  const toleranceExact = asExact(tolerance, `${label}:tolerance`);
  if (cmpExact(absExact(subExact(actualExact, expectedExact)), toleranceExact) > 0) {
    throw new Error(
      `SAFT_SEMANTIC_ERROR: ${label} divergente (actual=${formatMoney(actualExact)}, expected=${formatMoney(expectedExact)}).`
    );
  }
}

function buildTaxExemptionXml(item: SaftDocumentoItem, indent: string): string {
  if (cmpExact(asExact(item.taxa_iva, "taxa_iva"), parseExactDecimal("0")) > 0) return "";

  const code = item.tax_exemption_code?.trim();
  const reason = item.tax_exemption_reason?.trim();
  if (
    !code ||
    !/^M\d{2}$/.test(code) ||
    !reason ||
    reason.length < 6 ||
    reason.length > 60
  ) {
    throw new Error(
      `SAFT_SEMANTIC_ERROR: linha ${item.linha_no} com IVA 0 exige TaxExemptionCode Mxx e TaxExemptionReason de 6-60 caracteres.`
    );
  }

  return [
    `${indent}<TaxExemptionReason>${escapeXml(reason)}</TaxExemptionReason>`,
    `${indent}<TaxExemptionCode>${escapeXml(code)}</TaxExemptionCode>`,
  ].join("\n");
}

function isDebitSalesDocument(tipoDocumento: string): boolean {
  const normalized = normalizeTipoDocumento(tipoDocumento);
  return normalized === "NC" || normalized === "RE";
}

function resolveSignedHash(
  doc: SaftDocumento,
  softwareValidationNumber: string
): { hash: string; hashControl: string } {
  if (softwareValidationNumber === "0") {
    return { hash: "0", hashControl: "0" };
  }

  const hash = doc.saft_hash?.trim();
  const hashControl = integerValue(doc.saft_hash_control, "saft_hash_control");

  if (
    !doc.saft_required ||
    !hash ||
    hash.length !== 172 ||
    !Number.isInteger(hashControl) ||
    hashControl <= 0
  ) {
    throw new Error(
      `SAFT_SEMANTIC_ERROR: documento ${doc.numero_formatado} não pertence a uma cadeia SAF-T validada completa.`
    );
  }

  return {
    hash,
    hashControl: String(hashControl),
  };
}

function resolveSaftInvoiceNo(doc: SaftDocumento, documentType: string): string {
  const raw = doc.numero_formatado.trim();
  const expectedType = documentType.trim().toUpperCase();
  const match = /^([A-Z]{1,4})\s+([^/]+)\/(\d+)$/.exec(raw);

  if (!match || match[1] !== expectedType) {
    throw new Error(
      `SAFT_SEMANTIC_ERROR: documento ${doc.id} possui número fiscal '${raw}' incompatível com o tipo ${expectedType}; o SAF-T não corrige números fiscais históricos.`
    );
  }

  const sequential = integerValue(match[3], "numero sequencial SAF-T");
  const persistedSequential = integerValue(doc.numero, "numero fiscal persistido");
  if (sequential <= 0 || sequential !== persistedSequential) {
    throw new Error(
      `SAFT_SEMANTIC_ERROR: documento ${raw} diverge do contador fiscal persistido (${doc.numero}).`
    );
  }

  if (raw.length > 60) {
    throw new Error(
      `SAFT_SEMANTIC_ERROR: número fiscal ${raw} excede 60 caracteres.`
    );
  }

  return raw;
}
export function buildSaftAoXml(input: BuildSaftAoXmlInput): BuildSaftAoXmlOutput {
  if (input.header.taxAccountingBasis !== "F") {
    throw new Error(
      "SAFT_SEMANTIC_ERROR: KLASSE exporta SAF-T de Facturação (F). SAF-T contabilístico C/I exige plano de contas e movimentos de dupla entrada, inexistentes no módulo escolar."
    );
  }

  const empresaNif = input.empresa.nif.trim();
  if (empresaNif.length < 10 || empresaNif.length > 15) {
    throw new Error(
      `SAFT_BUILD_ERROR: TaxRegistrationNumber inválido para Header (esperado 10-15 chars, recebido ${empresaNif.length}).`
    );
  }

  const fiscalYear = Number.parseInt(input.periodoInicio.slice(0, 4), 10);
  if (!Number.isFinite(fiscalYear) || fiscalYear < 2000 || fiscalYear > 9999) {
    throw new Error(`SAFT_BUILD_ERROR: FiscalYear inválido a partir de StartDate ${input.periodoInicio}.`);
  }

  const companyRegistration = input.empresa.registoComercial?.trim();
  const companyAddressDetail = input.empresa.endereco?.trim();
  const companyCity = input.empresa.cidade?.trim();
  const companyProvince = input.empresa.provincia?.trim();
  const companyPostalCode = input.empresa.codigoPostal?.trim();

  if (!companyRegistration) {
    throw new Error("SAFT_SEMANTIC_ERROR: CompanyID/Registo Comercial da empresa fiscal é obrigatório.");
  }
  if (!companyAddressDetail || !companyCity) {
    throw new Error(
      "SAFT_SEMANTIC_ERROR: endereço e cidade da empresa fiscal são obrigatórios no Header SAF-T."
    );
  }
  const softwareValidationNumber = /^\d+\/AGT\/\d{4}$|^0$/.test(input.header.softwareCertificateNumber)
    ? input.header.softwareCertificateNumber
    : (() => {
        throw new Error(
          "SAFT_SEMANTIC_ERROR: SoftwareValidationNumber deve ser '0' ou NNN/AGT/AAAA."
        );
      })();

  const productCompanyTaxId = input.header.productCompanyTaxId.trim();
  if (productCompanyTaxId.length < 10 || productCompanyTaxId.length > 20) {
    throw new Error(
      "SAFT_SEMANTIC_ERROR: ProductCompanyTaxID do produtor do software deve ter 10-20 caracteres."
    );
  }

  const productVersion = input.header.productVersion.trim();
  if (!productVersion || productVersion.length > 30) {
    throw new Error("SAFT_SEMANTIC_ERROR: ProductVersion inválida.");
  }

  let totalItens = 0;
  let totalLiquidoAoaExact = parseExactDecimal("0");
  let totalImpostosAoaExact = parseExactDecimal("0");
  let totalBrutoAoaExact = parseExactDecimal("0");

  const customerRows = new Map<string, SaftCustomer>();
  const productRows = new Map<string, SaftProduct>();
  const normalizeAddress = (value: string | null): string => {
    const trimmed = value?.trim();
    return trimmed && trimmed.length > 0 ? trimmed : DESCONHECIDO;
  };
  const resolveAddress = (customer: SaftCustomer) => {
    const isConsumidorFinal = (customer.nif ?? "").trim() === CONSUMIDOR_FINAL_NIF;
    if (isConsumidorFinal) {
      return {
        addressDetail: DESCONHECIDO,
        city: DESCONHECIDO,
        postalCode: DESCONHECIDO,
        country: DESCONHECIDO,
      };
    }
    return {
      addressDetail: normalizeAddress(customer.address_detail),
      city: normalizeAddress(customer.city),
      postalCode: normalizeAddress(customer.postal_code),
      country: normalizeAddress(customer.country),
    };
  };

  for (const doc of input.documentos) {
    if (doc.status === "pendente_assinatura") {
      throw new Error(
        `SAFT_SEMANTIC_ERROR: documento ${doc.numero_formatado} ainda está pendente de assinatura e não pode ser exportado.`
      );
    }

    const identity = resolveCustomerIdentity(doc);
    const customerId = identity.id;
    const existingCustomer = customerRows.get(customerId);
    if (existingCustomer && existingCustomer.nome !== identity.nome) {
      throw new Error(
        `SAFT_SEMANTIC_ERROR: CustomerID ${customerId} aparece com nomes divergentes no período.`
      );
    }
    if (!existingCustomer) {
      customerRows.set(customerId, {
        nome: identity.nome,
        nif: identity.nif,
        address_detail: doc.address_detail,
        city: doc.city,
        postal_code: doc.postal_code,
        country: doc.country,
      });
    }

    totalItens += doc.itens.length;
    totalLiquidoAoaExact = addExact(
      totalLiquidoAoaExact,
      asExact(doc.total_liquido_aoa, "total_liquido_aoa")
    );
    totalImpostosAoaExact = addExact(
      totalImpostosAoaExact,
      asExact(doc.total_impostos_aoa, "total_impostos_aoa")
    );
    totalBrutoAoaExact = addExact(
      totalBrutoAoaExact,
      asExact(doc.total_bruto_aoa, "total_bruto_aoa")
    );

    for (const item of doc.itens) {
      const code = item.product_code.trim();
      if (!code) continue;
      const description = item.descricao.trim() || code;
      const numberCode = item.product_number_code?.trim() || code;
      const productType = item.product_type ?? "S";
      const existingProduct = productRows.get(code);

      if (existingProduct) {
        if (existingProduct.type !== productType) {
          throw new Error(
            `SAFT_SEMANTIC_ERROR: ProductCode ${code} possui ProductType divergente (${existingProduct.type}/${productType}).`
          );
        }
        if (existingProduct.numberCode !== numberCode) {
          throw new Error(
            `SAFT_SEMANTIC_ERROR: ProductCode ${code} possui ProductNumberCode divergente no período.`
          );
        }
        continue;
      }

      productRows.set(code, {
        code,
        description,
        numberCode,
        type: productType,
      });
    }
  }

  const customersXml = Array.from(customerRows.entries())
    .map(([customerId, customer]) => {
      const address = resolveAddress(customer);
      return [
        "    <Customer>",
        `      <CustomerID>${escapeXml(customerId)}</CustomerID>`,
        "      <AccountID>Desconhecido</AccountID>",
        `      <CustomerTaxID>${escapeXml(customer.nif ?? CONSUMIDOR_FINAL_NIF)}</CustomerTaxID>`,
        `      <CompanyName>${escapeXml(customer.nome)}</CompanyName>`,
        "      <BillingAddress>",
        `        <AddressDetail>${escapeXml(address.addressDetail)}</AddressDetail>`,
        `        <City>${escapeXml(address.city)}</City>`,
        `        <PostalCode>${escapeXml(address.postalCode)}</PostalCode>`,
        `        <Country>${escapeXml(address.country)}</Country>`,
        "      </BillingAddress>",
        "      <SelfBillingIndicator>0</SelfBillingIndicator>",
        "    </Customer>",
      ].join("\n");
    })
    .join("\n");

  const productsXml = Array.from(productRows.values())
    .map((product) =>
      [
        "    <Product>",
        `      <ProductType>${product.type}</ProductType>`,
        `      <ProductCode>${escapeXml(product.code)}</ProductCode>`,
        `      <ProductDescription>${escapeXml(product.description)}</ProductDescription>`,
        `      <ProductNumberCode>${escapeXml(product.numberCode)}</ProductNumberCode>`,
        "    </Product>",
      ].join("\n")
    )
    .join("\n");

  const taxProfiles = new Map<
    string,
    { rate: ExactDecimal; code: string; region: string }
  >();
  for (const doc of input.documentos) {
    for (const item of doc.itens) {
      const rate = asExact(item.taxa_iva, "taxa_iva");
      if (cmpExact(rate, parseExactDecimal("0")) < 0) {
        throw new Error(
          `SAFT_SEMANTIC_ERROR: taxa de IVA inválida no documento ${doc.numero_formatado}, linha ${item.linha_no}.`
        );
      }
      const code = resolveTaxCode(item);
      const region = resolveTaxCountryRegion(item);
      const key = `IVA:${region}:${code}:${exactToFixed(rate, 4)}`;
      taxProfiles.set(key, { rate, code, region });
    }
  }

  const taxTableXml = taxProfiles.size > 0
    ? [
        "    <TaxTable>",
        ...Array.from(taxProfiles.values())
          .sort((a, b) => {
            const regionCmp = a.region.localeCompare(b.region);
            if (regionCmp !== 0) return regionCmp;
            const codeCmp = a.code.localeCompare(b.code);
            return codeCmp !== 0 ? codeCmp : cmpExact(a.rate, b.rate);
          })
          .map(({ rate, code, region }) =>
            [
              "      <TaxTableEntry>",
              "        <TaxType>IVA</TaxType>",
              `        <TaxCountryRegion>${escapeXml(region)}</TaxCountryRegion>`,
              `        <TaxCode>${escapeXml(code)}</TaxCode>`,
              `        <Description>${escapeXml(resolveTaxDescription(code, rate, region))}</Description>`,
              `        <TaxPercentage>${exactToFixed(rate, 2)}</TaxPercentage>`,
              "      </TaxTableEntry>",
            ].join("\n")
          ),
        "    </TaxTable>",
      ].join("\n")
    : "";

  const salesDocsForXml = sortDocumentsForSaft(
    input.documentos.filter((doc) => isSalesInvoiceTipo(doc.tipo_documento))
  );
  const invoicesXml = salesDocsForXml.map((doc) => {
      const invoiceType = resolveSalesInvoiceType(doc.tipo_documento);
      const invoiceNo = resolveSaftInvoiceNo(doc, invoiceType);
      const sourceId = doc.source_id;
      const sourceBilling = resolveSourceBilling(doc.source_billing);
      const invoiceStatus = resolveInvoiceStatus(doc.status);
      const signedHash = resolveSignedHash(doc, softwareValidationNumber);
      const lineNetTotal = doc.itens.reduce(
        (sum, item) => addExact(sum, asExact(item.total_liquido_aoa, "total_liquido_aoa")),
        parseExactDecimal("0")
      );
      const lineTaxTotal = doc.itens.reduce(
        (sum, item) => addExact(sum, asExact(item.total_impostos_aoa, "total_impostos_aoa")),
        parseExactDecimal("0")
      );
      assertMoneyClose(`${doc.numero_formatado} NetTotal`, lineNetTotal, doc.total_liquido_aoa);
      assertMoneyClose(`${doc.numero_formatado} TaxPayable`, lineTaxTotal, doc.total_impostos_aoa);
      assertMoneyClose(
        `${doc.numero_formatado} GrossTotal`,
        addExact(
          asExact(doc.total_liquido_aoa, "total_liquido_aoa"),
          asExact(doc.total_impostos_aoa, "total_impostos_aoa")
        ),
        doc.total_bruto_aoa
      );

      const linesXml = doc.itens
        .map((item) => {
          const productCode = item.product_code.trim();
          if (!productCode) {
            throw new Error("SAFT_BUILD_ERROR: ProductCode obrigatório em todas as linhas.");
          }
          const productNumberCode = item.product_number_code?.trim() || productCode;
          const settlementAmountAoa = resolveSettlementAmountAoa(item, doc);
          const settlementAmountXml =
            settlementAmountAoa == null
              ? ""
              : `            <SettlementAmount>${formatMoney(settlementAmountAoa)}</SettlementAmount>`;
          const orderReferencesXml =
            Array.isArray(doc.order_references) && doc.order_references.length > 0
              ? doc.order_references
                  .map((ref) => {
                    const reference = ref.reference?.trim();
                    if (!reference) return "";
                    const orderDate = ref.origin_invoice_date?.trim();
                    return [
                      "            <OrderReferences>",
                      `              <OriginatingON>${escapeXml(reference)}</OriginatingON>`,
                      orderDate ? `              <OrderDate>${escapeXml(orderDate)}</OrderDate>` : "",
                      "            </OrderReferences>",
                    ]
                      .filter(Boolean)
                      .join("\n");
                  })
                  .filter(Boolean)
                  .join("\n")
              : "";
          const referencesXml =
            doc.tipo_documento === "NC" &&
            Array.isArray(doc.order_references) &&
            doc.order_references.length > 0
              ? doc.order_references
                  .map((ref) => {
                    const reference = ref.reference?.trim();
                    if (!reference) return "";
                    return [
                      "            <References>",
                      `              <Reference>${escapeXml(reference)}</Reference>`,
                      ref.reason?.trim() ? `              <Reason>${escapeXml(ref.reason.trim())}</Reason>` : "",
                      "            </References>",
                    ]
                      .filter(Boolean)
                      .join("\n");
                  })
                  .filter(Boolean)
                  .join("\n")
              : "";
          return [
            "          <Line>",
            `            <LineNumber>${item.linha_no}</LineNumber>`,
            orderReferencesXml,
            `            <ProductCode>${escapeXml(productCode)}</ProductCode>`,
            `            <ProductDescription>${escapeXml(item.descricao)}</ProductDescription>`,
            `            <Quantity>${item.quantidade}</Quantity>`,
            `            <UnitOfMeasure>${escapeXml(resolveUnitOfMeasure(item))}</UnitOfMeasure>`,
            `            <UnitPrice>${formatMoney(resolveUnitPriceAoa(item))}</UnitPrice>`,
            `            <TaxPointDate>${doc.invoice_date}</TaxPointDate>`,
            referencesXml,
            `            <Description>${escapeXml(item.descricao)}</Description>`,
            isDebitSalesDocument(doc.tipo_documento)
              ? `            <DebitAmount>${formatMoney(item.total_liquido_aoa)}</DebitAmount>`
              : `            <CreditAmount>${formatMoney(item.total_liquido_aoa)}</CreditAmount>`,
            "            <Tax>",
            "              <TaxType>IVA</TaxType>",
            `              <TaxCountryRegion>${escapeXml(resolveTaxCountryRegion(item))}</TaxCountryRegion>`,
            `              <TaxCode>${resolveTaxCode(item)}</TaxCode>`,
            `              <TaxPercentage>${item.taxa_iva.toFixed(2)}</TaxPercentage>`,
            "            </Tax>",
            buildTaxExemptionXml(item, "            "),
            settlementAmountXml,
            "          </Line>",
          ].join("\n");
        })
        .join("\n");

      const customerId = resolveCustomerIdentity(doc).id;
      const currencyXml =
        doc.moeda.toUpperCase() === "AOA"
          ? ""
          : [
              "            <Currency>",
              `              <CurrencyCode>${escapeXml(doc.moeda.toUpperCase())}</CurrencyCode>`,
              `              <CurrencyAmount>${formatMoney(currencyAmountAoaToDocumentCurrency(doc))}</CurrencyAmount>`,
              `              <ExchangeRate>${formatExchangeRate(assertPositiveExchangeRate(doc)!)}</ExchangeRate>`,
              "            </Currency>",
            ].join("\n");

      if (doc.moeda.toUpperCase() !== "AOA") {
        assertPositiveExchangeRate(doc);
        throw new Error(
          `SAFT_BUILD_ERROR: ExchangeRate obrigatório e positivo para documento ${doc.numero_formatado}.`
        );
      }

      const paymentXml =
        doc.payment_mechanism
          ? [
              "            <Payment>",
              `              <PaymentMechanism>${escapeXml(doc.payment_mechanism)}</PaymentMechanism>`,
              `              <PaymentAmount>${formatMoney(doc.total_bruto_aoa)}</PaymentAmount>`,
              `              <PaymentDate>${doc.invoice_date}</PaymentDate>`,
              "            </Payment>",
            ].join("\n")
          : "";

      return [
        "        <Invoice>",
        `          <InvoiceNo>${escapeXml(invoiceNo)}</InvoiceNo>`,
        "          <DocumentStatus>",
        `            <InvoiceStatus>${invoiceStatus}</InvoiceStatus>`,
        `            <InvoiceStatusDate>${resolveDocumentStatusDate(doc)}</InvoiceStatusDate>`,
        buildDocumentStatusReasonXml(doc, "            "),
        `            <SourceID>${escapeXml(doc.status_source_id)}</SourceID>`,
        `            <SourceBilling>${sourceBilling}</SourceBilling>`,
        "          </DocumentStatus>",
        `          <Hash>${escapeXml(signedHash.hash)}</Hash>`,
        `          <HashControl>${escapeXml(signedHash.hashControl)}</HashControl>`,
        `          <InvoiceDate>${doc.invoice_date}</InvoiceDate>`,
        `          <InvoiceType>${escapeXml(invoiceType)}</InvoiceType>`,
        "          <SpecialRegimes>",
        "            <SelfBillingIndicator>0</SelfBillingIndicator>",
        "            <CashVATSchemeIndicator>0</CashVATSchemeIndicator>",
        "            <ThirdPartiesBillingIndicator>0</ThirdPartiesBillingIndicator>",
        "          </SpecialRegimes>",
        `          <SourceID>${sourceId}</SourceID>`,
        `          <SystemEntryDate>${doc.system_entry}</SystemEntryDate>`,
        `          <CustomerID>${escapeXml(customerId)}</CustomerID>`,
        linesXml,
        "          <DocumentTotals>",
        `            <TaxPayable>${formatMoney2(doc.total_impostos_aoa)}</TaxPayable>`,
        `            <NetTotal>${formatMoney2(doc.total_liquido_aoa)}</NetTotal>`,
        `            <GrossTotal>${formatMoney2(doc.total_bruto_aoa)}</GrossTotal>`,
        currencyXml,
        paymentXml,
        "          </DocumentTotals>",
        "        </Invoice>",
      ].join("\n");
    })
    .join("\n");

  const workDocsForXml = sortDocumentsForSaft(
    input.documentos.filter((doc) => isWorkDocumentTipo(doc.tipo_documento))
  );
  const workDocumentsXml = workDocsForXml.map((doc) => {
      const workType = resolveWorkType(doc.tipo_documento);
      const documentNumber = resolveSaftInvoiceNo(doc, workType);
      const sourceId = doc.source_id;
      const sourceBilling = resolveSourceBilling(doc.source_billing);
      const workStatus = resolveWorkStatus(doc.status);
      const signedHash = resolveSignedHash(doc, softwareValidationNumber);
      const lineNetTotal = doc.itens.reduce(
        (sum, item) => addExact(sum, asExact(item.total_liquido_aoa, "total_liquido_aoa")),
        parseExactDecimal("0")
      );
      const lineTaxTotal = doc.itens.reduce(
        (sum, item) => addExact(sum, asExact(item.total_impostos_aoa, "total_impostos_aoa")),
        parseExactDecimal("0")
      );
      assertMoneyClose(`${doc.numero_formatado} NetTotal`, lineNetTotal, doc.total_liquido_aoa);
      assertMoneyClose(`${doc.numero_formatado} TaxPayable`, lineTaxTotal, doc.total_impostos_aoa);
      const customerId = resolveCustomerIdentity(doc).id;

      const linesXml = doc.itens
        .map((item) => {
          const productCode = item.product_code.trim();
          if (!productCode) {
            throw new Error("SAFT_BUILD_ERROR: ProductCode obrigatório em todas as linhas.");
          }
          const orderReferencesXml =
            Array.isArray(doc.order_references) && doc.order_references.length > 0
              ? doc.order_references
                  .map((ref) => {
                    const reference = ref.reference?.trim();
                    if (!reference) return "";
                    const orderDate = ref.origin_invoice_date?.trim();
                    const settlementAmountAoa = resolveSettlementAmountAoa(item, doc);
          const settlementAmountXml =
            settlementAmountAoa == null
              ? ""
              : `            <SettlementAmount>${formatMoney(settlementAmountAoa)}</SettlementAmount>`;
          return [
                      "            <OrderReferences>",
                      `              <OriginatingON>${escapeXml(reference)}</OriginatingON>`,
                      orderDate ? `              <OrderDate>${escapeXml(orderDate)}</OrderDate>` : "",
                      "            </OrderReferences>",
                    ]
                      .filter(Boolean)
                      .join("\n");
                  })
                  .filter(Boolean)
                  .join("\n")
              : "";
          return [
            "          <Line>",
            `            <LineNumber>${item.linha_no}</LineNumber>`,
            orderReferencesXml,
            `            <ProductCode>${escapeXml(productCode)}</ProductCode>`,
            `            <ProductDescription>${escapeXml(item.descricao)}</ProductDescription>`,
            `            <Quantity>${item.quantidade}</Quantity>`,
            `            <UnitOfMeasure>${escapeXml(resolveUnitOfMeasure(item))}</UnitOfMeasure>`,
            `            <UnitPrice>${formatMoney(resolveUnitPriceAoa(item))}</UnitPrice>`,
            `            <TaxPointDate>${doc.invoice_date}</TaxPointDate>`,
            `            <Description>${escapeXml(item.descricao)}</Description>`,
            `            <CreditAmount>${formatMoney(item.total_liquido_aoa)}</CreditAmount>`,
            "            <Tax>",
            "              <TaxType>IVA</TaxType>",
            `              <TaxCountryRegion>${escapeXml(resolveTaxCountryRegion(item))}</TaxCountryRegion>`,
            `              <TaxCode>${resolveTaxCode(item)}</TaxCode>`,
            `              <TaxPercentage>${item.taxa_iva.toFixed(2)}</TaxPercentage>`,
            "            </Tax>",
            buildTaxExemptionXml(item, "            "),
            settlementAmountXml,
            "          </Line>",
          ].join("\n");
        })
        .join("\n");

      const currencyXml =
        doc.moeda.toUpperCase() === "AOA"
          ? ""
          : [
              "            <Currency>",
              `              <CurrencyCode>${escapeXml(doc.moeda.toUpperCase())}</CurrencyCode>`,
              `              <CurrencyAmount>${formatMoney(currencyAmountAoaToDocumentCurrency(doc))}</CurrencyAmount>`,
              `              <ExchangeRate>${formatExchangeRate(assertPositiveExchangeRate(doc)!)}</ExchangeRate>`,
              "            </Currency>",
            ].join("\n");

      if (doc.moeda.toUpperCase() !== "AOA") {
        assertPositiveExchangeRate(doc);
        throw new Error(
          `SAFT_BUILD_ERROR: ExchangeRate obrigatório e positivo para documento ${doc.numero_formatado}.`
        );
      }

      return [
        "        <WorkDocument>",
        `          <DocumentNumber>${escapeXml(documentNumber)}</DocumentNumber>`,
        "          <DocumentStatus>",
        `            <WorkStatus>${workStatus}</WorkStatus>`,
        `            <WorkStatusDate>${resolveDocumentStatusDate(doc)}</WorkStatusDate>`,
        buildDocumentStatusReasonXml(doc, "            "),
        `            <SourceID>${escapeXml(doc.status_source_id)}</SourceID>`,
        `            <SourceBilling>${sourceBilling}</SourceBilling>`,
        "          </DocumentStatus>",
        `          <Hash>${escapeXml(signedHash.hash)}</Hash>`,
        `          <HashControl>${escapeXml(signedHash.hashControl)}</HashControl>`,
        `          <WorkDate>${doc.invoice_date}</WorkDate>`,
        `          <WorkType>${escapeXml(workType)}</WorkType>`,
        `          <SourceID>${sourceId}</SourceID>`,
        `          <SystemEntryDate>${doc.system_entry}</SystemEntryDate>`,
        `          <CustomerID>${escapeXml(customerId)}</CustomerID>`,
        linesXml,
        "          <DocumentTotals>",
        `            <TaxPayable>${formatMoney2(doc.total_impostos_aoa)}</TaxPayable>`,
        `            <NetTotal>${formatMoney2(doc.total_liquido_aoa)}</NetTotal>`,
        `            <GrossTotal>${formatMoney2(doc.total_bruto_aoa)}</GrossTotal>`,
        currencyXml,
        "          </DocumentTotals>",
        "        </WorkDocument>",
      ].join("\n");
    })
    .join("\n");

  const movementDocsForXml = sortDocumentsForSaft(
    input.documentos.filter((doc) => isMovementTipo(doc.tipo_documento))
  );
  const movementDocumentsXml = movementDocsForXml.map((doc) => {
      const movementType = resolveMovementType(doc.tipo_documento);
      const documentNumber = resolveSaftInvoiceNo(doc, movementType);
      const sourceId = doc.source_id;
      const sourceBilling = resolveSourceBilling(doc.source_billing);
      const movementStatus = resolveMovementStatus(doc.status);
      const signedHash = resolveSignedHash(doc, softwareValidationNumber);
      const lineNetTotal = doc.itens.reduce(
        (sum, item) => addExact(sum, asExact(item.total_liquido_aoa, "total_liquido_aoa")),
        parseExactDecimal("0")
      );
      const lineTaxTotal = doc.itens.reduce(
        (sum, item) => addExact(sum, asExact(item.total_impostos_aoa, "total_impostos_aoa")),
        parseExactDecimal("0")
      );
      assertMoneyClose(`${doc.numero_formatado} NetTotal`, lineNetTotal, doc.total_liquido_aoa);
      assertMoneyClose(`${doc.numero_formatado} TaxPayable`, lineTaxTotal, doc.total_impostos_aoa);
      const customerId = resolveCustomerIdentity(doc).id;

      const linesXml = doc.itens
        .map((item) => {
          const productCode = item.product_code.trim();
          if (!productCode) {
            throw new Error("SAFT_BUILD_ERROR: ProductCode obrigatório em todas as linhas.");
          }
          const settlementAmountAoa = resolveSettlementAmountAoa(item, doc);
          const settlementAmountXml =
            settlementAmountAoa == null
              ? ""
              : `            <SettlementAmount>${formatMoney(settlementAmountAoa)}</SettlementAmount>`;
          return [
            "          <Line>",
            `            <LineNumber>${item.linha_no}</LineNumber>`,
            `            <ProductCode>${escapeXml(productCode)}</ProductCode>`,
            `            <ProductDescription>${escapeXml(item.descricao)}</ProductDescription>`,
            `            <Quantity>${item.quantidade}</Quantity>`,
            `            <UnitOfMeasure>${escapeXml(resolveUnitOfMeasure(item))}</UnitOfMeasure>`,
            `            <UnitPrice>${formatMoney(resolveUnitPriceAoa(item))}</UnitPrice>`,
            `            <Description>${escapeXml(item.descricao)}</Description>`,
            `            <CreditAmount>${formatMoney(item.total_liquido_aoa)}</CreditAmount>`,
            "            <Tax>",
            "              <TaxType>IVA</TaxType>",
            `              <TaxCountryRegion>${escapeXml(resolveTaxCountryRegion(item))}</TaxCountryRegion>`,
            `              <TaxCode>${resolveTaxCode(item)}</TaxCode>`,
            `              <TaxPercentage>${item.taxa_iva.toFixed(2)}</TaxPercentage>`,
            "            </Tax>",
            buildTaxExemptionXml(item, "            "),
            settlementAmountXml,
            "          </Line>",
          ].join("\n");
        })
        .join("\n");

      const movementStartTime = doc.system_entry;
      const currencyXml =
        doc.moeda.toUpperCase() === "AOA"
          ? ""
          : [
              "            <Currency>",
              `              <CurrencyCode>${escapeXml(doc.moeda.toUpperCase())}</CurrencyCode>`,
              `              <CurrencyAmount>${formatMoney(currencyAmountAoaToDocumentCurrency(doc))}</CurrencyAmount>`,
              `              <ExchangeRate>${formatExchangeRate(assertPositiveExchangeRate(doc)!)}</ExchangeRate>`,
              "            </Currency>",
            ].join("\n");

      if (doc.moeda.toUpperCase() !== "AOA") {
        assertPositiveExchangeRate(doc);
        throw new Error(
          `SAFT_BUILD_ERROR: ExchangeRate obrigatório e positivo para documento ${doc.numero_formatado}.`
        );
      }

      return [
        "        <StockMovement>",
        `          <DocumentNumber>${escapeXml(documentNumber)}</DocumentNumber>`,
        "          <DocumentStatus>",
        `            <MovementStatus>${movementStatus}</MovementStatus>`,
        `            <MovementStatusDate>${resolveDocumentStatusDate(doc)}</MovementStatusDate>`,
        buildDocumentStatusReasonXml(doc, "            "),
        `            <SourceID>${escapeXml(doc.status_source_id)}</SourceID>`,
        `            <SourceBilling>${sourceBilling}</SourceBilling>`,
        "          </DocumentStatus>",
        `          <Hash>${escapeXml(signedHash.hash)}</Hash>`,
        `          <HashControl>${escapeXml(signedHash.hashControl)}</HashControl>`,
        `          <MovementDate>${doc.invoice_date}</MovementDate>`,
        `          <MovementType>${escapeXml(movementType)}</MovementType>`,
        `          <SystemEntryDate>${doc.system_entry}</SystemEntryDate>`,
        `          <CustomerID>${escapeXml(customerId)}</CustomerID>`,
        `          <SourceID>${sourceId}</SourceID>`,
        `          <MovementStartTime>${movementStartTime}</MovementStartTime>`,
        linesXml,
        "          <DocumentTotals>",
        `            <TaxPayable>${formatMoney2(doc.total_impostos_aoa)}</TaxPayable>`,
        `            <NetTotal>${formatMoney2(doc.total_liquido_aoa)}</NetTotal>`,
        `            <GrossTotal>${formatMoney2(doc.total_bruto_aoa)}</GrossTotal>`,
        currencyXml,
        "          </DocumentTotals>",
        "        </StockMovement>",
      ].join("\n");
    })
    .join("\n");

  const paymentDocsForXml = sortDocumentsForSaft(
    input.documentos.filter((doc) => isPaymentTipo(doc.tipo_documento))
  );
  const paymentsXml = paymentDocsForXml.map((doc) => {
      const paymentType = resolvePaymentType(doc.tipo_documento);
      const paymentRefNo = resolveSaftInvoiceNo(doc, paymentType);
      const sourceId = doc.source_id;
      const sourcePayment = resolveSourceBilling(doc.source_billing);
      const paymentStatus = resolvePaymentStatus(doc.status);
      const customerId = resolveCustomerIdentity(doc).id;
      const sourceDocuments = doc.payment_receipt?.sourceDocuments ?? [];

      if (sourceDocuments.length === 0) {
        throw new Error(
          `SAFT_SEMANTIC_ERROR: recibo ${doc.numero_formatado} não possui paymentReceipt.sourceDocuments.`
        );
      }

      const seenSources = new Set<string>();
      const linesXml = sourceDocuments
        .map((source, index) => {
          if (source.lineNo !== index + 1) {
            throw new Error(
              `SAFT_SEMANTIC_ERROR: recibo ${doc.numero_formatado} possui sourceDocuments fora de sequência.`
            );
          }

          const originatingON = source.sourceDocumentID?.OriginatingON?.trim();
          const invoiceDate =
            source.sourceDocumentID?.invoiceDate?.trim() ||
            source.sourceDocumentID?.documentDate?.trim();
          const creditAmount = asExact(
            source.creditAmount,
            "paymentReceipt.creditAmount"
          );

          if (
            !originatingON ||
            !invoiceDate ||
            cmpExact(creditAmount, parseExactDecimal("0")) <= 0
          ) {
            throw new Error(
              `SAFT_SEMANTIC_ERROR: sourceDocument inválido no recibo ${doc.numero_formatado}, linha ${source.lineNo}.`
            );
          }
          if (seenSources.has(originatingON)) {
            throw new Error(
              `SAFT_SEMANTIC_ERROR: sourceDocument duplicado (${originatingON}) no recibo ${doc.numero_formatado}.`
            );
          }
          seenSources.add(originatingON);

          return [
            "          <Line>",
            `            <LineNumber>${source.lineNo}</LineNumber>`,
            "            <SourceDocumentID>",
            `              <OriginatingON>${escapeXml(originatingON)}</OriginatingON>`,
            `              <InvoiceDate>${escapeXml(invoiceDate)}</InvoiceDate>`,
            "            </SourceDocumentID>",
            `            <CreditAmount>${formatMoney(creditAmount)}</CreditAmount>`,
            "          </Line>",
          ].join("\n");
        })
        .join("\n");

      const appliedNet = sourceDocuments.reduce(
        (sum, source) =>
          addExact(
            sum,
            asExact(source.creditAmount, "paymentReceipt.creditAmount")
          ),
        parseExactDecimal("0")
      );
      assertMoneyClose(
        `${doc.numero_formatado} Payments CreditAmount`,
        appliedNet,
        doc.total_liquido_aoa
      );
      assertMoneyClose(
        `${doc.numero_formatado} GrossTotal`,
        addExact(
          asExact(doc.total_liquido_aoa, "total_liquido_aoa"),
          asExact(doc.total_impostos_aoa, "total_impostos_aoa")
        ),
        doc.total_bruto_aoa
      );

      const paymentMethodXml = doc.payment_mechanism
        ? [
            "          <PaymentMethod>",
            `            <PaymentMechanism>${escapeXml(doc.payment_mechanism)}</PaymentMechanism>`,
            `            <PaymentAmount>${formatMoney(doc.total_bruto_aoa)}</PaymentAmount>`,
            `            <PaymentDate>${doc.invoice_date}</PaymentDate>`,
            "          </PaymentMethod>",
          ].join("\n")
        : "";

      const currencyXml =
        doc.moeda.toUpperCase() === "AOA"
          ? ""
          : [
              "            <Currency>",
              `              <CurrencyCode>${escapeXml(doc.moeda.toUpperCase())}</CurrencyCode>`,
              `              <CurrencyAmount>${formatMoney(currencyAmountAoaToDocumentCurrency(doc))}</CurrencyAmount>`,
              `              <ExchangeRate>${formatExchangeRate(assertPositiveExchangeRate(doc)!)}</ExchangeRate>`,
              "            </Currency>",
            ].join("\n");

      if (doc.moeda.toUpperCase() !== "AOA") {
        assertPositiveExchangeRate(doc);
        throw new Error(
          `SAFT_BUILD_ERROR: ExchangeRate obrigatório e positivo para documento ${doc.numero_formatado}.`
        );
      }

      return [
        "        <Payment>",
        `          <PaymentRefNo>${escapeXml(paymentRefNo)}</PaymentRefNo>`,
        `          <TransactionDate>${doc.invoice_date}</TransactionDate>`,
        `          <PaymentType>${escapeXml(paymentType)}</PaymentType>`,
        "          <DocumentStatus>",
        `            <PaymentStatus>${paymentStatus}</PaymentStatus>`,
        `            <PaymentStatusDate>${resolveDocumentStatusDate(doc)}</PaymentStatusDate>`,
        buildDocumentStatusReasonXml(doc, "            "),
        `            <SourceID>${escapeXml(doc.status_source_id)}</SourceID>`,
        `            <SourcePayment>${sourcePayment}</SourcePayment>`,
        "          </DocumentStatus>",
        paymentMethodXml,
        `          <SourceID>${sourceId}</SourceID>`,
        `          <SystemEntryDate>${doc.system_entry}</SystemEntryDate>`,
        `          <CustomerID>${escapeXml(customerId)}</CustomerID>`,
        linesXml,
        "          <DocumentTotals>",
        `            <TaxPayable>${formatMoney2(doc.total_impostos_aoa)}</TaxPayable>`,
        `            <NetTotal>${formatMoney2(doc.total_liquido_aoa)}</NetTotal>`,
        `            <GrossTotal>${formatMoney2(doc.total_bruto_aoa)}</GrossTotal>`,
        currencyXml,
        "          </DocumentTotals>",
        "        </Payment>",
      ]
        .filter(Boolean)
        .join("\n");
    })
    .join("\n");

  const salesDocs = sortDocumentsForSaft(
    input.documentos.filter((doc) => isSalesInvoiceTipo(doc.tipo_documento))
  );
  const workDocs = sortDocumentsForSaft(
    input.documentos.filter((doc) => isWorkDocumentTipo(doc.tipo_documento))
  );
  const movementDocs = sortDocumentsForSaft(
    input.documentos.filter((doc) => isMovementTipo(doc.tipo_documento))
  );
  const paymentDocs = sortDocumentsForSaft(
    input.documentos.filter((doc) => isPaymentTipo(doc.tipo_documento))
  );

  if (
    salesDocs.length + workDocs.length + movementDocs.length + paymentDocs.length !==
    input.documentos.length
  ) {
    const unknown = input.documentos
      .filter(
        (doc) =>
          !isSalesInvoiceTipo(doc.tipo_documento) &&
          !isWorkDocumentTipo(doc.tipo_documento) &&
          !isMovementTipo(doc.tipo_documento) &&
          !isPaymentTipo(doc.tipo_documento)
      )
      .map((doc) => normalizeTipoDocumento(doc.tipo_documento));
    throw new Error(
      `SAFT_SEMANTIC_ERROR: tipos de documento sem mapeamento SAF-T: ${Array.from(new Set(unknown)).join(", ")}.`
    );
  }

  const sumNet = (docs: SaftDocumento[]) =>
    docs.reduce(
      (acc, doc) =>
        addExact(acc, asExact(doc.total_liquido_aoa, "total_liquido_aoa")),
      parseExactDecimal("0")
    );
  const normalSalesDocs = salesDocs.filter((doc) => resolveInvoiceStatus(doc.status) === "N");
  const salesDebit = sumNet(
    normalSalesDocs.filter((doc) => isDebitSalesDocument(doc.tipo_documento))
  );
  const salesCredit = sumNet(
    normalSalesDocs.filter((doc) => !isDebitSalesDocument(doc.tipo_documento))
  );
  const movementLines = movementDocs.reduce((acc, doc) => acc + doc.itens.length, 0);
  const movementQuantity = movementDocs
    .filter((doc) => resolveMovementStatus(doc.status) !== "A")
    .reduce(
      (acc, doc) =>
        doc.itens.reduce(
          (sub, item) => addExact(sub, asExact(item.quantidade, "quantidade")),
          acc
        ),
      parseExactDecimal("0")
    );

  const salesBlock = [
    "    <SalesInvoices>",
    `      <NumberOfEntries>${salesDocs.length}</NumberOfEntries>`,
    `      <TotalDebit>${formatMoney(salesDebit)}</TotalDebit>`,
    `      <TotalCredit>${formatMoney(salesCredit)}</TotalCredit>`,
    invoicesXml,
    "    </SalesInvoices>",
  ].join("\n");

  const movementBlock = [
    "    <MovementOfGoods>",
    `      <NumberOfMovementLines>${movementLines}</NumberOfMovementLines>`,
    `      <TotalQuantityIssued>${formatMoney(movementQuantity)}</TotalQuantityIssued>`,
    movementDocumentsXml,
    "    </MovementOfGoods>",
  ].join("\n");

  const normalWorkDocs = workDocs.filter((doc) => resolveWorkStatus(doc.status) === "N");
  const workBlock = [
    "    <WorkingDocuments>",
    `      <NumberOfEntries>${workDocs.length}</NumberOfEntries>`,
    "      <TotalDebit>0.0000</TotalDebit>",
    `      <TotalCredit>${formatMoney(sumNet(normalWorkDocs))}</TotalCredit>`,
    workDocumentsXml,
    "    </WorkingDocuments>",
  ].join("\n");

  const normalPaymentDocs = paymentDocs.filter(
    (doc) => resolvePaymentStatus(doc.status) === "N"
  );
  const paymentBlock = [
    "    <Payments>",
    `      <NumberOfEntries>${paymentDocs.length}</NumberOfEntries>`,
    "      <TotalDebit>0.0000</TotalDebit>",
    `      <TotalCredit>${formatMoney(sumNet(normalPaymentDocs))}</TotalCredit>`,
    paymentsXml,
    "    </Payments>",
  ].join("\n");

  const xml = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    `<AuditFile xmlns="${SAFT_AO_NAMESPACE}">`,
    "  <Header>",
    "    <AuditFileVersion>1.01_01</AuditFileVersion>",
    `    <CompanyID>${escapeXml(companyRegistration)}</CompanyID>`,
    `    <TaxRegistrationNumber>${escapeXml(empresaNif)}</TaxRegistrationNumber>`,
    `    <TaxAccountingBasis>${escapeXml(input.header.taxAccountingBasis)}</TaxAccountingBasis>`,
    `    <CompanyName>${escapeXml(input.empresa.nome)}</CompanyName>`,
    `    <BusinessName>${escapeXml(input.empresa.nome)}</BusinessName>`,
    "    <CompanyAddress>",
    `      <AddressDetail>${escapeXml(companyAddressDetail)}</AddressDetail>`,
    `      <City>${escapeXml(companyCity)}</City>`,
    companyPostalCode ? `      <PostalCode>${escapeXml(companyPostalCode)}</PostalCode>` : "",
    companyProvince ? `      <Province>${escapeXml(companyProvince)}</Province>` : "",
    "      <Country>AO</Country>",
    "    </CompanyAddress>",
    `    <FiscalYear>${fiscalYear}</FiscalYear>`,
    `    <StartDate>${input.periodoInicio}</StartDate>`,
    `    <EndDate>${input.periodoFim}</EndDate>`,
    "    <CurrencyCode>AOA</CurrencyCode>",
    `    <DateCreated>${input.generatedAtIso.slice(0, 10)}</DateCreated>`,
    "    <TaxEntity>Global</TaxEntity>",
    `    <ProductCompanyTaxID>${escapeXml(productCompanyTaxId)}</ProductCompanyTaxID>`,
    `    <SoftwareValidationNumber>${escapeXml(softwareValidationNumber)}</SoftwareValidationNumber>`,
    `    <ProductID>${escapeXml(input.header.productId)}</ProductID>`,
    `    <ProductVersion>${escapeXml(productVersion)}</ProductVersion>`,
    "  </Header>",
    "  <MasterFiles>",
    customersXml,
    productsXml,
    taxTableXml,
    "  </MasterFiles>",
    "  <SourceDocuments>",
    salesBlock,
    movementBlock,
    workBlock,
    paymentBlock,
    "  </SourceDocuments>",
    "</AuditFile>",
    "",
  ].join("\n");

  return {
    xml,
    summary: {
      totalDocumentos: input.documentos.length,
      totalItens,
      totalLiquidoAoa: exactToJsonNumber(totalLiquidoAoaExact, 2),
      totalImpostosAoa: exactToJsonNumber(totalImpostosAoaExact, 2),
      totalBrutoAoa: exactToJsonNumber(totalBrutoAoaExact, 2),
      taxAccountingBasis: "F",
      sections: {
        salesInvoices: {
          entries: salesDocs.length,
          totalDebit: exactToJsonNumber(salesDebit, 4),
          totalCredit: exactToJsonNumber(salesCredit, 4),
        },
        workingDocuments: {
          entries: workDocs.length,
          totalDebit: 0,
          totalCredit: exactToJsonNumber(sumNet(normalWorkDocs), 4),
        },
        movementOfGoods: {
          lines: movementLines,
          totalQuantityIssued: exactToJsonNumber(movementQuantity, 4),
        },
        payments: {
          entries: paymentDocs.length,
          totalDebit: 0,
          totalCredit: exactToJsonNumber(sumNet(normalPaymentDocs), 4),
        },
        taxTableEntries: taxProfiles.size,
      },
    },
  };
}
