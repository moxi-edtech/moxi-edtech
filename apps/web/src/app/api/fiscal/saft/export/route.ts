import { createHash } from "node:crypto";

import { NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";

import { buildSaftAoXml } from "@/lib/fiscal/saftAo";
import { SaftXsdValidationError, validateSaftXmlWithXsd } from "@/lib/fiscal/saftXsdValidator";
import { readJsonWithLimit } from "@/lib/http/readJsonWithLimit";
import { recordAuditServer } from "@/lib/audit";
import {
  postFiscalSaftExportSchema,
  type PostFiscalSaftExportInput,
} from "@/lib/schemas/fiscal-saft.schema";
import { supabaseRouteClient } from "@/lib/supabaseServer";
import { resolveEscolaIdForUser } from "@/lib/tenant/resolveEscolaIdForUser";
import type { Database, Json } from "~types/supabase";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

type JsonRecord = Record<string, unknown>;
type RouteSupabase = SupabaseClient<Database>;
type SaftHeaderConfig = {
  productId: string;
  taxAccountingBasis: "F" | "C";
  softwareCertificateNumber: string;
};

const ALLOWED_FISCAL_ROLES = ["owner", "admin", "operator"] as const;
const SAFT_EXPORT_STATUS_CONFLICT = "FISCAL_SAFT_EXPORT_ALREADY_EXISTS";
const AGT_PAYMENT_MECHANISMS = new Set(["NU", "TB", "CC", "MB"]);

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
};

type ClienteAddressFromPayload = {
  address_detail: string | null;
  city: string | null;
  postal_code: string | null;
  country: string | null;
};

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

type FiscalSaftExportRow = Pick<
  Database["public"]["Tables"]["fiscal_saft_exports"]["Row"],
  | "id"
  | "empresa_id"
  | "periodo_inicio"
  | "periodo_fim"
  | "arquivo_storage_path"
  | "checksum_sha256"
  | "xsd_version"
  | "status"
  | "created_at"
>;

function jsonError(status: number, code: string, message: string, details?: JsonRecord) {
  return NextResponse.json(
    {
      ok: false,
      error: {
        code,
        message,
        details: details ?? null,
      },
    },
    { status }
  );
}

