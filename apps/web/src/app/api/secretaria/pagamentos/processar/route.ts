import { NextResponse } from "next/server";
import { enrichOperationalReceiptSnapshot } from "@/lib/financeiro/enrichOperationalReceiptSnapshot";
import { z } from "zod";
import { POST as processarPagamentoBalcao } from "../../balcao/pagamentos/route";
import { requireRoleInSchool } from "@/lib/authz";
import { recordAuditServer } from "@/lib/audit";
import { AcademicYearContextError, resolveAcademicYearContext } from "@/lib/academic-year/context";
import { supabaseServerTyped } from "@/lib/supabaseServer";
import { resolveEscolaIdForUser } from "@/lib/tenant/resolveEscolaIdForUser";
import type { Database } from "~types/supabase";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const paymentItemSchema = z.object({
  id: z.string().uuid(),
  tipo: z.enum(["mensalidade", "servico"]),
  nome: z.string().optional(),
  preco: z.number().positive(),
  origem_matricula_id: z.string().uuid().nullable().optional(),
});

const legacyPayloadSchema = z.object({
  aluno_id: z.string().uuid(),
  matricula_id: z.string().uuid().nullable().optional(),
  ano_letivo_id: z.string().uuid().nullable().optional(),
  origem: z.string().trim().optional(),
  pedido_id: z.string().uuid().nullable().optional(),
  metodo_pagamento: z.enum(["cash", "tpa", "transfer", "mcx", "kiwk", "kwik"]),
  detalhes: z.object({
    referencia: z.string().nullable().optional(),
    evidencia_url: z.string().nullable().optional(),
    gateway_ref: z.string().nullable().optional(),
  }).optional(),
  itens: z.array(paymentItemSchema).min(1),
});

type PaymentItem = z.infer<typeof paymentItemSchema>;
type BatchReceiptResult =
  | { ok: true; doc_id: string | null; public_id: string | null; emitido_em: string | null; print_url?: string | null }
  | { ok: false; error: string };

