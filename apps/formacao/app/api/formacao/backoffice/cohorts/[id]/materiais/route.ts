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

  const access = await assertCohortAccess(s, auth.userId, auth.escolaId, auth.role, cohortId);
  if (!access.ok) return access.response;

  const { data, error } = await s
    .from("formacao_materiais")
    .select("*, formacao_cohort_modulos(titulo, ordem)")
    .eq("escola_id", auth.escolaId)
    .eq("cohort_id", cohortId)
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 400 });

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
  const body = await request.json();
  const s = auth.supabase as FormacaoSupabaseClient;

  const access = await assertCohortAccess(s, auth.userId, auth.escolaId, auth.role, cohortId);
  if (!access.ok) return access.response;

  const payload = {
    ...body,
    escola_id: auth.escolaId,
    cohort_id: cohortId,
    created_by: auth.userId,
    updated_at: new Date().toISOString(),
  };

  let result;
  if (body.id) {
    result = await s
      .from("formacao_materiais")
      .update(payload)
      .eq("id", body.id)
      .eq("escola_id", auth.escolaId)
      .select()
      .single();
  } else {
    result = await s
      .from("formacao_materiais")
      .insert(payload)
      .select()
      .single();
  }

  if (result.error) return NextResponse.json({ ok: false, error: result.error.message }, { status: 400 });

  return NextResponse.json({ ok: true, item: result.data });
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireFormacaoRoles(allowedRoles);
  if (!auth.ok) return auth.response;

  const p = await params;
  const cohortId = p.id;
  const { searchParams } = new URL(request.url);
  const materialId = searchParams.get("id");

  if (!materialId) return NextResponse.json({ ok: false, error: "id é obrigatório" }, { status: 400 });

  const s = auth.supabase as FormacaoSupabaseClient;
  const access = await assertCohortAccess(s, auth.userId, auth.escolaId, auth.role, cohortId);
  if (!access.ok) return access.response;

  const { error } = await s
    .from("formacao_materiais")
    .delete()
    .eq("id", materialId)
    .eq("escola_id", auth.escolaId);

  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 400 });

  return NextResponse.json({ ok: true });
}
