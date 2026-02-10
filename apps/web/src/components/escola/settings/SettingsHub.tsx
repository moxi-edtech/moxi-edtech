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
  Play
} from "lucide-react";

// Componente Progress interno para não depender de lib externa
const Progress = ({ value, className }: { value: number, className?: string }) => (
  <div className={`w-full rounded-full overflow-hidden ${className}`}>
    <div 
      className="h-full bg-[#E3B23C] transition-all duration-500 ease-out" 
      style={{ width: `${value}%` }} 
    />
  </div>
);

interface SettingsHubProps {
  escolaId: string;
  onOpenWizard: () => void;
}

function PanelLoading() {
  return (
    <div className="flex items-center justify-center gap-2 py-10 text-xs font-semibold text-slate-500">
      Carregando painel...
    </div>
  );
}

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
    <div className="space-y-4">
      <div className="text-sm text-slate-600">
        Configure os tempos de aula e monte o quadro automático.
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <Link
          href={`/escola/${escolaId}/horarios/slots`}
          className="rounded-xl border border-slate-200 bg-white p-4 text-sm font-semibold text-slate-700 hover:bg-slate-50"
        >
          Configurar Slots
        </Link>
        <Link
          href={`/escola/${escolaId}/horarios/quadro`}
          className="rounded-xl border border-slate-200 bg-white p-4 text-sm font-semibold text-slate-700 hover:bg-slate-50"
        >
          Abrir Quadro
        </Link>
      </div>
    </div>
  );

