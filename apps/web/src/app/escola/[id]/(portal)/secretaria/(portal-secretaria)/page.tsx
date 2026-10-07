import SecretariaDashboardPage from "@/app/secretaria/(portal-secretaria)/page";
import { getDefaultK12PortalPathForRole } from "@/lib/permissions";
import { K12_OPERACOES_PRIMARY_ROLE } from "@/lib/roles";
import { supabaseServer } from "@/lib/supabaseServer";
import { resolveEscolaIdForUser } from "@/lib/tenant/resolveEscolaIdForUser";
import { redirect } from "next/navigation";
import type { DashboardCounts, DashboardRecentes } from "@/app/secretaria/(portal-secretaria)/types";

export default async function SecretariaLandingPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams?: Promise<{ aluno?: string; view?: string; modo?: string }>;
}) {
  const { id: escolaParam } = await params;
  const sp = searchParams ? await searchParams : undefined;
  const supabase = await supabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/redirect");

  const metaEscolaId = (user.app_metadata as { escola_id?: string | null } | null)?.escola_id ?? null;
  const resolvedEscolaId = await resolveEscolaIdForUser(
    supabase as any,
    user.id,
    escolaParam,
    metaEscolaId ? String(metaEscolaId) : null
  );

  if (!resolvedEscolaId) redirect("/redirect");

  const { data: vinculo } = await supabase
    .from("escola_users")
    .select("papel")
    .eq("escola_id", resolvedEscolaId)
    .eq("user_id", user.id)
    .maybeSingle();

  const papel = (vinculo?.papel ?? null) as string | null;

  const normalizedPapel = String(papel ?? "").trim().toLowerCase();
  if (normalizedPapel === K12_OPERACOES_PRIMARY_ROLE || normalizedPapel === "admin_secretaria") {
    const qp = new URLSearchParams(sp as Record<string, string> | undefined);
    const query = qp.toString();
    const dest = `/escola/${escolaParam}/operacoes/dashboard`;
    redirect(`${dest}${query ? `?${query}` : ""}`);
  }

  if (normalizedPapel && normalizedPapel !== "secretaria" && normalizedPapel !== "secretaria_financeiro") {
    const qp = new URLSearchParams(sp as Record<string, string> | undefined);
    const query = qp.toString();
    const dest = getDefaultK12PortalPathForRole(normalizedPapel, escolaParam);
    redirect(`${dest}${query ? `?${query}` : ""}`);
  }

  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);
  const endOfDay = new Date(startOfDay);
  endOfDay.setDate(endOfDay.getDate() + 1);

  const [countsRes, recentesRes, matriculasHojeRes] = await Promise.all([
    supabase.from("vw_secretaria_dashboard_counts").select("alunos_ativos, turmas_total").eq("escola_id", resolvedEscolaId).maybeSingle(),
    supabase.from("vw_secretaria_dashboard_kpis").select("pendencias_importacao, novas_matriculas, avisos_recentes").eq("escola_id", resolvedEscolaId).maybeSingle(),
    supabase.from("matriculas").select("id", { count: "exact", head: true }).eq("escola_id", resolvedEscolaId).gte("created_at", startOfDay.toISOString()).lt("created_at", endOfDay.toISOString()),
  ]);

  const dashboardCounts: DashboardCounts | null = countsRes.error ? null : {
    alunos: countsRes.data?.alunos_ativos ?? 0,
    matriculas: matriculasHojeRes.error ? 0 : (matriculasHojeRes.count ?? 0),
    turmas: countsRes.data?.turmas_total ?? 0,
    pendencias: recentesRes.error ? 0 : Number(recentesRes.data?.pendencias_importacao ?? 0),
  };

  const dashboardRecentes: DashboardRecentes | null = recentesRes.error ? null : {
    pendencias: Number(recentesRes.data?.pendencias_importacao ?? 0),
    novas_matriculas: Array.isArray(recentesRes.data?.novas_matriculas) ? recentesRes.data.novas_matriculas : [],
    avisos_recentes: Array.isArray(recentesRes.data?.avisos_recentes) ? recentesRes.data.avisos_recentes : [],
    fecho_trimestre: null,
  };

  return <SecretariaDashboardPage initialCounts={dashboardCounts} initialRecentes={dashboardRecentes} />;
}
