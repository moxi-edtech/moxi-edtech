// apps/web/src/components/layout/escola-admin/EscolaAdminDashboardContent.tsx
"use client";

import Link from "next/link";
import { AlertCircle, ArrowRight, Wallet, TrendingUp, TrendingDown, Minus } from "lucide-react";
import SecaoLabel from "@/components/shared/SecaoLabel";

import KpiSection      from "./KpiSection";
import NoticesSection  from "./NoticesSection";
import EventsSection   from "./EventsSection";
import AcademicSection from "./AcademicSection";
import QuickActionsSection from "./QuickActionsSection";
import ChartsSection   from "./ChartsSection";
import { RadarOperacional, type OperationalAlert } from "@/components/feedback/FeedbackSystem";

import type {
  KpiStats,
  SetupStatus,
  Aviso,
  Evento,
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
  events?:              Evento[];
  charts?:              DashboardCharts;
  stats:                KpiStats;
  pendingTurmasCount?:  number | null;
  curriculoPendencias?: CurriculoPendencias;
  setupStatus:          SetupStatus;
  missingPricingCount?: number;
  financeiroHref?:      string;
  inadimplenciaTop?:    InadimplenciaTopRow[];
  pagamentosRecentes?:  PagamentoRecenteRow[];
};

// ─── Currency formatter ───────────────────────────────────────────────────────

const moeda = new Intl.NumberFormat("pt-AO", { style: "currency", currency: "AOA" });

// ─── Alert banners ────────────────────────────────────────────────────────────
// One component covers both orange (turmas) and amber (currículo) banners,
// keeping the visual language consistent while allowing colour variation.

type AlertBannerProps = {
  href:    string;
  lines:   { bold: string; sub: string }[];
  tone:    "orange" | "amber";
};

function AlertBanner({ href, lines, tone }: AlertBannerProps) {
  const colors = tone === "orange"
    ? { wrap: "bg-orange-50 border-orange-200 hover:border-orange-300", dot: "bg-orange-400", bold: "text-orange-900", sub: "text-orange-600", icon: "bg-orange-100 text-orange-700 group-hover:bg-orange-200" }
    : { wrap: "bg-amber-50  border-amber-200  hover:border-amber-300",  dot: "bg-amber-400",  bold: "text-amber-900",  sub: "text-amber-600",  icon: "bg-amber-100  text-amber-700  group-hover:bg-amber-200"  };

  return (
    <div className="animate-in fade-in duration-500">
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
    </div>
  );
}

// ─── Section header ───────────────────────────────────────────────────────────

function SectionHeader({ title, href, linkLabel }: { title: string; href?: string; linkLabel?: string }) {
  return (
    <div className="flex items-center justify-between mb-4">
      <SecaoLabel>{title}</SecaoLabel>
      {href && linkLabel && (
        <Link href={href} className="text-xs font-semibold text-[#1F6B3B] hover:underline">
          {linkLabel}
        </Link>
      )}
    </div>
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
    <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
      {/* Card header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
        <div className="flex items-center gap-3">
          <div className={`rounded-xl p-2 ${iconBg}`}>{icon}</div>
          <div>
            <h3 className="text-sm font-bold text-slate-900">{title}</h3>
            <p className="text-xs text-slate-400">{subtitle}</p>
          </div>
        </div>
        <Link href={linkHref} className="text-xs font-semibold text-[#1F6B3B] hover:underline">
          {linkLabel}
        </Link>
      </div>
      {/* Card body */}
      <div className="px-5 divide-y divide-slate-100">{children}</div>
    </div>
  );
}

// ─── Status pill ──────────────────────────────────────────────────────────────

function StatusPill({ status }: { status: string | null }) {
  const s = (status ?? "").toLowerCase();
  if (s === "pago" || s === "confirmado") {
    return <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#1F6B3B]/10 text-[#1F6B3B]">Pago</span>;
  }
  if (s === "pendente") {
    return <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-50 text-amber-700">Pendente</span>;
  }
  return <span className="text-xs text-slate-400">{status ?? "—"}</span>;
}

// ─── Inadimplência severity indicator ────────────────────────────────────────

