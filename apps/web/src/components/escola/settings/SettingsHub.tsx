"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import dynamic from "next/dynamic";
import {
  Building2,
  BookOpen,
  ChevronRight,
  Layers,
  CalendarCheck,
  Wand2,
  AlertTriangle,
  Users,
  ShieldCheck,
  Wallet,
  Play,
  ChevronDown,
} from "lucide-react";

// ─── Progress ────────────────────────────────────────────────────────────────
const Progress = ({ value, className }: { value: number; className?: string }) => (
  <div className={`w-full rounded-full overflow-hidden ${className}`}>
    <div
      className="h-full bg-[#E3B23C] transition-all duration-700 ease-out"
      style={{ width: `${value}%` }}
    />
  </div>
);

// ─── Skeleton ────────────────────────────────────────────────────────────────
const Skeleton = ({ className }: { className?: string }) => (
  <div className={`animate-pulse rounded bg-slate-100 ${className}`} />
);

// ─── Panel loading ────────────────────────────────────────────────────────────
function PanelLoading() {
  return (
    <div className="space-y-3 p-2">
      {[...Array(4)].map((_, i) => (
        <Skeleton key={i} className="h-10 w-full" />
      ))}
    </div>
  );
}

// ─── Dynamic panels ───────────────────────────────────────────────────────────
const CalendarioPanel = dynamic(
  () => import("@/app/escola/[id]/admin/configuracoes/calendario/page"),
  { ssr: false, loading: () => <PanelLoading /> }
);
const AvaliacoesPanel = dynamic(
  () => import("@/app/escola/[id]/admin/configuracoes/avaliacao/page"),
  { ssr: false, loading: () => <PanelLoading /> }
);
const TurmasPanel = dynamic(
  () => import("@/app/escola/[id]/admin/configuracoes/turmas/page"),
  { ssr: false, loading: () => <PanelLoading /> }
);
const FinanceiroPanel = dynamic(
  () => import("@/app/escola/[id]/admin/configuracoes/financeiro/page"),
  { ssr: false, loading: () => <PanelLoading /> }
);
const FluxosPanel = dynamic(
  () => import("@/app/escola/[id]/admin/configuracoes/fluxos/page"),
  { ssr: false, loading: () => <PanelLoading /> }
);
const AvancadoPanel = dynamic(
  () => import("@/app/escola/[id]/admin/configuracoes/avancado/page"),
  { ssr: false, loading: () => <PanelLoading /> }
);
const HorariosPanel = ({ escolaId }: { escolaId: string }) => (
  <div className="space-y-3">
    <p className="text-sm text-slate-500">Configure os tempos de aula e monte o quadro automático.</p>
    <div className="grid gap-3 sm:grid-cols-2">
      <Link
        href={`/escola/${escolaId}/horarios/slots`}
        className="rounded-xl border border-slate-200 bg-white p-4 text-sm font-semibold text-slate-700 hover:bg-slate-50 transition-colors"
      >
        Configurar Slots
      </Link>
      <Link
        href={`/escola/${escolaId}/horarios/quadro`}
        className="rounded-xl border border-slate-200 bg-white p-4 text-sm font-semibold text-slate-700 hover:bg-slate-50 transition-colors"
      >
        Abrir Quadro
      </Link>
    </div>
  </div>
);

// ─── Types ────────────────────────────────────────────────────────────────────
interface SettingsHubProps {
  escolaId: string;
  onOpenWizard: () => void;
}

interface SetupStatus {
  ano_letivo_ok?: boolean;
  periodos_ok?: boolean;
  avaliacao_ok?: boolean;
  curriculo_draft_ok?: boolean;
  curriculo_published_ok?: boolean;
  turmas_ok?: boolean;
}

interface EstruturaCounts {
  cursos_total?: number;
  classes_total?: number;
  disciplinas_total?: number;
}

