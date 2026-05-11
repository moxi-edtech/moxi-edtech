import { NextResponse } from "next/server";
import { z } from "zod";
import { supabaseServerTyped } from "@/lib/supabaseServer";
import { resolveEscolaIdForUser } from "@/lib/tenant/resolveEscolaIdForUser";
import { recordAuditServer } from "@/lib/audit";
import { 
  emitirDocumentoFiscalViaAdapter, 
  resolveEmpresaFiscalAtiva 
} from "@/lib/fiscal/financeiroFiscalAdapter";
import type { Database, Json } from "~types/supabase";
import type { PostgrestError } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const payloadSchema = z.object({
  aluno_id: z.string().uuid(),
  mensalidade_id: z.string().uuid().nullable().optional(),
  valor: z.number().positive(),
  metodo: z.enum(["cash", "tpa", "transfer", "mcx", "kiwk", "kwik"]),
  reference: z.string().trim().min(1).nullable().optional(),
  evidence_url: z.string().trim().min(1).nullable().optional(),
  gateway_ref: z.string().trim().min(1).nullable().optional(),
  meta: z.record(z.unknown()).optional(),
});

type PagamentoRow = Database["public"]["Functions"]["financeiro_registrar_pagamento_secretaria"]["Returns"];
type BalcaoFiscalResult =
  | {
      ok: true;
      documento_id: string;
      numero_formatado: string;
      url_validacao: string | null;
    }
  | {
      ok: false;
      error: string;
    };
type BalcaoReciboResult =
  | { ok: true; doc_id: string | null; public_id: string | null; emitido_em: string | null }
  | { ok: false; error: string };

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function getStringField(record: Record<string, unknown>, key: string): string | null {
  const value = record[key];
  return typeof value === "string" && value.trim() ? value : null;
}

