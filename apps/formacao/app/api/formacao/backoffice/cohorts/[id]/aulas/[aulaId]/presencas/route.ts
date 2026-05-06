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
  { params }: { params: Promise<{ id: string; aulaId: string }> }
) {
  const auth = await requireFormacaoRoles(allowedRoles);
  if (!auth.ok) return auth.response;

  const p = await params;
  const cohortId = String(p.id ?? "").trim();
  const aulaId = String(p.aulaId ?? "").trim();
  if (!aulaId) {
    return NextResponse.json({ ok: false, error: "id da aula é obrigatório" }, { status: 400 });
  }

  const s = auth.supabase as FormacaoSupabaseClient;

  // Verify cohort access
  const access = await assertCohortAccess(s, auth.userId, auth.escolaId, auth.role, cohortId);
  if (!access.ok) return access.response;

  const { data, error } = await s
    .from("formacao_presencas")
    .select("id, inscricao_id, presente, justificativa, formacao_inscricoes(formando_user_id, nome_snapshot)")
    .eq("escola_id", auth.escolaId)
    .eq("aula_id", aulaId);

  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 400 });

  return NextResponse.json({ ok: true, items: data });
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string; aulaId: string }> }
) {
  const auth = await requireFormacaoRoles(allowedRoles);
  if (!auth.ok) return auth.response;

  const p = await params;
  const aulaId = String(p.aulaId ?? "").trim();
  const body = (await request.json().catch(() => null)) as {
    presencas: Array<{
      inscricao_id: string;
      presente: boolean;
      justificativa?: string;
    }>;
  } | null;

  if (!body?.presencas || !Array.isArray(body.presencas)) {
    return NextResponse.json({ ok: false, error: "Dados de presença inválidos" }, { status: 400 });
  }

  const s = auth.supabase as FormacaoSupabaseClient;

  const cohortId = String(p.id ?? "").trim();
  // Verify cohort access
  const access = await assertCohortAccess(s, auth.userId, auth.escolaId, auth.role, cohortId);
  if (!access.ok) return access.response;

  // Perform an upsert for all presences
  const { error } = await s.from("formacao_presencas").upsert(
    body.presencas.map((p) => ({
      escola_id: auth.escolaId,
      aula_id: aulaId,
      inscricao_id: p.inscricao_id,
      presente: p.presente,
      justificativa: p.justificativa || null,
    })),
    { onConflict: "aula_id, inscricao_id" }
  );

  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 400 });

  return NextResponse.json({ ok: true });
}
