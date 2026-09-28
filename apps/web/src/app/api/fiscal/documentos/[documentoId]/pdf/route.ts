import { NextResponse } from "next/server";
import { z } from "zod";
import { renderToBuffer, type DocumentProps } from "@react-pdf/renderer";
import { createElement, type ReactElement } from "react";

import { supabaseRouteClient } from "@/lib/supabaseServer";
import { requireFiscalAccessByCompanyOrSchool } from "@/lib/server/fiscalAccess";
import { resolveEscolaIdForUser } from "@/lib/tenant/resolveEscolaIdForUser";
import { FiscalDocumentV1 } from "@/templates/pdf/fiscal/FiscalDocumentV1";
import { resolveFiscalPdfMoney } from "@/lib/fiscal/pdfMoney";
import {
  CONSUMIDOR_FINAL_NIF,
  CONSUMIDOR_FINAL_NOME,
  FISCAL_ADDRESS_UNKNOWN,
  isGenericConsumidorFinal,
} from "@/lib/fiscal/customerIdentity";
import type { Database } from "~types/supabase";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

type JsonRecord = Record<string, unknown>;

const paramsSchema = z.object({
  documentoId: z.string().uuid(),
});


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
  const safeNome = normalizeString(nome);
  const genericConsumidorFinal = isGenericConsumidorFinal({
    nome: safeNome,
    nif: safeNif,
  });

  return {
    nome: genericConsumidorFinal
      ? CONSUMIDOR_FINAL_NOME
      : (safeNome ?? "Cliente sem NIF"),
    nif: safeNif,
    morada: genericConsumidorFinal
      ? FISCAL_ADDRESS_UNKNOWN
      : (normalizeString(morada) ?? FISCAL_ADDRESS_UNKNOWN),
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
        "id, empresa_id, numero_formatado, tipo_documento, invoice_date, cliente_nome, cliente_nif, total_bruto_aoa, total_impostos_aoa, total_liquido_aoa, hash_control, status, payload, moeda, documento_origem_id, rectifica_documento_id, reference_reason"
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
    const access = await requireFiscalAccessByCompanyOrSchool({
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

    const sourceDocumentoId = doc.documento_origem_id ?? doc.rectifica_documento_id;
    const [{ data: empresa }, { data: itens, error: itensError }, { data: sourceDocumento }] =
      await Promise.all([
      supabase
      .from("fiscal_empresas")
      .select("nome, nif, certificado_agt_numero, endereco")
      .eq("id", doc.empresa_id)
      .maybeSingle(),
      supabase
        .from("fiscal_documento_itens")
        .select("id, descricao, quantidade, preco_unit, unit_price_base, settlement_amount, taxa_iva, total_liquido_moeda, total_impostos_moeda, total_bruto_moeda, total_bruto_aoa, product_code, tax_exemption_code")
        .eq("documento_id", doc.id)
        .order("linha_no", { ascending: true }),
      sourceDocumentoId
        ? supabase
            .from("fiscal_documentos")
            .select("id, numero_formatado")
            .eq("id", sourceDocumentoId)
            .eq("empresa_id", doc.empresa_id)
            .maybeSingle()
        : Promise.resolve({ data: null, error: null }),
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

    const moeda = (normalizeString(doc.moeda) ?? "AOA").toUpperCase();
    const pdfMoney = resolveFiscalPdfMoney({
      moeda,
      totalsAoa: {
        incidencia: doc.total_liquido_aoa,
        imposto: doc.total_impostos_aoa,
        totalGeral: doc.total_bruto_aoa,
      },
      items: itens ?? [],
    });

    const itensSafe = (itens ?? []).map((item, index) => {
      const taxExemptionCode = normalizeString(item.tax_exemption_code);
      const money = pdfMoney.itemAmounts[index];
      return {
        id: item.id,
        codigo: normalizeString(item.product_code) ?? `ITEM-${index + 1}`,
        descricao: item.descricao ?? "Item fiscal",
        precoUnitario: money?.unitPrice ?? 0,
        quantidade: Number(item.quantidade ?? 0),
        taxaIva: Number(item.taxa_iva ?? 0),
        motivoIsencaoCode: taxExemptionCode ?? undefined,
        settlementAmount: money?.settlementAmount ?? 0,
        total: money?.total ?? 0,
      };
    });

    const totalsInDocumentCurrency = pdfMoney.totals;

    const agtNumero = resolveAgtNumber(empresa?.certificado_agt_numero);
    const assinatura4 = resolveHash4(doc.hash_control);
    const statusPdf = resolvePdfStatus(doc.status);
    const tipoDocumento = normalizeString(doc.tipo_documento) ?? "FT";

    const element = createElement(FiscalDocumentV1, {
      documento: {
        tipoDocumento,
        numeroDocumento: doc.numero_formatado ?? doc.id,
        dataEmissao: String(doc.invoice_date),
        status: statusPdf,
        empresa: {
          nome: empresa?.nome ?? "-",
          nif: empresa?.nif ?? "-",
          morada: normalizeString(empresa?.endereco) ?? FISCAL_ADDRESS_UNKNOWN,
        },
        cliente,
        itens: itensSafe,
        totais: totalsInDocumentCurrency,
        moeda,
        referencia: sourceDocumento?.numero_formatado
          ? {
              numero: String(sourceDocumento.numero_formatado),
              motivo:
                normalizeString(doc.reference_reason) ??
                normalizeString(
                  ((payload?.metadata ?? null) as JsonRecord | null)?.reference_reason
                ),
            }
          : null,
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
