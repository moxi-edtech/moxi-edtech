type SaftEmpresa = {
  id: string;
  nome: string;
  nif: string;
  endereco: string | null;
  certificadoAgtNumero: string | null;
};

type SaftDocumentoItem = {
  linha_no: number;
  descricao: string;
  product_code: string;
  product_number_code: string | null;
  quantidade: number;
  preco_unit: number;
  taxa_iva: number;
  total_liquido_aoa: number;
  total_impostos_aoa: number;
  total_bruto_aoa: number;
  settlement_amount?: number | null;
};

type SaftOrderReference = {
  reference: string;
  reason?: string | null;
  origin_document_id?: string | null;
  origin_invoice_date?: string | null;
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
  taxa_cambio_aoa: number | null;
  payment_mechanism: "NU" | "TB" | "CC" | "MB" | null;
  total_liquido_aoa: number;
  total_impostos_aoa: number;
  total_bruto_aoa: number;
  hash_control: string;
  status: string;
  order_references?: SaftOrderReference[];
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
};

const CONSUMIDOR_FINAL_NIF = "999999999";
const DESCONHECIDO = "Desconhecido";

type BuildSaftAoXmlInput = {
  empresa: SaftEmpresa;
  periodoInicio: string;
  periodoFim: string;
  header: {
    productId: string;
    taxAccountingBasis: "F" | "C";
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

function formatMoney(value: number): string {
  return value.toFixed(4);
}

function formatMoney2(value: number): string {
  return value.toFixed(2);
}

function formatExchangeRate(value: number): string {
  return value.toFixed(8);
}

function resolveSourceBillingFromStatus(status: string): "P" | "I" | "M" {
  const normalized = status.trim().toLowerCase();
  if (normalized === "manual_recuperado" || normalized === "contingencia") return "M";
  if (normalized === "integrado") return "I";
  return "P";
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

function resolveTaxCode(taxaIva: number): string {
  if (taxaIva <= 0) return "ISE";
  if (taxaIva <= 5) return "RED";
  return "NOR";
}

function resolveSaftInvoiceNo(doc: SaftDocumento, invoiceType: string): string {
  const raw = doc.numero_formatado.trim();
  const alreadyValidPattern = /^([^ ]+) [^/^ ]+\/[0-9]+$/.exec(raw);
  if (alreadyValidPattern && alreadyValidPattern[1] === invoiceType.trim().toUpperCase()) return raw;

  const tipo = invoiceType.trim().toUpperCase() || "FT";
  const serieMatch = raw.match(/^([A-Za-z0-9._-]+)/);
  const rawSerie = serieMatch?.[1] ?? "SERIE";
  const serie = rawSerie.replace(/[^A-Za-z0-9._-]/g, "") || "SERIE";

  const numeroFromRaw = raw.match(/(\d+)(?!.*\d)/)?.[1];
  const numeroResolved = Number.isFinite(doc.numero) && doc.numero > 0
    ? String(doc.numero)
    : (numeroFromRaw ?? "1");

  return `${tipo} ${serie}/${numeroResolved}`;
}

export function buildSaftAoXml(input: BuildSaftAoXmlInput): BuildSaftAoXmlOutput {
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

  const companyAddressDetail = input.empresa.endereco?.trim() || DESCONHECIDO;
  const softwareValidationNumber = /^\d+\/AGT\/\d{4}$|^0$/.test(input.header.softwareCertificateNumber)
    ? input.header.softwareCertificateNumber
    : "0";

  let totalItens = 0;
  let totalLiquidoAoa = 0;
  let totalImpostosAoa = 0;
  let totalBrutoAoa = 0;

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
    const key = `${doc.cliente_nif ?? "SEM_NIF"}::${doc.cliente_nome}`;
    if (!customerRows.has(key)) {
      customerRows.set(key, {
        nome: doc.cliente_nome,
        nif: doc.cliente_nif,
        address_detail: doc.address_detail,
        city: doc.city,
        postal_code: doc.postal_code,
        country: doc.country,
      });
    }

    totalItens += doc.itens.length;
    totalLiquidoAoa += doc.total_liquido_aoa;
    totalImpostosAoa += doc.total_impostos_aoa;
    totalBrutoAoa += doc.total_bruto_aoa;

    for (const item of doc.itens) {
      const code = item.product_code.trim();
      if (!code) continue;
      if (productRows.has(code)) continue;
      const description = item.descricao.trim() || code;
      const numberCode = item.product_number_code?.trim() || code;
      productRows.set(code, { code, description, numberCode });
    }
  }

  const customersXml = Array.from(customerRows.values())
    .map((customer) => {
      const customerId = customer.nif ? `NIF-${customer.nif}` : `NM-${customer.nome}`;
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
        "      <ProductType>S</ProductType>",
        `      <ProductCode>${escapeXml(product.code)}</ProductCode>`,
        `      <ProductDescription>${escapeXml(product.description)}</ProductDescription>`,
        `      <ProductNumberCode>${escapeXml(product.numberCode)}</ProductNumberCode>`,
        "    </Product>",
      ].join("\n")
    )
    .join("\n");

  const invoicesXml = input.documentos
    .filter((doc) => isSalesInvoiceTipo(doc.tipo_documento))
    .map((doc) => {
      const invoiceType = resolveSalesInvoiceType(doc.tipo_documento);
      const invoiceNo = resolveSaftInvoiceNo(doc, invoiceType);
      const sourceId = "KLASSE";
      const sourceBilling = resolveSourceBillingFromStatus(doc.status);
      const invoiceStatus = resolveInvoiceStatus(doc.status);

      const linesXml = doc.itens
        .map((item) => {
          const productCode = item.product_code.trim();
          if (!productCode) {
            throw new Error("SAFT_BUILD_ERROR: ProductCode obrigatório em todas as linhas.");
          }
          const productNumberCode = item.product_number_code?.trim() || productCode;
          const settlementAmountXml =
            typeof item.settlement_amount === "number" && Number.isFinite(item.settlement_amount)
              ? `            <SettlementAmount>${formatMoney(Math.max(0, item.settlement_amount))}</SettlementAmount>`
              : "";
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
            "            <UnitOfMeasure>UN</UnitOfMeasure>",
            `            <UnitPrice>${formatMoney(item.preco_unit)}</UnitPrice>`,
            `            <TaxPointDate>${doc.invoice_date}</TaxPointDate>`,
            referencesXml,
            `            <Description>${escapeXml(item.descricao)}</Description>`,
            `            <CreditAmount>${formatMoney(item.total_bruto_aoa)}</CreditAmount>`,
            "            <Tax>",
            "              <TaxType>IVA</TaxType>",
            "              <TaxCountryRegion>AO</TaxCountryRegion>",
            `              <TaxCode>${resolveTaxCode(item.taxa_iva)}</TaxCode>`,
            `              <TaxPercentage>${item.taxa_iva.toFixed(2)}</TaxPercentage>`,
            "            </Tax>",
            settlementAmountXml,
            "          </Line>",
          ].join("\n");
        })
        .join("\n");

      const customerId = doc.cliente_nif
        ? `NIF-${doc.cliente_nif}`
        : `NM-${doc.cliente_nome}`;
      const currencyXml =
        doc.moeda.toUpperCase() === "AOA"
          ? ""
          : [
              "            <Currency>",
              `              <CurrencyCode>${escapeXml(doc.moeda.toUpperCase())}</CurrencyCode>`,
              `              <CurrencyAmount>${formatMoney(Number(doc.total_bruto_aoa) / Number(doc.taxa_cambio_aoa ?? 1))}</CurrencyAmount>`,
              `              <ExchangeRate>${formatExchangeRate(Number(doc.taxa_cambio_aoa ?? 0))}</ExchangeRate>`,
              "            </Currency>",
            ].join("\n");

      if (doc.moeda.toUpperCase() !== "AOA" && (!doc.taxa_cambio_aoa || Number(doc.taxa_cambio_aoa) <= 0)) {
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
        `            <InvoiceStatusDate>${doc.system_entry}</InvoiceStatusDate>`,
        `            <SourceID>${sourceId}</SourceID>`,
        `            <SourceBilling>${sourceBilling}</SourceBilling>`,
        "          </DocumentStatus>",
        `          <Hash>${escapeXml(doc.hash_control)}</Hash>`,
        `          <HashControl>${escapeXml(doc.hash_control)}</HashControl>`,
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

  const workDocumentsXml = input.documentos
    .filter((doc) => isWorkDocumentTipo(doc.tipo_documento))
    .map((doc) => {
      const workType = resolveWorkType(doc.tipo_documento);
      const documentNumber = resolveSaftInvoiceNo(doc, workType);
      const sourceId = "KLASSE";
      const sourceBilling = resolveSourceBillingFromStatus(doc.status);
      const workStatus = resolveWorkStatus(doc.status);
      const customerId = doc.cliente_nif ? `NIF-${doc.cliente_nif}` : `NM-${doc.cliente_nome}`;

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
            "            <UnitOfMeasure>UN</UnitOfMeasure>",
            `            <UnitPrice>${formatMoney(item.preco_unit)}</UnitPrice>`,
            `            <TaxPointDate>${doc.invoice_date}</TaxPointDate>`,
            `            <Description>${escapeXml(item.descricao)}</Description>`,
            `            <CreditAmount>${formatMoney(item.total_bruto_aoa)}</CreditAmount>`,
            "            <Tax>",
            "              <TaxType>IVA</TaxType>",
            "              <TaxCountryRegion>AO</TaxCountryRegion>",
            `              <TaxCode>${resolveTaxCode(item.taxa_iva)}</TaxCode>`,
            `              <TaxPercentage>${item.taxa_iva.toFixed(2)}</TaxPercentage>`,
            "            </Tax>",
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
              `              <CurrencyAmount>${formatMoney(Number(doc.total_bruto_aoa) / Number(doc.taxa_cambio_aoa ?? 1))}</CurrencyAmount>`,
              `              <ExchangeRate>${formatExchangeRate(Number(doc.taxa_cambio_aoa ?? 0))}</ExchangeRate>`,
              "            </Currency>",
            ].join("\n");

      if (doc.moeda.toUpperCase() !== "AOA" && (!doc.taxa_cambio_aoa || Number(doc.taxa_cambio_aoa) <= 0)) {
        throw new Error(
          `SAFT_BUILD_ERROR: ExchangeRate obrigatório e positivo para documento ${doc.numero_formatado}.`
        );
      }

      return [
        "        <WorkDocument>",
        `          <DocumentNumber>${escapeXml(documentNumber)}</DocumentNumber>`,
        "          <DocumentStatus>",
        `            <WorkStatus>${workStatus}</WorkStatus>`,
        `            <WorkStatusDate>${doc.system_entry}</WorkStatusDate>`,
        `            <SourceID>${sourceId}</SourceID>`,
        `            <SourceBilling>${sourceBilling}</SourceBilling>`,
        "          </DocumentStatus>",
        `          <Hash>${escapeXml(doc.hash_control)}</Hash>`,
        `          <HashControl>${escapeXml(doc.hash_control)}</HashControl>`,
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

  const movementDocumentsXml = input.documentos
    .filter((doc) => isMovementTipo(doc.tipo_documento))
    .map((doc) => {
      const movementType = resolveMovementType(doc.tipo_documento);
      const documentNumber = resolveSaftInvoiceNo(doc, movementType);
      const sourceId = "KLASSE";
      const sourceBilling = resolveSourceBillingFromStatus(doc.status);
      const movementStatus = resolveMovementStatus(doc.status);
      const customerId = doc.cliente_nif ? `NIF-${doc.cliente_nif}` : `NM-${doc.cliente_nome}`;

      const linesXml = doc.itens
        .map((item) => {
          const productCode = item.product_code.trim();
          if (!productCode) {
            throw new Error("SAFT_BUILD_ERROR: ProductCode obrigatório em todas as linhas.");
          }
          return [
            "          <Line>",
            `            <LineNumber>${item.linha_no}</LineNumber>`,
            `            <ProductCode>${escapeXml(productCode)}</ProductCode>`,
            `            <ProductDescription>${escapeXml(item.descricao)}</ProductDescription>`,
            `            <Quantity>${item.quantidade}</Quantity>`,
            "            <UnitOfMeasure>UN</UnitOfMeasure>",
            `            <UnitPrice>${formatMoney(item.preco_unit)}</UnitPrice>`,
            `            <Description>${escapeXml(item.descricao)}</Description>`,
            `            <CreditAmount>${formatMoney(item.total_bruto_aoa)}</CreditAmount>`,
            "            <Tax>",
            "              <TaxType>IVA</TaxType>",
            "              <TaxCountryRegion>AO</TaxCountryRegion>",
            `              <TaxCode>${resolveTaxCode(item.taxa_iva)}</TaxCode>`,
            `              <TaxPercentage>${item.taxa_iva.toFixed(2)}</TaxPercentage>`,
            "            </Tax>",
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
              `              <CurrencyAmount>${formatMoney(Number(doc.total_bruto_aoa) / Number(doc.taxa_cambio_aoa ?? 1))}</CurrencyAmount>`,
              `              <ExchangeRate>${formatExchangeRate(Number(doc.taxa_cambio_aoa ?? 0))}</ExchangeRate>`,
              "            </Currency>",
            ].join("\n");

      if (doc.moeda.toUpperCase() !== "AOA" && (!doc.taxa_cambio_aoa || Number(doc.taxa_cambio_aoa) <= 0)) {
        throw new Error(
          `SAFT_BUILD_ERROR: ExchangeRate obrigatório e positivo para documento ${doc.numero_formatado}.`
        );
      }

      return [
        "        <StockMovement>",
        `          <DocumentNumber>${escapeXml(documentNumber)}</DocumentNumber>`,
        "          <DocumentStatus>",
        `            <MovementStatus>${movementStatus}</MovementStatus>`,
        `            <MovementStatusDate>${doc.system_entry}</MovementStatusDate>`,
        `            <SourceID>${sourceId}</SourceID>`,
        `            <SourceBilling>${sourceBilling}</SourceBilling>`,
        "          </DocumentStatus>",
        `          <Hash>${escapeXml(doc.hash_control)}</Hash>`,
        `          <HashControl>${escapeXml(doc.hash_control)}</HashControl>`,
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

  const paymentsXml = input.documentos
    .filter((doc) => isPaymentTipo(doc.tipo_documento))
    .map((doc) => {
      const paymentType = resolvePaymentType(doc.tipo_documento);
      const paymentRefNo = resolveSaftInvoiceNo(doc, paymentType);
      const sourceId = "KLASSE";
      const sourcePayment = resolveSourceBillingFromStatus(doc.status);
      const paymentStatus = resolvePaymentStatus(doc.status);
      const customerId = doc.cliente_nif ? `NIF-${doc.cliente_nif}` : `NM-${doc.cliente_nome}`;

      const paymentMethodXml = [
        "          <PaymentMethod>",
        doc.payment_mechanism
          ? `            <PaymentMechanism>${escapeXml(doc.payment_mechanism)}</PaymentMechanism>`
          : "",
        `            <PaymentAmount>${formatMoney(doc.total_bruto_aoa)}</PaymentAmount>`,
        `            <PaymentDate>${doc.invoice_date}</PaymentDate>`,
        "          </PaymentMethod>",
      ]
        .filter(Boolean)
        .join("\n");

      const linesXml = doc.itens
        .map((item) => {
          const sourceDocumentIdXml =
            Array.isArray(doc.order_references) && doc.order_references.length > 0
              ? doc.order_references
                  .map((ref) => {
                    const reference = ref.reference?.trim();
                    if (!reference) return "";
                    const invoiceDate = ref.origin_invoice_date?.trim() || doc.invoice_date;
                    return [
                      "            <SourceDocumentID>",
                      `              <OriginatingON>${escapeXml(reference)}</OriginatingON>`,
                      `              <InvoiceDate>${escapeXml(invoiceDate)}</InvoiceDate>`,
                      ref.reason?.trim() ? `              <Description>${escapeXml(ref.reason.trim())}</Description>` : "",
                      "            </SourceDocumentID>",
                    ]
                      .filter(Boolean)
                      .join("\n");
                  })
                  .filter(Boolean)
                  .join("\n")
              : [
                  "            <SourceDocumentID>",
                  `              <OriginatingON>${escapeXml(paymentRefNo)}</OriginatingON>`,
                  `              <InvoiceDate>${escapeXml(doc.invoice_date)}</InvoiceDate>`,
                  "            </SourceDocumentID>",
                ].join("\n");

          return [
            "          <Line>",
            `            <LineNumber>${item.linha_no}</LineNumber>`,
            sourceDocumentIdXml,
            `            <CreditAmount>${formatMoney(item.total_bruto_aoa)}</CreditAmount>`,
            "            <Tax>",
            "              <TaxType>IVA</TaxType>",
            "              <TaxCountryRegion>AO</TaxCountryRegion>",
            `              <TaxCode>${resolveTaxCode(item.taxa_iva)}</TaxCode>`,
            `              <TaxPercentage>${item.taxa_iva.toFixed(2)}</TaxPercentage>`,
            "            </Tax>",
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
              `              <CurrencyAmount>${formatMoney(Number(doc.total_bruto_aoa) / Number(doc.taxa_cambio_aoa ?? 1))}</CurrencyAmount>`,
              `              <ExchangeRate>${formatExchangeRate(Number(doc.taxa_cambio_aoa ?? 0))}</ExchangeRate>`,
              "            </Currency>",
            ].join("\n");

      if (doc.moeda.toUpperCase() !== "AOA" && (!doc.taxa_cambio_aoa || Number(doc.taxa_cambio_aoa) <= 0)) {
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
        `            <PaymentStatusDate>${doc.system_entry}</PaymentStatusDate>`,
        `            <SourceID>${sourceId}</SourceID>`,
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
      ].join("\n");
    })
    .join("\n");

  const salesDocs = input.documentos.filter((doc) => isSalesInvoiceTipo(doc.tipo_documento));
  const workDocs = input.documentos.filter((doc) => isWorkDocumentTipo(doc.tipo_documento));
  const movementDocs = input.documentos.filter((doc) => isMovementTipo(doc.tipo_documento));
  const paymentDocs = input.documentos.filter((doc) => isPaymentTipo(doc.tipo_documento));

  const sumGross = (docs: SaftDocumento[]) => docs.reduce((acc, doc) => acc + doc.total_bruto_aoa, 0);
  const movementLines = movementDocs.reduce((acc, doc) => acc + doc.itens.length, 0);
  const movementQuantity = movementDocs.reduce(
    (acc, doc) => acc + doc.itens.reduce((sub, item) => sub + item.quantidade, 0),
    0
  );

  const salesBlock = [
    "    <SalesInvoices>",
    `      <NumberOfEntries>${salesDocs.length}</NumberOfEntries>`,
    `      <TotalDebit>${formatMoney(sumGross(salesDocs))}</TotalDebit>`,
    "      <TotalCredit>0.0000</TotalCredit>",
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

  const workBlock = [
    "    <WorkingDocuments>",
    `      <NumberOfEntries>${workDocs.length}</NumberOfEntries>`,
    `      <TotalDebit>${formatMoney(sumGross(workDocs))}</TotalDebit>`,
    "      <TotalCredit>0.0000</TotalCredit>",
    workDocumentsXml,
    "    </WorkingDocuments>",
  ].join("\n");

  const paymentBlock = [
    "    <Payments>",
    `      <NumberOfEntries>${paymentDocs.length}</NumberOfEntries>`,
    `      <TotalDebit>${formatMoney(sumGross(paymentDocs))}</TotalDebit>`,
    "      <TotalCredit>0.0000</TotalCredit>",
    paymentsXml,
    "    </Payments>",
  ].join("\n");

  const xml = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    `<AuditFile xmlns="${SAFT_AO_NAMESPACE}">`,
    "  <Header>",
    "    <AuditFileVersion>1.01_01</AuditFileVersion>",
    `    <CompanyID>${escapeXml(input.empresa.id)}</CompanyID>`,
    `    <TaxRegistrationNumber>${escapeXml(empresaNif)}</TaxRegistrationNumber>`,
    `    <TaxAccountingBasis>${escapeXml(input.header.taxAccountingBasis)}</TaxAccountingBasis>`,
    `    <CompanyName>${escapeXml(input.empresa.nome)}</CompanyName>`,
    `    <BusinessName>${escapeXml(input.empresa.nome)}</BusinessName>`,
    "    <CompanyAddress>",
    `      <AddressDetail>${escapeXml(companyAddressDetail)}</AddressDetail>`,
    `      <City>${escapeXml(DESCONHECIDO)}</City>`,
    "      <Country>AO</Country>",
    "    </CompanyAddress>",
    `    <FiscalYear>${fiscalYear}</FiscalYear>`,
    `    <StartDate>${input.periodoInicio}</StartDate>`,
    `    <EndDate>${input.periodoFim}</EndDate>`,
    "    <CurrencyCode>AOA</CurrencyCode>",
    `    <DateCreated>${input.generatedAtIso.slice(0, 10)}</DateCreated>`,
    "    <TaxEntity>Global</TaxEntity>",
    `    <ProductCompanyTaxID>${escapeXml(empresaNif)}</ProductCompanyTaxID>`,
    `    <SoftwareValidationNumber>${escapeXml(softwareValidationNumber)}</SoftwareValidationNumber>`,
    `    <ProductID>${escapeXml(input.header.productId)}</ProductID>`,
    "    <ProductVersion>1.0.0</ProductVersion>",
    "  </Header>",
    "  <MasterFiles>",
    customersXml,
    productsXml,
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
      totalLiquidoAoa,
      totalImpostosAoa,
      totalBrutoAoa,
    },
  };
}
