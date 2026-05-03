// apps/web/src/components/layout/escola-admin/EscolaAdminDashboardContent.tsx
"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { AlertCircle, ArrowRight, Wallet, TrendingUp, TrendingDown, Minus } from "lucide-react";
import { motion, AnimatePresence, Variants } from "framer-motion";
import KpiSection      from "./KpiSection";
import NoticesSection  from "./NoticesSection";
import OperationalFeedSection from "./OperationalFeedSection";
import AcademicSection from "./AcademicSection";
import QuickActionsSection from "./QuickActionsSection";
import ChartsSection   from "./ChartsSection";
import { RadarOperacional, type OperationalAlert } from "@/components/feedback/FeedbackSystem";
import { EstadoVazio } from "@/components/harmonia";
import { useEscolaId } from "@/hooks/useEscolaId";

import type {
  KpiStats,
  SetupStatus,
  Aviso,
  CurriculoPendencias,
  DashboardCharts,
  InadimplenciaTopRow,
  PagamentoRecenteRow,
} from "./dashboard.types";

// ─── Types ────────────────────────────────────────────────────────────────────

type Props = {
  escolaId:             string;
  escolaNome?:          string;
  anoLetivo?:           string;
  loading?:             boolean;
  error?:               string | null;
  notices?:             Aviso[];
  charts?:              DashboardCharts;
  stats:                KpiStats;
  pendingTurmasCount?:  number | null;
  curriculoPendencias?: CurriculoPendencias;
  setupStatus:          SetupStatus;
  missingPricingCount?: number;
  financeiroHref?:      string;
  inadimplenciaTop?:    InadimplenciaTopRow[];
  pagamentosRecentes?:  PagamentoRecenteRow[];
  receitaResumo?: {
    previsto: number;
    realizado: number;
  };
};

// ─── Currency formatter ───────────────────────────────────────────────────────

const moeda = new Intl.NumberFormat("pt-AO", { style: "currency", currency: "AOA" });

// ─── Animation Variants ───────────────────────────────────────────────────────

const containerVariants: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1,
    },
  },
};

const itemVariants: Variants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.5, ease: "easeOut" } },
};

// ─── Alert banners ────────────────────────────────────────────────────────────

type AlertBannerProps = {
  href:    string;
  lines:   { bold: string; sub: string }[];
  tone:    "orange" | "amber";
};

function AlertBanner({ href, lines, tone }: AlertBannerProps) {
  const colors = tone === "orange"
    ? { wrap: "bg-orange-50 border-orange-200 hover:border-orange-300", dot: "bg-orange-400", bold: "text-orange-900", sub: "text-orange-600", icon: "bg-orange-100 text-orange-700 group-hover:bg-orange-200" }
    : { wrap: "bg-klasse-gold-50  border-klasse-gold-200  hover:border-klasse-gold-300",  dot: "bg-klasse-gold-400",  bold: "text-klasse-gold-900",  sub: "text-klasse-gold-600",  icon: "bg-klasse-gold-100  text-klasse-gold-700  group-hover:bg-klasse-gold-200"  };

  return (
    <motion.div variants={itemVariants}>
      <Link
        href={href}
        className={`group flex items-center justify-between gap-4 p-4 rounded-2xl border shadow-sm transition-all hover:shadow-md ${colors.wrap}`}
      >
        <div className="flex items-start gap-3">
          <span className={`mt-1.5 w-2 h-2 rounded-full flex-shrink-0 ${colors.dot}`} />
          <div className="space-y-1">
            {lines.map(({ bold, sub }, i) => (
              <div key={i}>
                <span className={`text-sm font-bold ${colors.bold}`}>{bold}</span>
                {i === lines.length - 1 && (
                  <p className={`text-xs mt-0.5 ${colors.sub}`}>{sub}</p>
                )}
              </div>
            ))}
          </div>
        </div>
        <div className={`flex-none w-9 h-9 rounded-full flex items-center justify-center transition ${colors.icon}`}>
          <ArrowRight className="h-4 w-4" />
        </div>
      </Link>
    </motion.div>
  );
}

// ─── Finance card wrapper ─────────────────────────────────────────────────────

