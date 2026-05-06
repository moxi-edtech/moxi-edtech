import { NextResponse } from "next/server";
import { requireFormacaoRoles } from "@/lib/route-auth";
import type { FormacaoSupabaseClient } from "@/lib/db-types";

export const dynamic = "force-dynamic";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireFormacaoRoles([
    "formando",
    "formacao_admin",
    "formacao_secretaria",
    "super_admin",
    "global_admin",
  ]);
  if (!auth.ok) return auth.response;

  const p = await params;
  const cohortId = p.id;
  const s = auth.supabase as FormacaoSupabaseClient;

  // 1. Verify if the student is enrolled in this cohort
  if (auth.role === "formando") {
    const { data: enrollment, error: enrollmentError } = await s
      .from("formacao_inscricoes")
      .select("id")
      .eq("escola_id", auth.escolaId)
      .eq("cohort_id", cohortId)
      .eq("formando_user_id", auth.userId)
      .is("cancelled_at", null)
      .maybeSingle();

    if (enrollmentError) return NextResponse.json({ ok: false, error: enrollmentError.message }, { status: 400 });
    if (!enrollment) return NextResponse.json({ ok: false, error: "Inscrição não encontrada" }, { status: 403 });
  }

  // 2. Fetch cohort details
  const { data: cohort, error: cohortError } = await s
    .from("formacao_cohorts")
    .select("id, codigo, nome, curso_nome, data_inicio, data_fim, status")
    .eq("escola_id", auth.escolaId)
    .eq("id", cohortId)
    .single();

  if (cohortError) return NextResponse.json({ ok: false, error: cohortError.message }, { status: 400 });

  // 3. Fetch modules
  const { data: modulos, error: modulosError } = await s
    .from("formacao_cohort_modulos")
    .select("id, titulo, ordem")
    .eq("escola_id", auth.escolaId)
    .eq("cohort_id", cohortId)
    .order("ordem", { ascending: true });

  if (modulosError) return NextResponse.json({ ok: false, error: modulosError.message }, { status: 400 });

  // 4. Fetch materials
  const { data: materiais, error: materiaisError } = await s
    .from("formacao_materiais")
    .select("id, titulo, descricao, file_url, file_type, modulo_id, created_at")
    .eq("escola_id", auth.escolaId)
    .eq("cohort_id", cohortId)
    .order("created_at", { ascending: false });

  if (materiaisError) return NextResponse.json({ ok: false, error: materiaisError.message }, { status: 400 });

  // 5. Fetch evaluations (agenda)
  const { data: agenda, error: agendaError } = await s
    .from("formacao_avaliacoes_agenda")
    .select("id, titulo, descricao, data, hora_inicio, hora_fim, local, modulo_id")
    .eq("escola_id", auth.escolaId)
    .eq("cohort_id", cohortId)
    .order("data", { ascending: true });

  if (agendaError) return NextResponse.json({ ok: false, error: agendaError.message }, { status: 400 });

  return NextResponse.json({
    ok: true,
    cohort,
    modulos,
    materiais,
    agenda
  });
}
