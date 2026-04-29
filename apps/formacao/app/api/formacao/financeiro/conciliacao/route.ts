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

  const { data, error } = await (s as any)
    .from("formacao_pagamentos_verificacao")
    .select("id, created_at, valor_informado, status, comprovativo_url, fatura_item_id, formando_user_id, metadata, mensagem_aluno, motivo_rejeicao, analisado_em")
    .eq("escola_id", auth.escolaId)
    .order("created_at", { ascending: false })
    .limit(300);

  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 400 });
  }

  const items = (data ?? []).map((row) => {
    const typed = row as {
      id: string;
      created_at: string;
      valor_informado: number | null;
      status: string;
      comprovativo_url: string | null;
      fatura_item_id: string;
      formando_user_id: string;
    };

    return {
      id: typed.id,
      created_at: typed.created_at,
      valor_pago: Number(typed.valor_informado ?? 0),
      metodo: "comprovativo",
      status: typed.status,
      evidence_url: typed.comprovativo_url,
      reference: typed.fatura_item_id,
      aluno_id: typed.formando_user_id,
    };
  });

  return NextResponse.json({ ok: true, items });
}

export async function PATCH(request: Request) {
  const auth = await requireFormacaoRoles(allowedRoles);
  if (!auth.ok) return auth.response;

  const body = (await request.json().catch(() => null)) as
    | { id?: string; status?: "em_analise" | "aprovado" | "rejeitado" | "contestacao"; motivo_rejeicao?: string }
    | null;

  const id = String(body?.id ?? "").trim();
  const status = String(body?.status ?? "").trim().toLowerCase();
  const motivo = String(body?.motivo_rejeicao ?? "").trim() || null;
  if (!id || !["em_analise", "aprovado", "rejeitado", "contestacao"].includes(status)) {
    return NextResponse.json({ ok: false, error: "id e status válidos são obrigatórios" }, { status: 400 });
  }

  const s = auth.supabase as FormacaoSupabaseClient;
  const patch: Record<string, unknown> = {
    status,
    analisado_por: auth.userId,
    analisado_em: new Date().toISOString(),
    motivo_rejeicao: status === "rejeitado" ? motivo : null,
  };

  const { data: verif, error: verifError } = await (s as any)
    .from("formacao_pagamentos_verificacao")
    .update(patch)
    .eq("escola_id", auth.escolaId)
    .eq("id", id)
    .select("id, fatura_item_id, status")
    .single();

  if (verifError) return NextResponse.json({ ok: false, error: verifError.message }, { status: 400 });

  const verifRow = verif as { id: string; fatura_item_id: string; status: string };
  const itemStatus = status === "aprovado" ? "pago" : status === "rejeitado" ? "pendente" : "em_verificacao";
  const { error: itemError } = await s
    .from("formacao_faturas_lote_itens")
    .update({ status_pagamento: itemStatus })
    .eq("escola_id", auth.escolaId)
    .eq("id", verifRow.fatura_item_id);

  if (itemError) return NextResponse.json({ ok: false, error: itemError.message }, { status: 400 });

  return NextResponse.json({ ok: true, item: verifRow });
}
