import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { supabaseServerTyped } from "@/lib/supabaseServer";
import { HttpError } from "@/lib/errors";
import { resolveEscolaIdForUser } from "@/lib/tenant/resolveEscolaIdForUser";
import { recordAuditServer } from "@/lib/audit";
import { requireFeature } from "@/lib/plan/requireFeature";
import {
  emitirDocumentoFiscalViaAdapter,
  resolveEmpresaFiscalAtiva,
} from "@/lib/fiscal/financeiroFiscalAdapter";
import type { Database, Json } from "~types/supabase";

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
  };
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

    const supabase = await supabaseServerTyped<Database>();
    const supabaseAny = supabase as any;
    const { data: userRes } = await supabase.auth.getUser();
    const user = userRes?.user;
    if (!user) {
      return NextResponse.json(
        { ok: false, error: "Não autenticado" },
        { status: 401 }
      );
    }

    const metadataEscolaId =
      (user.user_metadata as { escola_id?: string | null } | null)?.escola_id ??
      (user.app_metadata as { escola_id?: string | null } | null)?.escola_id ??
      null;

    const escolaId = await resolveEscolaIdForUser(supabase, user.id, undefined, metadataEscolaId);
    if (!escolaId) {
      return NextResponse.json(
        { ok: false, error: "Usuário sem escola associada", code: "NO_SCHOOL" },
        { status: 403 }
      );
    }

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
    const empresaFiscalId = await resolveEmpresaFiscalAtiva({
      origin,
      escolaId,
      cookieHeader,
    });

    await supabase
      .from("financeiro_fiscal_links")
      .upsert(
        {
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
        },
        { onConflict: "origem_tipo,origem_id" }
      )
      .select("id")
      .maybeSingle();
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
        .upsert(
          {
            escola_id: escolaId,
            empresa_id: empresaFiscalId,
            origem_tipo: "financeiro_recibos_emitir",
            origem_id: mensalidadeId,
            fiscal_documento_id: null,
            status: "failed",
            idempotency_key: `financeiro_recibos_emitir:${idempotencyKey}`,
            payload_snapshot: {
              origem_operacao: "financeiro_recibos_emitir",
              erro: fiscalErrorMessage,
            } as Json,
            fiscal_error: fiscalErrorMessage,
          },
          { onConflict: "origem_tipo,origem_id" }
        )
        .select("id")
        .maybeSingle();

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
      .upsert(
        {
          escola_id: escolaId,
          empresa_id: fiscal.empresa_id,
          origem_tipo: "financeiro_recibos_emitir",
          origem_id: mensalidadeId,
          fiscal_documento_id: fiscal.documento_id,
          status: "ok",
          idempotency_key: `financeiro_recibos_emitir:${idempotencyKey}`,
          payload_snapshot: fiscal.payload_snapshot as Json,
          fiscal_error: null,
        },
        { onConflict: "origem_tipo,origem_id" }
      )
      .select("id")
      .maybeSingle();

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
