import { NextResponse } from "next/server";
import { requireFormacaoRoles } from "@/lib/route-auth";
import type { FormacaoSupabaseClient } from "@/lib/db-types";

export const dynamic = "force-dynamic";

export async function GET() {
  const auth = await requireFormacaoRoles([
    "formando",
    "formacao_financeiro",
    "formacao_admin",
    "super_admin",
    "global_admin",
  ]);
  if (!auth.ok) return auth.response;

  const s = auth.supabase as FormacaoSupabaseClient;

  if (auth.role === "formando") {
    const { data: blockedRows, error: blockedError } = await s
      .from("formacao_inscricoes")
      .select("id")
      .eq("escola_id", auth.escolaId)
      .eq("formando_user_id", auth.userId)
      .is("cancelled_at", null)
      .contains("metadata", { portal_access_blocked: true })
      .limit(1);

    if (blockedError) return NextResponse.json({ ok: false, error: blockedError.message }, { status: 400 });

    if ((blockedRows ?? []).length > 0) {
      return NextResponse.json(
        {
          ok: false,
          code: "PORTAL_BLOCKED",
          error: "Acesso ao portal bloqueado. Regularize os pagamentos para continuar.",
        },
        { status: 423 }
      );
    }
  }

  let query = s
    .from("formacao_faturas_lote_itens")
    .select(
      "id, formando_user_id, descricao, quantidade, preco_unitario, desconto, valor_total, status_pagamento, formacao_faturas_lote:fatura_lote_id(id, referencia, emissao_em, vencimento_em, status)"
    )
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
