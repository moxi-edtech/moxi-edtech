import { NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";

import { supabaseRouteClient } from "@/lib/supabaseServer";
import { recordAuditServer } from "@/lib/audit";
import { resolveEscolaIdForUser } from "@/lib/tenant/resolveEscolaIdForUser";
import { inngest } from "@/inngest/client";
import type { Database, Json } from "~types/supabase";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

const ALLOWED_FISCAL_ROLES = ["owner", "admin", "operator"] as const;

type RouteSupabase = SupabaseClient<Database>;

type SaftExportRow = Pick<
  Database["public"]["Tables"]["fiscal_saft_exports"]["Row"],
  | "id"
  | "empresa_id"
  | "periodo_inicio"
  | "periodo_fim"
  | "arquivo_storage_path"
  | "xsd_version"
  | "status"
  | "checksum_sha256"
  | "metadata"
>;

function jsonError(status: number, code: string, message: string, details?: Record<string, unknown>) {
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

export async function POST(
  _req: Request,
  context: { params: Promise<{ exportId: string }> }
) {
  const requestId = crypto.randomUUID();
  const { exportId } = await context.params;

  if (!exportId) {
    return jsonError(400, "INVALID_EXPORT_ID", "Export ID inválido.", { request_id: requestId });
  }

  try {
    const supabase = await supabaseRouteClient<Database>();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return jsonError(401, "UNAUTHENTICATED", "Utilizador não autenticado.", {
        request_id: requestId,
      });
    }

    const { data: exportRow, error: exportError } = await supabase
      .from("fiscal_saft_exports")
      .select(
        "id, empresa_id, periodo_inicio, periodo_fim, arquivo_storage_path, xsd_version, status, checksum_sha256, metadata"
      )
      .eq("id", exportId)
      .maybeSingle<SaftExportRow>();

    if (exportError) {
      return jsonError(
        500,
        "FISCAL_SAFT_EXPORT_LOOKUP_FAILED",
        exportError.message || "Falha ao obter exportação SAF-T(AO).",
        { request_id: requestId, export_id: exportId }
      );
    }

    if (!exportRow) {
      return jsonError(404, "FISCAL_SAFT_EXPORT_NOT_FOUND", "Exportação SAF-T(AO) não encontrada.", {
        request_id: requestId,
        export_id: exportId,
      });
    }

    const escolaId = await resolveEscolaIdForUser(supabase, user.id);
    const access = await requireFiscalAccess({
      supabase,
      userId: user.id,
      empresaId: exportRow.empresa_id,
      escolaId,
    });

    if (!access.ok) {
      return jsonError(access.status, access.code, access.message, {
        request_id: requestId,
        export_id: exportId,
      });
    }

    if (!["queued", "generated", "validated", "failed", "submitted"].includes(exportRow.status)) {
      return jsonError(
        409,
        "FISCAL_SAFT_RETRY_NOT_ALLOWED",
        "Regeração permitida apenas para exportações queued, generated, validadas, submetidas ou falhadas.",
        {
          request_id: requestId,
          export_id: exportId,
          status: exportRow.status,
        }
      );
    }

    const metadata: Json = {};
    const previousMetadata =
      exportRow.metadata && typeof exportRow.metadata === "object" && !Array.isArray(exportRow.metadata)
        ? (exportRow.metadata as Record<string, unknown>)
        : {};
    const previousWorker =
      previousMetadata.worker && typeof previousMetadata.worker === "object"
        ? (previousMetadata.worker as Record<string, unknown>)
        : null;

    const { error: retryError } = await supabase
      .from("fiscal_saft_exports")
      .update({
        status: "queued",
        arquivo_storage_path: null,
        checksum_sha256: "pending",
        metadata,
      })
      .eq("id", exportRow.id);

    if (retryError) {
      return jsonError(
        500,
        "FISCAL_SAFT_RETRY_UPDATE_FAILED",
        retryError.message || "Falha ao colocar exportação na fila de regeração.",
        { request_id: requestId, export_id: exportId }
      );
    }

    if (escolaId) {
      recordAuditServer({
        escolaId,
        portal: "financeiro",
        acao: "FISCAL_SAFT_EXPORT_RETRY_REQUESTED",
        entity: "fiscal_saft_exports",
        entityId: exportRow.id,
        details: {
          request_id: requestId,
          empresa_id: exportRow.empresa_id,
          periodo_inicio: exportRow.periodo_inicio,
          periodo_fim: exportRow.periodo_fim,
          previous_status: exportRow.status,
          previous_checksum_sha256: exportRow.checksum_sha256,
          previous_storage_path: exportRow.arquivo_storage_path,
          previous_worker_state: (previousWorker?.state as Json | undefined) ?? null,
          previous_worker_finished_at: (previousWorker?.finished_at as Json | undefined) ?? null,
        },
      }).catch(() => null);
    }

    try {
      await inngest.send({
        name: "fiscal/saft-export.requested",
        data: {
          export_id: exportRow.id,
          empresa_id: exportRow.empresa_id,
          periodo_inicio: exportRow.periodo_inicio,
          periodo_fim: exportRow.periodo_fim,
          xsd_version: exportRow.xsd_version,
          requested_by: user.id,
          request_id: requestId,
        },
      });
    } catch (queueError) {
      if (escolaId) {
        recordAuditServer({
          escolaId,
          portal: "financeiro",
          acao: "FISCAL_SAFT_EXPORT_RETRY_QUEUE_FAILED",
          entity: "fiscal_saft_exports",
          entityId: exportRow.id,
          details: {
            request_id: requestId,
            empresa_id: exportRow.empresa_id,
            error: queueError instanceof Error ? queueError.message : String(queueError),
          },
        }).catch(() => null);
      }

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
        .eq("id", exportRow.id);

      return jsonError(
        503,
        "FISCAL_SAFT_QUEUE_UNAVAILABLE",
        "Fila de processamento indisponível para regeração SAF-T(AO).",
        { request_id: requestId, export_id: exportRow.id }
      );
    }

    if (escolaId) {
      recordAuditServer({
        escolaId,
        portal: "financeiro",
        acao: "FISCAL_SAFT_EXPORT_RETRY_QUEUED",
        entity: "fiscal_saft_exports",
        entityId: exportRow.id,
        details: {
          request_id: requestId,
          empresa_id: exportRow.empresa_id,
          periodo_inicio: exportRow.periodo_inicio,
          periodo_fim: exportRow.periodo_fim,
          status: "queued",
        },
      }).catch(() => null);
    }

    return NextResponse.json(
      {
        ok: true,
        data: {
          export_id: exportRow.id,
          status: "queued",
        },
        request_id: requestId,
      },
      { status: 202 }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro interno ao regerar SAF-T(AO).";
    return jsonError(500, "FISCAL_ROUTE_INTERNAL_ERROR", message, { request_id: requestId });
  }
}
