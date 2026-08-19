import { NextResponse } from "next/server";
import { z } from "zod";
import { POST as processarPagamentoBalcao } from "../../balcao/pagamentos/route";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const legacyPayloadSchema = z.object({
  aluno_id: z.string().uuid(),
  matricula_id: z.string().uuid().nullable().optional(),
  ano_letivo_id: z.string().uuid().nullable().optional(),
  origem: z.string().trim().optional(),
  metodo_pagamento: z.string().min(1),
  detalhes: z.object({
    referencia: z.string().nullable().optional(),
    evidencia_url: z.string().nullable().optional(),
    gateway_ref: z.string().nullable().optional(),
  }).optional(),
  itens: z.array(z.object({
    id: z.string().uuid(),
    tipo: z.enum(["mensalidade", "servico"]),
    nome: z.string().optional(),
    preco: z.number().positive(),
    origem_matricula_id: z.string().uuid().nullable().optional(),
  })).min(1),
});

function emptyStringToNull(value: string | null | undefined): string | null {
  const normalized = value?.trim();
  return normalized ? normalized : null;
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
  if (itensPagamento.length === 0) {
    return NextResponse.json(
      { ok: false, error: "O processamento exige pelo menos um item de pagamento." },
      { status: 400 },
    );
  }

  const detalhes = parsed.data.detalhes ?? {};
  const requestId = request.headers.get("Idempotency-Key") ?? crypto.randomUUID();
  const resultados: unknown[] = [];
  let ultimoResultado: Record<string, unknown> | null = null;

  // Each item is settled individually by the canonical balcão route, while
  // the last call emits one consolidated receipt for the whole batch.
  for (const [index, item] of itensPagamento.entries()) {
    const emitirRecibo = index === itensPagamento.length - 1;
    const delegatedHeaders = new Headers(request.headers);
    delegatedHeaders.set("Idempotency-Key", `${requestId}:${index}`);
    const delegatedRequest = new Request(request.url, {
      method: "POST",
      headers: delegatedHeaders,
      body: JSON.stringify({
        aluno_id: parsed.data.aluno_id,
        mensalidade_id: item.tipo === "mensalidade" ? item.id : undefined,
        valor: item.preco,
        metodo: parsed.data.metodo_pagamento.trim(),
        reference: emptyStringToNull(detalhes.referencia),
        evidence_url: emptyStringToNull(detalhes.evidencia_url),
        gateway_ref: emptyStringToNull(detalhes.gateway_ref),
        ano_letivo_id: parsed.data.ano_letivo_id ?? undefined,
        meta: {
          origem: parsed.data.origem ?? "secretaria_pagamentos_processar_compat",
          matricula_id: parsed.data.matricula_id ?? (item.tipo === "mensalidade" ? item.origem_matricula_id : null) ?? null,
          descricao_item: item.nome ?? (item.tipo === "mensalidade" ? "Mensalidade" : "Serviço escolar"),
          itens: itensPagamento,
          emitir_recibo: emitirRecibo,
        },
      }),
    });

    const response = await processarPagamentoBalcao(delegatedRequest);
    const json = await response.json().catch(() => ({}));
    if (!response.ok || !json?.ok) {
      return NextResponse.json({ ...json, resultados }, { status: response.status });
    }
    ultimoResultado = json as Record<string, unknown>;
    resultados.push(json.data ?? json);
  }

  return NextResponse.json({
    ...(ultimoResultado ?? { ok: true }),
    ok: true,
    data: (ultimoResultado as any)?.data ?? null,
    recibo: (ultimoResultado as any)?.recibo ?? null,
    fiscal: (ultimoResultado as any)?.fiscal ?? null,
    pagamentos: resultados,
  });
}
