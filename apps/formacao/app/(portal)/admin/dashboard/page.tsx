import { redirect } from "next/navigation";
import { getFormacaoAuthContext } from "@/lib/auth-context";
import { resolveFormacaoSessionContext } from "@/lib/session-context";
import { supabaseServer } from "@/lib/supabaseServer";
import type { FormacaoSupabaseClient } from "@/lib/db-types";
import { AdminDashboardClient } from "@/components/dashboard/AdminDashboardClient";

export const dynamic = "force-dynamic";

type CohortOverviewRow = {
  id: string;
  codigo: string | null;
  nome: string | null;
  curso_nome: string | null;
  vagas: number | null;
  data_inicio: string | null;
  data_fim: string | null;
  status: string | null;
  total_formadores: number | null;
};

type LotacaoRow = {
  cohort_id: string;
  cohort_nome: string | null;
  vagas: number | null;
  inscritos_total: number | null;
  inscritos_pagos: number | null;
  lotacao_percentual: number | null;
};

type StagingRow = {
  id: string;
  nome_completo: string;
  email: string | null;
  created_at: string;
  cohort: {
    nome: string | null;
    curso_nome: string | null;
    data_inicio: string | null;
  } | null;
};

type OperationalAlert = {
  title: string;
  description: string;
  href: string;
  label: string;
  level: "critical" | "warning" | "info" | "success";
};

