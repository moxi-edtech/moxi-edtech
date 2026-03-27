import { NextResponse } from "next/server";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import { supabaseRouteClient } from "@/lib/supabaseServer";
import { resolveEscolaIdForUser } from "@/lib/tenant/resolveEscolaIdForUser";
import type { Database } from "~types/supabase";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

const SAFT_BUCKET = "fiscal-saft";
const SIGNED_URL_TTL_SECONDS = 300;
const ALLOWED_FISCAL_ROLES = ["owner", "admin", "operator"] as const;

type RouteSupabase = SupabaseClient<Database>;

type SaftExportRow = Pick<
  Database["public"]["Tables"]["fiscal_saft_exports"]["Row"],
  "id" | "empresa_id" | "periodo_inicio" | "periodo_fim" | "arquivo_storage_path" | "status" | "created_at"
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

function getSupabaseAdmin() {
  const url = (process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").trim();
  const key = (process.env.SUPABASE_SERVICE_ROLE_KEY ?? "").trim();
  if (!url || !key) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY ausente");
  }
  return createClient<Database>(url, key);
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

export async function GET(
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
      .select("id, empresa_id, periodo_inicio, periodo_fim, arquivo_storage_path, status, created_at")
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

    if (!["validated", "submitted", "generated"].includes(exportRow.status)) {
      return jsonError(
        409,
        "FISCAL_SAFT_EXPORT_NOT_READY",
        "Exportação ainda não está pronta para download.",
        {
          request_id: requestId,
          export_id: exportId,
          status: exportRow.status,
        }
      );
    }

    if (!exportRow.arquivo_storage_path || exportRow.arquivo_storage_path.trim().length === 0) {
      return jsonError(
        409,
        "FISCAL_SAFT_EXPORT_NOT_READY",
        "Exportação ainda não possui ficheiro gerado para download.",
        {
          request_id: requestId,
          export_id: exportId,
          status: exportRow.status,
        }
      );
    }

    const supabaseAdmin = getSupabaseAdmin();
    const { data: signed, error: signedError } = await supabaseAdmin.storage
      .from(SAFT_BUCKET)
      .createSignedUrl(exportRow.arquivo_storage_path, SIGNED_URL_TTL_SECONDS);

    if (signedError || !signed?.signedUrl) {
      return jsonError(
        500,
        "FISCAL_SAFT_DOWNLOAD_SIGN_FAILED",
        signedError?.message || "Falha ao gerar URL assinada de download.",
        {
          request_id: requestId,
          export_id: exportId,
        }
      );
    }

    return NextResponse.json(
      {
        ok: true,
        data: {
          exportacao: exportRow,
          download_url: signed.signedUrl,
          expires_in_seconds: SIGNED_URL_TTL_SECONDS,
        },
        request_id: requestId,
      },
      { status: 200 }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro interno ao gerar download SAF-T(AO).";
    return jsonError(500, "FISCAL_ROUTE_INTERNAL_ERROR", message, { request_id: requestId });
  }
}
