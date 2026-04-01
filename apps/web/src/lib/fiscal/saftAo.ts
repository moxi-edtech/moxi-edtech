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

function formatExchangeRate(value: number): string {
  return value.toFixed(8);
}

function resolveSourceBillingFromStatus(status: string): "P" | "I" | "M" {
  const normalized = status.trim().toLowerCase();
  if (normalized === "manual_recuperado" || normalized === "contingencia") return "M";
  if (normalized === "integrado") return "I";
  return "P";
}

function resolveInvoiceStatus(docStatus: string): "N" | "A" | "R" | "S" {
  const normalized = docStatus.trim().toLowerCase();
  if (normalized === "anulado") return "A";
  return "N";
}

function resolveTaxCode(taxaIva: number): string {
  if (taxaIva <= 0) return "ISE";
  if (taxaIva <= 5) return "RED";
  return "NOR";
}

function resolveSaftInvoiceNo(doc: SaftDocumento): string {
  const raw = doc.numero_formatado.trim();
  const alreadyValidPattern = /^[^ ]+ [^/^ ]+\/[0-9]+$/.test(raw);
  if (alreadyValidPattern) return raw;

  const tipo = doc.tipo_documento.trim().toUpperCase() || "FT";
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

  const invoicesXml = input.documentos
    .map((doc) => {
      const invoiceNo = resolveSaftInvoiceNo(doc);
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
        doc.tipo_documento === "RC" && doc.payment_mechanism
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
        `          <InvoiceType>${escapeXml(doc.tipo_documento)}</InvoiceType>`,
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
        `            <TaxPayable>${formatMoney(doc.total_impostos_aoa)}</TaxPayable>`,
        `            <NetTotal>${formatMoney(doc.total_liquido_aoa)}</NetTotal>`,
        `            <GrossTotal>${formatMoney(doc.total_bruto_aoa)}</GrossTotal>`,
        currencyXml,
        paymentXml,
        "          </DocumentTotals>",
        "        </Invoice>",
      ].join("\n");
    })
    .join("\n");

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
    "  </MasterFiles>",
    "  <SourceDocuments>",
    "    <SalesInvoices>",
    `      <NumberOfEntries>${input.documentos.length}</NumberOfEntries>`,
    `      <TotalDebit>${formatMoney(totalBrutoAoa)}</TotalDebit>`,
    "      <TotalCredit>0.0000</TotalCredit>",
    invoicesXml,
    "    </SalesInvoices>",
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
