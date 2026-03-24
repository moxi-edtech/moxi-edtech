import { NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { supabaseRouteClient } from "@/lib/supabaseServer";
import { resolveEscolaIdForUser } from "@/lib/tenant/resolveEscolaIdForUser";
import {
  type PostFiscalDocumentoInput,
  postFiscalDocumentoSchema,
} from "@/lib/schemas/fiscal-documento.schema";
import { signFiscalCanonicalString } from "@/lib/fiscal/kmsSigner";
import type { Database, Json } from "~types/supabase";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

type JsonRecord = Record<string, unknown>;

type FiscalEmitirDocumentoArgs = {
  p_empresa_id: string;
  p_serie_id: string;
  p_tipo_documento: string;
  p_prefixo_serie: string;
  p_origem_documento: string;
  p_cliente: Json;
  p_documento_origem_id?: string;
  p_rectifica_documento_id?: string;
  p_invoice_date: string;
  p_moeda: string;
  p_taxa_cambio_aoa?: number;
  p_itens: Json;
  p_metadata?: Json;
  p_assinatura_base64?: string;
};

type FiscalEmitirDocumentoResult = {
  ok: boolean;
  documento_id: string;
  numero: number;
  numero_formatado: string;
  hash_control: string;
  key_version: number;
  status?: string;
  canonical_string?: string;
};

type FiscalFinalizarAssinaturaArgs = {
  p_documento_id: string;
  p_assinatura_base64: string;
  p_hash_control: string;
  p_canonical_string: string;
};

type FiscalDatabase = Database & {
  public: {
    Functions: Database["public"]["Functions"] & {
      fiscal_emitir_documento: {
        Args: FiscalEmitirDocumentoArgs;
        Returns: FiscalEmitirDocumentoResult;
      };
      fiscal_finalizar_assinatura: {
        Args: FiscalFinalizarAssinaturaArgs;
        Returns: FiscalEmitirDocumentoResult;
      };
    };
  };
};

type FiscalSerieLookup = {
  id: string;
  empresa_id: string;
  tipo_documento: string;
  prefixo: string;
  origem_documento: string;
  ativa: boolean;
  descontinuada_em: string | null;
};
type FiscalSupabaseClient = SupabaseClient<FiscalDatabase>;

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

function mapRpcError(message: string) {
  if (message.toLowerCase().includes("duplicate key value violates unique constraint")) {
    return { status: 409, code: "FISCAL_IDEMPOTENCY_CONFLICT" };
  }
  if (message.startsWith("AUTH:")) {
    return { status: 403, code: "FISCAL_FORBIDDEN" };
  }
  if (message.startsWith("STATE:")) {
    return { status: 409, code: "FISCAL_STATE_CONFLICT" };
  }
  if (message.startsWith("DATA:")) {
    return { status: 400, code: "FISCAL_DATA_INVALID" };
  }
  return { status: 500, code: "FISCAL_RPC_FAILED" };
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
    const supabase = await supabaseRouteClient<FiscalDatabase>();
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

    const rpcParams: FiscalEmitirDocumentoArgs = {
      p_empresa_id: parsed.data.empresa_id,
      p_serie_id: semanticSeries.data.id,
      p_tipo_documento: parsed.data.tipo_documento,
      p_prefixo_serie: parsed.data.prefixo_serie,
      p_origem_documento: parsed.data.origem_documento,
      p_cliente: parsed.data.cliente as Json,
      p_invoice_date: parsed.data.invoice_date,
      p_moeda: parsed.data.moeda,
      p_itens: parsed.data.itens as Json,
      p_assinatura_base64: "",
    };

    if (parsed.data.metadata) {
      rpcParams.p_metadata = parsed.data.metadata as Json;
    }

    if (parsed.data.documento_origem_id) {
      rpcParams.p_documento_origem_id = parsed.data.documento_origem_id;
    }

    if (parsed.data.rectifica_documento_id) {
      rpcParams.p_rectifica_documento_id = parsed.data.rectifica_documento_id;
    }

    if (parsed.data.taxa_cambio_aoa != null) {
      rpcParams.p_taxa_cambio_aoa = parsed.data.taxa_cambio_aoa;
    }

    const { data: rpcData, error: rpcError } = await supabase.rpc(
      "fiscal_emitir_documento",
      rpcParams
    );

    if (rpcError) {
      const mapped = mapRpcError(rpcError.message ?? "Falha ao emitir documento fiscal.");
      return jsonError(
        mapped.status,
        mapped.code,
        rpcError.message || "Falha ao emitir documento fiscal.",
        {
          request_id: requestId,
          empresa_id: parsed.data.empresa_id,
          serie_id: semanticSeries.data.id,
        }
      );
    }

    if (!rpcData?.ok) {
      return jsonError(
        500,
        "FISCAL_RPC_INCONSISTENTE",
        "Resposta inesperada ao emitir documento fiscal.",
        { request_id: requestId }
      );
    }

    if (rpcData.status === "pendente_assinatura" && rpcData.canonical_string) {
      const assinatura = await signFiscalCanonicalString(rpcData.canonical_string);
      const { data: finalizeData, error: finalizeError } = await supabase.rpc(
        "fiscal_finalizar_assinatura",
        {
          p_documento_id: rpcData.documento_id,
          p_assinatura_base64: assinatura,
          p_hash_control: rpcData.hash_control,
          p_canonical_string: rpcData.canonical_string,
        }
      );

      if (finalizeError) {
        const mapped = mapRpcError(
          finalizeError.message ?? "Falha ao finalizar assinatura fiscal."
        );
        return jsonError(
          mapped.status,
          mapped.code,
          finalizeError.message || "Falha ao finalizar assinatura fiscal.",
          {
            request_id: requestId,
            empresa_id: parsed.data.empresa_id,
            documento_id: rpcData.documento_id,
          }
        );
      }

      if (!finalizeData?.ok) {
        return jsonError(
          500,
          "FISCAL_FINALIZE_INCONSISTENTE",
          "Resposta inesperada ao finalizar assinatura fiscal.",
          { request_id: requestId }
        );
      }

      return NextResponse.json(
        {
          ok: true,
          data: finalizeData,
          request_id: requestId,
        },
        { status: 201 }
      );
    }

    return NextResponse.json(
      {
        ok: true,
        data: rpcData,
        request_id: requestId,
      },
      { status: 201 }
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
  supabase: FiscalSupabaseClient;
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
  supabase: FiscalSupabaseClient;
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

// A validação de chave fiscal activa ocorre na RPC atómica.