export default async function AdminCentroDashboardPage() {
  const auth = await getFormacaoAuthContext();
  if (!auth) redirect("/login");

  if (!["formacao_admin", "super_admin", "global_admin"].includes(String(auth.role))) {
    redirect("/forbidden");
  }

  const session = await resolveFormacaoSessionContext();
  const escolaId = session?.tenantId ?? null;
  const today = new Date();

  let onboardingDone = false;
  let cursosAtivosCount = 0;
  let cohortsAtivasCount = 0;
  let inscricoesAtivasCount = 0;
  let inscricoesPagasCount = 0;
  let inscricoesPendentesCount = 0;
  let pagamentosPendentesCount = 0;
  let salasAtivasCount = 0;
  let valorEmAberto = 0;
  let cohorts: CohortOverviewRow[] = [];
  let lotacao: LotacaoRow[] = [];
  let pendingAdmissions: StagingRow[] = [];
  let forecastData = { v30: 0, v60: 0, v90: 0, total: 0 };

  if (escolaId) {
    const s = (await supabaseServer()) as FormacaoSupabaseClient;

    const [
      cursosRes,
      cohortsRes,
      lotacaoRes,
      fiscalRes,
      stagingCountRes,
      stagingRecentRes,
      inscricoesAtivasRes,
      inscricoesPagasRes,
      inscricoesPendentesRes,
      salasRes,
      inadimplenciaRes,
      faturasPendentesRes,
    ] = await Promise.all([
      s
        .from("formacao_cursos")
        .select("id", { count: "exact", head: true })
        .eq("escola_id", escolaId)
        .eq("status", "ativo"),
      s
        .from("vw_formacao_cohorts_overview")
        .select("id, codigo, nome, curso_nome, vagas, data_inicio, data_fim, status, total_formadores")
        .order("data_inicio", { ascending: true }),
      s
        .from("vw_formacao_cohorts_lotacao")
        .select("cohort_id, cohort_nome, vagas, inscritos_total, inscritos_pagos, lotacao_percentual"),
      s.from("fiscal_escola_bindings").select("id").eq("escola_id", escolaId).limit(1),
      s
        .from("formacao_inscricoes_staging")
        .select("id", { count: "exact", head: true })
        .eq("escola_id", escolaId)
        .eq("status", "PENDENTE"),
      s
        .from("formacao_inscricoes_staging")
        .select(
          `
          id,
          nome_completo,
          email,
          created_at,
          cohort:formacao_cohorts (
            nome,
            curso_nome,
            data_inicio
          )
        `
        )
        .eq("escola_id", escolaId)
        .eq("status", "PENDENTE")
        .order("created_at", { ascending: true })
        .limit(5),
      s
        .from("formacao_inscricoes")
        .select("id", { count: "exact", head: true })
        .eq("escola_id", escolaId)
        .in("estado", ["pre_inscrito", "inscrito"]),
      s
        .from("formacao_inscricoes")
        .select("id", { count: "exact", head: true })
        .eq("escola_id", escolaId)
        .in("estado", ["pre_inscrito", "inscrito"])
        .eq("status_pagamento", "pago"),
      s
        .from("formacao_inscricoes")
        .select("id", { count: "exact", head: true })
        .eq("escola_id", escolaId)
        .in("estado", ["pre_inscrito", "inscrito"])
        .in("status_pagamento", ["pendente", "parcial"]),
      s
        .from("formacao_salas_infraestrutura")
        .select("id", { count: "exact", head: true })
        .eq("escola_id", escolaId)
        .eq("status", "ativa"),
      s.from("vw_formacao_inadimplencia_resumo").select("total_em_aberto").maybeSingle(),
      s
        .from("formacao_faturas_lote")
        .select("total_liquido, vencimento_em")
        .eq("escola_id", escolaId)
        .in("status", ["emitida", "parcial"])
        .lte("vencimento_em", new Date(today.getTime() + 90 * 86_400_000).toISOString()),
    ]);

    cohorts = (cohortsRes.data ?? []) as CohortOverviewRow[];
    lotacao = (lotacaoRes.data ?? []) as LotacaoRow[];
    pendingAdmissions = (stagingRecentRes.data ?? []) as StagingRow[];
    cursosAtivosCount = cursosRes.count ?? 0;
    cohortsAtivasCount = cohorts.filter((row) => ["aberta", "em_andamento"].includes(String(row.status))).length;
    onboardingDone = (fiscalRes.data ?? []).length > 0;
    pagamentosPendentesCount = stagingCountRes.count ?? 0;
    inscricoesAtivasCount = inscricoesAtivasRes.count ?? 0;
    inscricoesPagasCount = inscricoesPagasRes.count ?? 0;
    inscricoesPendentesCount = inscricoesPendentesRes.count ?? 0;
    salasAtivasCount = salasRes.count ?? 0;
    valorEmAberto = Number((inadimplenciaRes.data as { total_em_aberto?: number | null } | null)?.total_em_aberto ?? 0);

    const faturasFuturas = (faturasPendentesRes.data ?? []) as Array<{ total_liquido: number; vencimento_em: string }>;
    const em30 = new Date(today.getTime() + 30 * 86_400_000).toISOString();
    const em60 = new Date(today.getTime() + 60 * 86_400_000).toISOString();
    const em90 = new Date(today.getTime() + 90 * 86_400_000).toISOString();

    const v30 = faturasFuturas.filter((f) => f.vencimento_em <= em30).reduce((acc, f) => acc + Number(f.total_liquido ?? 0), 0);
    const v60 = faturasFuturas.filter((f) => f.vencimento_em > em30 && f.vencimento_em <= em60).reduce((acc, f) => acc + Number(f.total_liquido ?? 0), 0);
    const v90 = faturasFuturas.filter((f) => f.vencimento_em > em60 && f.vencimento_em <= em90).reduce((acc, f) => acc + Number(f.total_liquido ?? 0), 0);

    forecastData = { v30, v60, v90, total: v30 + v60 + v90 };
  }

  const lotacaoByCohort = new Map(lotacao.map((row) => [row.cohort_id, row]));
  const operationalCompleted = [onboardingDone, cursosAtivosCount > 0, cohortsAtivasCount > 0, salasAtivasCount > 0].filter(Boolean).length;
  const operationalReady = operationalCompleted === 4;

  const upcomingCohorts = cohorts
    .filter((row) => ["aberta", "planeada", "em_andamento"].includes(String(row.status)))
    .slice(0, 5)
    .map((row) => {
      const occupancy = lotacaoByCohort.get(row.id);
      return {
        ...row,
        inscritosTotal: Number(occupancy?.inscritos_total ?? 0),
        inscritosPagos: Number(occupancy?.inscritos_pagos ?? 0),
        lotacaoPercentual: Number(occupancy?.lotacao_percentual ?? 0),
      };
    });

  const alerts = buildOperationalAlerts({
    onboardingDone,
    cursosAtivosCount,
    cohortsAtivasCount,
    salasAtivasCount,
    pagamentosPendentesCount,
    valorEmAberto,
    upcomingCohorts,
    today,
  });

  const conversionRate =
    inscricoesAtivasCount > 0 ? Math.round((inscricoesPagasCount / inscricoesAtivasCount) * 100) : 0;

  return (
    <AdminDashboardClient
      onboardingDone={onboardingDone}
      cursosAtivosCount={cursosAtivosCount}
      cohortsAtivasCount={cohortsAtivasCount}
      inscricoesAtivasCount={inscricoesAtivasCount}
      inscricoesPagasCount={inscricoesPagasCount}
      inscricoesPendentesCount={inscricoesPendentesCount}
      pagamentosPendentesCount={pagamentosPendentesCount}
      salasAtivasCount={salasAtivasCount}
      valorEmAberto={valorEmAberto}
      cohorts={cohorts as any}
      upcomingCohorts={upcomingCohorts as any}
      pendingAdmissions={pendingAdmissions as any}
      forecastData={forecastData}
      conversionRate={conversionRate}
      operationalCompleted={operationalCompleted}
      operationalReady={operationalReady}
      alerts={alerts}
    />
  );
}

