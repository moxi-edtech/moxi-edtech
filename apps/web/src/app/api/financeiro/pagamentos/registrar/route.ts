import { NextResponse } from "next/server";
import { z } from "zod";
import { supabaseServerTyped } from "@/lib/supabaseServer";
import { resolveEscolaIdForUser } from "@/lib/tenant/resolveEscolaIdForUser";
import { requireRoleInSchool } from "@/lib/authz";
import { recordAuditServer } from "@/lib/audit";
import { emitirEvento } from "@/lib/eventos/emitirEvento";
import {
  emitirDocumentoFiscalViaAdapter,
  resolveEmpresaFiscalAtiva,
} from "@/lib/fiscal/financeiroFiscalAdapter";
import type { Json } from "~types/supabase";
import { issueFiscalReceiptForPayment } from "@/lib/fiscal/paymentFiscalDocument";
import {
  AcademicYearContextError,
  assertAcademicYearEntity,
  resolveAcademicYearContext,
} from "@/lib/academic-year/context";

export const dynamic = "force-dynamic";

const payloadSchema = z.object({
  aluno_id: z.string().uuid().optional(),
  mensalidade_id: z.string().uuid().optional(),
  valor: z.number().positive().optional(),
  metodo: z.enum(["cash", "tpa", "transfer", "mcx", "kiwk", "kwik"]).optional(),
  reference: z.string().trim().max(64).optional().nullable(),
  evidence_url: z.string().trim().max(255).optional().nullable(),
  meta: z.record(z.any()).optional(),
  metodo_pagamento: z.string().optional(),
  observacao: z.string().trim().max(255).optional().nullable(),
  ano_letivo_id: z.string().uuid().optional().nullable(),
});

const normalizeMetodo = (raw: string) => {
  const value = raw.toLowerCase().trim();
  if (["cash", "tpa", "transfer", "mcx", "kiwk", "kwik"].includes(value)) {
    return value === "kiwk" ? "kwik" : value;
  }
  if (value === "numerario" || value === "dinheiro") return "cash";
  if (value === "multicaixa" || value === "tpa_fisico" || value === "tpa") return "tpa";
  if (value === "transferencia") return "transfer";
  if (value === "mcx_express" || value === "mbway" || value === "referencia") return "mcx";
  if (value === "kwik") return "kwik";
  return "cash";
};