// ─── Status badge ─────────────────────────────────────────────────────────────
function StatusBadge({ ok, loading }: { ok?: boolean; loading: boolean }) {
  if (loading) return <Skeleton className="h-5 w-16" />;
  if (ok === undefined) return null;
  return (
    <span
      className={`text-[10px] font-bold uppercase px-2.5 py-1 rounded-full border ${
        ok
          ? "bg-[#1F6B3B]/10 text-[#1F6B3B] border-[#1F6B3B]/20"
          : "bg-amber-50 text-amber-700 border-amber-200"
      }`}
    >
      {ok ? "OK" : "Pendente"}
    </span>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────
export default function SettingsHub({ escolaId, onOpenWizard }: SettingsHubProps) {
  const [progress, setProgress] = useState<number | null>(null);
  const [setupStatus, setSetupStatus] = useState<SetupStatus | null>(null);
  const [estruturaCounts, setEstruturaCounts] = useState<EstruturaCounts | null>(null);
  const [loading, setLoading] = useState(true);
  const [dangerOpen, setDangerOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function fetchStatus() {
      if (!escolaId) return;
      try {
        const res = await fetch(`/api/escola/${escolaId}/admin/setup/state`, { cache: "no-store" });
        const json = await res.json().catch(() => null);
        if (!res.ok) throw new Error(json?.error);
        if (cancelled) return;

        const data = json?.data ?? {};
        setSetupStatus({
          ano_letivo_ok: data?.badges?.ano_letivo_ok,
          periodos_ok: data?.badges?.periodos_ok,
          avaliacao_ok: data?.badges?.avaliacao_ok,
          curriculo_draft_ok: data?.badges?.curriculo_draft_ok,
          curriculo_published_ok: data?.badges?.curriculo_published_ok,
          turmas_ok: data?.badges?.turmas_ok,
        });
        if (typeof data?.completion_percent === "number") setProgress(data.completion_percent);

        const impactRes = await fetch(`/api/escola/${escolaId}/admin/setup/impact`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({}),
        });
        const impactJson = await impactRes.json().catch(() => null);
        if (impactRes.ok && impactJson?.ok) {
          const counts = impactJson?.data?.counts;
          setEstruturaCounts({
            cursos_total: counts?.cursos_afetados ?? 0,
            classes_total: counts?.classes_afetadas ?? 0,
            disciplinas_total: counts?.disciplinas_afetadas ?? 0,
          });
        }
      } catch (error) {
        console.error(error);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    fetchStatus();
    return () => { cancelled = true; };
  }, [escolaId]);

  // ─── Derived ────────────────────────────────────────────────────────────────
  const anoLetivoOk = setupStatus?.ano_letivo_ok && setupStatus?.periodos_ok;
  const curriculoOk = setupStatus?.curriculo_published_ok;
  const turmasOk = setupStatus?.turmas_ok;
  const anoLetivoAtual = new Date().getFullYear();

  const estruturaMeta = estruturaCounts
    ? `${estruturaCounts.cursos_total ?? 0} cursos · ${estruturaCounts.classes_total ?? 0} classes · ${estruturaCounts.disciplinas_total ?? 0} disciplinas`
    : null;

  // ─── Tabs ───────────────────────────────────────────────────────────────────
  const pathname = usePathname();
  const safePathname = pathname ?? "/";
  const searchParams = useSearchParams();
  const panelParams = useMemo(() => Promise.resolve({ id: escolaId }), [escolaId]);

  const tabs = [
    { id: "calendario",  label: "Calendário",  icon: CalendarCheck, Component: CalendarioPanel },
    { id: "avaliacoes",  label: "Avaliações",  icon: BookOpen,       Component: AvaliacoesPanel },
    { id: "turmas",      label: "Turmas",      icon: Users,          Component: TurmasPanel },
    { id: "horarios",    label: "Horários",    icon: CalendarCheck,  Component: () => <HorariosPanel escolaId={escolaId} /> },
    { id: "financeiro",  label: "Financeiro",  icon: Wallet,         Component: FinanceiroPanel },
    { id: "fluxos",      label: "Fluxos",      icon: Layers,         Component: FluxosPanel },
    { id: "avancado",    label: "Avançado",    icon: ShieldCheck,    Component: AvancadoPanel },
  ];

  const activeTabId = searchParams?.get("tab") ?? tabs[0].id;
  const activeTab = tabs.find((t) => t.id === activeTabId) ?? tabs[0];
  const ActivePanel = activeTab.Component;

  const buildTabHref = (tabId: string) => {
    const params = new URLSearchParams(searchParams?.toString() ?? "");
    params.set("tab", tabId);
    const query = params.toString();
    return query ? `${safePathname}?${query}` : safePathname;
  };

  // ─── Quick cards ─────────────────────────────────────────────────────────────
  // Note: "Zona de Perigo" was removed from here — it now lives in its own
  // collapsible section at the bottom of the page.
  const quickCards = [
    {
      title: "Assistente de Setup",
      desc: "Reconfigurar ano letivo e estrutura.",
      icon: Wand2,
      action: onOpenWizard,
      highlight: true,
    },
    {
      title: "Oferta Formativa",
      desc: estruturaMeta ?? "Cursos, níveis e disciplinas.",
      icon: Layers,
      href: `/escola/${escolaId}/admin/configuracoes/estrutura`,
    },
    {
      title: "Identidade",
      desc: "Logo e dados da escola.",
      icon: Building2,
      href: `/escola/${escolaId}/admin/configuracoes/identidade`,
    },
    {
      title: "Horários",
      desc: "Slots e quadro automático.",
      icon: CalendarCheck,
      href: `/escola/${escolaId}/horarios/slots`,
    },
  ];

  // ─── Render ──────────────────────────────────────────────────────────────────
  return (
    <div className="max-w-[1400px] mx-auto px-8 py-10 space-y-10 bg-slate-50/50 min-h-screen">

      {/* ── 1. PAGE HEADER ───────────────────────────────────────────────────── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <p className="text-xs font-bold uppercase tracking-widest text-[#1F6B3B] mb-1">
            Ano Letivo {anoLetivoAtual}
          </p>
          <h1 className="text-3xl font-bold text-slate-900 tracking-tight">
            Configurações
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Gestão global da estrutura acadêmica e operacional.
          </p>
        </div>

        {/* Global progress — single source of truth */}
        <div className="flex items-center gap-4 bg-white border border-slate-200 rounded-2xl px-6 py-4 shadow-sm min-w-[280px]">
          <div className="flex-1">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
                Setup concluído
              </span>
              {loading ? (
                <Skeleton className="h-4 w-8" />
              ) : (
                <span className="text-sm font-bold text-slate-900">
                  {progress ?? 0}%
                </span>
              )}
            </div>
            {loading ? (
              <Skeleton className="h-2 w-full" />
            ) : (
              <Progress value={progress ?? 0} className="h-2 bg-slate-100" />
            )}
          </div>
          <button
            onClick={onOpenWizard}
            className="flex-shrink-0 p-2 rounded-xl bg-[#E3B23C] text-white hover:bg-[#c99a2e] transition-colors shadow-sm"
            title="Abrir assistente de setup"
          >
            <Wand2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* ── 2. STATUS BADGES ─────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-3">
        <span className="text-xs text-slate-400 font-medium mr-1">Status:</span>
        <div className="flex items-center gap-1.5">
          <span className="text-xs text-slate-500">Ano Letivo</span>
          <StatusBadge ok={anoLetivoOk} loading={loading} />
        </div>
        <span className="text-slate-200">·</span>
        <div className="flex items-center gap-1.5">
          <span className="text-xs text-slate-500">Currículo</span>
          <StatusBadge ok={curriculoOk} loading={loading} />
        </div>
        <span className="text-slate-200">·</span>
        <div className="flex items-center gap-1.5">
          <span className="text-xs text-slate-500">Turmas</span>
          <StatusBadge ok={turmasOk} loading={loading} />
        </div>
      </div>

      {/* ── 3. QUICK CARDS ───────────────────────────────────────────────────── */}
      <div>
        <h2 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-4">
          Acesso rápido
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {quickCards.map((card, idx) => {
            const inner = (
              <div
                className={`
                  group h-full p-4 rounded-xl border cursor-pointer transition-all
                  hover:-translate-y-0.5 hover:shadow-md flex flex-col gap-3
                  ${card.highlight
                    ? "bg-gradient-to-br from-[#E3B23C]/8 to-white border-[#E3B23C]/40 hover:border-[#E3B23C]"
                    : "bg-white border-slate-200 hover:border-slate-300"
                  }
                `}
              >
                <div className="flex items-start justify-between">
                  <div
                    className={`p-2 rounded-xl transition-colors ${
                      card.highlight
                        ? "bg-[#E3B23C] text-white"
                        : "bg-slate-50 text-slate-400 group-hover:bg-slate-100 group-hover:text-slate-600"
                    }`}
                  >
                    <card.icon size={16} strokeWidth={1.75} />
                  </div>
                  <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-slate-500 transition-colors" />
                </div>

                <div>
                  <h3 className="font-semibold text-sm text-slate-900 mb-0.5">{card.title}</h3>
                  <p className="text-xs text-slate-500 leading-relaxed">{card.desc}</p>
                </div>

                {card.highlight && !loading && progress !== null && (
                  <Progress value={progress} className="h-1 bg-slate-100 mt-auto" />
                )}
              </div>
            );

            // Wizard card uses onClick; others use <Link>
            if (card.action) {
              return (
                <button key={idx} type="button" onClick={card.action} className="text-left h-full">
                  {inner}
                </button>
              );
            }

            return (
              <Link key={idx} href={card.href!} className="h-full block">
                {inner}
              </Link>
            );
          })}
        </div>
      </div>

      {/* ── 4. CONFIGURATION PANEL (sidebar + content) ───────────────────────── */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xs font-bold text-slate-400 uppercase tracking-widest">
            Configurações detalhadas
          </h2>
          <Link
            href={`/escola/${escolaId}/admin/configuracoes/${
              activeTab.id === "avaliacoes" ? "avaliacao" : activeTab.id
            }`}
            className="text-xs font-semibold text-[#E3B23C] hover:underline flex items-center gap-1"
          >
            Tela cheia
            <ChevronRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden flex flex-col md:flex-row min-h-[560px]">

          {/* Sidebar tabs */}
          <nav className="md:w-48 lg:w-56 flex-shrink-0 border-b md:border-b-0 md:border-r border-slate-100 p-3">
            <ul className="flex flex-row md:flex-col gap-1 overflow-x-auto md:overflow-x-visible">
              {tabs.map((tab) => {
                const isActive = tab.id === activeTab.id;
                return (
                  <li key={tab.id} className="flex-shrink-0">
                    <Link
                      href={buildTabHref(tab.id)}
                      scroll={false}
                      className={`
                        flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm font-medium transition-all w-full
                        ${isActive
                          ? "bg-slate-900 text-[#E3B23C]"
                          : "text-slate-500 hover:text-slate-800 hover:bg-slate-50"
                        }
                      `}
                    >
                      <tab.icon className="w-4 h-4 flex-shrink-0" />
                      <span className="hidden md:inline">{tab.label}</span>
                    </Link>
                  </li>
                );
              })}
            </ul>

            {/* Sandbox shortcut — lives naturally here */}
            <div className="hidden md:block mt-4 pt-4 border-t border-slate-100">
              <Link
                href={`/escola/${escolaId}/admin/configuracoes/sandbox`}
                className="flex items-center gap-2 rounded-lg px-3 py-2.5 text-sm font-medium text-slate-400 hover:text-slate-700 hover:bg-slate-50 transition-all w-full"
              >
                <Play className="w-4 h-4 flex-shrink-0" />
                <span>Testar Fluxo</span>
              </Link>
            </div>
          </nav>

          {/* Panel content */}
          <div className="flex-1 p-6 overflow-y-auto max-h-[640px]">
            <ActivePanel params={panelParams} />
          </div>
        </div>
      </div>

      {/* ── 5. DANGER ZONE (collapsible, isolated) ───────────────────────────── */}
      <div className="rounded-2xl border border-rose-200 bg-rose-50/50 overflow-hidden">
        <button
          type="button"
          onClick={() => setDangerOpen((v) => !v)}
          className="w-full flex items-center justify-between px-6 py-4 text-left hover:bg-rose-50 transition-colors"
        >
          <div className="flex items-center gap-3">
            <AlertTriangle className="w-4 h-4 text-rose-500 flex-shrink-0" />
            <div>
              <span className="text-sm font-semibold text-rose-700">Zona de Perigo</span>
              <p className="text-xs text-rose-500/80 mt-0.5">Reset de dados e ações irreversíveis</p>
            </div>
          </div>
          <ChevronDown
            className={`w-4 h-4 text-rose-400 transition-transform duration-200 ${dangerOpen ? "rotate-180" : ""}`}
          />
        </button>

        {dangerOpen && (
          <div className="px-6 pb-6 border-t border-rose-200">
            <div className="pt-4">
              <Link
                href={`/escola/${escolaId}/admin/configuracoes`}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-rose-300 bg-white text-sm font-semibold text-rose-700 hover:bg-rose-50 transition-colors"
              >
                <AlertTriangle className="w-4 h-4" />
                Acessar configurações avançadas de reset
              </Link>
              <p className="text-xs text-rose-400 mt-3">
                Estas ações são irreversíveis. Certifique-se de ter um backup antes de prosseguir.
              </p>
            </div>
          </div>
        )}
      </div>

    </div>
  );
}
