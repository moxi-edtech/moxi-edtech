"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation"; // Correção: useParams é de next/navigation
import { 
  CalendarDays, 
  GraduationCap, 
  Users, 
  Wallet, 
  Workflow, 
  Settings2, 
  CheckCircle2, 
  Circle, 
  ArrowRight,
  AlertTriangle,
  LayoutDashboard
} from "lucide-react";
import ConfigSystemShell from "@/components/escola/settings/ConfigSystemShell";
import { buildConfigMenuItems } from "../_shared/menuItems";

// --- TYPES ---
type SetupState = {
  stage: string;
  next_action?: { label: string; href: string };
  blockers?: Array<{ title: string; detail: string; severity: string }>;
  badges?: {
    calendario?: boolean;
    avaliacao?: boolean;
    turmas?: boolean;
    financeiro?: boolean;
    fluxos?: boolean;
    sistema?: boolean;
  };
  completion_percent: number;
};

type ImpactData = {
  counts?: {
    alunos_afetados?: number;
    turmas_afetadas?: number;
    professores_afetados?: number;
  };
};

export default function SistemaConfiguracoesPage() {
  const params = useParams() as { id?: string };
  const escolaId = params?.id;
  const base = escolaId ? `/escola/${escolaId}/admin/configuracoes` : "";

  // --- MENU CONFIG ---
  const modules = useMemo(() => [
    {
      key: "calendario",
      label: "Calendário Acadêmico",
      desc: "Defina os trimestres, feriados e datas de bloqueio.",
      href: `${base}/calendario`,
      icon: CalendarDays,
    },
    {
      key: "avaliacao",
      label: "Avaliação & Notas",
      desc: "Pesos, fórmulas de cálculo e regras de aprovação.",
      href: `${base}/avaliacao`,
      icon: GraduationCap,
    },
    {
      key: "turmas",
      label: "Turmas & Currículo",
      desc: "Gere as turmas a partir da grade curricular.",
      href: `${base}/turmas`,
      icon: Users,
    },
    {
      key: "financeiro",
      label: "Financeiro",
      desc: "Tabela de preços, multas e datas de vencimento.",
      href: `${base}/financeiro`,
      icon: Wallet,
    },
    {
      key: "fluxos",
      label: "Fluxos de Aprovação",
      desc: "Quem aprova as notas antes do boletim sair?",
      href: `${base}/fluxos`,
      icon: Workflow,
    },
    {
      key: "avancado",
      label: "Avançado",
      desc: "Logs de auditoria e configurações perigosas.",
      href: `${base}/avancado`,
      icon: Settings2,
    },
  ], [base]);

  // --- STATE ---
  const [setupState, setSetupState] = useState<SetupState | null>(null);
  const [impact, setImpact] = useState<ImpactData | null>(null);
  const [loading, setLoading] = useState(true);

  // --- FETCH ---
  useEffect(() => {
    if (!escolaId) return;
    const load = async () => {
      try {
        // Fetch Setup State
        const stateRes = await fetch(`/api/escola/${escolaId}/admin/setup/state`, { cache: "no-store" });
        const stateJson = await stateRes.json().catch(() => null);
        
        if (stateRes.ok && stateJson?.data) {
          const badges = stateJson.data.badges || {};
          const total = modules.length;
          const done = Object.values(badges).filter(Boolean).length;
          const percent = Math.round((done / total) * 100);
          
          setSetupState({ ...stateJson.data, completion_percent: percent });
        }

        // Fetch Impacto
        const impactRes = await fetch(`/api/escola/${escolaId}/admin/setup/impact`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({}),
        });
        const impactJson = await impactRes.json().catch(() => null);
        if (impactRes.ok && impactJson?.ok) setImpact(impactJson.data);

      } finally {
        setLoading(false);
      }
    };
    load();
  }, [escolaId, modules.length]);

  const blockersList = setupState?.blockers?.map((b) => `${b.severity === 'critical' ? '🔴' : '⚠️'} ${b.title}`) ?? [];

  return (
    <ConfigSystemShell
      escolaId={escolaId ?? ""}
      title="Configurações do Sistema"
      subtitle="Painel de Controle do Ano Letivo."
      menuItems={buildConfigMenuItems(base)}
      nextHref={`${base}/calendario`}
      testHref={`${base}/sandbox`}
      statusItems={blockersList.length > 0 ? blockersList : ["Sistema Operante"]}
      impact={{
        alunos: impact?.counts?.alunos_afetados,
        turmas: impact?.counts?.turmas_afetadas,
        professores: impact?.counts?.professores_afetados,
      }}
      saveDisabled={true} 
    >
      <div className="space-y-8">
        
        {/* HERO CARD: STATUS GERAL */}
        <div className="relative overflow-hidden rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between relative z-10">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <div className="rounded-lg bg-slate-900 p-2 text-white">
                  <LayoutDashboard className="h-5 w-5" />
                </div>
                <h2 className="text-xl font-bold text-slate-900">
                  {setupState?.completion_percent === 100 ? "Escola Pronta para Decolar! 🚀" : "Vamos configurar sua escola"}
                </h2>
              </div>
              <p className="text-sm text-slate-500 max-w-lg">
                Siga as etapas abaixo para garantir que o ano letivo comece sem erros. 
                Cada módulo completado libera novas funcionalidades.
              </p>
            </div>
            
            {/* Progress Circle/Bar */}
            <div className="flex items-center gap-5 min-w-[200px]">
              <div className="text-right flex-1">
                <span className="block text-3xl font-bold text-slate-900">
                  {setupState?.completion_percent ?? 0}%
                </span>
                <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Concluído</span>
              </div>
              {/* Visual Bar Vertical */}
              <div className="h-16 w-3 rounded-full bg-slate-100 overflow-hidden">
                <div 
                  className="w-full rounded-full bg-[#E3B23C] shadow-[0_0_10px_rgba(227,178,60,0.5)] transition-all duration-1000 ease-out"
                  style={{ height: `${setupState?.completion_percent ?? 0}%`, marginTop: `${100 - (setupState?.completion_percent ?? 0)}%` }} 
                />
              </div>
            </div>
          </div>
          
          {/* Background decoration */}
          <div className="absolute top-0 right-0 h-full w-32 bg-gradient-to-l from-slate-50 to-transparent pointer-events-none" />
        </div>

        {/* ALERTA DE NEXT ACTION (Próximo Passo) */}
        {setupState?.next_action && (
          <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 p-4 shadow-sm ring-1 ring-slate-200/50">
            <div className="flex items-center gap-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-200 text-slate-600">
                <ArrowRight className="h-5 w-5" />
              </div>
              <div>
                <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Sugestão do Sistema</p>
                <p className="text-sm font-semibold text-slate-900">
                  Próximo passo: <span className="text-[#1F6B3B]">{setupState.next_action.label}</span>
                </p>
              </div>
            </div>
            <a 
              href={setupState.next_action.href}
              className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-4 py-2 text-xs font-bold text-white shadow-sm hover:bg-slate-800 transition-colors"
            >
              Continuar Configuração
              <ArrowRight className="h-3 w-3" />
            </a>
          </div>
        )}

        {/* BLOCKERS (Erros Críticos) */}
        {setupState?.blockers && setupState.blockers.length > 0 && (
          <div className="rounded-xl border border-red-100 bg-red-50/50 p-4">
            <div className="flex items-start gap-3">
              <AlertTriangle className="h-5 w-5 text-red-600 mt-0.5" />
              <div>
                <h3 className="text-sm font-bold text-red-900">Atenção Necessária</h3>
                <ul className="mt-2 space-y-1">
                  {setupState.blockers.map((blocker, idx) => (
                    <li key={idx} className="text-xs text-red-700 flex items-center gap-2">
                      <span className="h-1.5 w-1.5 rounded-full bg-red-500" />
                      <span className="font-semibold">{blocker.title}:</span> {blocker.detail}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        )}

        {/* GRID DE MÓDULOS */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {modules.map((mod) => {
            const isDone = setupState?.badges?.[mod.key as keyof typeof setupState.badges];
            
            return (
              <a 
                key={mod.key} 
                href={mod.href}
                className={`group relative flex flex-col justify-between overflow-hidden rounded-xl border p-6 transition-all hover:shadow-md hover:-translate-y-0.5 ${
                  isDone 
                    ? "border-[#1F6B3B]/20 bg-[#1F6B3B]/5" // Estilo "Done" (Verde Brand)
                    : "border-slate-200 bg-white hover:border-[#E3B23C]/50" // Estilo "Pending" (Hover Gold)
                }`}
              >
                <div>
                  <div className="flex items-start justify-between mb-4">
                    <div className={`rounded-lg p-3 transition-colors ${
                      isDone 
                        ? "bg-[#1F6B3B]/10 text-[#1F6B3B]" 
                        : "bg-slate-100 text-slate-500 group-hover:bg-[#E3B23C]/10 group-hover:text-[#E3B23C]"
                    }`}>
                      <mod.icon className="h-6 w-6" strokeWidth={1.5} />
                    </div>
                    {isDone ? (
                      <CheckCircle2 className="h-5 w-5 text-[#1F6B3B]" />
                    ) : (
                      <Circle className="h-5 w-5 text-slate-200 group-hover:text-slate-300" />
                    )}
                  </div>
                  
                  <h3 className={`font-bold transition-colors ${isDone ? "text-[#1F6B3B]" : "text-slate-900 group-hover:text-[#E3B23C]"}`}>
                    {mod.label}
                  </h3>
                  <p className="mt-2 text-xs text-slate-500 leading-relaxed">
                    {mod.desc}
                  </p>
                </div>

                <div className={`mt-6 flex items-center gap-1 text-xs font-bold uppercase tracking-wider transition-colors ${
                  isDone ? "text-[#1F6B3B]" : "text-slate-400 group-hover:text-[#E3B23C]"
                }`}>
                  {isDone ? "Revisar" : "Configurar"} 
                  <ArrowRight className="h-3 w-3 transition-transform group-hover:translate-x-1" />
                </div>
              </a>
            );
          })}
        </div>

      </div>
    </ConfigSystemShell>
  );
}