function emptyStringToNull(value: string | null | undefined): string | null {
  const normalized = value?.trim();
  return normalized ? normalized : null;
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function getStringField(record: Record<string, unknown>, key: string): string | null {
  const value = record[key];
  return typeof value === "string" && value.trim() ? value : null;
}

type ReceiptItem = { descricao: string; valor: number };

function normalizeReceiptItems(items: PaymentItem[]): ReceiptItem[] {
  return items.map((item) => ({
    descricao: item.nome?.trim() || (item.tipo === "mensalidade" ? "Mensalidade" : "Serviço escolar"),
    valor: item.preco,
  }));
}

function normalizeReceiptType(origin: string | undefined, items: PaymentItem[]): "pagamento" | "matricula" | "confirmacao" {
  const raw = String(origin ?? "").toLowerCase();
  if (raw.includes("confirm") || raw.includes("rematric")) return "confirmacao";

  const hasConfirmation = items.some((item) =>
    `${item.nome ?? ""}`.toLowerCase().includes("rematric"),
  );
  return hasConfirmation ? "confirmacao" : "pagamento";
}

async function emitBatchReceipt({
  supabase,
  escolaId,
  items,
  metodo,
  origin,
  lastPayment,
  alunoId,
}: {
  supabase: Awaited<ReturnType<typeof supabaseServerTyped<Database>>>;
  escolaId: string;
  items: PaymentItem[];
  metodo: string;
  origin: string | undefined;
  lastPayment: Record<string, unknown>;
  alunoId: string;
}): Promise<BatchReceiptResult> {
  const lastItem = items[items.length - 1];
  if (!lastItem) {
    return { ok: false, error: "Recibo não aplicável" };
  }

  let receipt: BatchReceiptResult = { ok: false, error: "Recibo não aplicável" };

  if (lastItem.tipo === "mensalidade") {
    const { data, error } = await supabase.rpc("emitir_recibo", {
      p_mensalidade_id: lastItem.id,
    });
    if (error) {
      return { ok: false, error: error.message || "Falha ao emitir recibo" };
    }

    const record = asRecord(data);
    if (record.ok === true) {
      const docId = getStringField(record, "doc_id");
      receipt = {
        ok: true,
        doc_id: docId,
        public_id: getStringField(record, "public_id"),
        emitido_em: getStringField(record, "emitido_em"),
        print_url: docId ? `/secretaria/documentos/${docId}/recibo/print` : null,
      };
    } else {
      receipt = { ok: false, error: getStringField(record, "erro") || "Falha ao emitir recibo" };
    }
  } else if (getStringField(lastPayment, "status") === "settled") {
    const pagamentoId = getStringField(lastPayment, "id");
    if (!pagamentoId) {
      return { ok: false, error: "Pagamento de serviço sem identificador." };
    }

    const { data, error } = await (supabase as any).rpc("emitir_recibo_servicos", {
      p_pagamento_id: pagamentoId,
    });
    if (error) {
      return { ok: false, error: error.message || "Falha ao emitir recibo" };
    }

    const record = asRecord(data);
    if (record.ok === true) {
      const docId = getStringField(record, "doc_id");
      receipt = {
        ok: true,
        doc_id: docId,
        public_id: getStringField(record, "public_id"),
        emitido_em: getStringField(record, "emitido_em"),
        print_url: docId ? `/secretaria/documentos/${docId}/recibo/print` : null,
      };
    } else {
      receipt = { ok: false, error: getStringField(record, "erro") || "Falha ao emitir recibo" };
    }
  }

  if (receipt.ok && receipt.doc_id) {
    const receiptItems = normalizeReceiptItems(items);
    try {
      await enrichOperationalReceiptSnapshot({
        escolaId,
        docId: receipt.doc_id,
        alunoId,
        extraSnapshot: {
          tipo_comprovativo: normalizeReceiptType(origin, items),
          itens_pagamento: receiptItems,
          referencia: receiptItems.map((item) => item.descricao).join(", "),
          valor_pago: receiptItems.reduce((total, item) => total + item.valor, 0),
          metodo,
          data_pagamento: new Date().toISOString(),
        },
      });
    } catch (error) {
      // The payment batch is already committed. Never turn an enrichment
      // error into an ambiguous HTTP 500 that tempts staff to pay again.
      console.error("[RECIBO-BATCH][SNAPSHOT]", {
        message: error instanceof Error ? error.message : "RECIBO_ENRICHMENT_FAILED",
      });
      return { ok: false, error: "Pagamento registado, mas o recibo precisa de recuperação." };
    }
  }

  return receipt;
}

/** Compatibility endpoint kept for the Secretaria Balcão contract used by older clients. */
export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const parsed = legacyPayloadSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      {
        ok: false,
        error: parsed.error.issues[0]?.message ?? "Payload inválido.",
        field: parsed.error.issues[0]?.path?.join(".") || null,
      },
      { status: 400 },
    );
  }

  const itensPagamento = parsed.data.itens;
  const detalhes = parsed.data.detalhes ?? {};
  const requestId = request.headers.get("Idempotency-Key") ?? crypto.randomUUID();
  const metodo = parsed.data.metodo_pagamento === "kiwk" ? "kwik" : parsed.data.metodo_pagamento;

  // Preserve the canonical single-item route exactly. The batch RPC is only
  // needed when one checkout can otherwise commit a prefix of the cart.
  if (itensPagamento.length === 1) {
    const item = itensPagamento[0];
    const delegatedHeaders = new Headers(request.headers);
    delegatedHeaders.set("Idempotency-Key", `${requestId}:0`);

    return processarPagamentoBalcao(new Request(request.url, {
      method: "POST",
      headers: delegatedHeaders,
      body: JSON.stringify({
        aluno_id: parsed.data.aluno_id,
        mensalidade_id: item.tipo === "mensalidade" ? item.id : undefined,
        valor: item.preco,
        metodo,
        reference: emptyStringToNull(detalhes.referencia),
        evidence_url: emptyStringToNull(detalhes.evidencia_url),
        gateway_ref: emptyStringToNull(detalhes.gateway_ref),
        ano_letivo_id: parsed.data.ano_letivo_id ?? undefined,
        meta: {
          origem: parsed.data.origem ?? "secretaria_pagamentos_processar_compat",
          pedido_id: parsed.data.pedido_id ?? null,
          matricula_id:
            parsed.data.matricula_id
            ?? (item.tipo === "mensalidade" ? item.origem_matricula_id : null)
            ?? null,
          descricao_item: item.nome ?? (item.tipo === "mensalidade" ? "Mensalidade" : "Serviço escolar"),
          itens: itensPagamento,
          emitir_recibo: true,
        },
      }),
    }));
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

  let academicContext;
  try {
    academicContext = await resolveAcademicYearContext(supabase as any, {
      userId: user.id,
      requestedAcademicYearId: parsed.data.ano_letivo_id ?? undefined,
      operation: "WRITE",
    });
  } catch (err) {
    if (err instanceof AcademicYearContextError) {
      return NextResponse.json(
        { ok: false, error: err.message, code: err.code },
        { status: err.status },
      );
    }
    throw err;
  }

  const baseMeta = {
    origem: parsed.data.origem ?? "secretaria_pagamentos_processar_compat",
    pedido_id: parsed.data.pedido_id ?? null,
    matricula_id: parsed.data.matricula_id ?? null,
    matricula_origem_id: parsed.data.matricula_id ?? null,
    ano_letivo_id: academicContext.anoLetivoId,
  };

  const { data: batchData, error: batchError } = await (supabase as any).rpc(
    "financeiro_registrar_pagamentos_secretaria_batch",
    {
      p_escola_id: escolaId,
      p_aluno_id: parsed.data.aluno_id,
      p_itens: itensPagamento,
      p_metodo: metodo,
      p_idempotency_key: requestId,
      p_reference: emptyStringToNull(detalhes.referencia),
      p_evidence_url: emptyStringToNull(detalhes.evidencia_url),
      p_gateway_ref: emptyStringToNull(detalhes.gateway_ref),
      p_meta: baseMeta,
    },
  );

  if (batchError) {
    console.error("[SECRETARIA-PAGAMENTOS-BATCH][RPC_ERROR]", {
      message: batchError.message,
      code: batchError.code ?? null,
      details: batchError.details ?? null,
      hint: batchError.hint ?? null,
    });
    return NextResponse.json(
      {
        ok: false,
        error: batchError.message || "Falha ao processar checkout.",
        pg: {
          code: batchError.code ?? null,
          details: batchError.details ?? null,
          hint: batchError.hint ?? null,
        },
      },
      { status: 400 },
    );
  }

  const batch = asRecord(batchData);
  if (batch.ok !== true) {
    const status = Number(batch.status);
    return NextResponse.json(
      batch,
      { status: Number.isInteger(status) && status >= 400 && status <= 599 ? status : 400 },
    );
  }

  const pagamentos = Array.isArray(batch.pagamentos) ? batch.pagamentos : [];
  const ultimoPagamento = asRecord(batch.data);
  const idempotent = batch.idempotent === true;

  // Receipt RPCs are themselves idempotent: on retry they return the existing
  // receipt instead of creating a duplicate. This closes the small gap between
  // the committed financial batch and HTTP response delivery.
  const recibo = await emitBatchReceipt({
    supabase,
    escolaId,
    items: itensPagamento,
    metodo,
    origin: parsed.data.origem,
    lastPayment: ultimoPagamento,
    alunoId: parsed.data.aluno_id,
  });

  if (!idempotent) {
    pagamentos.forEach((row, index) => {
      const payment = asRecord(row);
      recordAuditServer({
        escolaId,
        portal: "secretaria",
        acao: "PAGAMENTO_REGISTRADO",
        entity: "pagamento",
        entityId: getStringField(payment, "id"),
        details: {
          valor: itensPagamento[index]?.preco ?? null,
          metodo,
          fiscal_ok: false,
          ano_letivo_id: academicContext.anoLetivoId,
          batch_idempotency_key: requestId,
        },
      }).catch(() => null);
    });
  }

  return NextResponse.json({
    ok: true,
    data: ultimoPagamento,
    recibo,
    fiscal: { ok: false, error: "Emissão fiscal desativada" },
    pagamentos,
    idempotent,
  });
}
