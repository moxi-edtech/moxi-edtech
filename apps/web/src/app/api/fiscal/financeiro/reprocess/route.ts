import { NextResponse } from "next/server";

import { requireRoleInSchool, type Role } from "@/lib/authz";
import { readJsonWithLimit } from "@/lib/http/readJsonWithLimit";
import { supabaseRouteClient } from "@/lib/supabaseServer";
import { resolveEscolaIdForUser } from "@/lib/tenant/resolveEscolaIdForUser";
import { inngest } from "@/inngest/client";
import type { Database } from "~types/supabase";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

type JsonRecord = Record<string, unknown>;

const ALLOWED_FINANCEIRO_ROLES: Role[] = [
  "financeiro",
  "admin_financeiro",
  "secretaria_financeiro",
  "admin_escola",
  "admin",
  "super_admin",
];

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

async function resolveEmpresaBinding({
  supabase,
  escolaId,
  empresaId,
}: {
  supabase: Awaited<ReturnType<typeof supabaseRouteClient<Database>>>;
  escolaId: string;
  empresaId: string;
}) {
  const { data, error } = await supabase
    .from("fiscal_escola_bindings")
    .select("id, empresa_id")
    .eq("escola_id", escolaId)
    .eq("empresa_id", empresaId)
    .is("effective_to", null)
    .limit(1)
    .maybeSingle();

  if (error) {
    return {
      ok: false as const,
      status: 500,
      code: "FISCAL_BINDING_CHECK_FAILED",
      message: error.message || "Falha ao validar vínculo escola→empresa fiscal.",
    };
  }

  if (!data) {
    return {
      ok: false as const,
      status: 403,
      code: "FISCAL_ESCOLA_BINDING_NOT_FOUND",
      message: "A escola actual não está vinculada à empresa fiscal informada.",
    };
  }

  return { ok: true as const };
}

async function countPendingLinks({
  supabase,
  escolaId,
  empresaId,
}: {
  supabase: Awaited<ReturnType<typeof supabaseRouteClient<Database>>>;
  escolaId: string;
  empresaId: string;
}) {
  const { count, error } = await supabase
    .from("financeiro_fiscal_links")
    .select("id", { count: "exact", head: true })
    .eq("escola_id", escolaId)
    .eq("empresa_id", empresaId)
    .in("origem_tipo", ["financeiro_pagamentos_registrar", "financeiro_recibos_emitir"])
    .in("status", ["pending", "failed"])
    .is("fiscal_documento_id", null);

  if (error) {
    throw new Error(error.message || "Falha ao contar pendências fiscais.");
  }
  return count ?? 0;
}

export async function GET(req: Request) {
  const requestId = crypto.randomUUID();

  try {
    const url = new URL(req.url);
    const empresaId = (url.searchParams.get("empresa_id") ?? "").trim();

    if (!empresaId) {
      return jsonError(400, "INVALID_QUERY", "Parâmetro 'empresa_id' é obrigatório.", {
        request_id: requestId,
      });
    }

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

    const escolaId = await resolveEscolaIdForUser(supabase, user.id);
    if (!escolaId) {
      return jsonError(403, "NO_SCHOOL", "Usuário sem escola associada.", {
        request_id: requestId,
      });
    }

    const roleCheck = await requireRoleInSchool({
      supabase,
      escolaId,
      roles: ALLOWED_FINANCEIRO_ROLES,
    });
    if (roleCheck.error) return roleCheck.error;

    const binding = await resolveEmpresaBinding({ supabase, escolaId, empresaId });
    if (!binding.ok) {
      return jsonError(binding.status, binding.code, binding.message, {
        request_id: requestId,
      });
    }

    const pendingLinks = await countPendingLinks({ supabase, escolaId, empresaId });

    const supabaseAny = supabase as any;
    const { data: jobs, error: jobsError } = await supabaseAny
      .from("fiscal_reprocess_jobs")
      .select(
        "id, escola_id, empresa_id, status, total_links, processed_links, success_links, failed_links, requested_by, started_at, completed_at, error_message, metadata, created_at, updated_at"
      )
      .eq("escola_id", escolaId)
      .eq("empresa_id", empresaId)
      .order("created_at", { ascending: false })
      .limit(10);

    if (jobsError) {
      return jsonError(500, "FISCAL_REPROCESS_LIST_FAILED", jobsError.message, {
        request_id: requestId,
      });
    }

    return NextResponse.json({
      ok: true,
      data: {
        pending_links: pendingLinks,
        jobs: jobs ?? [],
      },
      request_id: requestId,
    });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Erro interno ao consultar reprocessamento fiscal.";
    return jsonError(500, "FISCAL_REPROCESS_STATUS_FAILED", message, {
      request_id: requestId,
    });
  }
}

