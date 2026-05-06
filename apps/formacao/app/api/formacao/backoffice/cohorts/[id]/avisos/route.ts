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
  const cohortId = p.id;
  const s = auth.supabase as FormacaoSupabaseClient;

  // Verify cohort access
  const access = await assertCohortAccess(s, auth.userId, auth.escolaId, auth.role, cohortId);
  if (!access.ok) return access.response;

  const { data, error } = await s
    .from("formacao_cohort_avisos")
    .select("*")
    .eq("escola_id", auth.escolaId)
    .eq("cohort_id", cohortId)
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 400 });
  }

  return NextResponse.json({ ok: true, items: data });
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireFormacaoRoles(allowedRoles);
  if (!auth.ok) return auth.response;

  const p = await params;
  const cohortId = p.id;
  const body = (await request.json().catch(() => null)) as {
    titulo: string;
    conteudo: string;
  } | null;

  if (!body?.titulo || !body?.conteudo) {
    return NextResponse.json({ ok: false, error: "Título e conteúdo são obrigatórios" }, { status: 400 });
  }

  const s = auth.supabase as FormacaoSupabaseClient;

  // Verify cohort access
  const access = await assertCohortAccess(s, auth.userId, auth.escolaId, auth.role, cohortId);
  if (!access.ok) return access.response;

  const { data, error } = await s
    .from("formacao_cohort_avisos")
    .insert({
      escola_id: auth.escolaId,
      cohort_id: cohortId,
      formador_user_id: auth.userId,
      titulo: body.titulo,
      conteudo: body.conteudo,
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 400 });
  }

  return NextResponse.json({ ok: true, item: data });
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireFormacaoRoles(allowedRoles);
  if (!auth.ok) return auth.response;

  const { searchParams } = new URL(request.url);
  const avisoId = searchParams.get("id");

  if (!avisoId) {
    return NextResponse.json({ ok: false, error: "ID do aviso é obrigatório" }, { status: 400 });
  }

  const p = await params;
  const cohortId = p.id;
  const s = auth.supabase as FormacaoSupabaseClient;

  // Verify cohort access
  const access = await assertCohortAccess(s, auth.userId, auth.escolaId, auth.role, cohortId);
  if (!access.ok) return access.response;

  const { error } = await s
    .from("formacao_cohort_avisos")
    .delete()
    .eq("escola_id", auth.escolaId)
    .eq("id", avisoId)
    .eq("cohort_id", cohortId);

  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}