function FinanceCard({ icon, iconBg, title, subtitle, linkHref, linkLabel, children }: {
  icon:       React.ReactNode;
  iconBg:     string;
  title:      string;
  subtitle:   string;
  linkHref:   string;
  linkLabel:  string;
  children:   React.ReactNode;
}) {
  return (
    <motion.div variants={itemVariants} className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden flex flex-col h-full">
      <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 bg-slate-50/30">
        <div className="flex items-center gap-3">
          <div className={`rounded-xl p-2 ${iconBg}`}>{icon}</div>
          <div>
            <h3 className="text-sm font-bold text-slate-900 tracking-tight">{title}</h3>
            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">{subtitle}</p>
          </div>
        </div>
        <Link href={linkHref} className="text-[11px] font-bold uppercase tracking-wider text-[#1F6B3B] hover:underline">
          {linkLabel}
        </Link>
      </div>
      <div className="px-5 divide-y divide-slate-100 flex-1">{children}</div>
    </motion.div>
  );
}

// ─── Status pill ──────────────────────────────────────────────────────────────

function StatusPill({ status }: { status: string | null }) {
  const s = (status ?? "").toLowerCase();
  if (s === "pago" || s === "confirmado") {
    return <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#1F6B3B]/10 text-[#1F6B3B]">Pago</span>;
  }
  if (s === "pendente") {
    return <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-klasse-gold-50 text-klasse-gold-700">Pendente</span>;
  }
  return <span className="text-xs text-slate-400">{status ?? "—"}</span>;
}

// ─── Inadimplência severity indicator ────────────────────────────────────────