function buildOperationalAlerts({
  onboardingDone,
  cursosAtivosCount,
  cohortsAtivasCount,
  salasAtivasCount,
  pagamentosPendentesCount,
  valorEmAberto,
  upcomingCohorts,
  today,
}: {
  onboardingDone: boolean;
  cursosAtivosCount: number;
  cohortsAtivasCount: number;
  salasAtivasCount: number;
  pagamentosPendentesCount: number;
  valorEmAberto: number;
  upcomingCohorts: Array<CohortOverviewRow & { lotacaoPercentual: number; inscritosTotal: number }>;
  today: Date;
}): OperationalAlert[] {
  const alerts: OperationalAlert[] = [];

  if (!onboardingDone) {
    alerts.push({
      title: "Configuração fiscal pendente",
      description: "O centro ainda não está vinculado a uma empresa fiscal para faturação.",
      href: "/admin/onboarding",
      label: "Concluir onboarding",
      level: "critical",
    });
  }

  if (cursosAtivosCount === 0) {
    alerts.push({
      title: "Catálogo sem cursos ativos",
      description: "Sem cursos ativos, a landing pública e as turmas ficam sem oferta comercial.",
      href: "/admin/cursos",
      label: "Publicar curso",
      level: "warning",
    });
  }

  if (cohortsAtivasCount === 0) {
    alerts.push({
      title: "Nenhuma turma aberta",
      description: "Abra pelo menos uma turma para receber inscrições e formar pipeline de cobrança.",
      href: "/admin/cohorts",
      label: "Abrir turma",
      level: "warning",
    });
  }

  if (salasAtivasCount === 0) {
    alerts.push({
      title: "Capacidade sem infraestrutura",
      description: "Cadastre salas, laboratórios ou ambientes online para planear a operação académica.",
      href: "/admin/infraestrutura",
      label: "Cadastrar sala",
      level: "info",
    });
  }

  if (pagamentosPendentesCount > 0) {
    alerts.push({
      title: `${pagamentosPendentesCount} comprovativo${pagamentosPendentesCount === 1 ? "" : "s"} para validar`,
      description: "Há inscrições públicas aguardando aprovação ou rejeição pela secretaria.",
      href: "/secretaria/inbox",
      label: "Validar agora",
      level: pagamentosPendentesCount > 5 ? "critical" : "warning",
    });
  }

  if (valorEmAberto > 0) {
    alerts.push({
      title: "Cobrança com valor em aberto",
      description: `${formatCurrency(valorEmAberto)} em títulos ou faturas pendentes no financeiro.`,
      href: "/financeiro/dashboard",
      label: "Abrir financeiro",
      level: "warning",
    });
  }

  const lowOccupancy = upcomingCohorts.find((cohort) => {
    if (!cohort.data_inicio) return false;
    const daysToStart = Math.ceil((new Date(cohort.data_inicio).getTime() - today.getTime()) / 86_400_000);
    return daysToStart >= 0 && daysToStart <= 14 && cohort.lotacaoPercentual < 50;
  });

  if (lowOccupancy) {
    alerts.push({
      title: "Turma próxima com baixa lotação",
      description: `${lowOccupancy.nome ?? "Turma"} inicia em breve com ${lowOccupancy.lotacaoPercentual}% de ocupação.`,
      href: "/admin/cohorts",
      label: "Rever turma",
      level: "info",
    });
  }

  return alerts.slice(0, 6);
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("pt-AO", {
    style: "currency",
    currency: "AOA",
    maximumFractionDigits: 0,
  }).format(Number(value ?? 0));
}
