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
  const escolaId = auth.escolaId;

  const { data, error } = await s
    .from("formacao_faturas_lote_itens")
    .select("id, status_pagamento, valor_total")
    .eq("escola_id", escolaId)
    .limit(1000);

  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 400 });
  }

  const rows = (data ?? []) as Array<{ status_pagamento?: string; valor_total?: number }>;
  const total = rows.reduce((sum, row) => sum + Number(row.valor_total ?? 0), 0);
  const pendentes = rows.filter((row) => row.status_pagamento === "pendente").length;

  return NextResponse.json({
    ok: true,
    summary: {
      totalItens: rows.length,
      totalValor: total,
      pendentes,
    },
  });
}
