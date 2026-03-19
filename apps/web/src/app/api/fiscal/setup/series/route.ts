import { NextResponse } from "next/server";

import { recordAuditServer } from "@/lib/audit";
import { postFiscalSerieSchema } from "@/lib/schemas/fiscal-setup.schema";
import { supabaseRouteClient } from "@/lib/supabaseServer";
import { resolveEscolaIdForUser } from "@/lib/tenant/resolveEscolaIdForUser";
import type { Database, Json } from "~types/supabase";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

type JsonRecord = Record<string, unknown>;

const FISCAL_SERIE_ROLES = ["owner", "admin", "operator"] as const;

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
  const parsed = postFiscalSerieSchema.safeParse(body);

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
        .in("role", [...FISCAL_SERIE_ROLES])
        .maybeSingle();

      if (membershipError) {
        return jsonError(
          500,
          "FISCAL_SERIE_AUTH_FAILED",
          membershipError.message || "Falha ao validar acesso fiscal.",
          { request_id: requestId }
        );
      }

      if (!membership) {
        return jsonError(403, "FORBIDDEN", "Sem permissão fiscal para cadastrar série.", {
          request_id: requestId,
          empresa_id: parsed.data.empresa_id,
        });
      }
    }

    const payload: Database["public"]["Tables"]["fiscal_series"]["Insert"] = {
      empresa_id: parsed.data.empresa_id,
      tipo_documento: parsed.data.tipo_documento,
      prefixo: parsed.data.prefixo,
      origem_documento: parsed.data.origem_documento,
      ativa: parsed.data.ativa ?? true,
      metadata: (parsed.data.metadata ?? null) as Json | null,
    };

    const { data: serie, error: serieError } = await supabase
      .from("fiscal_series")
      .insert(payload)
      .select(
        "id, empresa_id, tipo_documento, prefixo, origem_documento, ativa, descontinuada_em"
      )
      .single();

    if (serieError || !serie) {
      const status = serieError?.code === "23505" ? 409 : 500;
      return jsonError(
        status,
        "FISCAL_SERIE_CREATE_FAILED",
        serieError?.message || "Falha ao criar série fiscal.",
        { request_id: requestId }
      );
    }

    if (escolaId) {
      recordAuditServer({
        escolaId,
        portal: isSuperAdmin ? "super_admin" : "financeiro",
        acao: "FISCAL_SERIE_CRIADA",
        entity: "fiscal_series",
        entityId: serie.id,
        details: { request_id: requestId, empresa_id: serie.empresa_id },
      }).catch(() => null);
    }

    return NextResponse.json({ ok: true, data: serie, request_id: requestId }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro interno ao criar série fiscal.";
    return jsonError(500, "FISCAL_ROUTE_INTERNAL_ERROR", message, { request_id: requestId });
  }
}
