import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { requireRoleInSchool } from "@/lib/authz";

const payloadSchema = z.object({
  candidatura_id: z.string().uuid(),
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

  const { candidatura_id } = parsed.data;

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
    roles: ["secretaria", "admin", "admin_escola", "staff_admin"],
  });
  if (authError) return authError;

  const allowedStatuses = ["submetida", "em_analise", "aprovada", "aguardando_pagamento"];
  if (!allowedStatuses.includes(String(cand.status ?? "").toLowerCase())) {
    return NextResponse.json({ ok: false, error: "Status não pode ser reaberto" }, { status: 400 });
  }

  const { error: updateErr } = await supabase
    .from("candidaturas")
    .update({ status: "rascunho", updated_at: new Date().toISOString() })
    .eq("id", candidatura_id);

  if (updateErr) {
    return NextResponse.json({ ok: false, error: updateErr.message }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}
