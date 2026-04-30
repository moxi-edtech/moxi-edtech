import Link from "next/link";
import { redirect } from "next/navigation";
import {
  AlertCircle,
  ArrowUpRight,
  Award,
  CheckCircle2,
  Clock,
  CreditCard,
  FileText,
  GraduationCap,
  Inbox,
  UserPlus,
  Users,
} from "lucide-react";
import { getFormacaoAuthContext } from "@/lib/auth-context";
import { resolveFormacaoSessionContext } from "@/lib/session-context";
import { supabaseServer } from "@/lib/supabaseServer";
import type { FormacaoSupabaseClient } from "@/lib/db-types";

export const dynamic = "force-dynamic";

type CohortRow = {
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
  inscritos_total: number | null;
  inscritos_pagos: number | null;
  lotacao_percentual: number | null;
};

type PendingAdmission = {
  id: string;
  nome_completo: string;
  email: string | null;
  telefone: string | null;
  created_at: string;
  cohort: {
    nome: string | null;
    curso_nome: string | null;
    data_inicio: string | null;
  } | null;
};

type CertificateRow = {
  id: string;
  numero_documento: string | null;
  emitido_em: string | null;
  formando_nome: string | null;
};

type WorkItem = {
  title: string;
  description: string;
  href: string;
  label: string;
  tone: "danger" | "warning" | "info" | "success";
};