export default function SettingsHub({ escolaId, onOpenWizard }: SettingsHubProps) {
  // --- STATE & DATA ---
  const [progress, setProgress] = useState<number | null>(null);
  const [setupStatus, setSetupStatus] = useState<{
    ano_letivo_ok?: boolean;
    periodos_ok?: boolean;
    avaliacao_ok?: boolean;
    curriculo_draft_ok?: boolean;
    curriculo_published_ok?: boolean;
    turmas_ok?: boolean;
  } | null>(null);
  const [estruturaCounts, setEstruturaCounts] = useState<{
    cursos_total?: number;
    classes_total?: number;
    disciplinas_total?: number;
  } | null>(null);

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
        if (typeof data?.completion_percent === 'number') setProgress(data.completion_percent);

        const impactRes = await fetch(`/api/escola/${escolaId}/admin/setup/impact`, {
          method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({}),
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
        if (!cancelled) setProgress(null);
      }
    }
    fetchStatus();
    return () => { cancelled = true; };
  }, [escolaId]);

  // --- HELPERS VISUAIS (KLASSE TOKENS) ---
  
  // Cores: Verde Brand (#1F6B3B), Dourado Action (#E3B23C), Slate (Neutro)
  const okTone = "bg-[#1F6B3B]/10 text-[#1F6B3B] border-[#1F6B3B]/20";
  const pendingTone = "bg-amber-50 text-amber-700 border-amber-200";
  const neutralTone = "bg-slate-50 text-slate-600 border-slate-200";

  const anoLetivoOk = setupStatus?.ano_letivo_ok && setupStatus?.periodos_ok;
  const curriculoOk = setupStatus?.curriculo_published_ok;
  const turmasOk = setupStatus?.turmas_ok;
  const estruturaMeta = estruturaCounts
    ? `Cursos: ${estruturaCounts.cursos_total ?? 0} · Classes: ${estruturaCounts.classes_total ?? 0} · Disciplinas: ${estruturaCounts.disciplinas_total ?? 0}`
    : null;

  const cardStatus = (ok?: boolean) => ok === undefined
    ? { label: null, tone: undefined }
    : ok
    ? { label: "Configurado", tone: okTone }
    : { label: "Pendente", tone: pendingTone };

  const anoLetivoAtual = new Date().getFullYear();
  
  // Métricas do Card Central
  const impactItems = [
    { label: "Cursos", value: estruturaCounts?.cursos_total ?? 0 },
    { label: "Classes", value: estruturaCounts?.classes_total ?? 0 },
    { label: "Disciplinas", value: estruturaCounts?.disciplinas_total ?? 0 },
  ];

  const pathname = usePathname();
  const safePathname = pathname ?? "/";
  const searchParams = useSearchParams();
  const panelParams = useMemo(() => Promise.resolve({ id: escolaId }), [escolaId]);

  const tabs = [
    { id: "calendario", label: "Calendário", icon: CalendarCheck, Component: CalendarioPanel },
    { id: "avaliacoes", label: "Avaliações", icon: BookOpen, Component: AvaliacoesPanel },
    { id: "turmas", label: "Turmas", icon: Users, Component: TurmasPanel },
    {
      id: "horarios",
      label: "Horários",
      icon: CalendarCheck,
      Component: () => <HorariosPanel escolaId={escolaId} />,
    },
    { id: "financeiro", label: "Financeiro", icon: Wallet, Component: FinanceiroPanel },
    { id: "fluxos", label: "Fluxos", icon: Layers, Component: FluxosPanel },
    { id: "avancado", label: "Avançado", icon: ShieldCheck, Component: AvancadoPanel },
  ];
  const activeTabId = searchParams?.get("tab") ?? tabs[0].id;
  const activeTab = tabs.find((tab) => tab.id === activeTabId) ?? tabs[0];
  const ActivePanel = activeTab.Component;

  const buildTabHref = (tabId: string) => {
    const params = new URLSearchParams(searchParams?.toString() ?? "");
    params.set("tab", tabId);
    const query = params.toString();
    return query ? `${safePathname}?${query}` : safePathname;
  };

  type SettingsCard = {
    title: string;
    desc: string;
    icon: any;
    href?: string;
    action?: () => void;
    // Removido 'color' genérico, agora usa classes diretas
    statusLabel?: string | null;
    statusTone?: string;
    meta?: string | null;
    highlight?: boolean;
    danger?: boolean;
  };

  const quickCards: SettingsCard[] = [
    {
      title: "Assistente de Setup",
      desc: "Reconfigurar ano letivo e estrutura.",
      icon: Wand2,
      action: onOpenWizard,
      statusLabel: progress !== null ? `${progress}%` : null,
      statusTone: pendingTone,
      highlight: true,
    },
    {
      title: "Oferta Formativa",
      desc: "Cursos e níveis.",
      icon: Layers,
      href: `/escola/${escolaId}/admin/configuracoes/estrutura`,
      meta: estruturaMeta,
    },
    {
      title: "Identidade",
      desc: "Logo e dados.",
      icon: Building2,
      href: `/escola/${escolaId}/admin/configuracoes/identidade`,
    },
    {
      title: "Horários",
      desc: "Slots e quadro automático.",
      icon: CalendarCheck,
      href: `/escola/${escolaId}/horarios/slots`,
    },
    {
      title: "Zona de Perigo",
      desc: "Reset de dados.",
      icon: AlertTriangle,
      href: `/escola/${escolaId}/admin/configuracoes`,
      danger: true,
    },
  ];

  return (
    <div className="max-w-[1400px] mx-auto p-8 space-y-10 bg-slate-50/50 min-h-screen">
      
      {/* HEADER PRINCIPAL */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 tracking-tight">Configurações do Sistema</h1>
          <p className="text-slate-500 mt-1">Gestão global do ano letivo {anoLetivoAtual}.</p>
        </div>
      </div>

      {/* --- CARD GIGANTE (ESTRUTURA RESTAURADA) --- */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        
        {/* Header do Card */}
        <div className="px-8 py-6 border-b border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-bold text-slate-900">Visão Geral</h2>
            <p className="text-sm text-slate-500 mt-1">Painel de controle acadêmico.</p>
          </div>
          <button
            onClick={onOpenWizard}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl border border-slate-200 bg-white text-sm font-bold text-slate-700 hover:bg-slate-50 hover:border-slate-300 transition-all shadow-sm"
          >
            Reabrir Assistente
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>

        {/* Conteúdo principal em largura total */}
        <div className="p-8 space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-[2fr_1fr] gap-4">
            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-sm font-bold text-slate-900">Impacto Atual</h3>
                  <p className="text-xs text-slate-500">Métricas em tempo real da sua estrutura.</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <span className={`text-[10px] font-bold uppercase px-2.5 py-1 rounded-full border ${cardStatus(anoLetivoOk).tone}`}>Ano Letivo</span>
                  <span className={`text-[10px] font-bold uppercase px-2.5 py-1 rounded-full border ${cardStatus(curriculoOk).tone}`}>Currículo</span>
                  <span className={`text-[10px] font-bold uppercase px-2.5 py-1 rounded-full border ${cardStatus(turmasOk).tone}`}>Turmas</span>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {impactItems.map((item) => (
                  <div key={item.label} className="bg-slate-50 p-3 rounded-xl border border-slate-200">
                    <p className="text-[10px] font-bold uppercase text-slate-400">{item.label}</p>
                    <p className="text-lg font-bold text-slate-900">{item.value}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h4 className="text-sm font-bold text-slate-900">Barra de Status</h4>
                  <p className="text-xs text-slate-500">
                    Afeta {estruturaCounts?.classes_total ?? 0} classes e {estruturaCounts?.cursos_total ?? 0} cursos ativos.
                  </p>
                </div>
                {progress !== null && (
                  <div className="text-xs font-bold text-slate-600">
                    {progress === 100 ? "Completo" : `Setup ${progress}%`}
                  </div>
                )}
              </div>

              {progress !== null && (
                <div className="mt-3">
                  <Progress value={progress} className="h-2 bg-slate-100" />
                </div>
              )}

              <div className="mt-4 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={onOpenWizard}
                  className="rounded-full border border-slate-200 px-4 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 hover:border-slate-300 transition-all"
                >
                  Salvar e Revisar
                </button>
                <Link
                  href={`/escola/${escolaId}/admin/configuracoes/sandbox`}
                  className="inline-flex items-center gap-2 rounded-full bg-slate-900 px-4 py-2 text-xs font-bold text-white hover:bg-slate-800 shadow-lg shadow-slate-900/10 transition-all"
                >
                  <Play className="w-3 h-3 fill-current" />
                  Testar Fluxo
                </Link>
              </div>
            </div>
          </div>

          <div className="rounded-xl bg-slate-950 p-4 w-full">
            <div className="rounded-lg bg-white p-4">
              <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                <div className="flex flex-wrap items-center gap-1.5 font-sora">
                  {tabs.map((tab) => {
                    const isActive = tab.id === activeTab.id;
                    return (
                      <Link
                        key={tab.id}
                        href={buildTabHref(tab.id)}
                        scroll={false}
                        className={`inline-flex items-center gap-2 rounded-full px-2.5 py-1.5 text-[11px] font-semibold transition-all border ${
                          isActive
                            ? "bg-slate-900 text-klasse-gold border-klasse-gold/40"
                            : "border-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-900/40"
                        }`}
                      >
                        <tab.icon className="h-4 w-4" />
                        {tab.label}
                      </Link>
                    );
                  })}
                </div>
                <Link
                  href={`/escola/${escolaId}/admin/configuracoes/${activeTab.id === "avaliacoes" ? "avaliacao" : activeTab.id}`}
                  className="text-[10px] font-bold text-klasse-gold hover:underline"
                >
                  Abrir em tela cheia
                </Link>
              </div>
              <div className="w-full max-h-[640px] min-h-[640px] overflow-y-auto pr-2">
                <ActivePanel params={panelParams} />
              </div>
            </div>
          </div>
        </div>
      </div>

      <div>
        <h2 className="text-sm font-bold text-slate-500 uppercase tracking-wider mb-4 ml-1">Acesso rápido</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {quickCards.map((card, idx) => (
            <div
              key={`quick-${idx}`}
              onClick={() => card.action ? card.action() : window.location.href = card.href || '#'}
              className={`
                group relative p-4 rounded-xl border cursor-pointer transition-all hover:-translate-y-0.5 hover:shadow-sm flex flex-col justify-between
                ${card.highlight 
                  ? 'bg-gradient-to-br from-[#E3B23C]/5 to-white border-[#E3B23C]/30 hover:border-[#E3B23C]' 
                  : 'bg-white border-slate-200 hover:border-slate-300'
                }
                ${card.danger ? 'border-rose-100 hover:border-rose-300' : ''}
              `}
            >
              <div>
                <div className="flex justify-between items-start mb-2">
                  <div className={`p-2 rounded-xl ${card.danger ? 'bg-rose-50 text-rose-600' : card.highlight ? 'bg-[#E3B23C] text-white' : 'bg-slate-50 text-slate-500 group-hover:text-slate-700'}`}>
                    <card.icon size={18} strokeWidth={1.5} />
                  </div>
                  {card.statusLabel ? (
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase border ${card.statusTone}`}>
                      {card.statusLabel}
                    </span>
                  ) : (
                    <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-slate-500 transition-colors" />
                  )}
                </div>
                <h3 className={`font-bold text-sm mb-1 ${card.danger ? 'text-rose-700' : 'text-slate-900'}`}>{card.title}</h3>
                <p className={`text-xs leading-relaxed ${card.danger ? 'text-rose-600/80' : 'text-slate-500'}`}>{card.desc}</p>
              </div>
              {card.meta && (
                <p className="text-[10px] text-slate-400 mt-3 pt-3 border-t border-slate-50 font-medium">
                  {card.meta}
                </p>
              )}
              {card.highlight && progress !== null && (
                <div className="mt-3">
                  <Progress value={progress} className="h-1.5 bg-slate-100" />
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