export async function POST(request: Request) {
  try {
    const idempotencyKey =
      request.headers.get("Idempotency-Key") ?? request.headers.get("idempotency-key");
    if (!idempotencyKey) {
      return NextResponse.json(
        { ok: false, error: "Idempotency-Key header é obrigatório" },
        { status: 400 }
      );
    }

    const supabase = await supabaseServerTyped<Database>();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ ok: false, error: "Não autenticado" }, { status: 401 });
    }

    const escolaId = await resolveEscolaIdForUser(supabase, user.id);
    if (!escolaId) {
      return NextResponse.json({ ok: false, error: "Escola não identificada" }, { status: 403 });
    }

    const body = await request.json().catch(() => null);
    const parsed = payloadSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { ok: false, error: parsed.error.issues?.[0]?.message || "Payload inválido" },
        { status: 400 }
      );
    }

    const { data: existingPagamento } = await supabase
      .from("pagamentos")
      .select("id, status, meta")
      .eq("escola_id", escolaId)
      .contains("meta", { idempotency_key: idempotencyKey })
      .maybeSingle();
    if (existingPagamento) {
      return NextResponse.json({ ok: true, data: existingPagamento, idempotent: true });
    }

    const payload = parsed.data;
    const meta = asRecord(payload.meta);
    const metodo = payload.metodo === "kiwk" ? "kwik" : payload.metodo;
    
    // 1. Registro Financeiro
    const { data: pagamento, error: pgError } = await supabase.rpc("financeiro_registrar_pagamento_secretaria", {
      p_escola_id: escolaId,
      p_aluno_id: payload.aluno_id,
      p_mensalidade_id: (payload.mensalidade_id ?? null) as any,
      p_valor: payload.valor,
      p_metodo: metodo,
      p_reference: payload.reference ?? undefined,
      p_evidence_url: payload.evidence_url ?? undefined,
      p_gateway_ref: payload.gateway_ref ?? undefined,
      p_meta: { ...meta, idempotency_key: idempotencyKey },
    });

    if (pgError) {
      const err = pgError as PostgrestError & {
        details?: string | null;
        hint?: string | null;
        code?: string;
      };
      console.error("[BALCAO-PAGAMENTOS][RPC_ERROR]", {
        message: err.message,
        code: err.code,
        details: err.details,
        hint: err.hint,
      });
      return NextResponse.json(
        {
          ok: false,
          error: err.message || "Falha ao registrar pagamento",
          pg: {
            code: err.code ?? null,
            details: err.details ?? null,
            hint: err.hint ?? null,
          },
        },
        { status: 400 }
      );
    }

    // 2. Emissão Fiscal Síncrona (O Papel na Mão)
    const pagamentoRow = pagamento as PagamentoRow | null;
    let recibo: BalcaoReciboResult = { ok: false, error: "Recibo não aplicável" };
    if (payload.mensalidade_id) {
      try {
        const { data: reciboData, error: reciboError } = await supabase.rpc("emitir_recibo", {
          p_mensalidade_id: payload.mensalidade_id,
        });
        if (reciboError) {
          recibo = { ok: false, error: reciboError.message || "Falha ao emitir recibo" };
        } else {
          const rec = asRecord(reciboData);
          const recOk = rec.ok === true;
          recibo = recOk
            ? {
                ok: true,
                doc_id: getStringField(rec, "doc_id"),
                public_id: getStringField(rec, "public_id"),
                emitido_em: getStringField(rec, "emitido_em"),
              }
            : { ok: false, error: getStringField(rec, "erro") || "Falha ao emitir recibo" };
        }
      } catch (reciboErr: unknown) {
        const message = reciboErr instanceof Error ? reciboErr.message : String(reciboErr);
        recibo = { ok: false, error: message };
      }
    }
    let fiscalResult: BalcaoFiscalResult = { ok: false, error: "Fiscal pendente" };
    try {
      const origin = new URL(request.url).origin;
      const cookieHeader = request.headers.get("cookie");
      
      const fiscal = await emitirDocumentoFiscalViaAdapter({
        tipoFluxoFinanceiro: "immediate_payment",
        origemOperacao: "financeiro_balcao_pagamento",
        origemId: pagamentoRow?.id || idempotencyKey,
        descricaoPrincipal: "Pagamento via Balcão",
        itens: [{ 
          descricao: getStringField(meta, "descricao_item") || "Serviço/Item Balcão",
          valor: payload.valor 
        }],
        cliente: { nome: null, nif: null },
        escolaId,
        origin,
        cookieHeader,
        metadata: {
          pagamento_id: pagamentoRow?.id,
          aluno_id: payload.aluno_id
        }
      });

      fiscalResult = {
        ok: true,
        documento_id: fiscal.documento_id,
        numero_formatado: fiscal.numero_formatado,
        url_validacao: null // Placeholder
      };
    } catch (fError: unknown) {
      const message = fError instanceof Error ? fError.message : String(fError);
      console.error("[BALCAO-FISCAL] Falha síncrona:", message);
    }

    recordAuditServer({
      escolaId,
      portal: "secretaria",
      acao: "PAGAMENTO_REGISTRADO",
      entity: "pagamento",
      entityId: pagamentoRow?.id ?? null,
      details: { valor: payload.valor, metodo, fiscal_ok: fiscalResult.ok },
    }).catch(() => null);

    const intentId = getStringField(meta, "pagamento_intent_id");
    if (intentId) {
      await confirmPagamentoIntent({
        supabase,
        intentId: String(intentId),
        escolaId,
        metodo,
        reference: payload.reference ?? null,
        terminalId: payload.gateway_ref ?? null,
        evidenceUrl: payload.evidence_url ?? null,
        meta,
      });
    }

    return NextResponse.json({ 
      ok: true, 
      data: pagamento,
      recibo,
      fiscal: fiscalResult
    });
  } catch (e) {
    const err = e as Partial<PostgrestError> & { details?: string; hint?: string; code?: string };
    const message = e instanceof Error ? e.message : String(e);
    console.error("[BALCAO-PAGAMENTOS] POST erro:", {
      message,
      code: err?.code ?? null,
      details: err?.details ?? null,
      hint: err?.hint ?? null,
    });
    return NextResponse.json(
      {
        ok: false,
        error: message,
        pg: {
          code: err?.code ?? null,
          details: err?.details ?? null,
          hint: err?.hint ?? null,
        },
      },
      { status: 500 }
    );
  }
}


async function confirmPagamentoIntent({
  supabase,
  intentId,
  escolaId,
  metodo,
  reference,
  terminalId,
  evidenceUrl,
  meta,
}: {
  supabase: Awaited<ReturnType<typeof supabaseServerTyped<Database>>>;
  intentId: string;
  escolaId: string;
  metodo: string;
  reference: string | null;
  terminalId: string | null;
  evidenceUrl: string | null;
  meta: Record<string, unknown>;
}) {
  const { data: intent, error } = await supabase
    .from("pagamento_intents")
    .select("id, escola_id, status, servico_pedido_id")
    .eq("id", intentId)
    .maybeSingle();

  if (error || !intent || intent.escola_id !== escolaId) {
    return;
  }

  if (intent.status === "settled" || intent.status === "canceled") {
    return;
  }

  const normalizedMetodo = metodo === "kwik" ? "kiwk" : metodo;
  const newStatus = normalizedMetodo === "cash" ? "settled" : "pending";

  await supabase
    .from("pagamento_intents")
    .update({
      method: normalizedMetodo,
      status: newStatus,
      reference: reference ?? undefined,
      terminal_id: terminalId ?? undefined,
      evidence_url: evidenceUrl ?? undefined,
      meta: { ...meta, confirmed_via: "balcao_pagamentos" } as Json,
      settled_at: newStatus === "settled" ? new Date().toISOString() : null,
    })
    .eq("id", intentId);

  if (newStatus === "settled" && intent.servico_pedido_id) {
    await supabase
      .from("servico_pedidos")
      .update({ status: "granted" })
      .eq("id", intent.servico_pedido_id)
      .eq("escola_id", escolaId)
      .eq("status", "pending_payment");
  }
}
