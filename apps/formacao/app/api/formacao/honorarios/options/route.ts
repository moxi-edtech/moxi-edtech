import { NextResponse } from "next/server";
import { requireFormacaoRoles } from "@/lib/route-auth";
import type { FormacaoSupabaseClient } from "@/lib/db-types";

export const dynamic = "force-dynamic";

const allowedRoles = [
  "formador",
  "formacao_financeiro",
  "formacao_admin",
  "super_admin",
  "global_admin",
];

export async function GET() {
  const auth = await requireFormacaoRoles(allowedRoles);
  if (!auth.ok) return auth.response;

  const s = auth.supabase as FormacaoSupabaseClient;

  let cohortsQuery = s
    .from("formacao_cohorts_formadores")
    .select("cohort_id, formador_user_id")
    .eq("escola_id", auth.escolaId)
    .limit(500);

  if (auth.role === "formador") {
    cohortsQuery = cohortsQuery.eq("formador_user_id", auth.userId);
  }

  const { data: refs, error: refsError } = await cohortsQuery;
  if (refsError) return NextResponse.json({ ok: false, error: refsError.message }, { status: 400 });

  const cohortIds = Array.from(new Set((refs ?? []).map((r) => String((r as { cohort_id: string }).cohort_id)))).filter(Boolean);
  const formadorIds = Array.from(new Set((refs ?? []).map((r) => String((r as { formador_user_id: string }).formador_user_id)))).filter(Boolean);

  if (auth.role !== "formador") {
    const { data: escolaUsers } = await s
      .from("escola_users")
      .select("user_id, papel")
      .eq("escola_id", auth.escolaId)
      .or("papel.eq.formador,papel.eq.formacao_formador");

    for (const row of escolaUsers ?? []) {
      const userId = String((row as { user_id: string | null }).user_id ?? "").trim();
      if (userId) formadorIds.push(userId);
    }
  }

  const uniqueFormadorIds = Array.from(new Set(formadorIds));

  const [cohortsResult, profilesResult] = await Promise.all([
    cohortIds.length > 0
      ? s
          .from("formacao_cohorts")
          .select("id, codigo, nome, curso_nome, status")
          .eq("escola_id", auth.escolaId)
          .in("id", cohortIds)
          .order("nome", { ascending: true })
      : Promise.resolve({ data: [], error: null }),
    uniqueFormadorIds.length > 0
      ? s.rpc("tenant_profiles_by_ids", { p_user_ids: uniqueFormadorIds })
      : Promise.resolve({ data: [], error: null }),
  ]);

  if (cohortsResult.error) return NextResponse.json({ ok: false, error: cohortsResult.error.message }, { status: 400 });
  if (profilesResult.error) return NextResponse.json({ ok: false, error: profilesResult.error.message }, { status: 400 });

  const cohorts = (cohortsResult.data ?? []).map((row) => {
    const typed = row as {
      id: string;
      codigo: string | null;
      nome: string | null;
      curso_nome: string | null;
      status: string | null;
    };
    return {
      id: typed.id,
      label: [typed.codigo ?? "", typed.nome ?? "Turma", typed.curso_nome ?? ""].filter(Boolean).join(" · "),
      status: typed.status,
    };
  });

  const formadores = (profilesResult.data ?? [])
    .map((row) => {
      const typed = row as { user_id?: string; nome?: string; email?: string | null };
      if (!typed.user_id || !typed.nome) return null;
      return {
        user_id: typed.user_id,
        nome: typed.nome,
        email: typed.email ?? null,
        label: [typed.nome, typed.email ?? ""].filter(Boolean).join(" · "),
      };
    })
    .filter((item): item is NonNullable<typeof item> => Boolean(item))
    .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));

  return NextResponse.json({ ok: true, cohorts, formadores });
}
