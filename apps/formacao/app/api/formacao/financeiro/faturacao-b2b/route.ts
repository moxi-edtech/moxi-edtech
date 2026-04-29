import { NextResponse } from "next/server";
import { requireFormacaoRoles } from "@/lib/route-auth";
import type { FormacaoSupabaseClient } from "@/lib/db-types";
import { getCohortReferenceValue } from "@/lib/cohort-finance";

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

async function assertFormandoInTenant(s: FormacaoSupabaseClient, escolaId: string, userId: string) {
  const { data, error } = await s
    .from("alunos")
    .select("id")
    .eq("escola_id", escolaId)
    .or(`usuario_auth_id.eq.${userId},profile_id.eq.${userId}`)
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data?.id) throw new Error("Formando não pertence a este centro");
}

async function assertClienteInTenant(s: FormacaoSupabaseClient, escolaId: string, clienteId: string) {
  const { data, error } = await s
    .from("formacao_clientes_b2b")
    .select("id")
    .eq("escola_id", escolaId)
    .eq("id", clienteId)
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data?.id) throw new Error("cliente_b2b_id inválido para este centro");
}

async function assertCohortInTenant(s: FormacaoSupabaseClient, escolaId: string, cohortId: string | null) {
  if (!cohortId) return;
  const { data, error } = await s
    .from("formacao_cohorts")
    .select("id")
    .eq("escola_id", escolaId)
    .eq("id", cohortId)
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data?.id) throw new Error("cohort_id inválido para este centro");
}

export async function GET() {
  const auth = await requireFormacaoRoles(allowedRoles);
  if (!auth.ok) return auth.response;

  const s = auth.supabase as FormacaoSupabaseClient;
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
  const cohortId = String(body?.cohort_id ?? "").trim() || null;
  const vencimentoEm = String(body?.vencimento_em ?? "").trim();
  const itens = Array.isArray(body?.itens) ? body.itens : [];

  if (!clienteId || !vencimentoEm || itens.length === 0) {
    return NextResponse.json(
      { ok: false, error: "cliente_b2b_id, vencimento_em e ao menos 1 item são obrigatórios" },
      { status: 400 }
    );
  }

  const s = auth.supabase as FormacaoSupabaseClient;
  try {
    await assertClienteInTenant(s, auth.escolaId as string, clienteId);
    await assertCohortInTenant(s, auth.escolaId as string, cohortId);
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Dados inválidos para este centro" },
      { status: 400 }
    );
  }

  const cohortReference = await getCohortReferenceValue(s, auth.escolaId as string, cohortId);
  const referencia = String(body?.referencia ?? "").trim() || buildReference("B2B", auth.escolaId || "FAT");

  const normalizedItens = itens.map((item) => {
    const quantidade = Number(item.quantidade || 1);
    const desconto = Number(item.desconto || 0);
    const incomingPrice = Number(item.preco_unitario || 0);
    const resolvedPrice =
      incomingPrice > 0
        ? incomingPrice
        : cohortReference != null
          ? cohortReference
          : incomingPrice;

    return {
      formando_user_id: String(item.formando_user_id || "").trim(),
      descricao: String(item.descricao || "").trim(),
      quantidade,
      preco_unitario: resolvedPrice,
      desconto,
    };
  });

  try {
    for (const item of normalizedItens) {
      await assertFormandoInTenant(s, auth.escolaId as string, item.formando_user_id);
    }
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Formando inválido para este centro" },
      { status: 400 }
    );
  }

  const totalBrutoResolved = normalizedItens.reduce(
    (sum, item) => sum + Number(item.quantidade || 0) * Number(item.preco_unitario || 0),
    0
  );
  const totalDescontoResolved = normalizedItens.reduce((sum, item) => sum + Number(item.desconto || 0), 0);

  const { data: fatura, error: faturaErr } = await s
    .from("formacao_faturas_lote")
    .insert({
      escola_id: auth.escolaId,
      cliente_b2b_id: clienteId,
      cohort_id: cohortId,
      referencia,
      vencimento_em: vencimentoEm,
      total_bruto: totalBrutoResolved,
      total_desconto: totalDescontoResolved,
      status: "emitida",
      created_by: auth.userId,
    })
    .select("id, referencia, total_liquido, status")
    .single();

  if (faturaErr) return NextResponse.json({ ok: false, error: faturaErr.message }, { status: 400 });

  const itensPayload = normalizedItens.map((item) => ({
    escola_id: auth.escolaId,
    fatura_lote_id: fatura.id,
    formando_user_id: item.formando_user_id,
    descricao: item.descricao,
    quantidade: item.quantidade,
    preco_unitario: item.preco_unitario,
    desconto: item.desconto,
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

  const { data, error } = await (auth.supabase as FormacaoSupabaseClient)
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

  const { error } = await (auth.supabase as FormacaoSupabaseClient)
    .from("formacao_faturas_lote")
    .delete()
    .eq("escola_id", auth.escolaId)
    .eq("id", id);

  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true });
}
