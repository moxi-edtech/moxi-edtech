import Link from "next/link";
import { redirect } from "next/navigation";
import {
  AlertCircle,
  ArrowUpRight,
  BookOpen,
  Building2,
  CheckCircle2,
  Clock,
  CreditCard,
  DoorOpen,
  GraduationCap,
  Users,
} from "lucide-react";
import { getFormacaoAuthContext } from "@/lib/auth-context";
import { resolveFormacaoSessionContext } from "@/lib/session-context";
import { supabaseServer } from "@/lib/supabaseServer";
import type { FormacaoSupabaseClient } from "@/lib/db-types";

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
  }

  const lotacaoByCohort = new Map(lotacao.map((row) => [row.cohort_id, row]));
  const today = new Date();
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
    <div className="space-y-6 pb-12">
      <header className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="m-0 text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">admin centro</p>
            <h1 className="mt-1 text-2xl font-black tracking-tight text-slate-950">Dashboard de Gestão</h1>
          </div>
          <span
            className={`rounded-full border px-3 py-1 text-xs font-semibold ${
              operationalReady
                ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                : "border-amber-200 bg-amber-50 text-amber-700"
            }`}
          >
            {operationalReady ? "Centro operacional" : `Operacionalização ${operationalCompleted}/4`}
          </span>
        </div>
        <p className="mt-3 max-w-3xl text-sm leading-relaxed text-slate-600">
          Visão real da operação do centro: prontidão, admissões, turmas, cobrança e próximos bloqueios a resolver.
        </p>
      </header>

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          title="Admissões pendentes"
          value={String(pagamentosPendentesCount)}
          subtitle="Comprovativos aguardando validação"
          tone={pagamentosPendentesCount > 0 ? "warning" : "positive"}
          icon={<CreditCard size={18} />}
        />
        <MetricCard
          title="Formandos ativos"
          value={String(inscricoesAtivasCount)}
          subtitle={`${conversionRate}% com pagamento confirmado`}
          tone="neutral"
          icon={<Users size={18} />}
        />
        <MetricCard
          title="Turmas em operação"
          value={String(cohortsAtivasCount)}
          subtitle={`${cohorts.length} turmas no histórico`}
          tone="neutral"
          icon={<GraduationCap size={18} />}
        />
        <MetricCard
          title="Em aberto"
          value={formatCurrency(valorEmAberto)}
          subtitle={`${inscricoesPendentesCount} inscrições com pagamento pendente/parcial`}
          tone={valorEmAberto > 0 ? "danger" : "positive"}
          icon={<AlertCircle size={18} />}
        />
      </section>

      <section className="grid gap-5 xl:grid-cols-[1.15fr_0.85fr]">
        <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="m-0 text-lg font-semibold text-slate-950">Fila operacional</h2>
              <p className="mt-1 text-sm text-slate-500">Prioridades calculadas a partir dos dados do centro.</p>
            </div>
            <Link
              href="/secretaria/inbox"
              className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
            >
              Abrir inbox <ArrowUpRight size={14} />
            </Link>
          </div>

          <div className="mt-4 grid gap-3">
            {alerts.length === 0 ? (
              <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">
                Sem bloqueios operacionais relevantes no momento.
              </div>
            ) : (
              alerts.map((alert) => (
                <OperationalAlertCard key={alert.title} alert={alert} />
              ))
            )}
          </div>
        </article>

        <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="m-0 text-lg font-semibold text-slate-950">Prontidão do centro</h2>
          <p className="mt-1 text-sm text-slate-500">Checklist mínimo para operar sem bloqueios de secretaria e financeiro.</p>
          <div className="mt-4 grid gap-3">
            <ReadinessItem done={onboardingDone} title="Fiscal vinculado" href="/admin/onboarding" />
            <ReadinessItem done={cursosAtivosCount > 0} title="Catálogo ativo" href="/admin/cursos" />
            <ReadinessItem done={cohortsAtivasCount > 0} title="Turma aberta ou em andamento" href="/admin/cohorts" />
            <ReadinessItem done={salasAtivasCount > 0} title="Sala ou infraestrutura ativa" href="/admin/infraestrutura" />
          </div>
        </article>
      </section>

      <section className="grid gap-5 xl:grid-cols-[1fr_360px]">
        <article className="rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-100 px-5 py-4">
            <h2 className="m-0 text-lg font-semibold text-slate-950">Saúde das turmas</h2>
            <p className="mt-1 text-sm text-slate-500">Lotação, pagamentos e arranque das próximas edições.</p>
          </div>
          {upcomingCohorts.length === 0 ? (
            <EmptyState
              title="Sem turmas operacionais"
              description="Abra uma turma para acompanhar lotação e admissões neste painel."
              href="/admin/cohorts"
              label="Gerir turmas"
            />
          ) : (
            <div className="divide-y divide-slate-100">
              {upcomingCohorts.map((cohort) => (
                <CohortRow key={cohort.id} cohort={cohort} />
              ))}
            </div>
          )}
        </article>

        <article className="rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-100 px-5 py-4">
            <h2 className="m-0 text-lg font-semibold text-slate-950">Validação recente</h2>
            <p className="mt-1 text-sm text-slate-500">Primeiros comprovativos na fila.</p>
          </div>
          {pendingAdmissions.length === 0 ? (
            <EmptyState
              compact
              title="Nada pendente"
              description="Novas inscrições públicas aparecem aqui assim que entrarem."
              href="/secretaria/inbox"
              label="Abrir inbox"
            />
          ) : (
            <div className="divide-y divide-slate-100">
              {pendingAdmissions.map((item) => (
                <div key={item.id} className="px-5 py-4">
                  <p className="truncate text-sm font-semibold text-slate-950">{item.nome_completo}</p>
                  <p className="mt-1 truncate text-xs text-slate-500">{item.email ?? "Sem email registado"}</p>
                  <p className="mt-2 text-xs text-slate-600">
                    {item.cohort?.curso_nome ?? "Curso sem nome"} · {item.cohort?.nome ?? "Turma sem nome"}
                  </p>
                  <p className="mt-1 text-xs font-medium text-amber-700">Desde {formatDate(item.created_at)}</p>
                </div>
              ))}
            </div>
          )}
        </article>
      </section>

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <QuickAction href="/secretaria/inbox" title="Inbox operacional" description="Validar comprovativos e reenviar acessos." icon={<Clock size={18} />} />
        <QuickAction href="/admin/cohorts" title="Turmas" description="Abrir edições e ajustar capacidade." icon={<GraduationCap size={18} />} />
        <QuickAction href="/admin/cursos" title="Catálogo" description="Gerir cursos publicados." icon={<BookOpen size={18} />} />
        <QuickAction href="/admin/infraestrutura" title="Salas e infraestrutura" description="Organizar capacidade física e online." icon={<DoorOpen size={18} />} />
      </section>
    </div>
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

