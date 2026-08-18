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
import { getRequestOrigin, normalizeValidationBaseUrl } from "@/lib/serverUrl";

const PayloadSchema = z.object({
  mensalidadeId: z.string().uuid(),
});

type ReciboResponse = {
  ok: true;
  doc_id: string;
  url_validacao: string | null;
  print: {
    escola_nome: string;
    aluno_nome: string;
    aluno_bi: string | null;
    classe_nome: string | null;
    curso_nome: string | null;
    turma_nome: string | null;
    logo_url: string | null;
    numero_sequencial: number | null;
    public_id: string | null;
    emitido_em: string;
    banco: string | null;
    titular_conta: string | null;
    iban: string | null;
    kwik_chave: string | null;
  } | null;
  fiscal: {
    numero_formatado: string;
    hash_control: string;
    key_version: number;
  } | null;
};

type EscolaBrandingRow = {
  nome: string | null;
  logo_url: string | null;
  dados_pagamento: {
    banco?: string | null;
    titular_conta?: string | null;
    iban?: string | null;
    kwik_chave?: string | null;
  } | null;
};

type ExistingSnapshotRow = {
  dados_snapshot?: Json | null;
} | null;

type ReceiptItem = { descricao: string; valor: number };

function normalizeReceiptItems(meta: unknown, fallback: ReceiptItem): ReceiptItem[] {
  const record = normalizeSnapshotObject(meta as Json | null);
  const rawItems = record.itens_pagamento ?? record.itens ?? record.items;
  if (!Array.isArray(rawItems)) return [fallback];

  const items = rawItems
    .filter((item) => item && typeof item === "object" && !Array.isArray(item))
    .map((item) => {
      const row = item as Record<string, unknown>;
      const descricao = row.descricao ?? row.referencia ?? row.nome ?? row.label;
      const valor = Number(row.valor ?? row.amount ?? row.preco ?? 0);
      return {
        descricao: typeof descricao === "string" && descricao.trim() ? descricao.trim() : "Item pago",
        valor,
      };
    })
    .filter((item) => Number.isFinite(item.valor) && item.valor >= 0);

  return items.length > 0 ? items : [fallback];
}

function normalizeReceiptType(meta: unknown): "pagamento" | "matricula" | "confirmacao" {
  const record = normalizeSnapshotObject(meta as Json | null);
  const raw = String(record.tipo_comprovativo ?? record.tipo_operacao ?? record.operacao ?? record.origem ?? "").toLowerCase();
  if (raw.includes("confirm") || raw.includes("reconfirm") || raw.includes("rematric")) return "confirmacao";
  if (raw.includes("matric")) return "matricula";
  return "pagamento";
}

function normalizeSnapshotObject(value: Json | Record<string, unknown> | null | undefined) {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }

  return {};
}


async function resolveReciboValidationUrl({
  supabase,
  docId,
}: {
  supabase: any;
  docId: string;
}) {
  if (!docId) return null;

  const { data: doc } = await supabase
    .from("documentos_emitidos")
    .select("public_id, hash_validacao")
    .eq("id", docId)
    .maybeSingle();

  const publicId = typeof doc?.public_id === "string" ? doc.public_id : "";
  const hash = typeof doc?.hash_validacao === "string" ? doc.hash_validacao : "";
  if (!publicId || !hash) return null;

  const baseUrl = normalizeValidationBaseUrl(
    process.env.NEXT_PUBLIC_VALIDATION_BASE_URL ?? (await getRequestOrigin())
  );

  return `${String(baseUrl).replace(/\/$/, "")}/documentos/${publicId}?hash=${hash}`;
}

