"use client";

import Link from "next/link";
import { Building2, Users, GraduationCap, FileBarChart2, ArrowRight, Wallet } from "lucide-react";

export type KpiStats = {
  turmas: number;
  alunos: number;
  professores: number;
  avaliacoes: number;
  financeiro?: number; // Ex: % de pagamentos
};

interface KpiSectionProps {
  escolaId?: string;
  stats?: KpiStats;
  loading?: boolean;
  error?: string | null;
  onboardingComplete?: boolean; // Define se mostramos dados reais ou placeholders
}

export default function KpiSection({ 
  escolaId, 
  stats, 
  loading, 
  error, 
  onboardingComplete = false 
}: KpiSectionProps) {

  const safeStats: KpiStats = stats ?? { turmas: 0, alunos: 0, professores: 0, avaliacoes: 0 };

  // Função auxiliar para gerar links
  const getHref = (path: string) => escolaId ? `/escola/${escolaId}/admin/${path}` : '#';

  // Configuração dos KPIs
  const kpis = [
    {
      title: "Turmas Criadas",
      // Se carregando: tralha. Se onboarding completo: valor real. Se não: valor do setup (ex: 12)
      value: loading ? "—" : (onboardingComplete ? safeStats.turmas : 12),
      icon: Building2,
      theme: "blue",
      status: onboardingComplete ? "Ativas" : "Estrutura Pronta",
      href: getHref("turmas"),
    },
    {
      title: "Alunos",
      value: loading ? "—" : (onboardingComplete ? safeStats.alunos : 0),
      icon: Users,
      theme: "emerald",
      // Lógica visual crítica: Se não tem onboarding, mostra alerta
      status: onboardingComplete ? "Matriculados" : "A aguardar importação",
      isPending: !onboardingComplete, 
      href: getHref("alunos"),
    },
    {
      title: "Professores",
      value: loading ? "—" : (onboardingComplete ? safeStats.professores : 0),
      icon: GraduationCap,
      theme: "orange",
      status: onboardingComplete ? "Contratados" : "Pendente",
      isPending: !onboardingComplete,
      href: getHref("professores"),
    },
    {
      title: "Pagamentos",
      value: loading ? "—" : (onboardingComplete ? "98%" : "0%"),
      icon: Wallet,
      theme: "purple",
      status: onboardingComplete ? "Em dia" : "Configurar",
      isPending: !onboardingComplete,
      href: getHref("financeiro"),
    },
  ];

  // Mapas de cores (Design System)
  const styles: Record<string, string> = {
    blue: "bg-blue-50 text-blue-600 ring-blue-100",
    emerald: "bg-emerald-50 text-emerald-600 ring-emerald-100",
    orange: "bg-orange-50 text-orange-600 ring-orange-100",
    purple: "bg-purple-50 text-purple-600 ring-purple-100",
  };

  if (error) return (
    <div className="p-4 text-sm text-red-600 bg-red-50 rounded-xl border border-red-100">
      Não foi possível carregar os indicadores.
    </div>
  );

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {kpis.map((item, idx) => {
        const themeClass = styles[item.theme];
        
        return (
          <Link 
            key={idx} 
            href={item.href}
            className={`
              group relative flex flex-col justify-between overflow-hidden rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200 transition-all 
              hover:-translate-y-1 hover:shadow-md
              ${item.isPending ? "opacity-70 grayscale-[0.5]" : "opacity-100"}
            `}
          >
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-slate-400">{item.title}</p>
                <div className="mt-2 flex items-baseline gap-2">
                  <span className="text-2xl font-black text-slate-800">
                    {item.value}
                  </span>
                </div>
                
                {/* Status Badge */}
                <span className={`
                  mt-2 inline-block rounded-md px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide
                  ${item.isPending 
                    ? "bg-slate-100 text-slate-500" 
                    : "bg-teal-50 text-teal-700"}
                `}>
                  {item.status}
                </span>
              </div>

              <div className={`rounded-xl p-3 ring-1 ${themeClass}`}>
                <item.icon className="h-6 w-6" />
              </div>
            </div>
            
            {/* Hover Action */}
            {!item.isPending && (
              <div className="mt-4 flex items-center text-xs font-medium text-slate-400 group-hover:text-slate-600">
                Ver detalhes <ArrowRight className="ml-1 h-3 w-3 transition-transform group-hover:translate-x-1" />
              </div>
            )}
          </Link>
        );
      })}
    </div>
  );
}
