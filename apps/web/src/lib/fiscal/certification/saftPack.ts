import { createHash } from "node:crypto";

import {
  buildSaftAoXml,
  type BuildSaftAoXmlInput,
  type SaftDocumento,
} from "@/lib/fiscal/saftAo";
import type {
  CertificationDatasetSnapshot,
  CertificationDocumentSnapshot,
} from "@/lib/fiscal/certification/evidenceRepository";
import type { CertificationManifest } from "@/lib/fiscal/certification/types";

function objectValue(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function stringValue(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function clienteAddress(payload: Record<string, unknown>) {
  const cliente = objectValue(payload.cliente);
  return {
    address_detail: stringValue(cliente.address_detail),
    city: stringValue(cliente.city),
    postal_code: stringValue(cliente.postal_code),
    country: stringValue(cliente.country),
  };
}

function sourceId(userId: string | null) {
  const compact = String(userId ?? "").replace(/-/g, "");
  return compact ? `U${compact.slice(0, 29)}` : "KLASSE-SYSTEM";
}

function sourceBilling(
  origin: string,
  payload: Record<string, unknown>
): "P" | "I" | "M" {
  const metadata = objectValue(payload.metadata);
  const explicit = String(metadata.saft_source_billing ?? "")
    .trim()
    .toUpperCase();
  if (explicit === "P" || explicit === "I" || explicit === "M") {
    return explicit;
  }
  if (origin === "manual_recuperado" || origin === "contingencia") return "M";
  return "P";
}

function paymentReceipt(payload: Record<string, unknown>) {
  const receipt = objectValue(payload.paymentReceipt);
  const rawSources = Array.isArray(receipt.sourceDocuments)
    ? receipt.sourceDocuments
    : [];
  if (rawSources.length === 0) return null;
  return {
    sourceDocuments: rawSources.map((raw, index) => {
      const source = objectValue(raw);
      const sourceId = objectValue(source.sourceDocumentID);
      return {
        lineNo: Number(source.lineNo ?? index + 1),
        sourceDocumentID: {
          OriginatingON: String(sourceId.OriginatingON ?? ""),
          documentDate: stringValue(sourceId.documentDate),
          invoiceDate: stringValue(sourceId.invoiceDate),
        },
        creditAmount:
          typeof source.creditAmount === "number" || typeof source.creditAmount === "string"
            ? source.creditAmount
            : 0,
      };
    }),
  };
}

function toSaftDocument(doc: CertificationDocumentSnapshot): SaftDocumento {
  const address = clienteAddress(doc.payload);
  return {
    id: doc.id,
    numero: doc.numero,
    numero_formatado: doc.numero_formatado,
    tipo_documento: doc.tipo_documento,
    invoice_date: doc.invoice_date,
    system_entry: doc.system_entry,
    cliente_nome: doc.cliente_nome,
    cliente_nif: doc.cliente_nif,
    ...address,
    moeda: doc.moeda,
    taxa_cambio_aoa: doc.taxa_cambio_aoa,
    payment_mechanism:
      ["NU", "TB", "CC", "MB"].includes(String(doc.payment_mechanism))
        ? (doc.payment_mechanism as "NU" | "TB" | "CC" | "MB")
        : null,
    total_liquido_aoa: doc.total_liquido_aoa,
    total_impostos_aoa: doc.total_impostos_aoa,
    total_bruto_aoa: doc.total_bruto_aoa,
    hash_control: doc.hash_control,
    saft_hash: doc.saft_hash,
    saft_hash_control: doc.saft_hash_control,
    saft_required: doc.saft_required,
    status: doc.status,
    status_date: doc.cancellation?.created_at ?? null,
    status_reason: doc.cancellation?.motivo ?? null,
    source_id: sourceId(doc.created_by),
    status_source_id: sourceId(doc.cancellation?.created_by ?? doc.created_by),
    source_billing: sourceBilling(doc.series.origem_documento, doc.payload),
    series_sort_key:
      doc.series.agt_series_code ?? doc.series.prefixo ?? doc.serie_id,
    order_references: doc.originDocument
      ? [{
          reference: doc.originDocument.numero_formatado,
          origin_document_id: doc.originDocument.id,
          origin_invoice_date: doc.originDocument.invoice_date,
          reason:
            doc.reference_reason ??
            stringValue(objectValue(doc.payload.metadata).reference_reason),
        }]
      : [],
    payment_receipt: paymentReceipt(doc.payload),
    itens: doc.items.map((item) => ({
      linha_no: item.linha_no,
      descricao: item.descricao,
      product_code: String(item.product_code ?? ""),
      product_number_code: item.product_number_code,
      product_type:
        ["P", "S", "O", "E", "I"].includes(String(item.product_type))
          ? (item.product_type as "P" | "S" | "O" | "E" | "I")
          : (doc.tipo_documento === "GR" || doc.tipo_documento === "GT" ? "P" : "S"),
      unit_of_measure: item.unit_of_measure ?? "UN",
      tax_code:
        ["NOR", "INT", "RED", "ISE", "OUT", "NS", "NA"].includes(String(item.tax_code))
          ? (item.tax_code as "NOR" | "INT" | "RED" | "ISE" | "OUT" | "NS" | "NA")
          : null,
      tax_country_region: item.tax_country_region ?? "AO",
      quantidade: item.quantidade,
      preco_unit: item.preco_unit,
      taxa_iva: item.taxa_iva,
      total_liquido_aoa: item.total_liquido_aoa,
      total_impostos_aoa: item.total_impostos_aoa,
      total_bruto_aoa: item.total_bruto_aoa,
      settlement_amount: item.settlement_amount,
      tax_exemption_code: item.tax_exemption_code,
      tax_exemption_reason: item.tax_exemption_reason,
    })),
  };
}

export function manifestDocumentIds(manifest: CertificationManifest) {
  return Array.from(
    new Set(
      Object.entries(manifest.points)
        .filter(([point]) => /^P(?:0[1-9]|1[0-5])$/.test(point))
        .flatMap(([, entry]) => entry.documents.map((doc) => doc.documentoId))
    )
  );
}

export function buildCertificationSaftInput(input: {
  manifest: CertificationManifest;
  snapshot: CertificationDatasetSnapshot;
  header: BuildSaftAoXmlInput["header"];
  generatedAtIso?: string;
}): BuildSaftAoXmlInput {
  const expectedIds = manifestDocumentIds(input.manifest);
  const byId = new Map(input.snapshot.documents.map((doc) => [doc.id, doc]));
  const documents = expectedIds.map((id) => {
    const doc = byId.get(id);
    if (!doc) throw new Error(`CERTIFICATION_SAFT_DOCUMENT_MISSING:${id}`);
    return toSaftDocument(doc);
  });

  const dates = documents.map((doc) => doc.invoice_date).sort();
  if (dates.length === 0) throw new Error("CERTIFICATION_SAFT_EMPTY_DATASET");

  const metadata = input.snapshot.company.metadata;
  return {
    empresa: {
      id: input.snapshot.company.id,
      nome: input.snapshot.company.nome,
      nif: input.snapshot.company.nif,
      endereco: input.snapshot.company.endereco,
      registoComercial: stringValue(metadata.registo_comercial),
      cidade: stringValue(metadata.cidade),
      provincia: stringValue(metadata.provincia),
      codigoPostal: stringValue(metadata.codigo_postal),
      certificadoAgtNumero: input.snapshot.company.certificadoAgtNumero,
    },
    periodoInicio: dates[0],
    periodoFim: dates[dates.length - 1],
    header: input.header,
    generatedAtIso: input.generatedAtIso ?? new Date().toISOString(),
    documentos: documents,
  };
}

function decodeXml(value: string) {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'");
}

export function extractSaftDocumentNumbers(xml: string) {
  const values = new Set<string>();
  const regex = /<(?:InvoiceNo|DocumentNumber|PaymentRefNo)>([^<]+)<\/(?:InvoiceNo|DocumentNumber|PaymentRefNo)>/g;
  for (const match of xml.matchAll(regex)) values.add(decodeXml(match[1]));
  return values;
}

export function buildCertificationSaft(input: BuildSaftAoXmlInput) {
  const built = buildSaftAoXml(input);
  const numbers = extractSaftDocumentNumbers(built.xml);
  const expected = input.documentos.map((doc) => doc.numero_formatado);
  const missing = expected.filter((number) => !numbers.has(number));
  const unexpected = [...numbers].filter((number) => !expected.includes(number));
  if (missing.length > 0 || unexpected.length > 0 || numbers.size !== expected.length) {
    throw new Error(
      `CERTIFICATION_SAFT_COVERAGE_MISMATCH:missing=${missing.join(",")};unexpected=${unexpected.join(",")}`
    );
  }
  return {
    ...built,
    checksumSha256: createHash("sha256").update(built.xml).digest("hex"),
    coverage: {
      expected: expected.length,
      actual: numbers.size,
      missing,
      unexpected,
      exact: true,
    },
  };
}
