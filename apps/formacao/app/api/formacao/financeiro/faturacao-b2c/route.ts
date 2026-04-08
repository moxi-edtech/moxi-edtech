import { NextResponse } from "next/server";
import { requireFormacaoRoles } from "@/lib/route-auth";

export const dynamic = "force-dynamic";

function buildReference(prefix: string, escolaId: string) {
  const stamp = Date.now().toString().slice(-8);
  return `${prefix}-${escolaId.slice(0, 5).toUpperCase()}-${stamp}`;
}

async function ensureConsumidorFinal(s: any, escolaId: string) {
  const { data: existing } = await s
    .from("formacao_clientes_b2b")
    .select("id")
    .eq("escola_id", escolaId)
    .eq("nome_fantasia", "Consumidor Final")
    .limit(1)
    .maybeSingle();

  if (existing?.id) return existing.id as string;

  const { data, error } = await s
    .from("formacao_clientes_b2b")
    .insert({
      escola_id: escolaId,
      nome_fantasia: "Consumidor Final",
      status: "ativo",
    })
    .select("id")
    .single();

  if (error) throw new Error(error.message);
  return data.id as string;
}

const allowedRoles = [
  "formando",
  "formacao_financeiro",
  "formacao_admin",
  "super_admin",
  "global_admin",
];

export async function GET() {
  const auth = await requireFormacaoRoles(allowedRoles);
  if (!auth.ok) return auth.response;

  const s = auth.supabase as any;
  let query = s
    .from("formacao_faturas_lote_itens")
    .select("id, fatura_lote_id, formando_user_id, descricao, quantidade, preco_unitario, desconto, valor_total, status_pagamento")
    .eq("escola_id", auth.escolaId)
    .order("created_at", { ascending: false })
    .limit(500);

  if (auth.role === "formando") {
    query = query.eq("formando_user_id", auth.userId);
  }

  const { data, error } = await query;

  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true, items: data ?? [] });
}

export async function POST(request: Request) {
  const auth = await requireFormacaoRoles(allowedRoles);
  if (!auth.ok) return auth.response;

  const body = (await request.json().catch(() => null)) as {
    descricao?: string;
    formando_user_id?: string;
    quantidade?: number;
    preco_unitario?: number;
    desconto?: number;
    vencimento_em?: string;
    referencia?: string;
  } | null;

  const descricao = String(body?.descricao ?? "").trim();
  const quantidade = Number(body?.quantidade ?? 1);
  const precoUnitario = Number(body?.preco_unitario ?? 0);
  const desconto = Number(body?.desconto ?? 0);
  const vencimentoEm = String(body?.vencimento_em ?? "").trim();
  const formandoUserId = auth.role === "formando" ? auth.userId : String(body?.formando_user_id ?? "").trim();

  if (!descricao || !formandoUserId || quantidade <= 0 || precoUnitario < 0 || !vencimentoEm) {
    return NextResponse.json(
      { ok: false, error: "descricao, formando_user_id, vencimento_em, quantidade e preco_unitario são obrigatórios" },
      { status: 400 }
    );
  }

  const s = auth.supabase as any;
  try {
    const clienteId = await ensureConsumidorFinal(s, auth.escolaId as string);
    const referencia = String(body?.referencia ?? "").trim() || buildReference("B2C", auth.escolaId || "FAT");

    const totalBruto = quantidade * precoUnitario;

    const { data: fatura, error: faturaErr } = await s
      .from("formacao_faturas_lote")
      .insert({
        escola_id: auth.escolaId,
        cliente_b2b_id: clienteId,
        referencia,
        vencimento_em: vencimentoEm,
        total_bruto: totalBruto,
        total_desconto: desconto,
        status: "emitida",
        created_by: auth.userId,
      })
      .select("id, referencia, total_liquido, status")
      .single();

    if (faturaErr) {
      return NextResponse.json({ ok: false, error: faturaErr.message }, { status: 400 });
    }

    const { data: item, error: itemErr } = await s
      .from("formacao_faturas_lote_itens")
      .insert({
        escola_id: auth.escolaId,
        fatura_lote_id: fatura.id,
        formando_user_id: formandoUserId,
        descricao,
        quantidade,
        preco_unitario: precoUnitario,
        desconto,
        status_pagamento: "pendente",
      })
      .select("id, fatura_lote_id, formando_user_id, descricao, valor_total, status_pagamento")
      .single();

    if (itemErr) {
      return NextResponse.json({ ok: false, error: itemErr.message }, { status: 400 });
    }

    return NextResponse.json({ ok: true, item, fatura });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Falha ao emitir cobrança B2C" },
      { status: 400 }
    );
  }
}

export async function PATCH(request: Request) {
  const auth = await requireFormacaoRoles(allowedRoles);
  if (!auth.ok) return auth.response;

  const body = (await request.json().catch(() => null)) as {
    id?: string;
    status_pagamento?: "pendente" | "parcial" | "pago" | "cancelado";
  } | null;

  const id = String(body?.id ?? "").trim();
  if (!id) return NextResponse.json({ ok: false, error: "id é obrigatório" }, { status: 400 });

  const patch: Record<string, unknown> = {};
  if (body?.status_pagamento && ["pendente", "parcial", "pago", "cancelado"].includes(body.status_pagamento)) {
    patch.status_pagamento = body.status_pagamento;
  }

  let query = (auth.supabase as any)
    .from("formacao_faturas_lote_itens")
    .update(patch)
    .eq("escola_id", auth.escolaId)
    .eq("id", id);

  if (auth.role === "formando") {
    query = query.eq("formando_user_id", auth.userId);
  }

  const { data, error } = await query
    .select("id, fatura_lote_id, formando_user_id, descricao, valor_total, status_pagamento")
    .single();

  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true, item: data });
}

export async function DELETE(request: Request) {
  const auth = await requireFormacaoRoles(allowedRoles);
  if (!auth.ok) return auth.response;

  const id = new URL(request.url).searchParams.get("id")?.trim() ?? "";
  if (!id) return NextResponse.json({ ok: false, error: "id é obrigatório" }, { status: 400 });

  let query = (auth.supabase as any)
    .from("formacao_faturas_lote_itens")
    .delete()
    .eq("escola_id", auth.escolaId)
    .eq("id", id);

  if (auth.role === "formando") {
    query = query.eq("formando_user_id", auth.userId);
  }

  const { error } = await query;
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true });
}