export async function POST(req: Request) {
  try {
    const idempotencyKey =
      req.headers.get("Idempotency-Key") ?? req.headers.get("idempotency-key");
    if (!idempotencyKey) {
      return NextResponse.json(
        { ok: false, error: "Idempotency-Key header é obrigatório" },
        { status: 400 }
      );
    }

    const supabase = await supabaseServerTyped<any>();
    const { data: auth } = await supabase.auth.getUser();
    const user = auth?.user;
    if (!user) {
      return NextResponse.json({ ok: false, error: "Não autenticado" }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const parsed = payloadSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { ok: false, error: parsed.error.issues?.[0]?.message || "Payload inválido." },
        { status: 400 }
      );
    }

    const metodo = normalizeMetodo(parsed.data.metodo ?? parsed.data.metodo_pagamento ?? "cash");
    const observacao = parsed.data.observacao ?? null;

    type MensalidadeRow = {
      id: string;
      escola_id: string;
      status: string | null;
      valor: number | null;
      valor_previsto: number | null;
      aluno_id: string | null;
      ano_referencia: number | null;
      valor_pago_total: number | null;
      fiscal_documento_id: string | null;
    };

    let mensalidade: MensalidadeRow | null = null;

    if (parsed.data.mensalidade_id) {
      const { data: mensalidadeRow, error: mensalidadeErr } = await supabase
        .from("mensalidades")
        .select("id, escola_id, status, valor, valor_previsto, aluno_id, ano_referencia, valor_pago_total, fiscal_documento_id")
        .eq("id", parsed.data.mensalidade_id)
        .maybeSingle();

      if (mensalidadeErr || !mensalidadeRow) {
        return NextResponse.json({ ok: false, error: "Mensalidade não encontrada." }, { status: 404 });
      }

      mensalidade = mensalidadeRow as MensalidadeRow;
    }

    const escolaId = await resolveEscolaIdForUser(
      supabase,
      user.id,
      mensalidade?.escola_id ?? null
    );
    if (!escolaId || (mensalidade?.escola_id && escolaId !== mensalidade.escola_id)) {
      return NextResponse.json({ ok: false, error: "Sem permissão." }, { status: 403 });
    }

    const academicContext = await resolveAcademicYearContext(supabase as any, {
      userId: user.id,
      requestedAcademicYearId: parsed.data.ano_letivo_id,
      operation: "WRITE",
    });
    let billingAcademicYearId = academicContext.anoLetivoId;
    if (mensalidade?.ano_referencia) {
      const { data: billingYear } = await supabase
        .from("anos_letivos")
        .select("id")
        .eq("escola_id", escolaId)
        .eq("ano", mensalidade.ano_referencia)
        .maybeSingle();
      billingAcademicYearId = billingYear?.id ?? academicContext.anoLetivoId;
    }

    const { error: roleError } = await requireRoleInSchool({
      supabase,
      escolaId,
      roles: ["secretaria", "financeiro", "admin_financeiro", "admin", "admin_escola", "staff_admin"],
    });
    if (roleError) return roleError;

    if (mensalidade?.status === "pago") {
      return NextResponse.json({ ok: true, mensagem: "Mensalidade já paga." });
    }
    if (!mensalidade && !parsed.data.aluno_id) {
      return NextResponse.json({ ok: false, error: "Informe aluno ou mensalidade." }, { status: 400 });
    }

    const alunoId = parsed.data.aluno_id ?? mensalidade?.aluno_id ?? null;
    if (!alunoId) {
      return NextResponse.json({ ok: false, error: "Aluno não identificado." }, { status: 400 });
    }

    if (mensalidade?.id) {
      const { data: mensalidadeMeta, error: mensalidadeMetaError } = await supabase
        .from("mensalidades")
        .select("matricula_id, turma_id")
        .eq("id", mensalidade.id)
        .maybeSingle();
      if (mensalidadeMetaError) throw mensalidadeMetaError;
      if (mensalidadeMeta?.matricula_id) {
        await assertAcademicYearEntity(supabase as any, {
          table: "matriculas",
          entityId: String(mensalidadeMeta.matricula_id),
          escolaId: academicContext.escolaId,
          anoLetivoId: billingAcademicYearId,
        });
      } else if (mensalidadeMeta?.turma_id) {
        await assertAcademicYearEntity(supabase as any, {
          table: "turmas",
          entityId: String(mensalidadeMeta.turma_id),
          escolaId: academicContext.escolaId,
          anoLetivoId: billingAcademicYearId,
        });
      }
    }

    const valor = Number(parsed.data.valor ?? mensalidade?.valor_previsto ?? mensalidade?.valor ?? 0);
    if (!Number.isFinite(valor) || valor <= 0) {
      return NextResponse.json({ ok: false, error: "Valor inválido." }, { status: 400 });
    }

    if (mensalidade) {
      const expected = Number(mensalidade.valor_previsto ?? mensalidade.valor ?? 0);
      const paidBefore = Number(mensalidade.valor_pago_total ?? 0);
      const outstanding = Math.max(0, Number((expected - paidBefore).toFixed(2)));
      const isPartial = valor < outstanding - 0.01;

      if (isPartial && !mensalidade.fiscal_documento_id) {
        const origin = new URL(req.url).origin;
        const cookieHeader = req.headers.get("cookie");
        const ft = await emitirDocumentoFiscalViaAdapter({
          tipoFluxoFinanceiro: "deferred_payment",
          origemOperacao: "financeiro_mensalidade_partial_source",
          origemId: mensalidade.id,
          descricaoPrincipal: "Propina",
          itens: [
            {
              descricao: "Propina",
              valor: outstanding,
              productType: "S",
              operationType: "SE",
              unitOfMeasure: "UN",
            },
          ],
          cliente: { nome: null, nif: null },
          escolaId,
          origin,
          cookieHeader,
          metadata: {
            mensalidade_id: mensalidade.id,
            aluno_id: alunoId,
            motivo_emissao: "fonte_para_pagamento_parcial",
          },
        });

        const { error: sourceLinkError } = await supabase
          .from("mensalidades")
          .update({
            fiscal_documento_id: ft.documento_id,
            status_fiscal: "ok",
            fiscal_error: null,
          })
          .eq("id", mensalidade.id)
          .eq("escola_id", escolaId);

        if (sourceLinkError) {
          return NextResponse.json(
            {
              ok: false,
              error: sourceLinkError.message,
              code: "PARTIAL_PAYMENT_SOURCE_LINK_FAILED",
            },
            { status: 500 }
          );
        }

        mensalidade.fiscal_documento_id = ft.documento_id;
      }
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

    const { data: pagamento, error } = await supabase.rpc("financeiro_registrar_pagamento_secretaria", {
      p_escola_id: escolaId,
      p_aluno_id: alunoId,
      p_mensalidade_id: mensalidade?.id ?? null,
      p_valor: valor,
      p_metodo: metodo,
      p_reference: parsed.data.reference ?? null,
      p_evidence_url: parsed.data.evidence_url ?? null,
      p_gateway_ref: null,
      p_meta: {
        observacao: observacao ?? undefined,
        origem: "portal_financeiro",
        ...(parsed.data.meta ?? {}),
        idempotency_key: idempotencyKey,
      },
    });

    if (error) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 400 });
    }

    const pagamentoId = (pagamento as { id?: string } | null)?.id ?? null;
    const pagamentoStatus = String(
      (pagamento as { status?: string } | null)?.status ?? ""
    );

    if (!["settled", "concluido", "pago"].includes(pagamentoStatus)) {
      recordAuditServer({
        escolaId,
        portal: "financeiro",
        acao: "PAGAMENTO_PENDENTE_VALIDACAO",
        entity: "pagamento",
        entityId: pagamentoId,
        details: {
          valor,
          metodo,
          mensalidade_id: mensalidade?.id ?? null,
          status: pagamentoStatus,
        },
      }).catch(() => null);

      return NextResponse.json({
        ok: true,
        data: pagamento,
        fiscal: {
          ok: false,
          pending_validation: true,
          error: "Documento fiscal será emitido somente após a liquidação do pagamento.",
        },
        status_fiscal: "awaiting_payment_validation",
      });
    }

    let sourceAllocation:
      | { fiscal_documento_origem_id?: string | null }
      | null = null;

    if (pagamentoId) {
      const { data: allocation, error: allocationError } = await supabase
        .from("financeiro_pagamento_alocacoes")
        .select("fiscal_documento_origem_id")
        .eq("pagamento_id", pagamentoId)
        .eq("natureza", "aplicacao")
        .maybeSingle();

      if (allocationError) throw allocationError;
      sourceAllocation = allocation as
        | { fiscal_documento_origem_id?: string | null }
        | null;
    }

    if (pagamentoId && sourceAllocation?.fiscal_documento_origem_id) {
      try {
        const receiptResult = await issueFiscalReceiptForPayment({ paymentId: pagamentoId, createdBy: user.id });
        const receipt = receiptResult.document;

        recordAuditServer({
          escolaId,
          portal: "financeiro",
          acao: "PAGAMENTO_REGISTRADO_RC",
          entity: "pagamento",
          entityId: pagamentoId,
          details: {
            valor,
            metodo,
            mensalidade_id: mensalidade?.id ?? null,
            fiscal_documento_origem_id:
              sourceAllocation.fiscal_documento_origem_id,
            recibo_documento_id: receipt.documento_id,
          },
        }).catch(() => null);

        return NextResponse.json({
          ok: true,
          data: pagamento,
          fiscal: {
            ok: true,
            tipo_documento: "RC",
            documento_id: receipt.documento_id,
            numero_formatado: receipt.numero_formatado,
            agt_submission: receiptResult.agtSubmission,
          },
          status_fiscal: "ok",
        });
      } catch (receiptError) {
        const fiscalMessage =
          receiptError instanceof Error
            ? receiptError.message
            : "Falha ao emitir RC fiscal.";

        await supabase
          .from("pagamentos")
          .update({
            status_fiscal: "pending",
            fiscal_error: fiscalMessage,
          })
          .eq("id", pagamentoId);

        recordAuditServer({
          escolaId,
          portal: "financeiro",
          acao: "PAGAMENTO_RC_PENDENTE",
          entity: "pagamento",
          entityId: pagamentoId,
          details: {
            valor,
            metodo,
            mensalidade_id: mensalidade?.id ?? null,
            fiscal_documento_origem_id:
              sourceAllocation.fiscal_documento_origem_id,
            fiscal_error: fiscalMessage,
          },
        }).catch(() => null);

        return NextResponse.json({
          ok: true,
          data: pagamento,
          fiscal: { ok: false, error: fiscalMessage, tipo_documento: "RC" },
          status_fiscal: "pending",
        });
      }
    }

    const origin = new URL(req.url).origin;
    const cookieHeader = req.headers.get("cookie");
    const origemId = String(pagamentoId ?? idempotencyKey);
    const empresaFiscalId = await resolveEmpresaFiscalAtiva({
      origin,
      escolaId,
      cookieHeader,
    });

    const pendingPayload = {
      escola_id: escolaId,
      empresa_id: empresaFiscalId,
      origem_tipo: "financeiro_pagamentos_registrar",
      origem_id: origemId,
      fiscal_documento_id: null,
      status: "pending",
      idempotency_key: `financeiro_pagamentos_registrar:${idempotencyKey}`,
      payload_snapshot: {
        origem_operacao: "financeiro_pagamentos_registrar",
        pagamento_id: pagamentoId,
        mensalidade_id: mensalidade?.id ?? null,
        valor,
        metodo,
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
          .eq("origem_tipo", "financeiro_pagamentos_registrar")
          .eq("origem_id", origemId)
          .maybeSingle();

        return NextResponse.json(
          {
            ok: false,
            error: "Emissão fiscal já em processamento para esta origem.",
            code: "FISCAL_ORIGEM_LOCKED",
            details: {
              origem_tipo: "financeiro_pagamentos_registrar",
              origem_id: origemId,
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

    let fiscalResult:
      | {
          ok: true;
          empresa_id: string;
          tipo_documento: "FR" | "FT" | "RC";
          documento_id: string;
          numero_formatado: string;
          hash_control: string;
          key_version: number;
          payload_snapshot: Record<string, unknown>;
          url_validacao?: string | null;
        }
      | {
          ok: false;
          error: string;
        } = { ok: false, error: "Fiscal pendente." };

    try {
      if (!mensalidade) {
        throw new Error(
          "FISCAL_SOURCE_CLASSIFICATION_REQUIRED: pagamento financeiro directo sem mensalidade/origem fiscal classificada não pode ser emitido automaticamente como serviço de ensino."
        );
      }

      const fiscal = await emitirDocumentoFiscalViaAdapter({
        tipoFluxoFinanceiro: "immediate_payment",
        origemOperacao: "financeiro_pagamentos_registrar",
        origemId,
        descricaoPrincipal: "Pagamento de mensalidade",
        itens: [
          {
            descricao: mensalidade?.id
              ? `Pagamento mensalidade ${mensalidade.id}`
              : "Pagamento financeiro direto",
            valor,
            productType: "S",
            operationType: "SE",
            unitOfMeasure: "UN",
          },
        ],
        cliente: {
          nome: null,
          nif: null,
        },
        escolaId,
        origin,
        cookieHeader,
        metadata: {
          pagamento_id: (pagamento as { id?: string } | null)?.id ?? null,
          mensalidade_id: mensalidade?.id ?? null,
        },
      });

      fiscalResult = {
        ok: true,
        empresa_id: fiscal.empresa_id,
        tipo_documento: fiscal.tipo_documento,
        documento_id: fiscal.documento_id,
        numero_formatado: fiscal.numero_formatado,
        hash_control: fiscal.hash_control,
        key_version: fiscal.key_version,
        payload_snapshot: fiscal.payload_snapshot,
        url_validacao: null, // Placeholder para futura implementação de página de validação
      };
    } catch (fiscalError) {
      const fiscalMessage =
        fiscalError instanceof Error ? fiscalError.message : "Falha ao emitir documento fiscal.";

      fiscalResult = {
        ok: false,
        error: fiscalMessage,
      };

      recordAuditServer({
        escolaId,
        portal: "financeiro",
        acao: "PAGAMENTO_FISCAL_PENDENTE",
        entity: "pagamento",
        entityId: (pagamento as { id?: string } | null)?.id ?? null,
        details: {
          valor,
          metodo,
          mensalidade_id: mensalidade?.id ?? null,
          fiscal_error: fiscalMessage,
        },
      }).catch(() => null);
    }

    if (fiscalResult.ok) {
      await supabase
        .from("financeiro_fiscal_links")
        .update({
          empresa_id: fiscalResult.empresa_id,
          fiscal_documento_id: fiscalResult.documento_id,
          status: "ok",
          payload_snapshot: fiscalResult.payload_snapshot as Json,
          fiscal_error: null,
        })
        .eq("origem_tipo", "financeiro_pagamentos_registrar")
        .eq("origem_id", origemId);

      if (pagamentoId) {
        await supabase
          .from("pagamentos")
          .update({
            status_fiscal: "ok",
            fiscal_documento_id: fiscalResult.documento_id,
            fiscal_error: null,
          })
          .eq("id", pagamentoId);
      }

    } else {
      await supabase
        .from("financeiro_fiscal_links")
        .update({
          empresa_id: empresaFiscalId,
          fiscal_documento_id: null,
          status: "failed",
          payload_snapshot: {
            origem_operacao: "financeiro_pagamentos_registrar",
            pagamento_id: pagamentoId,
            mensalidade_id: mensalidade?.id ?? null,
            erro: fiscalResult.error,
          } as Json,
          fiscal_error: fiscalResult.error,
        })
        .eq("origem_tipo", "financeiro_pagamentos_registrar")
        .eq("origem_id", origemId);

      if (pagamentoId) {
        await supabase
          .from("pagamentos")
          .update({
            status_fiscal: "pending",
            fiscal_error: fiscalResult.error,
          })
          .eq("id", pagamentoId);
      }

      if (mensalidade?.id) {
        await supabase
          .from("mensalidades")
          .update({
            status_fiscal: "pending",
            fiscal_error: fiscalResult.error,
          })
          .eq("id", mensalidade.id);
      }
    }

    recordAuditServer({
      escolaId,
      portal: "financeiro",
      acao: "PAGAMENTO_REGISTRADO",
      entity: "pagamento",
      entityId: (pagamento as any)?.id ?? null,
      details: { valor, metodo, mensalidade_id: mensalidade?.id ?? null },
    }).catch(() => null);

    try {
      const { data: alunoRow } = await supabase
        .from("alunos")
        .select("nome, nome_completo")
        .eq("id", alunoId)
        .maybeSingle();

      const alunoNome = alunoRow?.nome_completo || alunoRow?.nome || "Aluno";
      const valorFormatado = new Intl.NumberFormat("pt-AO", {
        style: "currency",
        currency: "AOA",
      }).format(valor);

      await emitirEvento(supabase, {
        escola_id: escolaId,
        tipo: "pagamento.confirmado",
        payload: {
          aluno_id: alunoId,
          aluno_nome: alunoNome,
          valor,
          valor_formatado: valorFormatado,
          metodo,
          apto_matricula: false,
        },
        actor_id: user.id,
        actor_role: "admin",
        entidade_tipo: "pagamento",
        entidade_id: (pagamento as any)?.id ?? null,
      });
    } catch (eventError) {
      console.warn("[pagamentos.registrar] falha ao emitir evento:", eventError);
    }

    return NextResponse.json({
      ok: true,
      data: pagamento,
      fiscal: fiscalResult,
      status_fiscal: fiscalResult.ok ? "ok" : "pending",
    });
  } catch (err) {
    if (err instanceof AcademicYearContextError) {
      return NextResponse.json({ ok: false, error: err.message, code: err.code }, { status: err.status });
    }
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
