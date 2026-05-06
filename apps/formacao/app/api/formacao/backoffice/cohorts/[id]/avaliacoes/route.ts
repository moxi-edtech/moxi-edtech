import { NextResponse } from "next/server";
import { requireFormacaoRoles, assertCohortAccess } from "@/lib/route-auth";
import type { FormacaoSupabaseClient } from "@/lib/db-types";

export const dynamic = "force-dynamic";

const allowedRoles = [
  "formacao_admin",
  "formacao_secretaria",
  "formador",
  "super_admin",
  "global_admin",
];

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireFormacaoRoles(allowedRoles);
  if (!auth.ok) return auth.response;

  const p = await params;
  const cohortId = String(p.id ?? "").trim();
  const { searchParams } = new URL(request.url);
  const type = searchParams.get("type") || "grid"; // 'grid' or 'progress'

  const s = auth.supabase as FormacaoSupabaseClient;

  // Verify cohort access
  const access = await assertCohortAccess(s, auth.userId, auth.escolaId, auth.role, cohortId);
  if (!access.ok) return access.response;

  if (type === "progress") {
    const { data, error } = await s
      .from("vw_formacao_estudante_progresso")
      .select("*")
      .eq("cohort_id", cohortId);

    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 400 });
    return NextResponse.json({ ok: true, items: data });
  }

  // Fetch evaluations for the grid
  const { data: evaluations, error: evalError } = await s
    .from("formacao_modulo_avaliacoes")
    .select("id, inscricao_id, modulo_id, nota, conceito, observacoes")
    .eq("escola_id", auth.escolaId);
    
  if (evalError) return NextResponse.json({ ok: false, error: evalError.message }, { status: 400 });

  return NextResponse.json({ ok: true, items: evaluations });
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireFormacaoRoles(allowedRoles);
  if (!auth.ok) return auth.response;

  const p = await params;
  const cohortId = String(p.id ?? "").trim();
  const body = (await request.json().catch(() => null)) as {
    evaluations: Array<{
      id?: string;
      inscricao_id: string;
      modulo_id: string;
      nota?: number;
      conceito: string;
      observacoes?: string;
    }>;
  } | null;

  if (!body?.evaluations || !Array.isArray(body.evaluations)) {
    return NextResponse.json({ ok: false, error: "Dados de avaliação inválidos" }, { status: 400 });
  }

  const s = auth.supabase as FormacaoSupabaseClient;

  // Verify cohort access
  const access = await assertCohortAccess(s, auth.userId, auth.escolaId, auth.role, cohortId);
  if (!access.ok) return access.response;

  const { error } = await s.from("formacao_modulo_avaliacoes").upsert(
    body.evaluations.map((ev) => ({
      escola_id: auth.escolaId,
      inscricao_id: ev.inscricao_id,
      modulo_id: ev.modulo_id,
      nota: ev.nota || null,
      conceito: ev.conceito,
      observacoes: ev.observacoes || null,
      updated_at: new Date().toISOString(),
    })),
    { onConflict: "inscricao_id, modulo_id" }
  );

  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 400 });

  return NextResponse.json({ ok: true });
}
