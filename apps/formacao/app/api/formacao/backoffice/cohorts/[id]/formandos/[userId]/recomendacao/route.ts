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

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string; userId: string }> }
) {
  const auth = await requireFormacaoRoles(allowedRoles);
  if (!auth.ok) return auth.response;

  const p = await params;
  const cohortId = p.id;
  const userId = p.userId;
  const body = (await request.json().catch(() => null)) as {
    recomendado_certificacao: boolean;
  } | null;

  if (body === null || typeof body.recomendado_certificacao !== "boolean") {
    return NextResponse.json({ ok: false, error: "recomendado_certificacao deve ser um booleano" }, { status: 400 });
  }

  const s = auth.supabase as FormacaoSupabaseClient;

  // Verify cohort access
  const access = await assertCohortAccess(s, auth.userId, auth.escolaId, auth.role, cohortId);
  if (!access.ok) return access.response;

  const { error } = await s
    .from("formacao_inscricoes")
    // .update({ recomendado_certificacao: body.recomendado_certificacao })
    // TODO: Adicionar coluna recomendado_certificacao ou usar metadata
    .update({ updated_at: new Date().toISOString() } as any)
    .eq("escola_id", auth.escolaId)
    .eq("cohort_id", cohortId)
    .eq("formando_user_id", userId);

  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}
