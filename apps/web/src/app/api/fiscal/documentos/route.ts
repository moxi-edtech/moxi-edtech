import { NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { supabaseRouteClient } from "@/lib/supabaseServer";
import { resolveEscolaIdForUser } from "@/lib/tenant/resolveEscolaIdForUser";
import { recordAuditServer } from "@/lib/audit";
import {
  type PostFiscalDocumentoRequestInput,
  type PostFiscalDocumentoInput,
  postFiscalDocumentoRequestSchema,
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
  p_payment_mechanism?: string | null;
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

type FiscalKmsKeyLookup = {
  private_key_ref: string | null;
};
type FiscalSupabaseClient = SupabaseClient<FiscalDatabase>;

type EmpresaContext = {
  empresaId: string | null;
  source: "binding" | "membership" | "none";
};

type NormalizeResult =
  | { ok: true; data: PostFiscalDocumentoInput }
  | { ok: false; status: number; code: string; message: string; details?: JsonRecord };

const ALLOWED_FISCAL_ROLES = ["owner", "admin", "operator"] as const;
const CONSUMIDOR_FINAL_NIF = "999999999";
const CONSUMIDOR_FINAL_NOME = "Consumidor final";
const DESCONHECIDO = "Desconhecido";

function normalizeClienteAddressField(value: string | undefined): string {
  const trimmed = value?.trim();
  return trimmed && trimmed.length > 0 ? trimmed : DESCONHECIDO;
}

function toProductCode(descricao: string, index: number): string {
  const normalized = descricao
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
  const safe = normalized.length > 0 ? normalized.slice(0, 48) : `ITEM_${index + 1}`;
  return `SERV_${safe}`;
}

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

async function resolveEmpresaContext({
  supabase,
  userId,
  escolaId,
}: {
  supabase: FiscalSupabaseClient;
  userId: string;
  escolaId: string | null;
}): Promise<EmpresaContext> {
  if (escolaId) {
    const { data: binding } = await supabase
      .from("fiscal_escola_bindings")
      .select("empresa_id, is_primary, effective_from")
      .eq("escola_id", escolaId)
      .is("effective_to", null)
      .order("is_primary", { ascending: false })
      .order("effective_from", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (binding?.empresa_id) {
      return { empresaId: binding.empresa_id, source: "binding" };
    }
  }

  const { data: membership } = await supabase
    .from("fiscal_empresa_users")
    .select("empresa_id, created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (membership?.empresa_id) {
    return { empresaId: membership.empresa_id, source: "membership" };
  }

  return { empresaId: null, source: "none" };
}

function normalizePostInput({
  input,
  empresaId,
}: {
  input: PostFiscalDocumentoRequestInput;
  empresaId: string | null;
}): NormalizeResult {
  if ("empresa_id" in input) {
    const clienteNome = input.cliente.nome.trim();
    const clienteNif = input.cliente.nif?.trim();
    const isConsumidorFinal = !clienteNif;
    const normalizedAddressDetail = isConsumidorFinal
      ? DESCONHECIDO
      : normalizeClienteAddressField(input.cliente.address_detail);
    const normalizedCity = isConsumidorFinal
      ? DESCONHECIDO
      : normalizeClienteAddressField(input.cliente.city);
    const normalizedPostalCode = isConsumidorFinal
      ? DESCONHECIDO
      : normalizeClienteAddressField(input.cliente.postal_code);
    const normalizedCountry = isConsumidorFinal
      ? DESCONHECIDO
      : normalizeClienteAddressField(input.cliente.country);
    return {
      ok: true,
      data: {
        ...input,
        cliente: {
          ...input.cliente,
          nome: isConsumidorFinal ? CONSUMIDOR_FINAL_NOME : clienteNome,
          nif: isConsumidorFinal ? CONSUMIDOR_FINAL_NIF : clienteNif,
          address_detail: normalizedAddressDetail,
          city: normalizedCity,
          postal_code: normalizedPostalCode,
          country: normalizedCountry,
        },
        itens: input.itens.map((item, index) => {
          const productCode = item.product_code.trim();
          const productNumberCode = item.product_number_code?.trim();
          return {
            ...item,
            product_code: productCode,
            product_number_code:
              productNumberCode && productNumberCode.length > 0
                ? productNumberCode
                : productCode || toProductCode(item.descricao, index),
          };
        }),
      },
    };
  }

  if (!empresaId) {
    return {
      ok: false,
      status: 403,
      code: "FISCAL_EMPRESA_CONTEXT_REQUIRED",
      message:
        "Não foi possível identificar a empresa fiscal ativa para emissão. Verifique os vínculos fiscais.",
    };
  }

  const today = new Date().toISOString().slice(0, 10);
  return {
    ok: true,
    data: {
      empresa_id: empresaId,
      tipo_documento: input.tipo_documento,
      prefixo_serie: String(input.ano_fiscal),
      origem_documento: "interno",
      cliente: {
        nome: CONSUMIDOR_FINAL_NOME,
        nif: CONSUMIDOR_FINAL_NIF,
        address_detail: DESCONHECIDO,
        city: DESCONHECIDO,
        postal_code: DESCONHECIDO,
        country: DESCONHECIDO,
      },
      invoice_date: today,
      moeda: "AOA",
      payment_mechanism: input.payment_mechanism,
      documento_origem_id: input.documento_origem_id,
      rectifica_documento_id: input.rectifica_documento_id,
      itens: input.itens.map((item, index) => ({
        product_code: toProductCode(item.descricao, index),
        product_number_code: toProductCode(item.descricao, index),
        descricao: item.descricao,
        quantidade: 1,
        preco_unit: item.valor,
        taxa_iva: 14,
      })),
      metadata: {
        ...(input.metadata ?? {}),
        origem_payload: "ui_canonico",
        ano_fiscal: input.ano_fiscal,
      },
    },
  };
}

export async function GET() {
  const requestId = crypto.randomUUID();

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
    const ctx = await resolveEmpresaContext({ supabase, userId: user.id, escolaId });

    if (!ctx.empresaId) {
      return NextResponse.json({
        ok: true,
        data: {
          empresa_id: null,
          source: ctx.source,
          docs: [],
        },
        request_id: requestId,
      });
    }

    const authz = await requireFiscalAccess({
      supabase,
      userId: user.id,
      empresaId: ctx.empresaId,
      escolaId,
    });

    if (!authz.ok) {
      return jsonError(authz.status, authz.code, authz.message, {
        request_id: requestId,
        empresa_id: ctx.empresaId,
        escola_id: escolaId,
      });
    }

    const { data, error } = await supabase
      .from("fiscal_documentos")
      .select(
        "id, numero_formatado, invoice_date, created_at, cliente_nome, total_bruto_aoa, hash_control, key_version, status"
      )
      .eq("empresa_id", ctx.empresaId)
      .order("invoice_date", { ascending: false })
      .order("numero", { ascending: false })
      .limit(100);

    if (error) {
      return jsonError(
        500,
        "FISCAL_DOCUMENTOS_LIST_FAILED",
        error.message || "Falha ao listar documentos fiscais.",
        {
          request_id: requestId,
          empresa_id: ctx.empresaId,
        }
      );
    }

    const docs = (data ?? []).map((row) => ({
      id: row.id,
      numero: row.numero_formatado ?? "Sem número",
      emitido_em: row.created_at ?? row.invoice_date,
      cliente_nome: row.cliente_nome ?? "Consumidor Final",
      total_aoa: Number(row.total_bruto_aoa ?? 0),
      hash_control: row.hash_control ?? "",
      key_version: String(row.key_version ?? "1"),
      status:
        row.status === "anulado" ? "ANULADO" : row.status === "rectificado" ? "RETIFICADO" : "EMITIDO",
    }));

    return NextResponse.json({
      ok: true,
      data: {
        empresa_id: ctx.empresaId,
        source: ctx.source,
        docs,
      },
      request_id: requestId,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Erro interno ao listar documentos fiscais.";
    return jsonError(500, "FISCAL_ROUTE_INTERNAL_ERROR", message, { request_id: requestId });
  }
}

export async function POST(req: Request) {
  const requestId = crypto.randomUUID();
  const body = await parseRequestBody(req);
  const parsed = postFiscalDocumentoRequestSchema.safeParse(body);

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
    const ctx = await resolveEmpresaContext({ supabase, userId: user.id, escolaId });
    const normalized = normalizePostInput({
      input: parsed.data,
      empresaId: ctx.empresaId,
    });

    if (!normalized.ok) {
      return jsonError(normalized.status, normalized.code, normalized.message, {
        request_id: requestId,
        ...normalized.details,
      });
    }

    const input = normalized.data;
    const auditEscolaId = escolaId;

    const authz = await requireFiscalAccess({
      supabase,
      userId: user.id,
      empresaId: input.empresa_id,
      escolaId,
    });

    if (!authz.ok) {
      return jsonError(authz.status, authz.code, authz.message, {
        request_id: requestId,
        empresa_id: input.empresa_id,
        escola_id: escolaId,
      });
    }

    const semanticSeries = await resolveSerieSemantica({
      supabase,
      input,
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
      p_empresa_id: input.empresa_id,
      p_serie_id: semanticSeries.data.id,
      p_tipo_documento: input.tipo_documento,
      p_prefixo_serie: input.prefixo_serie,
      p_origem_documento: input.origem_documento,
      p_cliente: input.cliente as Json,
      p_invoice_date: input.invoice_date,
      p_moeda: input.moeda,
      p_itens: input.itens as Json,
      p_payment_mechanism: input.payment_mechanism ?? null,
      p_assinatura_base64: "",
    };

    if (input.metadata) {
      rpcParams.p_metadata = input.metadata as Json;
    }

    if (input.documento_origem_id) {
      rpcParams.p_documento_origem_id = input.documento_origem_id;
    }

    if (input.rectifica_documento_id) {
      rpcParams.p_rectifica_documento_id = input.rectifica_documento_id;
    }

    if (input.taxa_cambio_aoa != null) {
      rpcParams.p_taxa_cambio_aoa = input.taxa_cambio_aoa;
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
          empresa_id: input.empresa_id,
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
      const keyRefLookup = await resolveKmsPrivateKeyRef({
        supabase,
        empresaId: input.empresa_id,
        keyVersion: rpcData.key_version,
      });

      if (!keyRefLookup.ok) {
        return jsonError(
          keyRefLookup.status,
          keyRefLookup.code,
          keyRefLookup.message,
          {
            request_id: requestId,
            empresa_id: input.empresa_id,
            key_version: rpcData.key_version,
          }
        );
      }

      let assinatura: string;
      try {
        assinatura = await signFiscalCanonicalString(rpcData.canonical_string, {
          privateKeyRef: keyRefLookup.privateKeyRef,
        });
      } catch (error) {
        return jsonError(
          500,
          "FISCAL_KMS_SIGN_FAILED",
          error instanceof Error
            ? error.message
            : "Falha ao assinar documento fiscal via AWS KMS.",
          {
            request_id: requestId,
            empresa_id: input.empresa_id,
            key_version: rpcData.key_version,
          }
        );
      }

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
            empresa_id: input.empresa_id,
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

      if (auditEscolaId) {
        recordAuditServer({
          escolaId: auditEscolaId,
          portal: "financeiro",
          acao: "FISCAL_DOCUMENTO_EMITIDO",
          entity: "fiscal_documentos",
          entityId: finalizeData.documento_id,
          details: {
            request_id: requestId,
            empresa_id: input.empresa_id,
            tipo_documento: input.tipo_documento,
            numero_formatado: finalizeData.numero_formatado,
            status: finalizeData.status ?? "emitido",
          },
        }).catch(() => null);
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

    if (auditEscolaId) {
      recordAuditServer({
        escolaId: auditEscolaId,
        portal: "financeiro",
        acao: "FISCAL_DOCUMENTO_EMITIDO",
        entity: "fiscal_documentos",
        entityId: rpcData.documento_id,
        details: {
          request_id: requestId,
          empresa_id: input.empresa_id,
          tipo_documento: input.tipo_documento,
          numero_formatado: rpcData.numero_formatado,
          status: rpcData.status ?? "emitido",
        },
      }).catch(() => null);
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

async function resolveKmsPrivateKeyRef({
  supabase,
  empresaId,
  keyVersion,
}: {
  supabase: FiscalSupabaseClient;
  empresaId: string;
  keyVersion: number;
}) {
  const { data, error } = await supabase
    .from("fiscal_chaves")
    .select("private_key_ref")
    .eq("empresa_id", empresaId)
    .eq("key_version", keyVersion)
    .maybeSingle<FiscalKmsKeyLookup>();

  if (error) {
    return {
      ok: false as const,
      status: 500,
      code: "FISCAL_CHAVE_LOOKUP_FAILED",
      message: error.message || "Falha ao obter referência de chave privada fiscal.",
    };
  }

  return {
    ok: true as const,
    privateKeyRef: data?.private_key_ref ?? null,
  };
}
