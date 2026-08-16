import { NextResponse } from "next/server";
import { z } from "zod";
import { POST as processarPagamentoBalcao } from "../../balcao/pagamentos/route";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const legacyPayloadSchema = z.object({
  aluno_id: z.string().uuid(),
  matricula_id: z.string().uuid().nullable().optional(),
  ano_letivo_id: z.string().uuid().nullable().optional(),
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

  const mensalidade = parsed.data.itens.find((item) => item.tipo === "mensalidade");
  if (!mensalidade) {
    return NextResponse.json(
      { ok: false, error: "O processamento de mensalidades exige um item de mensalidade." },
      { status: 400 },
    );
  }

  const detalhes = parsed.data.detalhes ?? {};
  const delegatedRequest = new Request(request.url, {
    method: "POST",
    headers: request.headers,
    body: JSON.stringify({
      aluno_id: parsed.data.aluno_id,
      mensalidade_id: mensalidade.id,
      valor: mensalidade.preco,
      metodo: parsed.data.metodo_pagamento.trim(),
      reference: emptyStringToNull(detalhes.referencia),
      evidence_url: emptyStringToNull(detalhes.evidencia_url),
      gateway_ref: emptyStringToNull(detalhes.gateway_ref),
      ano_letivo_id: parsed.data.ano_letivo_id ?? undefined,
      meta: {
        origem: "secretaria_pagamentos_processar_compat",
        matricula_id: parsed.data.matricula_id ?? mensalidade.origem_matricula_id ?? null,
        descricao_item: mensalidade.nome ?? "Mensalidade",
        itens: parsed.data.itens,
      },
    }),
  });

  return processarPagamentoBalcao(delegatedRequest);
}
