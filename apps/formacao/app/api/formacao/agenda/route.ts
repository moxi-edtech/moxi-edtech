import { NextResponse } from "next/server";
import { requireFormacaoRoles } from "@/lib/route-auth";
import type { FormacaoSupabaseClient } from "@/lib/db-types";

export const dynamic = "force-dynamic";

export async function GET() {
  const auth = await requireFormacaoRoles([
    "formador",
    "formacao_admin",
    "super_admin",
    "global_admin",
  ]);
  if (!auth.ok) return auth.response;

  const s = auth.supabase as FormacaoSupabaseClient;
  let query = s
    .from("formacao_cohort_formadores")
    .select(
      "id, cohort_id, formador_user_id, percentual_honorario, created_at, formacao_cohorts:cohort_id(id, codigo, nome, curso_nome, data_inicio, data_fim, status, carga_horaria_total, vagas)"
    )
    .eq("escola_id", auth.escolaId)
    .order("created_at", { ascending: false })
    .limit(300);

  if (auth.role === "formador") {
    query = query.eq("formador_user_id", auth.userId);
  }

  const { data, error } = await query;
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true, items: data ?? [] });
}

