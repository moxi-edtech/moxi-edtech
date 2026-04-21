import { NextResponse } from "next/server";
import { requireFormacaoRoles } from "@/lib/route-auth";
import type { FormacaoSupabaseClient } from "@/lib/db-types";

export const dynamic = "force-dynamic";

const allowedRoles = [
  "formacao_financeiro",
  "formacao_admin",
  "super_admin",
  "global_admin",
];

export async function GET() {
  const auth = await requireFormacaoRoles(allowedRoles);
  if (!auth.ok) return auth.response;

  const s = auth.supabase as FormacaoSupabaseClient;

  const { data, error } = await s
    .from("pagamentos")
    .select("id, created_at, valor_pago, metodo, metodo_pagamento, status, evidence_url, reference, aluno_id")
    .eq("escola_id", auth.escolaId)
    .not("evidence_url", "is", null)
    .order("created_at", { ascending: false })
    .limit(300);

  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 400 });
  }

  const items = (data ?? []).map((row) => {
    const typed = row as {
      id: string;
      created_at: string;
      valor_pago: number;
      metodo: string;
      metodo_pagamento: string | null;
      status: string;
      evidence_url: string | null;
      reference: string | null;
      aluno_id: string | null;
    };

    return {
      id: typed.id,
      created_at: typed.created_at,
      valor_pago: Number(typed.valor_pago ?? 0),
      metodo: String(typed.metodo_pagamento ?? typed.metodo ?? "-").toLowerCase(),
      status: typed.status,
      evidence_url: typed.evidence_url,
      reference: typed.reference,
      aluno_id: typed.aluno_id,
    };
  });

  return NextResponse.json({ ok: true, items });
}