function MetricCard({
  title,
  value,
  subtitle,
  tone,
  icon,
}: {
  title: string;
  value: string;
  subtitle: string;
  tone: "warning" | "neutral" | "positive" | "danger";
  icon: React.ReactNode;
}) {
  const tones = {
    warning: "border-amber-200 bg-amber-50 text-amber-800",
    neutral: "border-slate-200 bg-white text-slate-950",
    positive: "border-emerald-200 bg-emerald-50 text-emerald-800",
    danger: "border-rose-200 bg-rose-50 text-rose-800",
  };

  return (
    <article className={`rounded-2xl border p-4 shadow-sm ${tones[tone]}`}>
      <div className="flex items-center justify-between gap-3">
        <span className="text-xs font-semibold uppercase tracking-widest opacity-70">{title}</span>
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white/70">{icon}</span>
      </div>
      <div className="mt-3 text-2xl font-black tracking-tight">{value}</div>
      <p className="mt-1 text-xs leading-5 opacity-80">{subtitle}</p>
    </article>
  );
}

function OperationalAlertCard({ alert }: { alert: OperationalAlert }) {
  const styles = {
    critical: "border-rose-200 bg-rose-50 text-rose-800",
    warning: "border-amber-200 bg-amber-50 text-amber-800",
    info: "border-blue-200 bg-blue-50 text-blue-800",
    success: "border-emerald-200 bg-emerald-50 text-emerald-800",
  };

  return (
    <div className={`rounded-xl border p-4 ${styles[alert.level]}`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-semibold">{alert.title}</p>
          <p className="mt-1 text-sm leading-5 opacity-80">{alert.description}</p>
        </div>
        <Link
          href={alert.href}
          className="inline-flex shrink-0 items-center gap-1 rounded-lg bg-white/80 px-3 py-2 text-xs font-semibold hover:bg-white"
        >
          {alert.label} <ArrowUpRight size={13} />
        </Link>
      </div>
    </div>
  );
}

function ReadinessItem({ done, title, href }: { done: boolean; title: string; href: string }) {
  return (
    <Link href={href} className="flex items-center justify-between gap-3 rounded-xl border border-slate-100 bg-slate-50 p-3 hover:bg-white">
      <span className="flex items-center gap-3 text-sm font-medium text-slate-800">
        {done ? <CheckCircle2 className="text-emerald-600" size={18} /> : <AlertCircle className="text-amber-600" size={18} />}
        {title}
      </span>
      <span className="text-xs font-semibold text-slate-500">{done ? "OK" : "Pendente"}</span>
    </Link>
  );
}

function CohortRow({
  cohort,
}: {
  cohort: CohortOverviewRow & {
    inscritosTotal: number;
    inscritosPagos: number;
    lotacaoPercentual: number;
  };
}) {
  return (
    <div className="grid gap-4 px-5 py-4 md:grid-cols-[1fr_180px] md:items-center">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <p className="truncate text-sm font-semibold text-slate-950">{cohort.nome ?? "Turma sem nome"}</p>
          <span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[11px] font-semibold text-slate-600">
            {cohort.status ?? "sem status"}
          </span>
        </div>
        <p className="mt-1 truncate text-sm text-slate-500">{cohort.curso_nome ?? "Curso sem nome"}</p>
        <p className="mt-2 text-xs text-slate-500">
          Início {formatDate(cohort.data_inicio)} · {cohort.inscritosTotal}/{cohort.vagas ?? 0} vagas · {cohort.inscritosPagos} pagos
        </p>
      </div>
      <div>
        <div className="flex items-center justify-between text-xs font-semibold text-slate-600">
          <span>Lotação</span>
          <span>{cohort.lotacaoPercentual}%</span>
        </div>
        <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-100">
          <div className="h-full rounded-full bg-klasse-green" style={{ width: `${Math.min(cohort.lotacaoPercentual, 100)}%` }} />
        </div>
      </div>
    </div>
  );
}

function QuickAction({
  href,
  title,
  description,
  icon,
}: {
  href: string;
  title: string;
  description: string;
  icon: React.ReactNode;
}) {
  return (
    <Link href={href} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm hover:border-slate-300 hover:shadow-md">
      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-slate-100 text-slate-600">{icon}</div>
      <p className="mt-3 text-sm font-semibold text-slate-950">{title}</p>
      <p className="mt-1 text-xs leading-5 text-slate-500">{description}</p>
    </Link>
  );
}

function EmptyState({
  title,
  description,
  href,
  label,
  compact = false,
}: {
  title: string;
  description: string;
  href: string;
  label: string;
  compact?: boolean;
}) {
  return (
    <div className={`px-5 text-center ${compact ? "py-10" : "py-14"}`}>
      <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-full bg-slate-100 text-slate-500">
        <Building2 size={20} />
      </div>
      <p className="mt-3 text-sm font-semibold text-slate-950">{title}</p>
      <p className="mx-auto mt-1 max-w-sm text-sm leading-5 text-slate-500">{description}</p>
      <Link href={href} className="mt-4 inline-flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50">
        {label} <ArrowUpRight size={13} />
      </Link>
    </div>
  );
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("pt-AO", {
    style: "currency",
    currency: "AOA",
    maximumFractionDigits: 0,
  }).format(Number(value ?? 0));
}

function formatDate(value: string | null | undefined) {
  if (!value) return "Sem data";
  return new Intl.DateTimeFormat("pt-AO", { dateStyle: "medium" }).format(new Date(value));
}
