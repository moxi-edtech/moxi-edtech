import { NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";

import { readJsonWithLimit } from "@/lib/http/readJsonWithLimit";
import { recordAuditServer } from "@/lib/audit";
import {
  postFiscalSaftExportSchema,
  type PostFiscalSaftExportInput,
} from "@/lib/schemas/fiscal-saft.schema";
import { supabaseRouteClient } from "@/lib/supabaseServer";
import { resolveEscolaIdForUser } from "@/lib/tenant/resolveEscolaIdForUser";
import { inngest } from "@/inngest/client";
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

type FiscalSaftExportListRow = Pick<
  Database["public"]["Tables"]["fiscal_saft_exports"]["Row"],
  | "id"
  | "empresa_id"
  | "periodo_inicio"
  | "periodo_fim"
  | "arquivo_storage_path"
  | "checksum_sha256"
  | "xsd_version"
  | "status"
  | "metadata"
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

const SAFT_HISTORY_STATUS_FILTERS = ["COMPLETED", "FAILED", "PROCESSING"] as const;
type SaftHistoryStatusFilter = (typeof SAFT_HISTORY_STATUS_FILTERS)[number];

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

export async function GET(req: Request) {
  const requestId = crypto.randomUUID();

  try {
    const url = new URL(req.url);
    const empresaId = (url.searchParams.get("empresa_id") ?? "").trim();
    const yearRaw = (url.searchParams.get("year") ?? "").trim();
    const statusRaw = (url.searchParams.get("status") ?? "").trim().toUpperCase();
    const limitRaw = Number(url.searchParams.get("limit") ?? "20");
    const limit = Number.isFinite(limitRaw) ? Math.max(1, Math.min(50, Math.trunc(limitRaw))) : 20;
    const year = /^\d{4}$/.test(yearRaw) ? Number(yearRaw) : null;
    const statusFilter = statusRaw
      ? (SAFT_HISTORY_STATUS_FILTERS.includes(statusRaw as SaftHistoryStatusFilter)
          ? (statusRaw as SaftHistoryStatusFilter)
          : null)
      : null;

    if (!empresaId) {
      return jsonError(400, "INVALID_QUERY", "Parâmetro 'empresa_id' é obrigatório.", {
        request_id: requestId,
      });
    }
    if (statusRaw && !statusFilter) {
      return jsonError(
        400,
        "INVALID_QUERY",
        "Parâmetro 'status' inválido. Use COMPLETED, FAILED ou PROCESSING.",
        { request_id: requestId }
      );
    }

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
    const access = await requireFiscalAccess({
      supabase,
      userId: user.id,
      empresaId,
      escolaId,
    });

    if (!access.ok) {
      return jsonError(access.status, access.code, access.message, {
        request_id: requestId,
        empresa_id: empresaId,
      });
    }

    let query = supabase
      .from("fiscal_saft_exports")
      .select(
        "id, empresa_id, periodo_inicio, periodo_fim, arquivo_storage_path, checksum_sha256, xsd_version, status, metadata, created_at"
      )
      .eq("empresa_id", empresaId)
      .order("created_at", { ascending: false });

    if (year !== null) {
      const from = `${year}-01-01`;
      const to = `${year}-12-31`;
      query = query.gte("periodo_inicio", from).lte("periodo_fim", to);
    }

    if (statusFilter) {
      if (statusFilter === "COMPLETED") {
        query = query.in("status", ["validated", "submitted"]);
      } else if (statusFilter === "FAILED") {
        query = query.eq("status", "failed");
      } else if (statusFilter === "PROCESSING") {
        query = query.in("status", ["queued", "processing", "generated"]);
      }
    }

    const { data, error } = await query.limit(limit).returns<FiscalSaftExportListRow[]>();

    if (error) {
      return jsonError(
        500,
        "FISCAL_SAFT_EXPORT_LIST_FAILED",
        error.message || "Falha ao listar exportações SAF-T(AO).",
        { request_id: requestId, empresa_id: empresaId }
      );
    }

    return NextResponse.json(
      {
        ok: true,
        data: {
          empresa_id: empresaId,
          exports: data ?? [],
          filters: {
            year,
            status: statusFilter,
          },
        },
        request_id: requestId,
      },
      { status: 200 }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro interno ao listar exportações SAF-T(AO).";
    return jsonError(500, "FISCAL_ROUTE_INTERNAL_ERROR", message, { request_id: requestId });
  }
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
      .select("id")
      .eq("id", body.empresa_id)
      .maybeSingle();

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

    const arquivoStoragePath = [
      "fiscal",
      "saft",
      body.empresa_id,
      `${body.periodo_inicio}_${body.periodo_fim}.xml`,
    ].join("/");

    const metadata: Json = {
      ...(body.metadata ?? {}),
      request_id: requestId,
      requested_at: new Date().toISOString(),
      requested_by: user.id,
      worker: { state: "queued" },
    };

    const exportPayload: Database["public"]["Tables"]["fiscal_saft_exports"]["Insert"] = {
      empresa_id: body.empresa_id,
      periodo_inicio: body.periodo_inicio,
      periodo_fim: body.periodo_fim,
      arquivo_storage_path: arquivoStoragePath,
      checksum_sha256: "pending",
      xsd_version: body.xsd_version,
      status: "queued",
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

    try {
      await inngest.send({
        name: "fiscal/saft-export.requested",
        data: {
          export_id: saftExport.id,
          empresa_id: body.empresa_id,
          periodo_inicio: body.periodo_inicio,
          periodo_fim: body.periodo_fim,
          xsd_version: body.xsd_version,
          requested_by: user.id,
          request_id: requestId,
        },
      });
    } catch (queueError) {
      await supabase
        .from("fiscal_saft_exports")
        .update({
          status: "failed",
          metadata: {
            ...(metadata as Record<string, unknown>),
            worker: {
              state: "failed_to_queue",
              error: queueError instanceof Error ? queueError.message : String(queueError),
            },
          } satisfies Json,
        })
        .eq("id", saftExport.id);

      return jsonError(
        503,
        "FISCAL_SAFT_QUEUE_UNAVAILABLE",
        "Fila de processamento indisponível para exportação SAF-T(AO).",
        { request_id: requestId, empresa_id: body.empresa_id, export_id: saftExport.id }
      );
    }

    if (escolaId) {
      recordAuditServer({
        escolaId,
        portal: "financeiro",
        acao: "FISCAL_SAFT_EXPORT_REQUESTED",
        entity: "fiscal_saft_exports",
        entityId: saftExport.id,
        details: {
          request_id: requestId,
          empresa_id: body.empresa_id,
          periodo_inicio: body.periodo_inicio,
          periodo_fim: body.periodo_fim,
          status: saftExport.status,
        },
      }).catch(() => null);
    }

    return NextResponse.json(
      {
        ok: true,
        data: {
          exportacao: saftExport,
        },
        request_id: requestId,
      },
      { status: 202 }
    );
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Erro interno ao exportar SAF-T(AO).";
    return jsonError(500, "FISCAL_ROUTE_INTERNAL_ERROR", message, { request_id: requestId });
  }
}