function DiasAtraso({ dias }: { dias: number }) {
  if (dias >= 60) return <TrendingUp   className="w-3.5 h-3.5 text-rose-500" />;
  if (dias >= 30) return <Minus        className="w-3.5 h-3.5 text-klasse-gold-500" />;
  return               <TrendingDown  className="w-3.5 h-3.5 text-slate-400" />;
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function EscolaAdminDashboardContent({
  escolaId,
  escolaNome,
  anoLetivo,
  loading,
  error,
  notices            = [],
  charts,
  stats,
  pendingTurmasCount,
  curriculoPendencias,
  setupStatus,
  missingPricingCount = 0,
  financeiroHref,
  inadimplenciaTop   = [],
  pagamentosRecentes = [],
  receitaResumo,
}: Props) {
  const { escolaSlug } = useEscolaId();
  const escolaParam = escolaSlug || escolaId;
  const financeBase = financeiroHref ?? `/escola/${escolaParam}/financeiro`;
  const [progress, setProgress] = useState(0);

  const horaAtual = new Date().getHours();
  const saudacao = horaAtual < 12 ? "Bom dia" : horaAtual < 19 ? "Boa tarde" : "Boa noite";

  const previstoReceita = Number(receitaResumo?.previsto ?? 0);
  const realizadoReceita = Number(receitaResumo?.realizado ?? 0);
  const percentualReceita =
    previstoReceita > 0 ? Math.min(100, Math.round((realizadoReceita / previstoReceita) * 100)) : 0;

  useEffect(() => {
    const timer = setTimeout(() => setProgress(percentualReceita), 150);
    return () => clearTimeout(timer);
  }, [percentualReceita]);

  const radarAlerts: OperationalAlert[] = [];
  if (typeof pendingTurmasCount === "number" && pendingTurmasCount > 0) {
    radarAlerts.push({
      id: "turmas-pendentes",
      severity: pendingTurmasCount >= 5 ? "critical" : "warning",
      categoria: "academico",
      titulo: `${pendingTurmasCount} turma${pendingTurmasCount > 1 ? "s" : ""} pendente${pendingTurmasCount > 1 ? "s" : ""} de validação`,
      descricao: "Revise turmas para liberar matrículas e financeiro.",
      count: pendingTurmasCount,
      link: `/escola/${escolaParam}/admin/turmas?status=pendente`,
      link_label: "Ver turmas",
    });
  }
  if (missingPricingCount > 0) {
    radarAlerts.push({
      id: "precos-pendentes",
      severity: "warning",
      categoria: "financeiro",
      titulo: "Tabelas de preço pendentes",
      descricao: "Defina preços para liberar cobranças automáticas.",
      count: missingPricingCount,
      link: `/escola/${escolaParam}/admin/configuracoes/mensalidades`,
      link_label: "Configurar preços",
    });
  }

  return (
    <motion.div
      initial="hidden"
      animate="visible"
      variants={containerVariants}
      className="space-y-8 pb-12"
    >

      {/* ── 1. HEADER ────────────────────────────────────────────────────────── */}
      <motion.div variants={itemVariants} className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black text-slate-900 tracking-tight leading-none">
            Dashboard
          </h1>
          <div className="mt-2 flex items-center gap-2">
            <p className="text-sm font-medium text-slate-500">{saudacao}</p>
            <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-emerald-50 border border-emerald-100">
              <div className="h-1.5 w-1.5 rounded-full bg-[#10b981] shadow-[0_0_8px_#10b981] animate-pulse" />
              <span className="text-[10px] font-black uppercase tracking-widest text-[#10b981]">Live</span>
            </div>
            {escolaNome && <p className="text-sm font-medium text-slate-400">· {escolaNome}</p>}
          </div>
        </div>

        {anoLetivo && (
          <div className="hidden md:flex flex-col items-end gap-1">
            <span className="flex items-center gap-2 bg-white border border-slate-200 px-4 py-2 rounded-2xl text-xs font-black text-slate-600 shadow-sm transition-all hover:border-slate-300">
              <span className="w-2 h-2 rounded-full bg-[#1F6B3B]" />
              ANO LETIVO {anoLetivo}
            </span>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mr-2">Status do Período</p>
          </div>
        )}
      </motion.div>

      {/* ── 2. RADAR ─────────────────────────────────────────────────────────── */}
      <motion.div variants={itemVariants}>
        <RadarOperacional alerts={radarAlerts} role="admin" />
      </motion.div>

      {/* ── 3. KPIs ──────────────────────────────────────────────────────────── */}
      <motion.div variants={itemVariants}>
        <KpiSection
          escolaId={escolaId}
          stats={stats}
          loading={loading}
          error={error}
          setupStatus={setupStatus}
          financeiroHref={financeiroHref}
        />
      </motion.div>

      {/* ── 4. PREVISÃO DE RECEITA ───────────────────────────────────────────── */}
      {(previstoReceita > 0 || realizadoReceita > 0) && (
        <motion.section variants={itemVariants} className="relative overflow-hidden rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-start justify-between gap-4 mb-6 relative z-10">
            <div className="space-y-1">
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Desempenho Financeiro</p>
              <h2 className="text-2xl font-black text-slate-900 leading-tight">
                {moeda.format(realizadoReceita)}
                <span className="ml-2 text-sm font-medium text-slate-400">de {moeda.format(previstoReceita)} previstos</span>
              </h2>
            </div>
            <div className="text-right">
              <p className="text-3xl font-black text-[#1F6B3B] leading-none">{percentualReceita}%</p>
              <p className="text-[10px] font-bold text-emerald-600 uppercase mt-1">Realizado</p>
            </div>
          </div>

          <div className="relative mt-2">
            <div className="h-4 overflow-hidden rounded-full bg-slate-50 border border-slate-100">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${progress}%` }}
                transition={{ duration: 1.5, ease: [0.16, 1, 0.3, 1] }}
                className="h-full rounded-full bg-gradient-to-r from-[#1F6B3B] to-[#4ade80] shadow-[0_0_20px_rgba(74,222,128,0.3)]"
              />
            </div>
            
            {/* Pacing marker (Target 70% for example) */}
            <div 
              className="absolute top-0 bottom-0 w-0.5 bg-slate-200 z-10 flex flex-col items-center"
              style={{ left: '70%' }}
            >
              <div className="w-2 h-2 rounded-full bg-slate-300 -mt-0.5 shadow-sm" />
              <div className="absolute top-5 bg-white border border-slate-100 px-1.5 py-0.5 rounded shadow-sm">
                <span className="text-[8px] font-black text-slate-400 whitespace-nowrap">META 70%</span>
              </div>
            </div>
          </div>
          
          <div className="mt-8 flex items-center justify-between text-[10px] font-bold text-slate-400 uppercase tracking-widest">
            <p>0% Iniciado</p>
            <p className="text-slate-900">Actual: {percentualReceita}%</p>
            <p>100% Meta Final</p>
          </div>
        </motion.section>
      )}

      {/* ── 5. CHARTS ────────────────────────────────────────────────────────── */}
      <motion.div variants={itemVariants}>
        <ChartsSection
          meses={charts?.meses}
          alunosPorMes={charts?.alunosPorMes}
          pagamentos={charts?.pagamentos}
        />
      </motion.div>

      {/* ── 6. FINANCE CARDS ─────────────────────────────────────────────────── */}
      <section className="grid gap-6 lg:grid-cols-2">
        <FinanceCard
          iconBg="bg-emerald-50 text-emerald-700"
          icon={<Wallet className="h-4 w-4" />}
          title="Fluxo de Caixa"
          subtitle="Entradas confirmadas hoje"
          linkHref={`${financeBase}/pagamentos`}
          linkLabel="Ver histórico"
        >
          <AnimatePresence mode="popLayout">
            {pagamentosRecentes.length === 0 ? (
              <div className="py-8">
                <EstadoVazio tipo="notificacoes.nenhuma" />
              </div>
            ) : (
              pagamentosRecentes.map((p, idx) => (
                <motion.div
                  key={p.id}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: idx * 0.05 }}
                  className="flex items-center justify-between gap-3 py-4 group/row transition-colors hover:bg-slate-50/50"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-slate-900 truncate group-hover/row:text-klasse-green transition-colors">
                      {p.aluno_nome ?? (p.aluno_id ? `Aluno ${p.aluno_id.slice(0, 8)}…` : "—")}
                    </p>
                    <p className="text-[11px] font-medium text-slate-400">{p.metodo ?? "—"}</p>
                  </div>
                  <div className="flex items-center gap-4 flex-shrink-0">
                    <StatusPill status={p.status} />
                    <div className="text-right">
                      <p className="text-sm font-black text-slate-900">
                        {moeda.format(Number(p.valor_pago ?? 0))}
                      </p>
                      <p className="text-[10px] font-bold text-slate-400">
                        {p.created_at
                          ? new Date(p.created_at).toLocaleTimeString("pt-PT", { hour: "2-digit", minute: "2-digit" })
                          : "—"}
                      </p>
                    </div>
                  </div>
                </motion.div>
              ))
            )}
          </AnimatePresence>
        </FinanceCard>

        <FinanceCard
          iconBg="bg-rose-50 text-rose-600"
          icon={<AlertCircle className="h-4 w-4" />}
          title="Radar Financeiro"
          subtitle="Alertas de inadimplência"
          linkHref={`${financeBase}/radar`}
          linkLabel="Ver todos"
        >
          <AnimatePresence mode="popLayout">
            {inadimplenciaTop.length === 0 ? (
              <div className="py-8">
                <EstadoVazio tipo="atrasos.nenhum" />
              </div>
            ) : (
              inadimplenciaTop.map((row, idx) => {
                const nome = row.aluno_nome?.trim() || "Aluno";
                const iniciais = nome.charAt(0).toUpperCase();
                return (
                  <motion.div
                    key={row.aluno_id}
                    initial={{ opacity: 0, x: 10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: idx * 0.05 }}
                    className="flex items-center justify-between gap-3 py-4 group/row transition-colors hover:bg-slate-50/50"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-10 h-10 rounded-xl bg-slate-100 text-slate-600 flex items-center justify-center text-xs font-black flex-shrink-0 border border-slate-200">
                        {iniciais}
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-bold text-slate-900 truncate group-hover/row:text-rose-600 transition-colors">{nome}</p>
                        <div className="flex items-center gap-1 text-[11px] font-bold text-slate-400 uppercase tracking-tighter">
                          <DiasAtraso dias={row.dias_em_atraso} />
                          <span>{row.dias_em_atraso ? `${row.dias_em_atraso} DIAS DE ATRASO` : "—"}</span>
                        </div>
                      </div>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className="text-sm font-black text-rose-600">
                        {moeda.format(Number(row.valor_em_atraso ?? 0))}
                      </p>
                      <p className="text-[10px] font-bold text-slate-400 uppercase">Dívida Total</p>
                    </div>
                  </motion.div>
                );
              })
            )}
          </AnimatePresence>
        </FinanceCard>
      </section>

      {/* ── 7. BOTTOM GRID ───────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 gap-8 lg:grid-cols-3 lg:items-start">
        <div className="lg:col-span-2 space-y-8">
          <motion.div variants={itemVariants}>
            <QuickActionsSection escolaId={escolaId} setupStatus={setupStatus} />
          </motion.div>
          <motion.div variants={itemVariants}>
            <NoticesSection notices={notices} />
          </motion.div>
        </div>
        <div className="space-y-8">
          <motion.div variants={itemVariants}>
            <AcademicSection
              escolaId={escolaId}
              setupStatus={setupStatus}
              missingPricingCount={missingPricingCount}
              financeiroHref={financeiroHref}
            />
          </motion.div>
          <motion.div variants={itemVariants}>
            <OperationalFeedSection escolaId={escolaId} />
          </motion.div>
        </div>
      </div>

    </motion.div>
  );
}
