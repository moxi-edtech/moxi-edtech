import { NextResponse } from "next/server";
import { z } from "zod";
import { requireRoleInSchool } from "@/lib/authz";
import { supabaseServerTyped } from "@/lib/supabaseServer";
import { resolveEscolaIdForUser } from "@/lib/tenant/resolveEscolaIdForUser";
import { recordAuditServer } from "@/lib/audit";
import { AcademicYearContextError, resolveAcademicYearContext } from "@/lib/academic-year/context";
import type { Database, Json } from "~types/supabase";
import type { PostgrestError } from "@supabase/supabase-js";
import { isBillingCompetencyAllowed, resolveTurmaBillingWindow } from "@/lib/financeiro/turma-billing-window";
import { resolveRegimeAcademico } from "@/lib/academico/regime-academico";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const optionalNonEmptyString = z.preprocess(
  (value) => typeof value === "string" && value.trim() === "" ? null : value,
  z.string().trim().min(1).nullable().optional(),
);

const payloadSchema = z.object({
  aluno_id: z.string().uuid(),
  mensalidade_id: z.string().uuid().nullable().optional(),
  valor: z.number().positive(),
  metodo: z.enum(["cash", "tpa", "transfer", "mcx", "kiwk", "kwik"]),
  reference: optionalNonEmptyString,
  evidence_url: optionalNonEmptyString,
  gateway_ref: optionalNonEmptyString,
  ano_letivo_id: z.string().uuid().optional(),
  meta: z.record(z.unknown()).optional(),
});

type PagamentoRow = Database["public"]["Functions"]["financeiro_registrar_pagamento_secretaria"]["Returns"];
type BalcaoReciboResult =
  | { ok: true; doc_id: string | null; public_id: string | null; emitido_em: string | null; print_url?: string | null }
  | { ok: false; error: string };

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function getStringField(record: Record<string, unknown>, key: string): string | null {
  const value = record[key];
  return typeof value === "string" && value.trim() ? value : null;
}

type ReceiptItem = { descricao: string; valor: number };

function normalizeReceiptItems(meta: Record<string, unknown>, fallback: ReceiptItem): ReceiptItem[] {
  const rawItems = meta.itens_pagamento ?? meta.itens;
  if (!Array.isArray(rawItems)) return [fallback];

  const items = rawItems
    .filter((item) => item && typeof item === "object" && !Array.isArray(item))
    .map((item) => {
      const row = item as Record<string, unknown>;
      const nome = row.nome ?? row.descricao ?? row.referencia ?? row.label;
      const valor = Number(row.preco ?? row.valor ?? row.amount ?? 0);
      return {
        descricao: typeof nome === "string" && nome.trim() ? nome.trim() : "Item pago",
        valor,
      };
    })
    .filter((item) => Number.isFinite(item.valor) && item.valor >= 0);

  return items.length > 0 ? items : [fallback];
}

function normalizeReceiptType(meta: Record<string, unknown>): "pagamento" | "matricula" | "confirmacao" {
  const raw = String(meta.tipo_comprovativo ?? meta.tipo_operacao ?? meta.origem ?? "").toLowerCase();
  if (raw.includes("confirm") || raw.includes("rematric")) return "confirmacao";
  if (raw.includes("matric")) return "matricula";

  const items = Array.isArray(meta.itens) ? meta.itens : [];
  const hasConfirmation = items.some((item) => {
    const row = asRecord(item);
    return `${row.codigo ?? ""} ${row.nome ?? ""}`.toLowerCase().includes("rematric");
  });
  return hasConfirmation ? "confirmacao" : "pagamento";
}

