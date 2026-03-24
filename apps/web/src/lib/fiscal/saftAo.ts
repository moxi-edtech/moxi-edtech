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
  quantidade: number;
  preco_unit: number;
  taxa_iva: number;
  total_liquido_aoa: number;
  total_impostos_aoa: number;
  total_bruto_aoa: number;
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
  total_liquido_aoa: number;
  total_impostos_aoa: number;
  total_bruto_aoa: number;
  hash_control: string;
  status: string;
  itens: SaftDocumentoItem[];
};

type BuildSaftAoXmlInput = {
  empresa: SaftEmpresa;
  periodoInicio: string;
  periodoFim: string;
  xsdVersion: string;
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

export function buildSaftAoXml(input: BuildSaftAoXmlInput): BuildSaftAoXmlOutput {
  let totalItens = 0;
  let totalLiquidoAoa = 0;
  let totalImpostosAoa = 0;
  let totalBrutoAoa = 0;

  const customerRows = new Map<string, { nome: string; nif: string | null }>();
  for (const doc of input.documentos) {
    const key = `${doc.cliente_nif ?? "SEM_NIF"}::${doc.cliente_nome}`;
    if (!customerRows.has(key)) {
      customerRows.set(key, {
        nome: doc.cliente_nome,
        nif: doc.cliente_nif,
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
      return [
        "      <Customer>",
        `        <CustomerID>${escapeXml(customerId)}</CustomerID>`,
        `        <CompanyName>${escapeXml(customer.nome)}</CompanyName>`,
        `        <TaxRegistrationNumber>${escapeXml(customer.nif ?? "999999999")}</TaxRegistrationNumber>`,
        "      </Customer>",
      ].join("\n");
    })
    .join("\n");

  const invoicesXml = input.documentos
    .map((doc) => {
      const linesXml = doc.itens
        .map((item) =>
          [
            "          <Line>",
            `            <LineNumber>${item.linha_no}</LineNumber>`,
            `            <ProductDescription>${escapeXml(item.descricao)}</ProductDescription>`,
            `            <Quantity>${item.quantidade}</Quantity>`,
            `            <UnitPrice>${formatMoney(item.preco_unit)}</UnitPrice>`,
            "            <Tax>",
            `              <TaxPercentage>${item.taxa_iva}</TaxPercentage>`,
            `              <TaxAmount>${formatMoney(item.total_impostos_aoa)}</TaxAmount>`,
            "            </Tax>",
            `            <CreditAmount>${formatMoney(item.total_bruto_aoa)}</CreditAmount>`,
            "          </Line>",
          ].join("\n")
        )
        .join("\n");

      const customerId = doc.cliente_nif
        ? `NIF-${doc.cliente_nif}`
        : `NM-${doc.cliente_nome}`;

      return [
        "        <Invoice>",
        `          <InvoiceNo>${escapeXml(doc.numero_formatado)}</InvoiceNo>`,
        `          <InvoiceDate>${doc.invoice_date}</InvoiceDate>`,
        `          <SystemEntryDate>${doc.system_entry}</SystemEntryDate>`,
        `          <InvoiceType>${escapeXml(doc.tipo_documento)}</InvoiceType>`,
        `          <CustomerID>${escapeXml(customerId)}</CustomerID>`,
        `          <DocumentStatus>${escapeXml(doc.status)}</DocumentStatus>`,
        `          <Hash>${escapeXml(doc.hash_control)}</Hash>`,
        linesXml,
        "          <DocumentTotals>",
        `            <TaxPayable>${formatMoney(doc.total_impostos_aoa)}</TaxPayable>`,
        `            <NetTotal>${formatMoney(doc.total_liquido_aoa)}</NetTotal>`,
        `            <GrossTotal>${formatMoney(doc.total_bruto_aoa)}</GrossTotal>`,
        "          </DocumentTotals>",
        "        </Invoice>",
      ].join("\n");
    })
    .join("\n");

  const xml = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    "<AuditFile>",
    "  <Header>",
    "    <AuditFileVersion>1.04_01</AuditFileVersion>",
    `    <CompanyID>${escapeXml(input.empresa.id)}</CompanyID>`,
    `    <TaxRegistrationNumber>${escapeXml(input.empresa.nif)}</TaxRegistrationNumber>`,
    `    <CompanyName>${escapeXml(input.empresa.nome)}</CompanyName>`,
    `    <CompanyAddress>${escapeXml(input.empresa.endereco ?? "")}</CompanyAddress>`,
    `    <BusinessName>${escapeXml(input.empresa.nome)}</BusinessName>`,
    `    <TaxAccountingBasis>${escapeXml(input.xsdVersion)}</TaxAccountingBasis>`,
    `    <CertificateNumber>${escapeXml(input.empresa.certificadoAgtNumero ?? "")}</CertificateNumber>`,
    `    <DateCreated>${input.generatedAtIso.slice(0, 10)}</DateCreated>`,
    `    <StartDate>${input.periodoInicio}</StartDate>`,
    `    <EndDate>${input.periodoFim}</EndDate>`,
    "    <CurrencyCode>AOA</CurrencyCode>",
    "  </Header>",
    "  <MasterFiles>",
    "    <CustomerList>",
    customersXml,
    "    </CustomerList>",
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