async function enrichReciboSnapshot({
  supabase,
  docId,
  escolaId,
  alunoId,
  extraSnapshot = {},
}: {
  supabase: any;
  docId: string;
  escolaId: string;
  alunoId: string | null;
  extraSnapshot?: Record<string, unknown>;
}) {
  if (!docId) return;

  const [
    { data: escolaRow },
    { data: alunoRow },
    { data: matriculaRow },
    { data: existingDoc },
  ] = await Promise.all([
    supabase
      .from("escolas")
      .select("nome, logo_url, dados_pagamento")
      .eq("id", escolaId)
      .maybeSingle(),
    alunoId
      ? supabase
          .from("alunos")
          .select("nome, nome_completo, bi_numero")
          .eq("id", alunoId)
          .maybeSingle()
      : Promise.resolve({ data: null }),
    alunoId
      ? supabase
          .from("matriculas")
          .select(`
            aluno_id,
            turmas (
              id,
              nome,
              turno,
              ano_letivo,
              classes ( nome ),
              cursos ( nome )
            )
          `)
          .eq("aluno_id", alunoId)
          .order("updated_at", { ascending: false })
          .limit(1)
          .maybeSingle()
      : Promise.resolve({ data: null }),
    supabase
      .from("documentos_emitidos")
      .select("dados_snapshot")
      .eq("id", docId)
      .maybeSingle(),
  ]);

  const branding = (escolaRow ?? null) as EscolaBrandingRow | null;
  const rawPagamento = branding?.dados_pagamento ?? null;
  const existingSnapshot = normalizeSnapshotObject((existingDoc as ExistingSnapshotRow)?.dados_snapshot ?? null);
  const aluno = (alunoRow ?? null) as
    | {
        nome?: string | null;
        nome_completo?: string | null;
        bi_numero?: string | null;
      }
    | null;
  const turma = ((matriculaRow as any)?.turmas ?? null) as
    | {
        nome?: string | null;
        turno?: string | null;
        ano_letivo?: number | null;
        classes?: { nome?: string | null } | null;
        cursos?: { nome?: string | null } | null;
      }
    | null;

  const patch = {
    escola_nome: branding?.nome ?? null,
    escola_logo_url: branding?.logo_url ?? null,
    escola_banco: rawPagamento?.banco ?? null,
    escola_titular_conta: rawPagamento?.titular_conta ?? null,
    escola_iban: rawPagamento?.iban ?? null,
    escola_kwik_chave: rawPagamento?.kwik_chave ?? null,
    aluno_nome: aluno?.nome_completo ?? aluno?.nome ?? null,
    aluno_bi: aluno?.bi_numero ?? null,
    turma_nome: turma?.nome ?? null,
    turma_turno: turma?.turno ?? null,
    classe_nome: turma?.classes?.nome ?? null,
    curso_nome: turma?.cursos?.nome ?? null,
    ano_letivo: turma?.ano_letivo ?? null,
  } satisfies Record<string, unknown>;

  await supabase
    .from("documentos_emitidos")
    .update({
      dados_snapshot: {
        ...existingSnapshot,
        ...patch,
        ...extraSnapshot,
      } as Json,
    })
    .eq("id", docId);
}

