import { NextResponse } from "next/server";
import { requireFormacaoRoles } from "@/lib/route-auth";

export const dynamic = "force-dynamic";

type ItemPayload = {
  formando_user_id: string;
  descricao: string;
  quantidade: number;
  preco_unitario: number;
  desconto?: number;
};

const allowedRoles = [
  "formacao_financeiro",
  "formacao_admin",
  "super_admin",
  "global_admin",
];

function buildReference(prefix: string, escolaId: string) {
  const stamp = Date.now().toString().slice(-8);
  return `${prefix}-${escolaId.slice(0, 5).toUpperCase()}-${stamp}`;
}

export async function GET() {
  const auth = await requireFormacaoRoles(allowedRoles);
  if (!auth.ok) return auth.response;

  const s = auth.supabase as any;
  const { data, error } = await s
    .from("formacao_faturas_lote")
    .select("id, referencia, cliente_b2b_id, cohort_id, emissao_em, vencimento_em, total_bruto, total_desconto, total_liquido, status")
    .eq("escola_id", auth.escolaId)
    .order("created_at", { ascending: false })
    .limit(200);

  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true, items: data ?? [] });
}

export async function POST(request: Request) {
  const auth = await requireFormacaoRoles(allowedRoles);
  if (!auth.ok) return auth.response;

  const body = (await request.json().catch(() => null)) as {
    cliente_b2b_id?: string;
    cohort_id?: string;
    referencia?: string;
    vencimento_em?: string;
    itens?: ItemPayload[];
  } | null;

  const clienteId = String(body?.cliente_b2b_id ?? "").trim();
  const vencimentoEm = String(body?.vencimento_em ?? "").trim();
  const itens = Array.isArray(body?.itens) ? body.itens : [];

  if (!clienteId || !vencimentoEm || itens.length === 0) {
    return NextResponse.json(
      { ok: false, error: "cliente_b2b_id, vencimento_em e ao menos 1 item são obrigatórios" },
      { status: 400 }
    );
  }

  const totalBruto = itens.reduce(
    (sum, item) => sum + Number(item.quantidade || 0) * Number(item.preco_unitario || 0),
    0
  );
  const totalDesconto = itens.reduce((sum, item) => sum + Number(item.desconto || 0), 0);

  const s = auth.supabase as any;
  const referencia = String(body?.referencia ?? "").trim() || buildReference("B2B", auth.escolaId || "FAT");

  const { data: fatura, error: faturaErr } = await s
    .from("formacao_faturas_lote")
    .insert({
      escola_id: auth.escolaId,
      cliente_b2b_id: clienteId,
      cohort_id: String(body?.cohort_id ?? "").trim() || null,
      referencia,
      vencimento_em: vencimentoEm,
      total_bruto: totalBruto,
      total_desconto: totalDesconto,
      status: "emitida",
      created_by: auth.userId,
    })
    .select("id, referencia, total_liquido, status")
    .single();

  if (faturaErr) return NextResponse.json({ ok: false, error: faturaErr.message }, { status: 400 });

  const itensPayload = itens.map((item) => ({
    escola_id: auth.escolaId,
    fatura_lote_id: fatura.id,
    formando_user_id: String(item.formando_user_id || "").trim(),
    descricao: String(item.descricao || "").trim(),
    quantidade: Number(item.quantidade || 1),
    preco_unitario: Number(item.preco_unitario || 0),
    desconto: Number(item.desconto || 0),
    status_pagamento: "pendente",
  }));

  const { error: itensErr } = await s.from("formacao_faturas_lote_itens").insert(itensPayload);
  if (itensErr) {
    return NextResponse.json({ ok: false, error: itensErr.message }, { status: 400 });
  }

  return NextResponse.json({ ok: true, item: fatura });
}

export async function PATCH(request: Request) {
  const auth = await requireFormacaoRoles(allowedRoles);
  if (!auth.ok) return auth.response;

  const body = (await request.json().catch(() => null)) as {
    id?: string;
    status?: "rascunho" | "emitida" | "parcial" | "paga" | "cancelada";
    vencimento_em?: string;
  } | null;

  const id = String(body?.id ?? "").trim();
  if (!id) return NextResponse.json({ ok: false, error: "id é obrigatório" }, { status: 400 });

  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (body?.status && ["rascunho", "emitida", "parcial", "paga", "cancelada"].includes(body.status)) {
    patch.status = body.status;
  }
  if (typeof body?.vencimento_em === "string") patch.vencimento_em = body.vencimento_em.trim();

  const { data, error } = await (auth.supabase as any)
    .from("formacao_faturas_lote")
    .update(patch)
    .eq("escola_id", auth.escolaId)
    .eq("id", id)
    .select("id, referencia, emissao_em, vencimento_em, total_liquido, status")
    .single();

  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true, item: data });
}

export async function DELETE(request: Request) {
  const auth = await requireFormacaoRoles(allowedRoles);
  if (!auth.ok) return auth.response;

  const id = new URL(request.url).searchParams.get("id")?.trim() ?? "";
  if (!id) return NextResponse.json({ ok: false, error: "id é obrigatório" }, { status: 400 });

  const { error } = await (auth.supabase as any)
    .from("formacao_faturas_lote")
    .delete()
    .eq("escola_id", auth.escolaId)
    .eq("id", id);

  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true });
}