export default async function SecretariaDashboardPage() {
  const auth = await getFormacaoAuthContext();
  if (!auth) redirect("/login");

  if (!["formacao_secretaria", "formacao_admin", "super_admin", "global_admin"].includes(String(auth.role))) {
    redirect("/forbidden");
  }

  const session = await resolveFormacaoSessionContext();
  const escolaId = session?.tenantId ?? null;

  let pendingAdmissionsCount = 0;
  let activeStudentsCount = 0;
  let pendingPaymentsCount = 0;
  let activeCohortsCount = 0;
  let certificatesCount = 0;
  let cohorts: CohortRow[] = [];
  let lotacao: LotacaoRow[] = [];
  let pendingAdmissions: PendingAdmission[] = [];
  let recentCertificates: CertificateRow[] = [];

  if (escolaId) {
    const s = (await supabaseServer()) as FormacaoSupabaseClient;

    const [
      stagingCountRes,
      stagingRecentRes,
      activeStudentsRes,
      pendingPaymentsRes,
      cohortsRes,
      lotacaoRes,
      certificatesCountRes,
      certificatesRecentRes,
    ] = await Promise.all([
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
          telefone,
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
        .limit(6),
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
        .in("status_pagamento", ["pendente", "parcial"]),
      s
        .from("vw_formacao_cohorts_overview")
        .select("id, codigo, nome, curso_nome, vagas, data_inicio, data_fim, status, total_formadores")
        .order("data_inicio", { ascending: true }),
      s
        .from("vw_formacao_cohorts_lotacao")
        .select("cohort_id, inscritos_total, inscritos_pagos, lotacao_percentual"),
      s
        .from("formacao_certificado_emissoes")
        .select("id", { count: "exact", head: true })
        .eq("escola_id", escolaId),
      s
        .from("formacao_certificado_emissoes")
        .select("id, numero_documento, emitido_em, formando_nome")
        .eq("escola_id", escolaId)
        .order("emitido_em", { ascending: false })
        .limit(5),
    ]);

    pendingAdmissionsCount = stagingCountRes.count ?? 0;
    pendingAdmissions = (stagingRecentRes.data ?? []) as PendingAdmission[];
    activeStudentsCount = activeStudentsRes.count ?? 0;
    pendingPaymentsCount = pendingPaymentsRes.count ?? 0;
    cohorts = (cohortsRes.data ?? []) as CohortRow[];
    lotacao = (lotacaoRes.data ?? []) as LotacaoRow[];
    activeCohortsCount = cohorts.filter((row) => ["aberta", "em_andamento"].includes(String(row.status))).length;
    certificatesCount = certificatesCountRes.count ?? 0;
    recentCertificates = (certificatesRecentRes.data ?? []) as CertificateRow[];
  }

  const lotacaoByCohort = new Map(lotacao.map((row) => [row.cohort_id, row]));
  const today = new Date();
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

  const workItems = buildWorkItems({
    pendingAdmissionsCount,
    pendingPaymentsCount,
    activeCohortsCount,
    upcomingCohorts,
    today,
  });

  return (
    <div className="space-y-6 pb-12">
      <header className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="m-0 text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">secretaria</p>
            <h1 className="mt-1 text-2xl font-semibold tracking-tight text-klasse-green">Portal da Secretaria</h1>
            <p className="mt-3 max-w-3xl text-sm leading-relaxed text-slate-600">
              Balcão operacional para admissões, turmas, acessos, pagamentos pendentes e emissão documental.
            </p>
          </div>
          <Link
            href="/secretaria/inscricoes"
            className="inline-flex items-center gap-2 rounded-xl bg-klasse-gold px-4 py-2 text-sm font-semibold text-white hover:brightness-95"
          >
            <UserPlus size={16} />
            Nova inscrição
          </Link>
        </div>
      </header>

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <Metric title="Inbox" value={String(pendingAdmissionsCount)} subtitle="Comprovativos pendentes" tone={pendingAdmissionsCount > 0 ? "warning" : "positive"} icon={<Inbox size={18} />} />
        <Metric title="Formandos" value={String(activeStudentsCount)} subtitle="Inscrições ativas" tone="neutral" icon={<Users size={18} />} />
        <Metric title="Pagamentos" value={String(pendingPaymentsCount)} subtitle="Pendentes ou parciais" tone={pendingPaymentsCount > 0 ? "danger" : "positive"} icon={<CreditCard size={18} />} />
        <Metric title="Turmas" value={String(activeCohortsCount)} subtitle="Abertas ou em curso" tone="neutral" icon={<GraduationCap size={18} />} />
        <Metric title="Certificados" value={String(certificatesCount)} subtitle="Emitidos no centro" tone="neutral" icon={<Award size={18} />} />
      </section>

      <section className="grid gap-5 xl:grid-cols-[1fr_380px]">
        <article className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="m-0 text-lg font-semibold text-slate-950">Fila do balcão</h2>
              <p className="mt-1 text-sm text-slate-500">O que precisa de atenção antes de seguir para turma ou financeiro.</p>
            </div>
            <Link href="/secretaria/inbox" className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50">
              Abrir inbox <ArrowUpRight size={13} />
            </Link>
          </div>

          <div className="mt-4 grid gap-3">
            {workItems.length === 0 ? (
              <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">
                Sem bloqueios de secretaria no momento.
              </div>
            ) : (
              workItems.map((item) => <WorkItemCard key={item.title} item={item} />)
            )}
          </div>
        </article>

        <article className="rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-100 px-5 py-4">
            <h2 className="m-0 text-lg font-semibold text-slate-950">Comprovativos antigos</h2>
            <p className="mt-1 text-sm text-slate-500">Primeiros itens aguardando validação.</p>
          </div>
          {pendingAdmissions.length === 0 ? (
            <EmptyState title="Fila limpa" description="Novas inscrições públicas aparecem aqui." href="/secretaria/inbox" label="Abrir inbox" />
          ) : (
            <div className="divide-y divide-slate-100">
              {pendingAdmissions.map((item) => (
                <div key={item.id} className="px-5 py-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-slate-950">{item.nome_completo}</p>
                      <p className="mt-1 truncate text-xs text-slate-500">{item.email ?? item.telefone ?? "Sem contacto"}</p>
                    </div>
                    <span className="shrink-0 rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-700">
                      {daysSince(item.created_at)}d
                    </span>
                  </div>
                  <p className="mt-2 text-xs text-slate-600">
                    {item.cohort?.curso_nome ?? "Curso sem nome"} · {item.cohort?.nome ?? "Turma sem nome"}
                  </p>
                </div>
              ))}
            </div>
          )}
        </article>
      </section>

      <section className="grid gap-5 xl:grid-cols-[1fr_380px]">
        <article className="rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-100 px-5 py-4">
            <h2 className="m-0 text-lg font-semibold text-slate-950">Turmas em acompanhamento</h2>
            <p className="mt-1 text-sm text-slate-500">Capacidade, início e ocupação das próximas turmas.</p>
          </div>
          {upcomingCohorts.length === 0 ? (
            <EmptyState title="Sem turmas abertas" description="Abra ou publique uma turma para acompanhar inscrições." href="/secretaria/turmas" label="Gerir turmas" />
          ) : (
            <div className="divide-y divide-slate-100">
              {upcomingCohorts.map((cohort) => (
                <CohortProgress key={cohort.id} cohort={cohort} />
              ))}
            </div>
          )}
        </article>

        <article className="rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-100 px-5 py-4">
            <h2 className="m-0 text-lg font-semibold text-slate-950">Certificados recentes</h2>
            <p className="mt-1 text-sm text-slate-500">Últimas emissões documentais.</p>
          </div>
          {recentCertificates.length === 0 ? (
            <EmptyState title="Sem emissões" description="Certificados emitidos aparecem nesta lista." href="/secretaria/certificados" label="Abrir certificados" />
          ) : (
            <div className="divide-y divide-slate-100">
              {recentCertificates.map((item) => (
                <div key={item.id} className="px-5 py-4">
                  <p className="truncate text-sm font-semibold text-slate-950">{item.formando_nome ?? "Formando"}</p>
                  <p className="mt-1 text-xs text-slate-500">{item.numero_documento ?? "Sem número"} · {formatDate(item.emitido_em)}</p>
                </div>
              ))}
            </div>
          )}
        </article>
      </section>

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <QuickAction href="/secretaria/inscricoes" title="Nova inscrição" description="Registar formando no balcão." icon={<UserPlus size={18} />} />
        <QuickAction href="/secretaria/inbox" title="Inbox operacional" description="Validar comprovativos e acessos." icon={<Inbox size={18} />} />
        <QuickAction href="/secretaria/turmas" title="Turmas" description="Acompanhar formandos e presença." icon={<GraduationCap size={18} />} />
        <QuickAction href="/secretaria/certificados" title="Certificados" description="Emitir documentos oficiais." icon={<FileText size={18} />} />
      </section>
    </div>
  );
}

