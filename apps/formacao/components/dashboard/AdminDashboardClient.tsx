"use client";

import Link from "next/link";
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
  Wallet,
  TrendingUp,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useState } from "react";
import { StagingValidationSheet } from "./StagingValidationSheet";

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
  inscritosTotal: number;
  inscritosPagos: number;
  lotacaoPercentual: number;
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

type Props = {
  onboardingDone: boolean;
  cursosAtivosCount: number;
  cohortsAtivasCount: number;
  inscricoesAtivasCount: number;
  inscricoesPagasCount: number;
  inscricoesPendentesCount: number;
  pagamentosPendentesCount: number;
  salasAtivasCount: number;
  valorEmAberto: number;
  cohorts: CohortOverviewRow[];
  upcomingCohorts: CohortOverviewRow[];
  pendingAdmissions: StagingRow[];
  forecastData: { v30: number; v60: number; v90: number; total: number };
  conversionRate: number;
  operationalCompleted: number;
  operationalReady: boolean;
  alerts: OperationalAlert[];
};

export function AdminDashboardClient({
  onboardingDone,
  cursosAtivosCount,
  cohortsAtivasCount,
  inscricoesAtivasCount,
  inscricoesPagasCount,
  inscricoesPendentesCount,
  pagamentosPendentesCount,
  salasAtivasCount,
  valorEmAberto,
  cohorts,
  upcomingCohorts,
  pendingAdmissions,
  forecastData,
  conversionRate,
  operationalCompleted,
  operationalReady,
  alerts,
}: Props) {
  const [isValidationOpen, setIsValidationOpen] = useState(false);
  const [selectedStagingId, setSelectedStagingId] = useState<string | null>(null);

  const container = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1,
      },
    },
  };

  const item = {
    hidden: { opacity: 0, y: 20 },
    show: { opacity: 1, y: 0 },
  };

  const handleOpenValidation = (id?: string) => {
    if (id) setSelectedStagingId(id);
    else setSelectedStagingId(null);
    setIsValidationOpen(true);
  };

  return (
    <>
      <motion.div
        variants={container}
        initial="hidden"
        animate="show"
        className="space-y-6 pb-12"
      >
        <motion.header variants={item} className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <p className="m-0 text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400">Command Center</p>
                <div className="h-1.5 w-1.5 rounded-full bg-emerald-500 shadow-[0_0_8px_#10b981] animate-pulse" />
              </div>
              <h1 className="mt-1 text-3xl font-black tracking-tight text-slate-900">Dashboard de Gestão</h1>
            </div>
            <motion.span
              whileHover={{ scale: 1.05 }}
              className={`rounded-xl border px-4 py-2 text-xs font-bold shadow-sm transition-colors ${
                operationalReady
                  ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                  : "border-amber-200 bg-amber-50 text-amber-700"
              }`}
            >
              {operationalReady ? "Centro operacional" : `Operacionalização ${operationalCompleted}/4`}
            </motion.span>
          </div>
          <p className="mt-4 max-w-3xl text-sm font-medium leading-relaxed text-slate-500">
            Monitorização em tempo real da operação do centro. Resolva bloqueios, valide admissões e acompanhe o crescimento.
          </p>
        </motion.header>

        <motion.section variants={item} className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <MetricCard
            title="Admissões pendentes"
            value={String(pagamentosPendentesCount)}
            subtitle="Comprovativos aguardando validação"
            tone={pagamentosPendentesCount > 0 ? "warning" : "positive"}
            icon={<CreditCard size={18} />}
            onClick={() => handleOpenValidation()}
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
        </motion.section>

        <motion.section variants={item} className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm overflow-hidden relative">
          <div className="absolute top-0 right-0 p-8 opacity-5">
            <Wallet size={120} />
          </div>
          
          <div className="flex flex-wrap items-center justify-between gap-4 relative z-10">
            <div>
              <h2 className="m-0 text-xl font-black text-slate-900">Saúde Financeira Preditiva</h2>
              <p className="mt-1 text-sm font-medium text-slate-500">Projeção de recebíveis para os próximos 90 dias.</p>
            </div>
            <div className="text-right">
              <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Total projetado</p>
              <p className="text-3xl font-black text-slate-900 tracking-tighter">{formatCurrency(forecastData.total)}</p>
            </div>
          </div>

          <div className="mt-10 grid gap-10 md:grid-cols-3 relative z-10">
            <ForecastBar label="Próximos 30 dias" value={forecastData.v30} total={forecastData.total} color="bg-emerald-500" />
            <ForecastBar label="31 a 60 dias" value={forecastData.v60} total={forecastData.total} color="bg-amber-500" />
            <ForecastBar label="61 a 90 dias" value={forecastData.v90} total={forecastData.total} color="bg-rose-500" />
          </div>
        </motion.section>

        <div className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
          <motion.article variants={item} className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <h2 className="m-0 text-xl font-black text-slate-900">Alertas do Radar</h2>
                <p className="mt-1 text-sm font-medium text-slate-500">Bloqueios e tarefas críticas detetadas.</p>
              </div>
              <Link
                href="/secretaria/inbox"
                className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-4 py-2.5 text-xs font-bold text-slate-700 hover:bg-slate-50 transition-colors shadow-sm"
              >
                Abrir inbox completo <ArrowUpRight size={14} />
              </Link>
            </div>

            <div className="mt-6 grid gap-4">
              <AnimatePresence mode="popLayout">
                {alerts.length === 0 ? (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="rounded-2xl border border-emerald-100 bg-emerald-50/50 p-6 text-center"
                  >
                    <CheckCircle2 className="mx-auto h-8 w-8 text-emerald-500 mb-2" />
                    <p className="text-sm font-bold text-emerald-800">
                      Tudo em ordem. Sem bloqueios operacionais relevantes.
                    </p>
                  </motion.div>
                ) : (
                  alerts.map((alert) => (
                    <OperationalAlertCard 
                      key={alert.title} 
                      alert={alert} 
                      onAction={alert.href === "/secretaria/inbox" ? () => handleOpenValidation() : undefined}
                    />
                  ))
                )}
              </AnimatePresence>
            </div>
          </motion.article>

          <motion.article variants={item} className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="m-0 text-xl font-black text-slate-900">Prontidão</h2>
            <p className="mt-1 text-sm font-medium text-slate-500">Checklist vital para operação contínua.</p>
            <div className="mt-6 grid gap-3">
              <ReadinessItem done={onboardingDone} title="Fiscal vinculado" href="/admin/onboarding" />
              <ReadinessItem done={cursosAtivosCount > 0} title="Catálogo ativo" href="/admin/cursos" />
              <ReadinessItem done={cohortsAtivasCount > 0} title="Turmas em operação" href="/admin/cohorts" />
              <ReadinessItem done={salasAtivasCount > 0} title="Salas e infraestrutura" href="/admin/infraestrutura" />
            </div>
          </motion.article>
        </div>

        <div className="grid gap-6 xl:grid-cols-[1fr_360px]">
          <motion.article variants={item} className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
            <div className="border-b border-slate-100 px-6 py-5 bg-slate-50/50">
              <h2 className="m-0 text-lg font-bold text-slate-900">Próximas Turmas</h2>
              <p className="mt-1 text-sm font-medium text-slate-500">Lotação e ritmo de admissão.</p>
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
          </motion.article>

          <motion.article variants={item} className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
            <div className="border-b border-slate-100 px-6 py-5 bg-slate-50/50">
              <h2 className="m-0 text-lg font-bold text-slate-900">Fila operacional</h2>
              <p className="mt-1 text-sm font-medium text-slate-500">Inscrições aguardando validação.</p>
            </div>
            {pendingAdmissions.length === 0 ? (
              <EmptyState
                compact
                title="Inbox limpo"
                description="Novas inscrições aparecerão aqui."
                href="/secretaria/inbox"
                label="Abrir inbox"
              />
            ) : (
              <div className="divide-y divide-slate-100">
                {pendingAdmissions.map((item) => (
                  <div key={item.id} className="group px-6 py-5 hover:bg-slate-50 transition-colors">
                    <div className="flex items-start justify-between">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-bold text-slate-900">{item.nome_completo}</p>
                        <p className="mt-0.5 truncate text-xs font-medium text-slate-400">{item.email ?? "Sem email"}</p>
                      </div>
                    </div>
                    <div className="mt-3 flex items-center justify-between gap-4">
                      <div className="flex items-center gap-2">
                        <span className="rounded-md bg-slate-100 px-2 py-1 text-[10px] font-bold text-slate-600 uppercase">
                          {item.cohort?.curso_nome?.slice(0, 20)}...
                        </span>
                        <span className="text-[10px] font-bold text-slate-400">
                          {formatDate(item.created_at)}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Link 
                          href={`/secretaria/inbox?id=${item.id}`} 
                          className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-[10px] font-bold text-slate-600 hover:bg-slate-50 transition-all shadow-sm"
                        >
                          Detalhes
                        </Link>
                        <button
                          onClick={() => handleOpenValidation(item.id)}
                          className="rounded-lg bg-slate-900 px-3 py-1.5 text-[10px] font-bold text-white hover:bg-slate-800 transition-all shadow-sm"
                        >
                          Validar
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </motion.article>
        </div>

        <motion.section variants={item} className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <QuickAction href="/secretaria/inbox" title="Inbox operacional" description="Validar admissões e comprovativos." icon={<Clock size={18} />} />
          <QuickAction href="/admin/cohorts" title="Gestão de Turmas" description="Abrir edições e ajustar capacidade." icon={<GraduationCap size={18} />} />
          <QuickAction href="/admin/cursos" title="Gestão de Cursos" description="Gerir catálogo e conteúdos." icon={<BookOpen size={18} />} />
          <QuickAction href="/admin/infraestrutura" title="Infraestrutura" description="Salas físicas e ambientes online." icon={<DoorOpen size={18} />} />
        </motion.section>
      </motion.div>

      <StagingValidationSheet 
        isOpen={isValidationOpen} 
        onClose={() => setIsValidationOpen(false)}
        initialId={selectedStagingId}
      />
    </>
  );
}

function MetricCard({
  title,
  value,
  subtitle,
  tone,
  icon,
  onClick,
}: {
  title: string;
  value: string;
  subtitle: string;
  tone: "warning" | "neutral" | "positive" | "danger";
  icon: React.ReactNode;
  onClick?: () => void;
}) {
  const tones = {
    warning: "border-amber-200 bg-amber-50/30 text-amber-900",
    neutral: "border-slate-200 bg-white text-slate-900",
    positive: "border-emerald-200 bg-emerald-50/30 text-emerald-900",
    danger: "border-rose-200 bg-rose-50/30 text-rose-900",
  };

  const Component = onClick ? motion.button : motion.article;

  return (
    <Component
      onClick={onClick}
      whileHover={{ y: -4, boxShadow: "0 10px 15px -3px rgba(0, 0, 0, 0.1)" }}
      className={`rounded-2xl border p-5 transition-shadow text-left w-full ${tones[tone]} ${onClick ? "cursor-pointer" : ""}`}
    >
      <div className="flex items-center justify-between gap-3">
        <span className="text-[10px] font-bold uppercase tracking-widest opacity-60">{title}</span>
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/80 shadow-sm">{icon}</span>
      </div>
      <div className="mt-4 text-3xl font-black tracking-tighter leading-none">{value}</div>
      <p className="mt-2 text-xs font-semibold leading-relaxed opacity-60">{subtitle}</p>
    </Component>
  );
}

function OperationalAlertCard({ 
  alert, 
  onAction 
}: { 
  alert: OperationalAlert; 
  onAction?: () => void;
}) {
  const styles = {
    critical: "border-rose-200 bg-rose-50 text-rose-900 shadow-rose-100/50",
    warning: "border-amber-200 bg-amber-50 text-amber-900 shadow-amber-100/50",
    info: "border-blue-200 bg-blue-50 text-blue-900 shadow-blue-100/50",
    success: "border-emerald-200 bg-emerald-50 text-emerald-900 shadow-emerald-100/50",
  };

  return (
    <motion.div
      layout
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, scale: 0.95 }}
      className={`rounded-2xl border p-5 shadow-sm ${styles[alert.level]}`}
    >
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-sm font-bold">{alert.title}</p>
          <p className="mt-1 text-sm font-medium leading-relaxed opacity-70">{alert.description}</p>
        </div>
        {onAction ? (
          <button
            onClick={onAction}
            className="inline-flex shrink-0 items-center gap-1.5 rounded-xl bg-white/90 px-4 py-2 text-xs font-bold hover:bg-white transition-all shadow-sm active:scale-95"
          >
            {alert.label} <ArrowUpRight size={14} />
          </button>
        ) : (
          <Link
            href={alert.href}
            className="inline-flex shrink-0 items-center gap-1.5 rounded-xl bg-white/90 px-4 py-2 text-xs font-bold hover:bg-white transition-all shadow-sm active:scale-95"
          >
            {alert.label} <ArrowUpRight size={14} />
          </Link>
        )}
      </div>
    </motion.div>
  );
}

function ReadinessItem({ done, title, href }: { done: boolean; title: string; href: string }) {
  return (
    <Link href={href} className="group flex items-center justify-between gap-3 rounded-2xl border border-slate-100 bg-slate-50/50 p-4 hover:bg-white hover:border-slate-200 transition-all hover:shadow-sm">
      <span className="flex items-center gap-4 text-sm font-bold text-slate-800">
        <div className={`flex h-6 w-6 items-center justify-center rounded-full ${done ? "bg-emerald-100 text-emerald-600" : "bg-amber-100 text-amber-600"}`}>
          {done ? <CheckCircle2 size={14} /> : <AlertCircle size={14} />}
        </div>
        {title}
      </span>
      <span className={`text-[10px] font-black uppercase tracking-widest ${done ? "text-emerald-600" : "text-amber-600"}`}>
        {done ? "Ativo" : "Pendente"}
      </span>
    </Link>
  );
}

function CohortRow({ cohort }: { cohort: CohortOverviewRow }) {
  const isTargetMet = cohort.lotacaoPercentual >= 70;
  
  return (
    <div className="group grid gap-4 px-6 py-5 md:grid-cols-[1fr_200px] md:items-center hover:bg-slate-50 transition-colors">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <p className="truncate text-sm font-bold text-slate-900">{cohort.nome ?? "Turma"}</p>
          <span className="rounded-md border border-slate-200 bg-white px-2 py-0.5 text-[10px] font-bold text-slate-500 uppercase tracking-tight">
            {cohort.status}
          </span>
        </div>
        <p className="mt-0.5 truncate text-xs font-medium text-slate-400">{cohort.curso_nome}</p>
        <div className="mt-3 flex items-center gap-3 text-[10px] font-bold text-slate-400 uppercase tracking-widest">
          <span className="flex items-center gap-1"><Clock size={10} /> {formatDate(cohort.data_inicio)}</span>
          <span className="flex items-center gap-1"><Users size={10} /> {cohort.inscritosTotal}/{cohort.vagas}</span>
        </div>
      </div>
      <div className="space-y-2">
        <div className="flex items-center justify-between text-[10px] font-black uppercase tracking-widest">
          <span className="text-slate-400">Ocupação</span>
          <span className={isTargetMet ? "text-emerald-600" : "text-slate-900"}>{cohort.lotacaoPercentual}%</span>
        </div>
        <div className="relative h-2.5 overflow-hidden rounded-full bg-slate-100">
          {/* Target line at 70% */}
          <div className="absolute left-[70%] top-0 bottom-0 w-0.5 bg-slate-300 z-10" title="Objetivo (70%)" />
          
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${Math.min(cohort.lotacaoPercentual, 100)}%` }}
            transition={{ duration: 1, ease: "easeOut" }}
            className={`h-full rounded-full ${isTargetMet ? "bg-emerald-500 shadow-[0_0_8px_#10b98144]" : "bg-slate-900"}`}
          />
        </div>
        <p className="text-[9px] font-bold text-slate-400 text-right">
          {isTargetMet ? "Objetivo atingido" : `Faltam ${70 - cohort.lotacaoPercentual}% para o objetivo`}
        </p>
      </div>
    </div>
  );
}

function ForecastBar({ label, value, total, color }: { label: string; value: number; total: number; color: string }) {
  const percent = total > 0 ? Math.round((value / total) * 100) : 0;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between text-[10px] font-black uppercase tracking-widest text-slate-400">
        <span>{label}</span>
        <span className="text-slate-900">{formatCurrency(value)}</span>
      </div>
      <div className="h-2.5 overflow-hidden rounded-full bg-slate-100">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${percent}%` }}
          transition={{ duration: 1.5, delay: 0.2, ease: "circOut" }}
          className={`h-full rounded-full ${color} shadow-sm`}
        />
      </div>
      <p className="text-[10px] font-bold text-slate-400 tracking-tight">{percent}% do total</p>
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
    <motion.div
      whileHover={{ y: -4 }}
      className="relative group"
    >
      <Link href={href} className="block rounded-2xl border border-slate-200 bg-white p-5 shadow-sm hover:border-slate-300 hover:shadow-md transition-all">
        <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-slate-50 text-slate-600 group-hover:bg-slate-900 group-hover:text-white transition-colors">{icon}</div>
        <p className="mt-4 text-sm font-bold text-slate-900">{title}</p>
        <p className="mt-1 text-xs font-medium leading-relaxed text-slate-400">{description}</p>
      </Link>
    </motion.div>
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
    <div className={`px-6 text-center ${compact ? "py-10" : "py-16"}`}>
      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-50 text-slate-400">
        <TrendingUp size={24} />
      </div>
      <p className="mt-4 text-sm font-bold text-slate-900">{title}</p>
      <p className="mx-auto mt-1 max-w-xs text-xs font-medium leading-relaxed text-slate-400">{description}</p>
      <Link href={href} className="mt-6 inline-flex items-center gap-2 rounded-xl border border-slate-200 px-4 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 shadow-sm transition-all">
        {label} <ArrowUpRight size={14} />
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