function DiasAtraso({ dias }: { dias: number }) {
  if (dias >= 60) return <TrendingUp   className="w-3.5 h-3.5 text-rose-500" />;
  if (dias >= 30) return <Minus        className="w-3.5 h-3.5 text-amber-500" />;
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
  events             = [],
  charts,
  stats,
  pendingTurmasCount,
  curriculoPendencias,
  setupStatus,
  missingPricingCount = 0,
  financeiroHref,
  inadimplenciaTop   = [],
  pagamentosRecentes = [],
}: Props) {
  const financeBase = financeiroHref ?? `/escola/${escolaId}/financeiro`;

  // Collect currículo alerts into a unified list
  const curriculoAlerts: { bold: string; sub: string }[] = [];
  if ((curriculoPendencias?.horario ?? 0) > 0) {
    const n = curriculoPendencias!.horario;
    curriculoAlerts.push({
      bold: `Horários incompletos: ${n} disciplina${n > 1 ? "s" : ""}`,
      sub:  "Ajuste a carga horária para liberar o quadro automático.",
    });
  }
  if ((curriculoPendencias?.avaliacao ?? 0) > 0) {
    const n = curriculoPendencias!.avaliacao;
    curriculoAlerts.push({
      bold: `Avaliação incompleta: ${n} disciplina${n > 1 ? "s" : ""}`,
      sub:  "Configure avaliação para liberar lançamento de notas.",
    });
  }

  const radarAlerts: OperationalAlert[] = [];
  if (typeof pendingTurmasCount === "number" && pendingTurmasCount > 0) {
    radarAlerts.push({
      id: "turmas-pendentes",
      severity: pendingTurmasCount >= 5 ? "critical" : "warning",
      categoria: "academico",
      titulo: `${pendingTurmasCount} turma${pendingTurmasCount > 1 ? "s" : ""} pendente${pendingTurmasCount > 1 ? "s" : ""} de validação`,
      descricao: "Revise turmas para liberar matrículas e financeiro.",
      count: pendingTurmasCount,
      link: `/escola/${escolaId}/admin/turmas?status=pendente`,
      link_label: "Ver turmas",
    });
  }
  if ((curriculoPendencias?.horario ?? 0) > 0) {
    radarAlerts.push({
      id: "curriculo-horario",
      severity: "warning",
      categoria: "academico",
      titulo: "Horários incompletos",
      descricao: "Ajuste a carga horária para liberar o quadro automático.",
      count: curriculoPendencias?.horario ?? 0,
      link: `/escola/${escolaId}/admin/configuracoes/academico-completo`,
      link_label: "Ajustar currículo",
    });
  }
  if ((curriculoPendencias?.avaliacao ?? 0) > 0) {
    radarAlerts.push({
      id: "curriculo-avaliacao",
      severity: "warning",
      categoria: "academico",
      titulo: "Avaliação incompleta",
      descricao: "Configure avaliação para liberar lançamento de notas.",
      count: curriculoPendencias?.avaliacao ?? 0,
      link: `/escola/${escolaId}/admin/configuracoes/academico-completo`,
      link_label: "Configurar avaliação",
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
      link: `/escola/${escolaId}/admin/configuracoes/financeiro`,
      link_label: "Configurar preços",
    });
  }

  return (
    <div className="space-y-8 pb-12">

      {/* ── 1. HEADER ────────────────────────────────────────────────────────── */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight leading-none">
            Dashboard
          </h1>
          {escolaNome && (
            <p className="text-sm font-medium text-slate-500 mt-1">{escolaNome}</p>
          )}
        </div>

        {anoLetivo && (
          <span className="hidden md:inline-flex items-center gap-2 bg-white border border-slate-200 px-3 py-1.5 rounded-xl text-xs font-bold text-slate-600 shadow-sm flex-shrink-0">
            <span className="w-1.5 h-1.5 rounded-full bg-[#1F6B3B]" />
            Ano Letivo {anoLetivo}
          </span>
        )}
      </div>

      {/* ── 2. RADAR ─────────────────────────────────────────────────────────── */}
      <RadarOperacional alerts={radarAlerts} role="admin" />

      {/* ── 3. KPIs ──────────────────────────────────────────────────────────── */}
      <KpiSection
        escolaId={escolaId}
        stats={stats}
        loading={loading}
        error={error}
        setupStatus={setupStatus}
        financeiroHref={financeiroHref}
      />

      {/* ── 4. ALERT BANNERS ─────────────────────────────────────────────────── */}
      {(typeof pendingTurmasCount === "number" && pendingTurmasCount > 0) || curriculoAlerts.length > 0 ? (
        <div className="space-y-2">
          {typeof pendingTurmasCount === "number" && pendingTurmasCount > 0 && (
            <AlertBanner
              tone="orange"
              href={`/escola/${escolaId}/admin/turmas?status=pendente`}
              lines={[{
                bold: `${pendingTurmasCount} turma${pendingTurmasCount > 1 ? "s" : ""} pendente${pendingTurmasCount > 1 ? "s" : ""} de validação`,
                sub:  "Revise e aprove as turmas importadas/rascunho.",
              }]}
            />
          )}
          {curriculoAlerts.length > 0 && (
            <AlertBanner
              tone="amber"
              href={`/escola/${escolaId}/admin/configuracoes/estrutura?resolvePendencias=1`}
              lines={curriculoAlerts}
            />
          )}
        </div>
      ) : null}

      {/* ── 4. CHARTS ────────────────────────────────────────────────────────── */}
      <div className="animate-in fade-in duration-500">
        <ChartsSection
          meses={charts?.meses}
          alunosPorMes={charts?.alunosPorMes}
          pagamentos={charts?.pagamentos}
        />
      </div>

      {/* ── 5. FINANCE CARDS ─────────────────────────────────────────────────── */}
      <section className="grid gap-5 lg:grid-cols-2 animate-in fade-in duration-500">

        {/* Pagamentos do dia */}
        <FinanceCard
          iconBg="bg-emerald-50 text-emerald-600"
          icon={<Wallet className="h-4 w-4" />}
          title="Pagamentos do dia"
          subtitle="Feed em tempo real"
          linkHref={`${financeBase}/pagamentos`}
          linkLabel="Ver todos"
        >
          {pagamentosRecentes.length === 0 ? (
            <p className="py-6 text-sm text-slate-400 text-center">Nenhum pagamento hoje.</p>
          ) : (
            pagamentosRecentes.map((p) => (
              <div key={p.id} className="flex items-center justify-between gap-3 py-3">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-slate-900 truncate">
                    {p.aluno_nome ?? (p.aluno_id ? `Aluno ${p.aluno_id.slice(0, 8)}…` : "—")}
                  </p>
                  <p className="text-xs text-slate-400">{p.metodo ?? "—"}</p>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <StatusPill status={p.status} />
                  <div className="text-right">
                    <p className="text-sm font-bold text-slate-900">
                      {moeda.format(Number(p.valor_pago ?? 0))}
                    </p>
                    <p className="text-xs text-slate-400">
                      {p.created_at
                        ? new Date(p.created_at).toLocaleTimeString("pt-PT", { hour: "2-digit", minute: "2-digit" })
                        : "—"}
                    </p>
                  </div>
                </div>
              </div>
            ))
          )}
        </FinanceCard>

        {/* Top inadimplentes */}
        <FinanceCard
          iconBg="bg-rose-50 text-rose-600"
          icon={<AlertCircle className="h-4 w-4" />}
          title="Top inadimplentes"
          subtitle="5 maiores valores em atraso"
          linkHref={`${financeBase}/radar`}
          linkLabel="Ver radar completo"
        >
          {inadimplenciaTop.length === 0 ? (
            <p className="py-6 text-sm text-slate-400 text-center">Nenhuma inadimplência registada.</p>
          ) : (
            inadimplenciaTop.map((row) => {
              const nome    = row.aluno_nome?.trim() || "Aluno";
              const iniciais = nome.charAt(0).toUpperCase();
              return (
                <div key={row.aluno_id} className="flex items-center justify-between gap-3 py-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-9 h-9 rounded-full bg-slate-100 text-slate-600 flex items-center justify-center text-sm font-bold flex-shrink-0">
                      {iniciais}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-slate-900 truncate">{nome}</p>
                      <div className="flex items-center gap-1 text-xs text-slate-400">
                        <DiasAtraso dias={row.dias_em_atraso} />
                        <span>{row.dias_em_atraso ? `${row.dias_em_atraso} dias` : "—"}</span>
                      </div>
                    </div>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="text-sm font-bold text-rose-600">
                      {moeda.format(Number(row.valor_em_atraso ?? 0))}
                    </p>
                    <p className="text-xs text-slate-400">em atraso</p>
                  </div>
                </div>
              );
            })
          )}
        </FinanceCard>
      </section>

      {/* ── 6. BOTTOM GRID ───────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3 lg:items-start animate-in fade-in duration-700">
        <div className="lg:col-span-2 space-y-6">
          <QuickActionsSection escolaId={escolaId} setupStatus={setupStatus} />
          <NoticesSection notices={notices} />
        </div>
        <div className="space-y-6">
          <AcademicSection
            escolaId={escolaId}
            setupStatus={setupStatus}
            missingPricingCount={missingPricingCount}
            financeiroHref={financeiroHref}
          />
          <EventsSection events={events} />
        </div>
      </div>

    </div>
  );
}
