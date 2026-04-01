import { NextResponse } from "next/server";
import { z } from "zod";
import { renderToBuffer, type DocumentProps } from "@react-pdf/renderer";
import { createElement, type ReactElement } from "react";

import { supabaseRouteClient } from "@/lib/supabaseServer";
import { resolveEscolaIdForUser } from "@/lib/tenant/resolveEscolaIdForUser";
import { FiscalDocumentV1 } from "@/templates/pdf/fiscal/FiscalDocumentV1";
import type { Database } from "~types/supabase";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

type JsonRecord = Record<string, unknown>;

const paramsSchema = z.object({
  documentoId: z.string().uuid(),
});

const ALLOWED_FISCAL_ROLES = ["owner", "admin", "operator"] as const;
const CONSUMIDOR_FINAL_NIF = "999999999";
const DESCONHECIDO = "Desconhecido";

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

async function requireFiscalAccess({
  supabase,
  userId,
  empresaId,
  escolaId,
}: {
  supabase: Awaited<ReturnType<typeof supabaseRouteClient<Database>>>;
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
      message: "Sem acesso fiscal ao documento informado.",
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

function normalizeString(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function resolveHash4(hashControl: string | null | undefined): string {
  const normalized = (hashControl ?? "").replace(/[^A-Za-z0-9]/g, "");
  if (normalized.length >= 31) {
    return `${normalized[0]}${normalized[10]}${normalized[20]}${normalized[30]}`;
  }
  if (normalized.length >= 4) return normalized.slice(0, 4);
  return "0000";
}

function resolveAgtNumber(raw: string | null | undefined): string {
  const value = (raw ?? "").trim();
  if (!value) return "0";
  return /^\d+$/.test(value) ? value : "0";
}

function resolvePdfStatus(status: string | null | undefined): "DRAFT" | "ASSINADO" | "ANULADO" {
  const normalized = (status ?? "").trim().toLowerCase();
  if (normalized === "anulado") return "ANULADO";
  if (normalized === "pendente_assinatura") return "DRAFT";
  return "ASSINADO";
}

function resolveClienteFallback({
  nome,
  nif,
  morada,
}: {
  nome: string | null;
  nif: string | null;
  morada: string | null;
}) {
  const safeNif = normalizeString(nif) ?? CONSUMIDOR_FINAL_NIF;
  const isConsumidorFinal = safeNif === CONSUMIDOR_FINAL_NIF;
  return {
    nome: isConsumidorFinal ? "Consumidor final" : (normalizeString(nome) ?? "Cliente"),
    nif: safeNif,
    morada: isConsumidorFinal ? DESCONHECIDO : (normalizeString(morada) ?? DESCONHECIDO),
  };
}

export async function GET(
  _req: Request,
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

    const { data: doc, error: docError } = await supabase
      .from("fiscal_documentos")
      .select(
        "id, empresa_id, numero_formatado, tipo_documento, invoice_date, cliente_nome, cliente_nif, total_bruto_aoa, total_impostos_aoa, total_liquido_aoa, hash_control, status, payload, moeda"
      )
      .eq("id", parsedParams.data.documentoId)
      .maybeSingle();

    if (docError) {
      return jsonError(
        500,
        "FISCAL_DOCUMENTO_LOOKUP_FAILED",
        docError.message || "Falha ao obter documento fiscal.",
        { request_id: requestId, documento_id: parsedParams.data.documentoId }
      );
    }

    if (!doc) {
      return jsonError(404, "FISCAL_DOCUMENTO_NOT_FOUND", "Documento fiscal não encontrado.", {
        request_id: requestId,
        documento_id: parsedParams.data.documentoId,
      });
    }

    if (doc.status === "pendente_assinatura") {
      return jsonError(
        409,
        "FISCAL_PREVIEW_NOT_ALLOWED",
        "Documento ainda não assinado. Impressão/preview fiscal não permitido.",
        {
          request_id: requestId,
          documento_id: doc.id,
        }
      );
    }

    const escolaId = await resolveEscolaIdForUser(supabase, user.id);
    const access = await requireFiscalAccess({
      supabase,
      userId: user.id,
      empresaId: doc.empresa_id,
      escolaId,
    });

    if (!access.ok) {
      return jsonError(access.status, access.code, access.message, {
        request_id: requestId,
        documento_id: doc.id,
        empresa_id: doc.empresa_id,
      });
    }

    const [{ data: empresa }, { data: itens, error: itensError }] = await Promise.all([
      supabase
      .from("fiscal_empresas")
      .select("nome, nif, certificado_agt_numero, endereco")
      .eq("id", doc.empresa_id)
      .maybeSingle(),
      supabase
        .from("fiscal_documento_itens")
        .select("id, descricao, quantidade, preco_unit, taxa_iva, total_bruto_aoa, product_code, tax_exemption_code")
        .eq("documento_id", doc.id)
        .order("linha_no", { ascending: true }),
    ]);

    if (itensError) {
      return jsonError(
        500,
        "FISCAL_DOCUMENTO_ITEMS_LOOKUP_FAILED",
        itensError.message || "Falha ao obter itens do documento fiscal.",
        { request_id: requestId, documento_id: doc.id }
      );
    }

    const payload = (doc.payload ?? null) as JsonRecord | null;
    const clientePayload = (payload?.cliente ?? null) as JsonRecord | null;
    const clienteNomePayload = normalizeString(clientePayload?.nome);
    const clienteNifPayload = normalizeString(clientePayload?.nif);
    const clienteMoradaPayload = normalizeString(clientePayload?.address_detail);
    const cliente = resolveClienteFallback({
      nome: clienteNomePayload ?? doc.cliente_nome,
      nif: clienteNifPayload ?? doc.cliente_nif,
      morada: clienteMoradaPayload,
    });

    const itensSafe = (itens ?? []).map((item, index) => {
      const taxExemptionCode = normalizeString(item.tax_exemption_code);
      return {
        id: item.id,
        codigo: normalizeString(item.product_code) ?? `ITEM-${index + 1}`,
        descricao: item.descricao ?? "Item fiscal",
        precoUnitario: Number(item.preco_unit ?? 0),
        quantidade: Number(item.quantidade ?? 0),
        taxaIva: Number(item.taxa_iva ?? 0),
        motivoIsencaoCode: taxExemptionCode ?? undefined,
        total: Number(item.total_bruto_aoa ?? 0),
      };
    });

    const agtNumero = resolveAgtNumber(empresa?.certificado_agt_numero);
    const assinatura4 = resolveHash4(doc.hash_control);
    const statusPdf = resolvePdfStatus(doc.status);
    const tipoDocumento = normalizeString(doc.tipo_documento) ?? "FT";
    const moeda = (normalizeString(doc.moeda) ?? "AOA").toUpperCase();

    const element = createElement(FiscalDocumentV1, {
      documento: {
        tipoDocumento,
        numeroDocumento: doc.numero_formatado ?? doc.id,
        dataEmissao: String(doc.invoice_date),
        status: statusPdf,
        empresa: {
          nome: empresa?.nome ?? "-",
          nif: empresa?.nif ?? "-",
          morada: normalizeString(empresa?.endereco) ?? DESCONHECIDO,
        },
        cliente,
        itens: itensSafe,
        totais: {
          incidencia: Number(doc.total_liquido_aoa ?? 0),
          imposto: Number(doc.total_impostos_aoa ?? 0),
          totalGeral: Number(doc.total_bruto_aoa ?? 0),
        },
        moeda,
      },
      assinaturaCurta: assinatura4,
      agtNumber: agtNumero,
    }) as unknown as ReactElement<DocumentProps>;

    const pdfBytes = await renderToBuffer(element);
    const pdfBody = Buffer.from(pdfBytes) as unknown as BodyInit;

    return new NextResponse(pdfBody, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename=\"fiscal_${doc.numero_formatado ?? doc.id}.pdf\"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro interno ao gerar PDF fiscal.";
    return jsonError(500, "FISCAL_PDF_GENERATION_FAILED", message, { request_id: requestId });
  }
}
