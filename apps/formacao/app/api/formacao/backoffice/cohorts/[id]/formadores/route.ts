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

async function assertCohortExists(client: FormacaoSupabaseClient, escolaId: string, cohortId: string) {
  const { data, error } = await client
    .from("formacao_cohorts")
    .select("id")
    .eq("escola_id", escolaId)
    .eq("id", cohortId)
    .maybeSingle();

  if (error) return { ok: false as const, error: error.message, status: 400 };
  if (!data) return { ok: false as const, error: "Turma não encontrada", status: 404 };
  return { ok: true as const };
}

async function assertFormadorBelongsToCentro(client: FormacaoSupabaseClient, escolaId: string, userId: string) {
  const { data, error } = await client
    .from("escola_users")
    .select("user_id,papel")
    .eq("escola_id", escolaId)
    .eq("tenant_type", "formacao")
    .eq("user_id", userId)
    .in("papel", ["formador", "formacao_admin", "formacao_secretaria"])
    .maybeSingle();

  if (error) return { ok: false as const, error: error.message, status: 400 };
  if (!data) {
    return {
      ok: false as const,
      error: "Formador não pertence a este centro. Cadastre-o primeiro em Equipa.",
      status: 400,
    };
  }
  return { ok: true as const };
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireFormacaoRoles(allowedRoles);
  if (!auth.ok) return auth.response;

  const p = await params;
  const cohortId = String(p.id ?? "").trim();
  if (!cohortId) return NextResponse.json({ ok: false, error: "id é obrigatório" }, { status: 400 });

  const body = (await request.json().catch(() => null)) as
    | {
        formador_user_id?: string;
        percentual_honorario?: number;
      }
    | null;

  const formadorUserId = String(body?.formador_user_id ?? "").trim();
  const percentualRaw = Number(body?.percentual_honorario ?? 100);
  const percentualHonorario = Number.isFinite(percentualRaw) ? percentualRaw : 100;

  if (!formadorUserId) {
    return NextResponse.json({ ok: false, error: "formador_user_id é obrigatório" }, { status: 400 });
  }
  if (percentualHonorario <= 0 || percentualHonorario > 100) {
    return NextResponse.json(
      { ok: false, error: "percentual_honorario deve estar entre 1 e 100" },
      { status: 400 }
    );
  }

  const s = auth.supabase as FormacaoSupabaseClient;

  const cohortCheck = await assertCohortExists(s, auth.escolaId as string, cohortId);
  if (!cohortCheck.ok) {
    return NextResponse.json({ ok: false, error: cohortCheck.error }, { status: cohortCheck.status });
  }

  const formadorCheck = await assertFormadorBelongsToCentro(s, auth.escolaId as string, formadorUserId);
  if (!formadorCheck.ok) {
    return NextResponse.json({ ok: false, error: formadorCheck.error }, { status: formadorCheck.status });
  }

  const { data, error } = await s
    .from("formacao_cohort_formadores")
    .upsert(
      {
        escola_id: auth.escolaId,
        cohort_id: cohortId,
        formador_user_id: formadorUserId,
        percentual_honorario: percentualHonorario,
      },
      { onConflict: "escola_id,cohort_id,formador_user_id" }
    )
    .select("id, cohort_id, formador_user_id, percentual_honorario, created_at")
    .single();

  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 400 });

  return NextResponse.json({ ok: true, item: data });
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireFormacaoRoles(allowedRoles);
  if (!auth.ok) return auth.response;

  const p = await params;
  const cohortId = String(p.id ?? "").trim();
  if (!cohortId) return NextResponse.json({ ok: false, error: "id é obrigatório" }, { status: 400 });

  const url = new URL(request.url);
  const assignmentId = url.searchParams.get("assignment_id")?.trim() ?? "";
  const formadorUserId = url.searchParams.get("formador_user_id")?.trim() ?? "";

  if (!assignmentId && !formadorUserId) {
    return NextResponse.json(
      { ok: false, error: "Informe assignment_id ou formador_user_id" },
      { status: 400 }
    );
  }

  const s = auth.supabase as FormacaoSupabaseClient;

  const cohortCheck = await assertCohortExists(s, auth.escolaId as string, cohortId);
  if (!cohortCheck.ok) {
    return NextResponse.json({ ok: false, error: cohortCheck.error }, { status: cohortCheck.status });
  }

  let query = s
    .from("formacao_cohort_formadores")
    .delete()
    .eq("escola_id", auth.escolaId)
    .eq("cohort_id", cohortId);

  query = assignmentId ? query.eq("id", assignmentId) : query.eq("formador_user_id", formadorUserId);

  const { error } = await query;
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 400 });

  return NextResponse.json({ ok: true });
}
