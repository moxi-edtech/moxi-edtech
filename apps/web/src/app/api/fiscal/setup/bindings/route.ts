import { NextResponse } from "next/server";

import { recordAuditServer } from "@/lib/audit";
import { requireRoleInSchool } from "@/lib/authz";
import { postFiscalBindingSchema } from "@/lib/schemas/fiscal-setup.schema";
import { supabaseRouteClient } from "@/lib/supabaseServer";
import { resolveEscolaIdForUser } from "@/lib/tenant/resolveEscolaIdForUser";
import type { Database, Json } from "~types/supabase";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

type JsonRecord = Record<string, unknown>;

const ESCOLA_ROLES = [
  "admin",
  "admin_escola",
  "staff_admin",
  "financeiro",
  "admin_financeiro",
  "secretaria_financeiro",
] as const;

const FISCAL_BINDING_ROLES = ["owner", "admin"] as const;

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

async function parseRequestBody(req: Request) {
  try {
    return await req.json();
  } catch {
    return null;
  }
}

async function checkSuperAdmin(supabase: any) {
  try {
    const { data, error } = await supabase.rpc("check_super_admin_role");
    if (error) return false;
    return data === true;
  } catch {
    return false;
  }
}

export async function POST(req: Request) {
  const requestId = crypto.randomUUID();
  const body = await parseRequestBody(req);
  const parsed = postFiscalBindingSchema.safeParse(body);

  if (!parsed.success) {
    return jsonError(400, "INVALID_PAYLOAD", "O corpo da requisição é inválido.", {
      request_id: requestId,
      field_errors: parsed.error.flatten().fieldErrors,
      form_errors: parsed.error.flatten().formErrors,
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

    const isSuperAdmin = await checkSuperAdmin(supabase);
    const requestedEscolaId = parsed.data.escola_id ?? null;
    const resolvedEscolaId = await resolveEscolaIdForUser(supabase, user.id, requestedEscolaId);
    const escolaId = resolvedEscolaId ?? (isSuperAdmin ? requestedEscolaId : null);

    if (!escolaId) {
      return jsonError(403, "ESCOLA_ACCESS_DENIED", "Sem acesso à escola informada.", {
        request_id: requestId,
      });
    }

    const roleCheck = await requireRoleInSchool({
      supabase,
      escolaId,
      roles: [...ESCOLA_ROLES],
    });

    if (roleCheck.error) {
      return roleCheck.error;
    }

    if (!isSuperAdmin) {
      const { data: membership, error: membershipError } = await supabase
        .from("fiscal_empresa_users")
        .select("role")
        .eq("empresa_id", parsed.data.empresa_id)
        .eq("user_id", user.id)
        .in("role", [...FISCAL_BINDING_ROLES])
        .maybeSingle();

      if (membershipError) {
        return jsonError(
          500,
          "FISCAL_BINDING_AUTH_FAILED",
          membershipError.message || "Falha ao validar acesso fiscal.",
          { request_id: requestId }
        );
      }

      if (!membership) {
        return jsonError(403, "FORBIDDEN", "Sem permissão fiscal para vincular escola.", {
          request_id: requestId,
          empresa_id: parsed.data.empresa_id,
        });
      }
    }

    const payload: Database["public"]["Tables"]["fiscal_escola_bindings"]["Insert"] = {
      empresa_id: parsed.data.empresa_id,
      escola_id: escolaId,
      is_primary: parsed.data.is_primary ?? true,
      metadata: (parsed.data.metadata ?? null) as Json | null,
    };

    if (parsed.data.effective_from) {
      payload.effective_from = parsed.data.effective_from;
    }

    if (parsed.data.effective_to !== undefined) {
      payload.effective_to = parsed.data.effective_to;
    }

    const { data: binding, error: bindingError } = await supabase
      .from("fiscal_escola_bindings")
      .insert(payload)
      .select("id, escola_id, empresa_id, is_primary, effective_from, effective_to")
      .single();

    if (bindingError || !binding) {
      const status = bindingError?.code === "23505" ? 409 : 500;
      return jsonError(
        status,
        "FISCAL_BINDING_CREATE_FAILED",
        bindingError?.message || "Falha ao vincular escola à empresa fiscal.",
        { request_id: requestId }
      );
    }

    recordAuditServer({
      escolaId,
      portal: isSuperAdmin ? "super_admin" : "financeiro",
      acao: "FISCAL_ESCOLA_VINCULADA",
      entity: "fiscal_escola_bindings",
      entityId: binding.id,
      details: { request_id: requestId, empresa_id: binding.empresa_id },
    }).catch(() => null);

    return NextResponse.json({ ok: true, data: binding, request_id: requestId }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro interno ao criar vínculo fiscal.";
    return jsonError(500, "FISCAL_ROUTE_INTERNAL_ERROR", message, { request_id: requestId });
  }
}
