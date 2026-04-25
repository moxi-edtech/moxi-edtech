import { createHash } from "node:crypto";

import { createClient } from "@supabase/supabase-js";

import { inngest } from "@/inngest/client";
import { buildSaftAoXml } from "@/lib/fiscal/saftAo";
import { SaftXsdValidationError, validateSaftXmlWithXsd } from "@/lib/fiscal/saftXsdValidator";
import type { Database, Json } from "~types/supabase";

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
  "id" | "nome" | "nif" | "endereco" | "certificado_agt_numero"
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
  taxa_cambio_aoa: number | null;
  payment_mechanism: string | null;
  total_liquido_aoa: number;
  total_impostos_aoa: number;
  total_bruto_aoa: number;
  hash_control: string;
  status: string;
  documento_origem_id: string | null;
  rectifica_documento_id: string | null;
};

type FiscalDocumentoItemRow = {
  documento_id: string;
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
};

type OrderReference = {
  reference: string;
  origin_invoice_date?: string;
};

function parseSettlementAmountsFromPayload(payload: Json | null): Map<number, number> {
  const result = new Map<number, number>();
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) return result;
  const payloadRecord = payload as Record<string, unknown>;
  const itens = payloadRecord["itens"];
  if (!Array.isArray(itens)) return result;

  itens.forEach((item, index) => {
    if (!item || typeof item !== "object" || Array.isArray(item)) return;
    const raw = (item as Record<string, unknown>)["settlement_amount"];
    if (typeof raw !== "number" || !Number.isFinite(raw) || raw < 0) return;
    result.set(index + 1, raw);
  });

  return result;
}

type FiscalSaftExportRow = Pick<
  Database["public"]["Tables"]["fiscal_saft_exports"]["Row"],
  "id" | "empresa_id" | "periodo_inicio" | "periodo_fim" | "arquivo_storage_path" | "xsd_version" | "metadata"
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

function resolveSaftHeaderConfig() {
  const productIdRaw = (process.env.SAFT_PRODUCT_ID ?? "").trim();
  const taxAccountingBasisRaw = (process.env.SAFT_TAX_ACCOUNTING_BASIS ?? "F").trim().toUpperCase();
  const softwareCertificateNumberRaw = (process.env.SAFT_SOFTWARE_CERTIFICATE_NUMBER ?? "0").trim();

  if (!productIdRaw || !productIdRaw.includes("/")) {
    throw new Error("SAFT_PRODUCT_ID inválido. Use o formato 'NomeAplicacao/NomeProdutorSoftware'.");
  }

  if (taxAccountingBasisRaw !== "F" && taxAccountingBasisRaw !== "C") {
    throw new Error("SAFT_TAX_ACCOUNTING_BASIS inválido. Use 'F' (Facturação) ou 'C' (Contabilidade).");
  }

  if (!/^\d+$/.test(softwareCertificateNumberRaw)) {
    throw new Error("SAFT_SOFTWARE_CERTIFICATE_NUMBER inválido. Use apenas dígitos (ex.: 0).");
  }

  return {
    productId: productIdRaw,
    taxAccountingBasis: taxAccountingBasisRaw as "F" | "C",
    softwareCertificateNumber: softwareCertificateNumberRaw,
  };
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
        .select("id, empresa_id, periodo_inicio, periodo_fim, arquivo_storage_path, xsd_version, metadata")
        .eq("id", data.export_id)
        .maybeSingle<FiscalSaftExportRow>();

      if (error) throw new Error(error.message || "Falha ao carregar exportação SAF-T");
      if (!row) throw new Error("Exportação SAF-T não encontrada");
      return row;
    });

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
          .select("id, nome, nif, endereco, certificado_agt_numero")
          .eq("id", exportRow.empresa_id)
          .maybeSingle<FiscalEmpresaRow>(),
        supabase
          .from("fiscal_documentos")
          .select(
            "id, numero, numero_formatado, tipo_documento, invoice_date, system_entry, cliente_nome, cliente_nif, payload, total_liquido_aoa, total_impostos_aoa, total_bruto_aoa, hash_control, status, documento_origem_id, rectifica_documento_id"
            + ", moeda, taxa_cambio_aoa, payment_mechanism"
          )
          .eq("empresa_id", exportRow.empresa_id)
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
            + ", product_code, product_number_code"
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

      const headerConfig = resolveSaftHeaderConfig();
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

      const saftInput = {
        empresa: {
          id: empresa.id,
          nome: empresa.nome,
          nif: empresa.nif,
          endereco: empresa.endereco,
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
            return {
          itens:
            itemMap.get(doc.id)?.map((item) => {
              const settlementAmount = settlements.get(Number(item.linha_no)) ?? null;
              return {
                ...item,
                product_code: String(item.product_code ?? ""),
                product_number_code: item.product_number_code ? String(item.product_number_code) : null,
                quantidade: Number(item.quantidade),
                preco_unit: Number(item.preco_unit),
                taxa_iva: Number(item.taxa_iva),
                total_liquido_aoa: Number(item.total_liquido_aoa),
                total_impostos_aoa: Number(item.total_impostos_aoa),
                total_bruto_aoa: Number(item.total_bruto_aoa),
                settlement_amount: settlementAmount,
              };
            }) ?? [],
            };
          })(),
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
          taxa_cambio_aoa: doc.taxa_cambio_aoa == null ? null : Number(doc.taxa_cambio_aoa),
          payment_mechanism: parsePaymentMechanism(doc.payment_mechanism),
          total_liquido_aoa: Number(doc.total_liquido_aoa),
          total_impostos_aoa: Number(doc.total_impostos_aoa),
          total_bruto_aoa: Number(doc.total_bruto_aoa),
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
