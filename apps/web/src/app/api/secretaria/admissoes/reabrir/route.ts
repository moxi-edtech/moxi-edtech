import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { requireRoleInSchool } from "@/lib/authz";

const payloadSchema = z.object({
  candidatura_id: z.string().uuid(),
  motivo: z.string().min(3).max(500).optional(),
});

export async function POST(request: Request) {
  const supabase = await createClient();
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = payloadSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: parsed.error.format() }, { status: 400 });
  }

  const { candidatura_id, motivo } = parsed.data;

  const { data: cand, error: candErr } = await supabase
    .from("candidaturas")
    .select("id, escola_id, status")
    .eq("id", candidatura_id)
    .maybeSingle();

  if (candErr || !cand) {
    return NextResponse.json({ ok: false, error: "Candidatura não encontrada" }, { status: 404 });
  }

  const { error: authError } = await requireRoleInSchool({
    supabase,
    escolaId: cand.escola_id,
    roles: ["secretaria", "secretaria_financeiro", "admin_financeiro", "admin", "admin_escola", "staff_admin"],
  });
  if (authError) return authError;

  // Se o status for rejeitada ou arquivada, usamos a nova admissao_reabrir
  const currentStatus = String(cand.status ?? "").toLowerCase();
  const isFromClosed = ["rejeitada", "arquivada", "arquivado"].includes(currentStatus);

  let rpcName = "admissao_unsubmit";
  if (isFromClosed) {
    rpcName = "admissao_reabrir";
  } else {
    // Para os outros estados, verificamos se o unsubmit é permitido
    const allowedUnsubmit = ["submetida", "em_analise", "aprovada", "aguardando_pagamento"];
    if (!allowedUnsubmit.includes(currentStatus)) {
      return NextResponse.json({ ok: false, error: "Status não pode ser reaberto ou revertido para rascunho" }, { status: 400 });
    }
  }

  const { error: rpcErr } = await supabase.rpc(rpcName as "admissao_unsubmit" | "admissao_reabrir", {
    p_escola_id: cand.escola_id,
    p_candidatura_id: candidatura_id,
    p_motivo: motivo || "Reaberto via portal secretaria",
  });

  if (rpcErr) {
    return NextResponse.json({ ok: false, error: rpcErr.message }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}