async function enrichReceiptSnapshot({
  supabase,
  escolaId,
  docId,
  extraSnapshot,
}: {
  supabase: Awaited<ReturnType<typeof supabaseServerTyped<Database>>>;
  escolaId: string;
  docId: string;
  extraSnapshot: Record<string, unknown>;
}) {
  const { data: doc } = await supabase
    .from("documentos_emitidos")
    .select("dados_snapshot")
    .eq("id", docId)
    .eq("escola_id", escolaId)
    .maybeSingle();
  const existingSnapshot = asRecord(doc?.dados_snapshot);

  await supabase
    .from("documentos_emitidos")
    .update({ dados_snapshot: { ...existingSnapshot, ...extraSnapshot } as Json })
    .eq("id", docId)
    .eq("escola_id", escolaId);
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
    const authz = await requireRoleInSchool({
      supabase,
      escolaId,
      roles: [
        "secretaria",
        "secretaria_financeiro",
        "admin_financeiro",
        "admin",
        "admin_escola",
        "staff_admin",
      ],
    });
    if (authz.error) {
      return authz.error;
    }

    const body = await request.json().catch(() => null);
    const parsed = payloadSchema.safeParse(body);
    if (!parsed.success) {
    return NextResponse.json(
        {
          ok: false,
          error: parsed.error.issues?.[0]?.message || "Payload inválido",
          field: parsed.error.issues?.[0]?.path?.join(".") || null,
        },
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
    const mensalidadeItem = (meta.itens as unknown[] | undefined)?.find((item) => asRecord(item).tipo === "mensalidade");
    const receiptItems = normalizeReceiptItems(meta, {
      descricao: getStringField(meta, "descricao_item") || "Propina",
      valor: Number(asRecord(mensalidadeItem).preco ?? payload.valor),
    });
    const receiptType = normalizeReceiptType(meta);
    const isPosViradaPayment = meta.origem === "pos_virada";
    let academicContext;
    try {
      academicContext = await resolveAcademicYearContext(supabase as any, {
        userId: user.id,
        requestedAcademicYearId: payload.ano_letivo_id,
        operation: "WRITE",
      });
    } catch (err) {
      if (err instanceof AcademicYearContextError) {
        return NextResponse.json({ ok: false, error: err.message, code: err.code }, { status: err.status });
      }
      throw err;
    }
    let billingAcademicYearId = academicContext.anoLetivoId;

    if (payload.mensalidade_id) {
      const { data: mensalidade, error: mensalidadeError } = await supabase
        .from("mensalidades")
        .select("id, matricula_id, aluno_id, turma_id, ano_letivo, mes_referencia, ano_referencia")
        .eq("escola_id", escolaId)
        .eq("id", payload.mensalidade_id)
        .maybeSingle();
      if (mensalidadeError) throw mensalidadeError;
      if (!mensalidade?.matricula_id) {
        return NextResponse.json({ ok: false, error: "Mensalidade não encontrada.", code: "ACADEMIC_ENTITY_NOT_FOUND" }, { status: 404 });
      }
      if (String(mensalidade.aluno_id) !== String(payload.aluno_id)) {
        return NextResponse.json({ ok: false, error: "A mensalidade não pertence ao aluno selecionado.", code: "ACADEMIC_ENTITY_NOT_FOUND" }, { status: 409 });
      }

      const { data: matriculaContext, error: matriculaContextError } = await supabase
        .from("matriculas")
        .select("id, turma_id, session_id, ano_letivo")
        .eq("escola_id", escolaId)
        .eq("id", mensalidade.matricula_id)
        .maybeSingle();
      if (matriculaContextError) throw matriculaContextError;
      if (!matriculaContext) {
        return NextResponse.json({ ok: false, error: "A matrícula da mensalidade não foi encontrada.", code: "ACADEMIC_ENTITY_NOT_FOUND" }, { status: 409 });
      }

      // O ano de competência é o ano civil do mês (ex.: maio/2026), não o
      // ano letivo da matrícula. Em calendários atravessados, usar
      // ano_referencia aqui seleciona a janela errada e bloqueia cobranças.
      const billingTurmaId = mensalidade.turma_id ?? matriculaContext?.turma_id ?? null;
      // A mensalidade keeps the canonical civil/academic year even when an
      // old matrícula was removed or has a stale session_id.
      const billingYear = Number(mensalidade.ano_letivo ?? mensalidade.ano_referencia ?? matriculaContext?.ano_letivo);

      if (mensalidade.mes_referencia && mensalidade.ano_referencia) {
        // Regularização de dívida pode ocorrer no ano letivo seguinte.
        // A janela deve ser a do ano letivo da matrícula, não a do ano ativo.
        const yearQuery = supabase
          .from("anos_letivos")
          .select("id, ano, data_inicio, data_fim")
          .eq("escola_id", escolaId);
        const { data: anoConfig, error: anoConfigError } = await yearQuery
          .eq("ano", billingYear)
          .order("ativo", { ascending: false })
          .order("data_inicio", { ascending: false })
          .limit(1)
          .maybeSingle();
        if (anoConfigError) throw anoConfigError;
        if (!anoConfig) {
          return NextResponse.json({
            ok: false,
            error: "O ano letivo da matrícula não foi encontrado.",
            code: "ACADEMIC_YEAR_NOT_FOUND",
          }, { status: 409 });
        }
        billingAcademicYearId = anoConfig?.id ?? academicContext.anoLetivoId;
        if (anoConfig?.data_inicio && anoConfig.data_fim) {
          const { data: resolvedWindowRows, error: resolvedWindowError } = billingTurmaId && anoConfig.id
            ? await (supabase as any).rpc("resolve_turma_janela_cobranca", {
                p_turma_id: billingTurmaId,
                p_ano_letivo_id: anoConfig.id,
              })
            : { data: null, error: null };
          if (resolvedWindowError) {
            return NextResponse.json({ ok: false, error: "Não foi possível resolver a janela de cobrança da turma.", code: "BILLING_WINDOW_RESOLUTION_FAILED" }, { status: 500 });
          }
          const resolvedWindow = Array.isArray(resolvedWindowRows) ? resolvedWindowRows[0] : resolvedWindowRows;
          const regime = billingTurmaId
            ? await resolveRegimeAcademico(supabase, billingTurmaId)
            : null;
          const janela = resolveTurmaBillingWindow({
            academicStart: anoConfig.data_inicio,
            academicEnd: anoConfig.data_fim,
            customWindow: resolvedWindow,
            isClasseExame: Boolean(regime?.eh_classe_exame),
          });
          if (!isBillingCompetencyAllowed(janela, {
            ano: Number(mensalidade.ano_referencia),
            mes: Number(mensalidade.mes_referencia),
          })) {
            return NextResponse.json({
              ok: false,
              error: "Esta mensalidade está fora da janela de cobrança da turma e não pode ser liquidada.",
              code: "MONTH_OUTSIDE_ACADEMIC_YEAR",
              context: {
                turma_id: billingTurmaId,
                ano_letivo_id: anoConfig.id,
                ano: anoConfig.ano,
                data_inicio_permitida: janela.dataInicio,
                data_fim_permitida: janela.dataFim,
                competencia: `${mensalidade.ano_referencia}-${String(mensalidade.mes_referencia).padStart(2, "0")}`,
              },
              next_action: { type: "contact_secretaria", label: "Rever o ano letivo, a turma e a competência", href: "/secretaria/operacoes-academicas" },
            }, { status: 409 });
          }
        }
      }
      if (isPosViradaPayment) {
        const matriculaOrigemId = getStringField(meta, "matricula_origem_id");
        if (!matriculaOrigemId || matriculaOrigemId !== mensalidade.matricula_id) {
          return NextResponse.json({ ok: false, error: "A mensalidade não pertence à matrícula de origem da pendência.", code: "POS_VIRADA_CONTEXT_MISMATCH" }, { status: 409 });
        }
      } else if (matriculaContext) {
        // Legacy records can have a correct numeric year but a missing/stale
        // session_id. Reject only a real cross-year conflict.
        const matriculaYear = Number(matriculaContext.ano_letivo);
        if (matriculaYear > 0 && matriculaYear !== billingYear) {
          return NextResponse.json({
            ok: false,
            error: "A entidade não pertence ao ano letivo da mensalidade.",
            code: "CROSS_YEAR_ENTITY_MISMATCH",
          }, { status: 409 });
        }
      }
    }
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
    if (payload.mensalidade_id && meta.emitir_recibo !== false) {
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
                print_url: getStringField(rec, "doc_id")
                  ? `/secretaria/documentos/${getStringField(rec, "doc_id")}/recibo/print`
                  : null,
              }
            : { ok: false, error: getStringField(rec, "erro") || "Falha ao emitir recibo" };
        }
        if (recibo.ok && recibo.doc_id) {
          await enrichReceiptSnapshot({
            supabase,
            escolaId,
            docId: recibo.doc_id,
            extraSnapshot: {
              tipo_comprovativo: receiptType,
              itens_pagamento: receiptItems,
              referencia: receiptItems.map((item) => item.descricao).join(", "),
              valor_pago: receiptItems.reduce((total, item) => total + item.valor, 0),
              metodo: metodo,
              data_pagamento: new Date().toISOString(),
            },
          });
        }
      } catch (reciboErr: unknown) {
        const message = reciboErr instanceof Error ? reciboErr.message : String(reciboErr);
        recibo = { ok: false, error: message };
      }
    } else if (pagamentoRow?.id && pagamentoRow.status === "settled" && meta.emitir_recibo !== false) {
      try {
        const { data: reciboData, error: reciboError } = await (supabase as any).rpc("emitir_recibo_servicos", {
          p_pagamento_id: pagamentoRow.id,
        });
        const rec = asRecord(reciboData);
        if (reciboError) {
          recibo = { ok: false, error: reciboError.message || "Falha ao emitir recibo" };
        } else if (rec.ok === true) {
          const docId = getStringField(rec, "doc_id");
          recibo = {
            ok: true,
            doc_id: docId,
            public_id: getStringField(rec, "public_id"),
            emitido_em: getStringField(rec, "emitido_em"),
            print_url: docId ? `/secretaria/documentos/${docId}/recibo/print` : null,
          };
          if (docId) {
            await enrichReceiptSnapshot({
              supabase,
              escolaId,
              docId,
              extraSnapshot: {
                tipo_comprovativo: receiptType,
                itens_pagamento: receiptItems,
                referencia: receiptItems.map((item) => item.descricao).join(", "),
                valor_pago: receiptItems.reduce((total, item) => total + item.valor, 0),
                metodo,
                data_pagamento: new Date().toISOString(),
              },
            });
          }
        } else {
          recibo = { ok: false, error: getStringField(rec, "erro") || "Falha ao emitir recibo" };
        }
      } catch (reciboErr: unknown) {
        const message = reciboErr instanceof Error ? reciboErr.message : String(reciboErr);
        recibo = { ok: false, error: message };
      }
    }
    // A emissão fiscal permanece desligada até o motor fiscal estar ativo.
    const fiscalResult = { ok: false, error: "Emissão fiscal desativada" } as const;

    recordAuditServer({
      escolaId,
      portal: "secretaria",
      acao: "PAGAMENTO_REGISTRADO",
      entity: "pagamento",
      entityId: pagamentoRow?.id ?? null,
      details: { valor: payload.valor, metodo, fiscal_ok: fiscalResult.ok, ano_letivo_id: academicContext.anoLetivoId },
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
  // No balcão físico, se a secretária está processando TPA/Transfer, ela já viu o comprovativo.
  // Portanto, liquidamos imediatamente para permitir a emissão do documento.
  const isBalcaoEmissao = meta.origem === "documentos_emissao";
  const newStatus = (normalizedMetodo === "cash" || isBalcaoEmissao) ? "settled" : "pending";

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