function buildWorkItems({
  pendingAdmissionsCount,
  pendingPaymentsCount,
  activeCohortsCount,
  upcomingCohorts,
  today,
}: {
  pendingAdmissionsCount: number;
  pendingPaymentsCount: number;
  activeCohortsCount: number;
  upcomingCohorts: Array<CohortRow & { inscritosTotal: number; lotacaoPercentual: number }>;
  today: Date;
}): WorkItem[] {
  const items: WorkItem[] = [];

  if (pendingAdmissionsCount > 0) {
    items.push({
      title: `${pendingAdmissionsCount} comprovativo${pendingAdmissionsCount === 1 ? "" : "s"} aguardando secretaria`,
      description: "Valide ou rejeite inscrições públicas para liberar acesso aos formandos.",
      href: "/secretaria/inbox",
      label: "Validar",
      tone: pendingAdmissionsCount > 5 ? "danger" : "warning",
    });
  }

  if (pendingPaymentsCount > 0) {
    items.push({
      title: "Inscrições com pagamento pendente",
      description: `${pendingPaymentsCount} formando${pendingPaymentsCount === 1 ? "" : "s"} ainda dependem de regularização financeira.`,
      href: "/financeiro/dashboard",
      label: "Ver financeiro",
      tone: "warning",
    });
  }

  if (activeCohortsCount === 0) {
    items.push({
      title: "Sem turmas abertas ou em curso",
      description: "A secretaria precisa de uma turma operacional para registar formandos.",
      href: "/secretaria/turmas",
      label: "Abrir turmas",
      tone: "danger",
    });
  }

  const startingSoon = upcomingCohorts.find((cohort) => {
    if (!cohort.data_inicio) return false;
    const days = Math.ceil((new Date(cohort.data_inicio).getTime() - today.getTime()) / 86_400_000);
    return days >= 0 && days <= 7;
  });

  if (startingSoon) {
    items.push({
      title: "Turma inicia nos próximos 7 dias",
      description: `${startingSoon.nome ?? "Turma"} tem ${startingSoon.inscritosTotal} inscritos e ${startingSoon.lotacaoPercentual}% de lotação.`,
      href: "/secretaria/turmas",
      label: "Conferir turma",
      tone: "info",
    });
  }

  return items.slice(0, 5);
}

