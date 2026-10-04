import { NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";

import { recordAuditServer } from "@/lib/audit";
import { postFiscalChaveSchema } from "@/lib/schemas/fiscal-setup.schema";
import { supabaseRouteClient } from "@/lib/supabaseServer";
import { supabaseServerRole } from "@/lib/supabaseServerRole";
import { resolveEscolaIdForUser } from "@/lib/tenant/resolveEscolaIdForUser";
import type { Database, Json } from "~types/supabase";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

type JsonRecord = Record<string, unknown>;
type RouteSupabase = SupabaseClient<Database>;

const FISCAL_CHAVE_ROLES = ["owner", "admin"] as const;

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

async function checkSuperAdmin(supabase: RouteSupabase) {
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
  const parsed = postFiscalChaveSchema.safeParse(body);

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

    const escolaId = await resolveEscolaIdForUser(supabase, user.id);
    const isSuperAdmin = await checkSuperAdmin(supabase);

    if (!isSuperAdmin) {
      const { data: membership, error: membershipError } = await supabase
        .from("fiscal_empresa_users")
        .select("role")
        .eq("empresa_id", parsed.data.empresa_id)
        .eq("user_id", user.id)
        .in("role", [...FISCAL_CHAVE_ROLES])
        .maybeSingle();

      if (membershipError) {
        return jsonError(
          500,
          "FISCAL_CHAVE_AUTH_FAILED",
          membershipError.message || "Falha ao validar acesso fiscal.",
          { request_id: requestId }
        );
      }

      if (!membership) {
        return jsonError(403, "FORBIDDEN", "Sem permissão fiscal para cadastrar chave.", {
          request_id: requestId,
          empresa_id: parsed.data.empresa_id,
        });
      }
    }

    if (!parsed.data.private_key_ref) {
      return jsonError(
        400,
        "FISCAL_KMS_REFERENCE_REQUIRED",
        "A chave fiscal privada deve ser referenciada por KMS; material privado em claro não é aceite.",
        { request_id: requestId }
      );
    }

    const admin = supabaseServerRole<Database>() as any;
    const { data: chave, error: chaveError } = await admin.rpc(
      "fiscal_register_key_ref",
      {
        p_empresa_id: parsed.data.empresa_id,
        p_key_version: parsed.data.key_version,
        p_public_key_pem: parsed.data.public_key_pem,
        p_private_key_ref: parsed.data.private_key_ref,
        p_key_fingerprint: parsed.data.key_fingerprint,
        p_status: parsed.data.status,
        p_metadata: (parsed.data.metadata ?? {}) as Json,
      }
    );

    if (chaveError || !chave) {
      const status = chaveError?.code === "23505" ? 409 : 500;
      return jsonError(
        status,
        "FISCAL_CHAVE_CREATE_FAILED",
        chaveError?.message || "Falha ao criar chave fiscal.",
        { request_id: requestId }
      );
    }

    if (escolaId) {
      recordAuditServer({
        escolaId,
        portal: isSuperAdmin ? "super_admin" : "financeiro",
        acao: "FISCAL_CHAVE_CRIADA",
        entity: "fiscal_chaves",
        entityId: chave.id,
        details: { request_id: requestId, empresa_id: chave.empresa_id },
      }).catch(() => null);
    }

    return NextResponse.json({ ok: true, data: chave, request_id: requestId }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro interno ao criar chave fiscal.";
    return jsonError(500, "FISCAL_ROUTE_INTERNAL_ERROR", message, { request_id: requestId });
  }
}
