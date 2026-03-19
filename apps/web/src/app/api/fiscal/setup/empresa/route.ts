import { NextResponse } from "next/server";

import { recordAuditServer } from "@/lib/audit";
import { postFiscalEmpresaSchema } from "@/lib/schemas/fiscal-setup.schema";
import { supabaseRouteClient } from "@/lib/supabaseServer";
import { resolveEscolaIdForUser } from "@/lib/tenant/resolveEscolaIdForUser";
import type { Database, Json } from "~types/supabase";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

type JsonRecord = Record<string, unknown>;

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
  const parsed = postFiscalEmpresaSchema.safeParse(body);

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
    const escolaId = await resolveEscolaIdForUser(supabase, user.id);

    if (!isSuperAdmin) {
      return jsonError(403, "FORBIDDEN", "Apenas Super Admin pode criar empresa fiscal.", {
        request_id: requestId,
      });
    }

    const payload: Database["public"]["Tables"]["fiscal_empresas"]["Insert"] = {
      nome: parsed.data.nome,
      nif: parsed.data.nif,
      endereco: parsed.data.endereco ?? null,
      certificado_agt_numero: parsed.data.certificado_agt_numero ?? null,
      metadata: (parsed.data.metadata ?? null) as Json | null,
    };

    const { data: empresa, error: empresaError } = await supabase
      .from("fiscal_empresas")
      .insert(payload)
      .select("id, nome, nif, status")
      .single();

    if (empresaError || !empresa) {
      const status = empresaError?.code === "23505" ? 409 : 500;
      return jsonError(
        status,
        "FISCAL_EMPRESA_CREATE_FAILED",
        empresaError?.message || "Falha ao criar empresa fiscal.",
        { request_id: requestId }
      );
    }

    const { error: membershipError } = await supabase.from("fiscal_empresa_users").insert({
      empresa_id: empresa.id,
      user_id: user.id,
      role: "owner",
    });

    if (membershipError) {
      return jsonError(
        500,
        "FISCAL_EMPRESA_MEMBERSHIP_FAILED",
        membershipError.message || "Falha ao registrar membership fiscal.",
        { request_id: requestId, empresa_id: empresa.id }
      );
    }

    if (escolaId) {
      recordAuditServer({
        escolaId,
        portal: "super_admin",
        acao: "FISCAL_EMPRESA_CRIADA",
        entity: "fiscal_empresas",
        entityId: empresa.id,
        details: { request_id: requestId, empresa_id: empresa.id, nif: empresa.nif },
      }).catch(() => null);
    }

    return NextResponse.json({ ok: true, data: empresa, request_id: requestId }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro interno ao criar empresa fiscal.";
    return jsonError(500, "FISCAL_ROUTE_INTERNAL_ERROR", message, { request_id: requestId });
  }
}
