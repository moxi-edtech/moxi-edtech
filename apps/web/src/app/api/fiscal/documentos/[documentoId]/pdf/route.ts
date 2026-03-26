import { NextResponse } from "next/server";
import { z } from "zod";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

import { supabaseRouteClient } from "@/lib/supabaseServer";
import { resolveEscolaIdForUser } from "@/lib/tenant/resolveEscolaIdForUser";
import type { Database } from "~types/supabase";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

type JsonRecord = Record<string, unknown>;

const paramsSchema = z.object({
  documentoId: z.string().uuid(),
});

const ALLOWED_FISCAL_ROLES = ["owner", "admin", "operator"] as const;
const FATURA_TYPES = new Set(["FT", "FR"]);

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

function drawLine(page: ReturnType<PDFDocument["addPage"]>, text: string, x: number, y: number, size = 11) {
  page.drawText(text, { x, y, size, color: rgb(0.15, 0.15, 0.15) });
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
        "id, empresa_id, numero_formatado, tipo_documento, invoice_date, cliente_nome, total_bruto_aoa, assinatura_base64, status"
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

    const { data: empresa } = await supabase
      .from("fiscal_empresas")
      .select("nome, nif, certificado_agt_numero")
      .eq("id", doc.empresa_id)
      .maybeSingle();

    const agtNumero = empresa?.certificado_agt_numero?.trim() || "...";
    const assinatura4 = (doc.assinatura_base64 ?? "").slice(0, 4) || "----";

    const pdfDoc = await PDFDocument.create();
    const page = pdfDoc.addPage([595, 842]);
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

    page.drawText("Documento Fiscal", {
      x: 48,
      y: 790,
      size: 18,
      font: fontBold,
      color: rgb(0.1, 0.1, 0.1),
    });

    const lines: string[] = [
      `Documento: ${doc.numero_formatado ?? doc.id}`,
      `Tipo: ${doc.tipo_documento}`,
      `Data: ${doc.invoice_date}`,
      `Cliente: ${doc.cliente_nome ?? "Consumidor Final"}`,
      `Total (AOA): ${Number(doc.total_bruto_aoa ?? 0).toLocaleString("pt-AO")}`,
      `Assinatura (4): ${assinatura4}`,
      `NIF Emitente: ${empresa?.nif ?? "-"}`,
      `Emitente: ${empresa?.nome ?? "-"}`,
    ];

    let y = 750;
    for (const line of lines) {
      page.drawText(line, { x: 48, y, size: 11, font, color: rgb(0.15, 0.15, 0.15) });
      y -= 22;
    }

    drawLine(
      page,
      `Processado por programa validado n.º ${agtNumero}/AGT`,
      48,
      88,
      10
    );

    if (!FATURA_TYPES.has(doc.tipo_documento ?? "")) {
      drawLine(page, "Este documento não serve de factura", 48, 68, 10);
    }

    const pdfBytes = await pdfDoc.save();
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