function Metric({
  title,
  value,
  subtitle,
  tone,
  icon,
}: {
  title: string;
  value: string;
  subtitle: string;
  tone: "danger" | "warning" | "neutral" | "positive";
  icon: React.ReactNode;
}) {
  const styles = {
    danger: "border-rose-200 bg-rose-50 text-rose-800",
    warning: "border-amber-200 bg-amber-50 text-amber-800",
    neutral: "border-slate-200 bg-white text-slate-950",
    positive: "border-emerald-200 bg-emerald-50 text-emerald-800",
  };

  return (
    <article className={`rounded-xl border p-4 shadow-sm ${styles[tone]}`}>
      <div className="flex items-center justify-between gap-3">
        <span className="text-xs font-semibold uppercase tracking-widest opacity-70">{title}</span>
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white/70">{icon}</span>
      </div>
      <div className="mt-3 text-2xl font-black tracking-tight">{value}</div>
      <p className="mt-1 text-xs leading-5 opacity-80">{subtitle}</p>
    </article>
  );
}

function WorkItemCard({ item }: { item: WorkItem }) {
  const styles = {
    danger: "border-rose-200 bg-rose-50 text-rose-800",
    warning: "border-amber-200 bg-amber-50 text-amber-800",
    info: "border-blue-200 bg-blue-50 text-blue-800",
    success: "border-emerald-200 bg-emerald-50 text-emerald-800",
  };

  return (
    <div className={`rounded-xl border p-4 ${styles[item.tone]}`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-semibold">{item.title}</p>
          <p className="mt-1 text-sm leading-5 opacity-80">{item.description}</p>
        </div>
        <Link href={item.href} className="inline-flex shrink-0 items-center gap-1 rounded-xl bg-white/80 px-3 py-2 text-xs font-semibold hover:bg-white">
          {item.label} <ArrowUpRight size={13} />
        </Link>
      </div>
    </div>
  );
}

function CohortProgress({
  cohort,
}: {
  cohort: CohortRow & {
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
          Início {formatDate(cohort.data_inicio)} · {cohort.inscritosTotal}/{cohort.vagas ?? 0} inscritos · {cohort.inscritosPagos} pagos
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
    <Link href={href} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm hover:border-slate-300 hover:shadow-md">
      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100 text-slate-600">{icon}</div>
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
}: {
  title: string;
  description: string;
  href: string;
  label: string;
}) {
  return (
    <div className="px-5 py-10 text-center">
      <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-full bg-slate-100 text-slate-500">
        <CheckCircle2 size={20} />
      </div>
      <p className="mt-3 text-sm font-semibold text-slate-950">{title}</p>
      <p className="mx-auto mt-1 max-w-sm text-sm leading-5 text-slate-500">{description}</p>
      <Link href={href} className="mt-4 inline-flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50">
        {label} <ArrowUpRight size={13} />
      </Link>
    </div>
  );
}

function daysSince(value: string) {
  return Math.max(0, Math.floor((Date.now() - new Date(value).getTime()) / 86_400_000));
}

function formatDate(value: string | null | undefined) {
  if (!value) return "Sem data";
  return new Intl.DateTimeFormat("pt-AO", { dateStyle: "medium" }).format(new Date(value));
}
