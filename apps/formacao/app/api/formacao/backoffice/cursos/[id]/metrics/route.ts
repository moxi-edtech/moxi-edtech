import { NextResponse } from "next/server";
import { requireFormacaoRoles } from "@/lib/route-auth";
import type { FormacaoSupabaseClient } from "@/lib/db-types";

export const dynamic = "force-dynamic";

const allowedRoles = [
  "formacao_admin",
  "formacao_secretaria",
  "super_admin",
  "global_admin",
];

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const auth = await requireFormacaoRoles(allowedRoles);
  if (!auth.ok) return auth.response;

  const s = auth.supabase as FormacaoSupabaseClient;

  const { data: metrics, error } = await s
    .from("vw_formacao_curso_cockpit_metrics")
    .select("*")
    .eq("curso_id", id)
    .eq("escola_id", auth.escolaId)
    .maybeSingle();

  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 400 });

  return NextResponse.json({ ok: true, metrics: metrics || {
    total_leads: 0,
    total_turmas: 0,
    ocupacao_media: 0,
    receita_estimada: 0
  } });
}
