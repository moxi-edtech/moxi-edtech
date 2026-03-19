import { NextResponse } from "next/server";
import { supabaseRouteClient } from "@/lib/supabaseServer";
import { resolveEscolaIdForUser } from "@/lib/tenant/resolveEscolaIdForUser";
import {
  type PostFiscalDocumentoInput,
  postFiscalDocumentoSchema,
} from "@/lib/schemas/fiscal-documento.schema";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

type JsonRecord = Record<string, unknown>;

type FiscalSerieLookup = {
  id: string;
  empresa_id: string;
  tipo_documento: string;
  prefixo: string;
  origem_documento: string;
  ativa: boolean;
  descontinuada_em: string | null;
};

const ALLOWED_FISCAL_ROLES = ["owner", "admin", "operator"] as const;

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

export async function POST(req: Request) {
  const requestId = crypto.randomUUID();
  const body = await parseRequestBody(req);
  const parsed = postFiscalDocumentoSchema.safeParse(body);

  if (!parsed.success) {
    return jsonError(400, "INVALID_PAYLOAD", "O corpo da requisição é inválido.", {
      request_id: requestId,
      field_errors: parsed.error.flatten().fieldErrors,
      form_errors: parsed.error.flatten().formErrors,
    });
  }

  try {
    const supabase = await supabaseRouteClient<any>();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return jsonError(401, "UNAUTHENTICATED", "Utilizador não autenticado.", {
        request_id: requestId,
      });
    }

    const escolaId = await resolveEscolaIdForUser(supabase as any, user.id);
    const authz = await requireFiscalAccess({
      supabase,
      userId: user.id,
      empresaId: parsed.data.empresa_id,
      escolaId,
    });

    if (!authz.ok) {
      return jsonError(authz.status, authz.code, authz.message, {
        request_id: requestId,
        empresa_id: parsed.data.empresa_id,
        escola_id: escolaId,
      });
    }

    const semanticSeries = await resolveSerieSemantica({
      supabase,
      input: parsed.data,
      escolaId,
      requestId,
    });

    if (!semanticSeries.ok) {
      return jsonError(
        semanticSeries.status,
        semanticSeries.code,
        semanticSeries.message,
        semanticSeries.details
      );
    }

    const activeKey = await resolveChaveActiva({
      supabase,
      empresaId: parsed.data.empresa_id,
      requestId,
    });

    if (!activeKey.ok) {
      return jsonError(activeKey.status, activeKey.code, activeKey.message, activeKey.details);
    }

    return jsonError(
      501,
      "FISCAL_EMISSAO_ATOMICA_PENDENTE",
      "A emissão fiscal permanece bloqueada até a introdução da RPC atómica que una reserva de número, assinatura e persistência sem risco de buracos na sequência.",
      {
        request_id: requestId,
        empresa_id: parsed.data.empresa_id,
        serie_id: semanticSeries.data.id,
        tipo_documento: parsed.data.tipo_documento,
        prefixo_serie: parsed.data.prefixo_serie,
        origem_documento: parsed.data.origem_documento,
        key_version: activeKey.data.key_version,
      }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro interno ao preparar emissão fiscal.";
    return jsonError(500, "FISCAL_ROUTE_INTERNAL_ERROR", message, { request_id: requestId });
  }
}

async function requireFiscalAccess({
  supabase,
  userId,
  empresaId,
  escolaId,
}: {
  supabase: any;
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

async function resolveSerieSemantica({
  supabase,
  input,
  escolaId,
  requestId,
}: {
  supabase: any;
  input: PostFiscalDocumentoInput;
  escolaId: string | null;
  requestId: string;
}) {
  const { data, error } = await supabase
    .from("fiscal_series")
    .select("id, empresa_id, tipo_documento, prefixo, origem_documento, ativa, descontinuada_em")
    .eq("empresa_id", input.empresa_id)
    .eq("tipo_documento", input.tipo_documento)
    .eq("prefixo", input.prefixo_serie)
    .eq("origem_documento", input.origem_documento)
    .eq("ativa", true)
    .is("descontinuada_em", null)
    .limit(2);

  if (error) {
    return {
      ok: false as const,
      status: 500,
      code: "SERIE_LOOKUP_FAILED",
      message: error.message || "Falha ao resolver semanticamente a série fiscal.",
      details: {
        request_id: requestId,
        escola_id: escolaId,
        empresa_id: input.empresa_id,
        tipo_documento: input.tipo_documento,
        prefixo_serie: input.prefixo_serie,
        origem_documento: input.origem_documento,
      },
    };
  }

  const rows = ((data ?? []) as FiscalSerieLookup[]);
  if (rows.length === 0) {
    return {
      ok: false as const,
      status: 404,
      code: "SERIE_NAO_ENCONTRADA",
      message: "Nenhuma série activa encontrada para a combinação semântica informada.",
      details: {
        request_id: requestId,
        escola_id: escolaId,
        empresa_id: input.empresa_id,
        tipo_documento: input.tipo_documento,
        prefixo_serie: input.prefixo_serie,
        origem_documento: input.origem_documento,
      },
    };
  }

  if (rows.length > 1) {
    return {
      ok: false as const,
      status: 409,
      code: "SERIE_AMBIGUA",
      message: "Mais de uma série activa corresponde ao contrato semântico informado.",
      details: {
        request_id: requestId,
        escola_id: escolaId,
        empresa_id: input.empresa_id,
        tipo_documento: input.tipo_documento,
        prefixo_serie: input.prefixo_serie,
        origem_documento: input.origem_documento,
      },
    };
  }

  return { ok: true as const, data: rows[0] };
}

async function resolveChaveActiva({
  supabase,
  empresaId,
  requestId,
}: {
  supabase: any;
  empresaId: string;
  requestId: string;
}) {
  const { data, error } = await supabase
    .from("fiscal_chaves")
    .select("key_version, status, private_key_ref")
    .eq("empresa_id", empresaId)
    .eq("status", "active")
    .maybeSingle();

  if (error) {
    return {
      ok: false as const,
      status: 500,
      code: "CHAVE_LOOKUP_FAILED",
      message: error.message || "Falha ao localizar a chave fiscal activa.",
      details: { request_id: requestId, empresa_id: empresaId },
    };
  }

  if (!data) {
    return {
      ok: false as const,
      status: 409,
      code: "CHAVE_FISCAL_INDISPONIVEL",
      message: "A empresa não possui chave fiscal activa para emissão.",
      details: { request_id: requestId, empresa_id: empresaId },
    };
  }

  return { ok: true as const, data };
}
