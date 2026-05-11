import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { HttpError } from "@/lib/errors";
import { recordAuditServer } from "@/lib/audit";
import { requireFeature } from "@/lib/plan/requireFeature";
import {
  emitirDocumentoFiscalViaAdapter,
  resolveEmpresaFiscalAtiva,
} from "@/lib/fiscal/financeiroFiscalAdapter";
import type { Database, Json } from "~types/supabase";
import { requireApiTenantGuard } from "@/lib/api/requireApiTenantGuard";

const PayloadSchema = z.object({
  mensalidadeId: z.string().uuid(),
});

type ReciboResponse = {
  ok: true;
  doc_id: string;
  url_validacao: string | null;
  fiscal: {
    numero_formatado: string;
    hash_control: string;
    key_version: number;
  } | null;
};

export async function POST(req: NextRequest) {
  try {
    const idempotencyKey =
      req.headers.get("Idempotency-Key") ?? req.headers.get("idempotency-key");
    if (!idempotencyKey) {
      return NextResponse.json(
        { ok: false, error: "Idempotency-Key header é obrigatório" },
        { status: 400 }
      );
    }

    const payload = PayloadSchema.safeParse(await req.json().catch(() => ({})));
    if (!payload.success) {
      return NextResponse.json(
        { ok: false, error: payload.error.issues?.[0]?.message || "Payload inválido." },
        { status: 400 }
      );
    }

    const { mensalidadeId } = payload.data;

    const guard = await requireApiTenantGuard({
      productContext: "k12",
      requireTenantType: "k12",
      allowedRoles: [
        "secretaria",
        "financeiro",
        "secretaria_financeiro",
        "admin_financeiro",
        "admin",
        "admin_escola",
        "staff_admin",
        "super_admin",
        "global_admin",
      ],
    });
    if (!guard.ok) return guard.response;

    const supabase = guard.supabase;
    const supabaseAny = supabase as any;
    const user = guard.user;
    const escolaId = guard.tenantId;

    const { data: existingIdempotency } = await supabaseAny
      .from("idempotency_keys")
      .select("result")
      .eq("escola_id", escolaId)
      .eq("scope", "financeiro_recibo_emitir")
      .eq("key", idempotencyKey)
      .maybeSingle();

    if (existingIdempotency?.result) {
      return NextResponse.json(existingIdempotency.result, { status: 200 });
    }

    try {
      await requireFeature("fin_recibo_pdf");
    } catch (err) {
      if (err instanceof HttpError) {
        return NextResponse.json(
          { ok: false, error: err.message, code: err.code },
          { status: err.status }
        );
      }
      throw err;
    }

    const { data: mensalidade, error: mensalidadeError } = await supabase
      .from("mensalidades")
      .select("id, valor, valor_previsto, aluno_id")
      .eq("id", mensalidadeId)
      .maybeSingle();

    if (mensalidadeError || !mensalidade) {
      return NextResponse.json(
        { ok: false, error: mensalidadeError?.message || "Mensalidade não encontrada." },
        { status: 404 }
      );
    }

    const valorRecibo = Number(mensalidade.valor_previsto ?? mensalidade.valor ?? 0);
    if (!Number.isFinite(valorRecibo) || valorRecibo <= 0) {
      return NextResponse.json(
        { ok: false, error: "Valor inválido para emissão fiscal do recibo." },
        { status: 400 }
      );
    }

    const origin = new URL(req.url).origin;
    const cookieHeader = req.headers.get("cookie");
    let empresaFiscalId: string | null = null;
    try {
      empresaFiscalId = await resolveEmpresaFiscalAtiva({
        origin,
        escolaId,
        cookieHeader,
      });
    } catch (ctxErr) {
      const message = ctxErr instanceof Error ? ctxErr.message : String(ctxErr);
      if (message.includes("FISCAL_EMPRESA_CONTEXT_REQUIRED")) {
        const { data: legacyRecibo, error: legacyError } = await supabase.rpc("emitir_recibo", {
          p_mensalidade_id: mensalidadeId,
        });
        if (legacyError) {
          return NextResponse.json(
            { ok: false, error: legacyError.message, code: "LEGACY_RECIBO_EMIT_FAILED" },
            { status: 500 }
          );
        }

        const legacy = (legacyRecibo ?? {}) as Record<string, unknown>;
        if (legacy.ok !== true) {
          return NextResponse.json(
            {
              ok: false,
              error: String(legacy.erro ?? "Falha ao emitir recibo."),
              code: "LEGACY_RECIBO_EMIT_FAILED",
            },
            { status: 400 }
          );
        }

        const response: ReciboResponse = {
          ok: true,
          doc_id: String(legacy.doc_id ?? ""),
          url_validacao: null,
          fiscal: null,
        };
        return NextResponse.json(response, { status: 200 });
      }
      throw ctxErr;
    }

    const pendingPayload = {
      escola_id: escolaId,
      empresa_id: empresaFiscalId,
      origem_tipo: "financeiro_recibos_emitir",
      origem_id: mensalidadeId,
      fiscal_documento_id: null,
      status: "pending",
      idempotency_key: `financeiro_recibos_emitir:${idempotencyKey}`,
      payload_snapshot: {
        origem_operacao: "financeiro_recibos_emitir",
        mensalidade_id: mensalidadeId,
        aluno_id: mensalidade.aluno_id ?? null,
        valor: valorRecibo,
      } as Json,
      fiscal_error: null,
    };

    const { error: lockError } = await supabase
      .from("financeiro_fiscal_links")
      .insert(pendingPayload);

    if (lockError) {
      if (lockError.code === "23505") {
        const { data: existingLink } = await supabase
          .from("financeiro_fiscal_links")
          .select("status, fiscal_documento_id, fiscal_error")
          .eq("origem_tipo", "financeiro_recibos_emitir")
          .eq("origem_id", mensalidadeId)
          .maybeSingle();

        return NextResponse.json(
          {
            ok: false,
            error: "Emissão fiscal já em processamento para esta mensalidade.",
            code: "FISCAL_ORIGEM_LOCKED",
            details: {
              origem_tipo: "financeiro_recibos_emitir",
              origem_id: mensalidadeId,
              status: existingLink?.status ?? null,
              fiscal_documento_id: existingLink?.fiscal_documento_id ?? null,
            },
          },
          { status: 409 }
        );
      }

      return NextResponse.json(
        { ok: false, error: lockError.message, code: "FISCAL_LINK_CREATE_FAILED" },
        { status: 500 }
      );
    }
    let fiscal:
      | Awaited<ReturnType<typeof emitirDocumentoFiscalViaAdapter>>
      | null = null;
    let fiscalErrorMessage: string | null = null;

    try {
      fiscal = await emitirDocumentoFiscalViaAdapter({
        tipoFluxoFinanceiro: "immediate_payment",
        origemOperacao: "financeiro_recibos_emitir",
        origemId: mensalidadeId,
        descricaoPrincipal: "Recebimento de mensalidade",
        itens: [{ descricao: `Recebimento mensalidade ${mensalidadeId}`, valor: valorRecibo }],
        cliente: { nome: null, nif: null },
        escolaId,
        origin,
        cookieHeader,
        metadata: {
          mensalidade_id: mensalidadeId,
          aluno_id: mensalidade.aluno_id ?? null,
        },
      });
    } catch (fiscalError) {
      fiscalErrorMessage =
        fiscalError instanceof Error ? fiscalError.message : "Falha ao emitir documento fiscal.";
    }

    if (!fiscal) {
      await supabase
        .from("financeiro_fiscal_links")
        .update({
          empresa_id: empresaFiscalId,
          fiscal_documento_id: null,
          status: "failed",
          payload_snapshot: {
            origem_operacao: "financeiro_recibos_emitir",
            erro: fiscalErrorMessage,
          } as Json,
          fiscal_error: fiscalErrorMessage,
        })
        .eq("origem_tipo", "financeiro_recibos_emitir")
        .eq("origem_id", mensalidadeId);

      await supabase
        .from("mensalidades")
        .update({
          status_fiscal: "pending",
          fiscal_error: fiscalErrorMessage,
        })
        .eq("id", mensalidadeId);

      return NextResponse.json(
        {
          ok: false,
          error: fiscalErrorMessage ?? "Falha ao emitir documento fiscal.",
          code: "FISCAL_ADAPTER_EMIT_FAILED",
          status_fiscal: "pending",
        },
        { status: 502 }
      );
    }

    await supabase
      .from("financeiro_fiscal_links")
      .update({
        empresa_id: fiscal.empresa_id,
        fiscal_documento_id: fiscal.documento_id,
        status: "ok",
        payload_snapshot: fiscal.payload_snapshot as Json,
        fiscal_error: null,
      })
      .eq("origem_tipo", "financeiro_recibos_emitir")
      .eq("origem_id", mensalidadeId);

    await supabase
      .from("mensalidades")
      .update({
        status_fiscal: "ok",
        fiscal_documento_id: fiscal.documento_id,
        fiscal_error: null,
      })
      .eq("id", mensalidadeId);

    const response: ReciboResponse = {
      ok: true,
      doc_id: fiscal.documento_id,
      url_validacao: null,
      fiscal: {
        numero_formatado: fiscal.numero_formatado,
        hash_control: fiscal.hash_control,
        key_version: fiscal.key_version,
      },
    };

    await supabaseAny.from("idempotency_keys").upsert(
      {
        escola_id: escolaId,
        scope: "financeiro_recibo_emitir",
        key: idempotencyKey,
        result: response,
      },
      { onConflict: "escola_id,scope,key" }
    );

    recordAuditServer({
      escolaId,
      portal: "financeiro",
      acao: "RECIBO_EMITIDO",
      entity: "fiscal_documentos",
      entityId: fiscal.documento_id,
      details: { mensalidade_id: mensalidadeId, numero_formatado: fiscal.numero_formatado },
    }).catch(() => null);

    return NextResponse.json(response, { status: 200 });
  } catch (err) {
    if (err instanceof HttpError) {
      return NextResponse.json(
        { ok: false, error: err.message, code: err.code },
        { status: err.status }
      );
    }

    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