async function resolveReciboPrintPayload({
  supabase,
  docId,
  escolaId,
}: {
  supabase: any;
  docId: string;
  escolaId: string;
}) {
  if (!docId) return null;

  const [{ data: doc }, { data: escola }] = await Promise.all([
    supabase
      .from("documentos_emitidos")
      .select("public_id, created_at, numero_sequencial, dados_snapshot")
      .eq("id", docId)
      .maybeSingle(),
    supabase
      .from("escolas")
      .select("logo_url")
      .eq("id", escolaId)
      .maybeSingle(),
  ]);

  if (!doc) return null;

  const snapshot = normalizeSnapshotObject(doc.dados_snapshot ?? null);

  return {
    escola_nome:
      typeof snapshot.escola_nome === "string" && snapshot.escola_nome.trim()
        ? snapshot.escola_nome
        : "Escola",
    aluno_nome:
      typeof snapshot.aluno_nome === "string" && snapshot.aluno_nome.trim()
        ? snapshot.aluno_nome
        : "Aluno",
    aluno_bi: typeof snapshot.aluno_bi === "string" ? snapshot.aluno_bi : null,
    classe_nome: typeof snapshot.classe_nome === "string" ? snapshot.classe_nome : null,
    curso_nome: typeof snapshot.curso_nome === "string" ? snapshot.curso_nome : null,
    turma_nome: typeof snapshot.turma_nome === "string" ? snapshot.turma_nome : null,
    logo_url:
      typeof escola?.logo_url === "string" && escola.logo_url.trim()
        ? escola.logo_url
        : typeof snapshot.escola_logo_url === "string" && snapshot.escola_logo_url.trim()
          ? snapshot.escola_logo_url
          : null,
    numero_sequencial: typeof doc.numero_sequencial === "number" ? doc.numero_sequencial : null,
    public_id: typeof doc.public_id === "string" ? doc.public_id : null,
    emitido_em: typeof doc.created_at === "string" ? doc.created_at : new Date().toISOString(),
    banco: typeof snapshot.escola_banco === "string" ? snapshot.escola_banco : null,
    titular_conta:
      typeof snapshot.escola_titular_conta === "string" ? snapshot.escola_titular_conta : null,
    iban: typeof snapshot.escola_iban === "string" ? snapshot.escola_iban : null,
    kwik_chave: typeof snapshot.escola_kwik_chave === "string" ? snapshot.escola_kwik_chave : null,
  };
}

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
      const cachedResult = existingIdempotency.result as Partial<ReciboResponse>;
      if (cachedResult.ok === true && typeof cachedResult.doc_id === "string") {
        const print = await resolveReciboPrintPayload({
          supabase,
          docId: cachedResult.doc_id,
          escolaId,
        });
        return NextResponse.json({ ...cachedResult, print }, { status: 200 });
      }
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

    const { data: latestPagamento } = await supabaseAny
      .from("pagamentos")
      .select("meta, valor_pago, created_at")
      .eq("escola_id", escolaId)
      .eq("mensalidade_id", mensalidadeId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    const pagamentoMeta = normalizeSnapshotObject(latestPagamento?.meta ?? null);
    const fallbackItem = {
      descricao: "Propina",
      valor: Number(latestPagamento?.valor_pago ?? mensalidade.valor_previsto ?? mensalidade.valor ?? 0),
    } satisfies ReceiptItem;
    const receiptItems = normalizeReceiptItems(pagamentoMeta, fallbackItem);
    const receiptType = normalizeReceiptType(pagamentoMeta);

    const { data: reclassificacaoPendente } = await supabaseAny
      .from("matricula_reclassificacoes")
      .select("id,tipo")
      .eq("escola_id", escolaId)
      .eq("aluno_id", mensalidade.aluno_id)
      .eq("status", "aguardando_destino")
      .limit(1)
      .maybeSingle();
    if (reclassificacaoPendente) {
      return NextResponse.json(
        {
          ok: false,
          error: "Não é possível emitir recibo enquanto o aluno aguarda definição de destino académico.",
          code: "MATRICULA_AGUARDANDO_RECLASSIFICACAO",
          reclassificacao_tipo: reclassificacaoPendente.tipo,
        },
        { status: 409 }
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

        const legacyDocId = String(legacy.doc_id ?? "");
        const legacyUrlValidacao = legacyDocId
          ? await resolveReciboValidationUrl({ supabase, docId: legacyDocId })
          : null;

        const response: ReciboResponse = {
          ok: true,
          doc_id: legacyDocId,
          url_validacao: legacyUrlValidacao,
          print: null,
          fiscal: null,
        };

        if (legacyDocId) {
          await enrichReciboSnapshot({
            supabase,
            docId: legacyDocId,
            escolaId,
            alunoId: mensalidade.aluno_id ?? null,
            extraSnapshot: {
              tipo_comprovativo: receiptType,
              itens_pagamento: receiptItems,
              referencia: receiptItems.map((item) => item.descricao).join(", "),
              valor_pago: valorRecibo,
            },
          });
          response.print = await resolveReciboPrintPayload({
            supabase,
            docId: legacyDocId,
            escolaId,
          });
        }

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
        descricaoPrincipal: receiptType === "matricula"
          ? "Recebimento de matrícula"
          : receiptType === "confirmacao"
            ? "Recebimento de confirmação"
            : "Recebimento de mensalidade",
        itens: receiptItems,
        cliente: { nome: null, nif: null },
        escolaId,
        origin,
        cookieHeader,
        metadata: {
          mensalidade_id: mensalidadeId,
          aluno_id: mensalidade.aluno_id ?? null,
          tipo_comprovativo: receiptType,
          itens_pagamento: receiptItems,
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

    const urlValidacao = await resolveReciboValidationUrl({
      supabase,
      docId: fiscal.documento_id,
    });

    const response: ReciboResponse = {
      ok: true,
      doc_id: fiscal.documento_id,
      url_validacao: urlValidacao,
      print: null,
      fiscal: {
        numero_formatado: fiscal.numero_formatado,
        hash_control: fiscal.hash_control,
        key_version: fiscal.key_version,
      },
    };

    await enrichReciboSnapshot({
      supabase,
      docId: fiscal.documento_id,
      escolaId,
      alunoId: mensalidade.aluno_id ?? null,
      extraSnapshot: {
        tipo_comprovativo: receiptType,
        itens_pagamento: receiptItems,
        referencia: receiptItems.map((item) => item.descricao).join(", "),
        valor_pago: valorRecibo,
      },
    });
    response.print = await resolveReciboPrintPayload({
      supabase,
      docId: fiscal.documento_id,
      escolaId,
    });

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
