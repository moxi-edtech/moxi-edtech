import { NextResponse } from "next/server";
import { z } from "zod";

import { recordAuditServer } from "@/lib/audit";
import {
  fiscalDocumentoActionSchema,
  type FiscalDocumentoActionInput,
} from "@/lib/schemas/fiscal-documento.schema";
import { supabaseRouteClient } from "@/lib/supabaseServer";
import { resolveEscolaIdForUser } from "@/lib/tenant/resolveEscolaIdForUser";
import type { Database, Json } from "~types/supabase";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

type JsonRecord = Record<string, unknown>;

const paramsSchema = z.object({
  documentoId: z.string().uuid(),
});

const ALLOWED_ROLES = ["owner", "admin", "operator"] as const;

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

async function parseRequestBody(req: Request): Promise<FiscalDocumentoActionInput | null> {
  try {
    const body = await req.json();
    const parsed = fiscalDocumentoActionSchema.safeParse(body);
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

export async function POST(
  req: Request,
  context: { params: Promise<{ documentoId: string }> }
) {
  const requestId = crypto.randomUUID();
  const rawParams = await context.params;
  const parsedParams = paramsSchema.safeParse(rawParams);

  if (!parsedParams.success) {
    return jsonError(400, "INVALID_PARAMS", "Parâmetros inválidos.", {
      request_id: requestId,
      field_errors: parsedParams.error.flatten().fieldErrors,
    });
  }

  const body = await parseRequestBody(req);
  if (!body) {
    return jsonError(400, "INVALID_PAYLOAD", "O corpo da requisição é inválido.", {
      request_id: requestId,
    });
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

    const { data: documento, error: documentoError } = await supabase
      .from("fiscal_documentos")
      .select("id, empresa_id, status")
      .eq("id", parsedParams.data.documentoId)
      .maybeSingle();

    if (documentoError) {
      return jsonError(
        500,
        "FISCAL_DOCUMENTO_LOOKUP_FAILED",
        documentoError.message || "Falha ao obter documento fiscal.",
        { request_id: requestId, documento_id: parsedParams.data.documentoId }
      );
    }

    if (!documento) {
      return jsonError(404, "FISCAL_DOCUMENTO_NOT_FOUND", "Documento fiscal não encontrado.", {
        request_id: requestId,
        documento_id: parsedParams.data.documentoId,
      });
    }

    const { data: membership, error: membershipError } = await supabase
      .from("fiscal_empresa_users")
      .select("role")
      .eq("empresa_id", documento.empresa_id)
      .eq("user_id", user.id)
      .in("role", [...ALLOWED_ROLES])
      .maybeSingle();

    if (membershipError) {
      return jsonError(
        500,
        "FISCAL_AUTH_CHECK_FAILED",
        membershipError.message || "Falha ao validar acesso fiscal.",
        { request_id: requestId, empresa_id: documento.empresa_id }
      );
    }

    if (!membership) {
      return jsonError(403, "FORBIDDEN", "Sem acesso fiscal ao documento informado.", {
        request_id: requestId,
        empresa_id: documento.empresa_id,
      });
    }

    const escolaId = await resolveEscolaIdForUser(supabase, user.id);
    const auditEscolaId = escolaId;

    if (escolaId) {
      const { data: binding, error: bindingError } = await supabase
        .from("fiscal_escola_bindings")
        .select("id")
        .eq("empresa_id", documento.empresa_id)
        .eq("escola_id", escolaId)
        .is("effective_to", null)
        .limit(1)
        .maybeSingle();

      if (bindingError) {
        return jsonError(
          500,
          "FISCAL_BINDING_CHECK_FAILED",
          bindingError.message || "Falha ao validar vínculo escola→empresa fiscal.",
          { request_id: requestId, escola_id: escolaId }
        );
      }

      if (!binding) {
        return jsonError(
          403,
          "FISCAL_ESCOLA_BINDING_NOT_FOUND",
          "A escola actual do utilizador não está vinculada à empresa fiscal informada.",
          { request_id: requestId, escola_id: escolaId, empresa_id: documento.empresa_id }
        );
      }
    }

    const payload: Database["public"]["Tables"]["fiscal_documentos_eventos"]["Insert"] = {
      empresa_id: documento.empresa_id,
      documento_id: documento.id,
      tipo_evento: "SUBMETIDO",
      created_by: user.id,
      payload: {
        motivo: body.motivo,
        metadata: body.metadata ?? {},
        status_documento: documento.status,
      } as Json,
    };

    const { data: event, error: eventError } = await supabase
      .from("fiscal_documentos_eventos")
      .insert(payload)
      .select("id, documento_id, tipo_evento, created_at")
      .single();

    if (eventError || !event) {
      return jsonError(
        500,
        "FISCAL_SUBMISSAO_CREATE_FAILED",
        eventError?.message || "Falha ao criar evento de submissão fiscal.",
        { request_id: requestId, documento_id: documento.id }
      );
    }

    if (auditEscolaId) {
      recordAuditServer({
        escolaId: auditEscolaId,
        portal: "financeiro",
        acao: "FISCAL_DOCUMENTO_SUBMETIDO",
        entity: "fiscal_documentos_eventos",
        entityId: event.id,
        details: {
          request_id: requestId,
          documento_id: documento.id,
          empresa_id: documento.empresa_id,
          motivo: body.motivo,
          tipo_evento: event.tipo_evento,
        },
      }).catch(() => null);
    }

    return NextResponse.json(
      {
        ok: true,
        data: event,
        request_id: requestId,
      },
      { status: 201 }
    );
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Erro interno ao submeter documento fiscal.";
    return jsonError(500, "FISCAL_ROUTE_INTERNAL_ERROR", message, { request_id: requestId });
  }
}
