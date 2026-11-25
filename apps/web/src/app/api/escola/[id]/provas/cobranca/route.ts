import { NextResponse } from "next/server";
import { provaAccess } from "@/lib/provas/access";
import { parseDistribution, distributionError, distributionResult, recipientSchema, rpcArgs } from "@/lib/provas/distribution";

export const dynamic = "force-dynamic";
const serviceCode = "SERV_FOLHA_PROVA";
const json = (data: unknown, status = 200) => NextResponse.json(data, {
  status,
  headers: { "Cache-Control": "private, no-store", "Referrer-Policy": "no-referrer" },
});

// Read-only preview. The existing catalogue currently represents AOA prices.
// This endpoint is not a payment authorization or a durable quote.
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const access = await provaAccess((await params).id);
  if (!access.ok) return json({ error: "Acesso não autorizado." }, access.status);
  if (!access.distribute) return json({ error: "Acesso não autorizado." }, 403);

  const query = new URL(req.url).searchParams;
  const parsed = parseDistribution(query);
  if (!parsed.success || parsed.data.modo !== "imprimir" || !parsed.data.matricula ||
      parsed.data.turmas.length !== 1 || parsed.data.offset !== 0) {
    return json({ error: "Seleccione uma prova aprovada, uma turma e uma matrícula." }, 400);
  }
  const selection = parsed.data;
  const result = await access.db.rpc("provas_destinatarios", rpcArgs(access.escolaId, selection));
  if (result.error) {
    const error = distributionError(result.error);
    return json({ error: error.message }, error.status);
  }
  const distribution = distributionResult.safeParse(result.data);
  if (!distribution.success || distribution.data.total !== 1 || distribution.data.items.length !== 1) {
    return json({ error: "Destinatário inválido." }, 409);
  }
  const recipient = recipientSchema.safeParse(distribution.data.items[0]);
  if (!recipient.success || recipient.data.matricula_id !== selection.matricula ||
      recipient.data.turma_id !== selection.turmas[0]) {
    return json({ error: "Destinatário inválido." }, 409);
  }
  const { data: price, error: priceError } = await access.db.from("servicos_escola")
    .select("valor_base")
    .eq("escola_id", access.escolaId)
    .eq("codigo", serviceCode)
    .eq("ativo", true)
    .maybeSingle();
  if (priceError) return json({ error: "Não foi possível consultar o preço." }, 503);

  const amount = typeof price?.valor_base === "number" ? price.valor_base : NaN;
  const cents = Math.round(amount * 100);
  const configured = Number.isFinite(amount) && amount > 0 &&
    Number.isSafeInteger(cents) && Math.abs(amount * 100 - cents) < 0.000001;
  return json({
    ok: true,
    prova_id: selection.prova,
    versao: selection.versao,
    matricula_id: selection.matricula,
    turma_id: selection.turmas[0],
    snapshot: distribution.data.snapshot,
    servico_codigo: serviceCode,
    moeda: "AOA",
    valor_centimos: configured ? cents : null,
    estado: configured ? "preco_disponivel" : "preco_nao_configurado",
    confirmacao_disponivel: false,
  });
}
