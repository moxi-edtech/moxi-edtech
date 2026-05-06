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
    .from("formacao_avaliacoes_agenda")
    .select("*, formacao_cohort_modulos(titulo, ordem)")
    .eq("escola_id", auth.escolaId)
    .eq("cohort_id", cohortId)
    .order("data", { ascending: true });

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
    updated_at: new Date().toISOString(),
  };

  let result;
  if (body.id) {
    result = await s
      .from("formacao_avaliacoes_agenda")
      .update(payload)
      .eq("id", body.id)
      .eq("escola_id", auth.escolaId)
      .select()
      .single();
  } else {
    result = await s
      .from("formacao_avaliacoes_agenda")
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
  const eventId = searchParams.get("id");

  if (!eventId) return NextResponse.json({ ok: false, error: "id é obrigatório" }, { status: 400 });

  const s = auth.supabase as FormacaoSupabaseClient;
  const access = await assertCohortAccess(s, auth.userId, auth.escolaId, auth.role, cohortId);
  if (!access.ok) return access.response;

  const { error } = await s
    .from("formacao_avaliacoes_agenda")
    .delete()
    .eq("id", eventId)
    .eq("escola_id", auth.escolaId);

  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 400 });

  return NextResponse.json({ ok: true });
}