export async function POST(req: Request) {
  const requestId = crypto.randomUUID();

  try {
    const body = await readJsonWithLimit(req, { maxBytes: 32 * 1024 }).catch(() => null);
    const empresaId =
      body && typeof body === "object" && "empresa_id" in body
        ? String((body as { empresa_id?: unknown }).empresa_id ?? "").trim()
        : "";

    if (!empresaId) {
      return jsonError(400, "INVALID_PAYLOAD", "Campo 'empresa_id' é obrigatório.", {
        request_id: requestId,
      });
    }

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

    const escolaId = await resolveEscolaIdForUser(supabase, user.id);
    if (!escolaId) {
      return jsonError(403, "NO_SCHOOL", "Usuário sem escola associada.", {
        request_id: requestId,
      });
    }

    const roleCheck = await requireRoleInSchool({
      supabase,
      escolaId,
      roles: ALLOWED_FINANCEIRO_ROLES,
    });
    if (roleCheck.error) return roleCheck.error;

    const binding = await resolveEmpresaBinding({ supabase, escolaId, empresaId });
    if (!binding.ok) {
      return jsonError(binding.status, binding.code, binding.message, {
        request_id: requestId,
      });
    }

    const pendingLinks = await countPendingLinks({ supabase, escolaId, empresaId });
    if (pendingLinks <= 0) {
      return jsonError(409, "FISCAL_REPROCESS_NOTHING_TO_DO", "Não existem pendências fiscais para reprocessar.", {
        request_id: requestId,
        empresa_id: empresaId,
      });
    }

    const supabaseAny = supabase as any;
    const { data: activeJob } = await supabaseAny
      .from("fiscal_reprocess_jobs")
      .select("id, status, created_at")
      .eq("escola_id", escolaId)
      .eq("empresa_id", empresaId)
      .in("status", ["queued", "processing"])
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (activeJob?.id) {
      return jsonError(409, "FISCAL_REPROCESS_ALREADY_RUNNING", "Já existe um reprocessamento fiscal em execução.", {
        request_id: requestId,
        job_id: activeJob.id,
        status: activeJob.status,
      });
    }

    const { data: insertedJob, error: insertError } = await supabaseAny
      .from("fiscal_reprocess_jobs")
      .insert({
        escola_id: escolaId,
        empresa_id: empresaId,
        status: "queued",
        total_links: pendingLinks,
        processed_links: 0,
        success_links: 0,
        failed_links: 0,
        requested_by: user.id,
        metadata: {
          source: "fiscal_cockpit_ui",
          request_id: requestId,
        },
      })
      .select(
        "id, escola_id, empresa_id, status, total_links, processed_links, success_links, failed_links, requested_by, started_at, completed_at, error_message, metadata, created_at, updated_at"
      )
      .single();

    if (insertError || !insertedJob?.id) {
      return jsonError(
        500,
        "FISCAL_REPROCESS_CREATE_FAILED",
        insertError?.message ?? "Falha ao criar job de reprocessamento fiscal.",
        { request_id: requestId }
      );
    }

    try {
      await inngest.send({
        name: "fiscal/financeiro-reprocess.requested",
        data: {
          job_id: insertedJob.id,
          escola_id: escolaId,
          empresa_id: empresaId,
          requested_by: user.id,
          request_id: requestId,
        },
      });
    } catch (eventError) {
      const message =
        eventError instanceof Error
          ? eventError.message
          : "Falha ao enfileirar reprocessamento fiscal.";
      await supabaseAny
        .from("fiscal_reprocess_jobs")
        .update({
          status: "failed",
          error_message: message,
          completed_at: new Date().toISOString(),
        })
        .eq("id", insertedJob.id);

      return jsonError(500, "FISCAL_REPROCESS_QUEUE_FAILED", message, {
        request_id: requestId,
        job_id: insertedJob.id,
      });
    }

    return NextResponse.json(
      {
        ok: true,
        data: insertedJob,
        request_id: requestId,
      },
      { status: 202 }
    );
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Erro interno ao solicitar reprocessamento fiscal.";
    return jsonError(500, "FISCAL_REPROCESS_REQUEST_FAILED", message, {
      request_id: requestId,
    });
  }
}