function resolveSaftHeaderConfig(): SaftHeaderConfig {
  const productIdRaw = (process.env.SAFT_PRODUCT_ID ?? "").trim();
  const taxAccountingBasisRaw = (process.env.SAFT_TAX_ACCOUNTING_BASIS ?? "F").trim().toUpperCase();
  const softwareCertificateNumberRaw = (process.env.SAFT_SOFTWARE_CERTIFICATE_NUMBER ?? "0").trim();

  if (!productIdRaw || !productIdRaw.includes("/")) {
    throw new Error(
      "SAFT_PRODUCT_ID inválido. Use o formato 'NomeAplicacao/NomeProdutorSoftware'."
    );
  }

  if (taxAccountingBasisRaw !== "F" && taxAccountingBasisRaw !== "C") {
    throw new Error("SAFT_TAX_ACCOUNTING_BASIS inválido. Use 'F' (Facturação) ou 'C' (Contabilidade).");
  }

  if (!/^\d+$/.test(softwareCertificateNumberRaw)) {
    throw new Error("SAFT_SOFTWARE_CERTIFICATE_NUMBER inválido. Use apenas dígitos (ex.: 0).");
  }

  return {
    productId: productIdRaw,
    taxAccountingBasis: taxAccountingBasisRaw,
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

async function parseRequestBody(req: Request): Promise<PostFiscalSaftExportInput | null> {
  try {
    const body = await readJsonWithLimit(req, { maxBytes: 64 * 1024 });
    const parsed = postFiscalSaftExportSchema.safeParse(body);
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

async function requireFiscalAccess({
  supabase,
  userId,
  empresaId,
  escolaId,
}: {
  supabase: RouteSupabase;
  userId: string;
  empresaId: string;
  escolaId: string | null;
}) {
  const { data: membership, error } = await supabase
    .from("fiscal_empresa_users")
    .select("role")
    .eq("empresa_id", empresaId)
    .eq("user_id", userId)
    .in("role", [...ALLOWED_FISCAL_ROLES])
    .maybeSingle();

  if (error) {
    return {
      ok: false as const,
      status: 500,
      code: "FISCAL_AUTH_CHECK_FAILED",
      message: error.message || "Falha ao validar acesso fiscal.",
    };
  }

  if (!membership) {
    return {
      ok: false as const,
      status: 403,
      code: "FORBIDDEN",
      message: "Sem acesso fiscal à empresa informada.",
    };
  }

  if (!escolaId) {
    return { ok: true as const };
  }

  const { data: binding, error: bindingError } = await supabase
    .from("fiscal_escola_bindings")
    .select("id")
    .eq("empresa_id", empresaId)
    .eq("escola_id", escolaId)
    .is("effective_to", null)
    .limit(1)
    .maybeSingle();

  if (bindingError) {
    return {
      ok: false as const,
      status: 500,
      code: "FISCAL_BINDING_CHECK_FAILED",
      message: bindingError.message || "Falha ao validar vínculo escola→empresa fiscal.",
    };
  }

  if (!binding) {
    return {
      ok: false as const,
      status: 403,
      code: "FISCAL_ESCOLA_BINDING_NOT_FOUND",
      message: "A escola actual do utilizador não está vinculada à empresa fiscal informada.",
    };
  }

  return { ok: true as const };
}

export async function POST(req: Request) {
  const requestId = crypto.randomUUID();
  const body = await parseRequestBody(req);

  if (!body) {
    return jsonError(400, "INVALID_PAYLOAD", "O corpo da requisição é inválido.", {
      request_id: requestId,
    });
  }

  try {
    const supabase = await supabaseRouteClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return jsonError(401, "UNAUTHENTICATED", "Utilizador não autenticado.", {
        request_id: requestId,
      });
    }

    const escolaId = await resolveEscolaIdForUser(supabase, user.id);
    const auditEscolaId = escolaId;

    const access = await requireFiscalAccess({
      supabase,
      userId: user.id,
      empresaId: body.empresa_id,
      escolaId,
    });

    if (!access.ok) {
      return jsonError(access.status, access.code, access.message, {
        request_id: requestId,
        empresa_id: body.empresa_id,
      });
    }

    const { data: empresa, error: empresaError } = await supabase
      .from("fiscal_empresas")
      .select("id, nome, nif, endereco, certificado_agt_numero")
      .eq("id", body.empresa_id)
      .maybeSingle<FiscalEmpresaRow>();

    if (empresaError) {
      return jsonError(
        500,
        "FISCAL_EMPRESA_LOOKUP_FAILED",
        empresaError.message || "Falha ao obter empresa fiscal.",
        { request_id: requestId, empresa_id: body.empresa_id }
      );
    }

    if (!empresa) {
      return jsonError(404, "FISCAL_EMPRESA_NOT_FOUND", "Empresa fiscal não encontrada.", {
        request_id: requestId,
        empresa_id: body.empresa_id,
      });
    }

    const { data: documentos, error: documentosError } = await supabase
      .from("fiscal_documentos")
      .select(
        "id, numero, numero_formatado, tipo_documento, invoice_date, system_entry, cliente_nome, cliente_nif, payload, total_liquido_aoa, total_impostos_aoa, total_bruto_aoa, hash_control, status"
        + ", moeda, taxa_cambio_aoa, payment_mechanism"
      )
      .eq("empresa_id", body.empresa_id)
      .gte("invoice_date", body.periodo_inicio)
      .lte("invoice_date", body.periodo_fim)
      .order("invoice_date", { ascending: true })
      .order("numero", { ascending: true })
      .order("id", { ascending: true })
      .returns<FiscalDocumentoRow[]>();

    if (documentosError) {
      return jsonError(
        500,
        "FISCAL_DOCUMENTOS_LOOKUP_FAILED",
        documentosError.message || "Falha ao obter documentos para exportação SAF-T(AO).",
        { request_id: requestId, empresa_id: body.empresa_id }
      );
    }

    const documentoRows = documentos ?? [];
    const documentoIds = documentoRows.map((row) => row.id);
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

      if (itensError) {
        return jsonError(
          500,
          "FISCAL_ITENS_LOOKUP_FAILED",
          itensError.message || "Falha ao obter itens para exportação SAF-T(AO).",
          { request_id: requestId, empresa_id: body.empresa_id }
        );
      }

      for (const item of itens ?? []) {
        const current = itemMap.get(item.documento_id) ?? [];
        current.push(item);
        itemMap.set(item.documento_id, current);
      }
    }

    const headerConfig = resolveSaftHeaderConfig();
    const generatedAtIso = new Date().toISOString();
    const saftInput = {
      empresa: {
        id: empresa.id,
        nome: empresa.nome,
        nif: empresa.nif,
        endereco: empresa.endereco,
        certificadoAgtNumero: empresa.certificado_agt_numero,
      },
      periodoInicio: body.periodo_inicio,
      periodoFim: body.periodo_fim,
      header: headerConfig,
      generatedAtIso,
      documentos: documentoRows.map((doc) => ({
        ...parseClienteAddressFromPayload(doc.payload),
        ...doc,
        itens:
          itemMap.get(doc.id)?.map((item) => ({
            ...item,
            product_code: String(item.product_code ?? ""),
            product_number_code: item.product_number_code ? String(item.product_number_code) : null,
            quantidade: Number(item.quantidade),
            preco_unit: Number(item.preco_unit),
            taxa_iva: Number(item.taxa_iva),
            total_liquido_aoa: Number(item.total_liquido_aoa),
            total_impostos_aoa: Number(item.total_impostos_aoa),
            total_bruto_aoa: Number(item.total_bruto_aoa),
          })) ?? [],
        moeda: String(doc.moeda ?? "AOA").toUpperCase(),
        taxa_cambio_aoa:
          doc.taxa_cambio_aoa == null ? null : Number(doc.taxa_cambio_aoa),
        payment_mechanism: parsePaymentMechanism(doc.payment_mechanism),
        total_liquido_aoa: Number(doc.total_liquido_aoa),
        total_impostos_aoa: Number(doc.total_impostos_aoa),
        total_bruto_aoa: Number(doc.total_bruto_aoa),
      })),
    };

    const { xml, summary } = buildSaftAoXml(saftInput);
    let xsdValidation: Awaited<ReturnType<typeof validateSaftXmlWithXsd>>;
    try {
      xsdValidation = await validateSaftXmlWithXsd({
        xml,
        xsdVersion: body.xsd_version,
      });
    } catch (error) {
      if (error instanceof SaftXsdValidationError) {
        const status =
          error.code === "XSD_VALIDATION_FAILED"
            ? 422
            : error.code === "XSD_VALIDATOR_UNAVAILABLE"
              ? 503
              : error.code === "XSD_SCHEMA_NOT_FOUND"
                ? 500
                : 400;
        return jsonError(
          status,
          "FISCAL_SAFT_XSD_INVALID",
          error.message,
          {
            request_id: requestId,
            empresa_id: body.empresa_id,
            xsd_validation: {
              code: error.code,
              validator: error.validator,
              xsdVersion: error.xsdVersion,
              xsdPath: error.xsdPath,
              validatedAt: error.validatedAt,
              output: error.output,
              failures: error.failures,
            },
          }
        );
      }
      throw error;
    }

    const checksumSha256 = createHash("sha256").update(xml).digest("hex");
    const arquivoStoragePath = [
      "fiscal",
      "saft",
      body.empresa_id,
      `${body.periodo_inicio}_${body.periodo_fim}_${requestId}.xml`,
    ].join("/");

    const metadata: Json = {
      ...(body.metadata ?? {}),
      request_id: requestId,
      generated_at: generatedAtIso,
      summary,
    };

    const exportPayload: Database["public"]["Tables"]["fiscal_saft_exports"]["Insert"] = {
      empresa_id: body.empresa_id,
      periodo_inicio: body.periodo_inicio,
      periodo_fim: body.periodo_fim,
      arquivo_storage_path: arquivoStoragePath,
      checksum_sha256: checksumSha256,
      xsd_version: body.xsd_version,
      status: "generated",
      metadata,
      created_by: user.id,
    };

    const { data: saftExport, error: exportError } = await supabase
      .from("fiscal_saft_exports")
      .insert(exportPayload)
      .select(
        "id, empresa_id, periodo_inicio, periodo_fim, arquivo_storage_path, checksum_sha256, xsd_version, status, created_at"
      )
      .single<FiscalSaftExportRow>();

    if (exportError) {
      if (exportError.code === "23505") {
        const { data: existing } = await supabase
          .from("fiscal_saft_exports")
          .select(
            "id, empresa_id, periodo_inicio, periodo_fim, arquivo_storage_path, checksum_sha256, xsd_version, status, created_at"
          )
          .eq("empresa_id", body.empresa_id)
          .eq("periodo_inicio", body.periodo_inicio)
          .eq("periodo_fim", body.periodo_fim)
          .maybeSingle<FiscalSaftExportRow>();

        return jsonError(
          409,
          SAFT_EXPORT_STATUS_CONFLICT,
          "Já existe exportação SAF-T(AO) para este período.",
          {
            request_id: requestId,
            empresa_id: body.empresa_id,
            export_id: existing?.id ?? null,
          }
        );
      }

      return jsonError(
        500,
        "FISCAL_SAFT_EXPORT_CREATE_FAILED",
        exportError.message || "Falha ao persistir exportação SAF-T(AO).",
        { request_id: requestId, empresa_id: body.empresa_id }
      );
    }

    let auditEventInsertError: string | null = null;
    if (documentoRows.length > 0) {
      const eventPayload: Json = {
        export_id: saftExport.id,
        periodo_inicio: body.periodo_inicio,
        periodo_fim: body.periodo_fim,
        checksum_sha256: checksumSha256,
      };

      const events: Database["public"]["Tables"]["fiscal_documentos_eventos"]["Insert"][] =
        documentoRows.map((doc) => ({
          empresa_id: body.empresa_id,
          documento_id: doc.id,
          tipo_evento: "SAFT_EXPORTADO",
          payload: eventPayload,
          created_by: user.id,
        }));

      const { error: eventsError } = await supabase.from("fiscal_documentos_eventos").insert(events);
      if (eventsError) {
        auditEventInsertError =
          eventsError.message || "Falha ao registar eventos fiscais de exportação.";
      }
    }

    if (auditEscolaId) {
      recordAuditServer({
        escolaId: auditEscolaId,
        portal: "financeiro",
        acao: "FISCAL_SAFT_EXPORTADO",
        entity: "fiscal_saft_exports",
        entityId: saftExport.id,
        details: {
          request_id: requestId,
          empresa_id: body.empresa_id,
          periodo_inicio: body.periodo_inicio,
          periodo_fim: body.periodo_fim,
          documentos_total: documentoRows.length,
          status: saftExport.status,
        },
      }).catch(() => null);
    }

    return NextResponse.json(
      {
        ok: true,
        data: {
          exportacao: saftExport,
          summary,
          xsd_validation: xsdValidation,
          saft_xml: xml,
          content_type: "application/xml",
        },
        warnings: auditEventInsertError ? [{ code: "AUDIT_EVENT_INSERT_FAILED", message: auditEventInsertError }] : [],
        request_id: requestId,
      },
      { status: 201 }
    );
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Erro interno ao exportar SAF-T(AO).";
    return jsonError(500, "FISCAL_ROUTE_INTERNAL_ERROR", message, { request_id: requestId });
  }
}
