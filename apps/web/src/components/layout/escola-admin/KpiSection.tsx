// apps/web/src/components/layout/escola-admin/KpiSection.tsx
"use client";

import Link from "next/link";
import { 
  UsersRound, // Turmas
  Users,      // Alunos
  UserCheck,  // Professores (Substituindo GraduationCap)
  Wallet,     // Financeiro
  ArrowRight,
  AlertCircle 
} from "lucide-react";
import type { SetupStatus } from "./setupStatus";

export type KpiStats = {
  turmas: number;
  alunos: number;
  professores: number;
  avaliacoes: number;
  financeiro?: number;
};

type Props = {
  escolaId: string;
  stats: KpiStats;
  loading?: boolean;
  error?: string | null;
  setupStatus: SetupStatus;
  financeiroHref?: string;
};

export default function KpiSection({
  escolaId,
  stats,
  loading = false,
  error,
  setupStatus,
  financeiroHref,
}: Props) {
  
  // Tratamento de Erro (Clean)
  if (error) {
    return (
      <div className="flex items-center gap-2 p-4 text-sm text-red-600 bg-red-50 rounded-xl border border-red-100 font-medium">
        <AlertCircle className="w-4 h-4" />
        Não foi possível carregar os indicadores.
      </div>
    );
  }

  const safeStats: KpiStats = stats ?? { turmas: 0, alunos: 0, professores: 0, avaliacoes: 0 };
  const getHref = (path: string) => `/escola/${escolaId}/admin/${path}`;
  const { turmasOk } = setupStatus;

  const kpis = [
    {
      title: "Turmas",
      value: safeStats.turmas,
      icon: UsersRound, // Icon token correto
      status: turmasOk ? "Ativas" : "Estrutura",
      href: getHref("turmas"),
      disabled: false, 
    },
    {
      title: "Alunos",
      value: safeStats.alunos,
      icon: Users, // Icon token correto
      status: turmasOk ? "Matriculados" : "Aguardando",
      href: getHref("alunos"),
      disabled: !turmasOk,
    },
    {
      title: "Professores",
      value: safeStats.professores,
      icon: UserCheck, // Icon token correto
      status: turmasOk ? "Docentes" : "Pendente",
      href: getHref("professores"),
      disabled: !turmasOk,
    },
    {
      title: "Financeiro", // Alterado título para consistência
      value: (safeStats.financeiro ?? 0) + "%",
      icon: Wallet,
      status: turmasOk ? "Arrecadação" : "Configurar",
      href: financeiroHref ?? getHref("financeiro"),
      disabled: !turmasOk,
    },
  ] as const;

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4 font-sora">
      {kpis.map((item) => {
        const Icon = item.icon;
        
        // Se estiver disabled, bloqueia clique, mas mantém visual clean (não "quebrado")
        const Component = item.disabled ? 'div' : Link;

        return (
          <Component
            key={item.title}
            href={item.href}
            className={`
              group relative flex flex-col justify-between overflow-hidden rounded-xl bg-white p-5 shadow-sm border border-slate-200 transition-all duration-200
              ${!item.disabled ? 'hover:border-[#E3B23C]/50 hover:shadow-md cursor-pointer' : 'opacity-75 cursor-default bg-slate-50/50'}
            `}
          >
            <div className="flex items-start justify-between">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  {item.title}
                </p>
                
                <div className="mt-1.5 flex items-baseline gap-2">
                  {loading ? (
                    <div className="h-8 w-16 bg-slate-100 animate-pulse rounded-md" />
                  ) : (
                    <span className="text-2xl font-bold text-slate-900 tracking-tight">
                      {item.value}
                    </span>
                  )}
                </div>

                {/* Badge Status */}
                <span className={`
                    mt-2 inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wide border
                    ${item.disabled 
                        ? 'bg-slate-100 text-slate-400 border-slate-200' 
                        : 'bg-[#1F6B3B]/5 text-[#1F6B3B] border-[#1F6B3B]/10'} 
                `}>
                  {item.status}
                </span>
              </div>

              {/* Icon Container */}
              <div className={`
                p-2.5 rounded-xl transition-colors
                ${item.disabled 
                    ? 'bg-slate-100 text-slate-300' 
                    : 'bg-slate-50 text-slate-400 group-hover:text-[#E3B23C] group-hover:bg-[#E3B23C]/10'}
              `}>
                <Icon size={20} />
              </div>
            </div>

            {/* Footer Action (Só aparece se ativo e não loading) */}
            {!item.disabled && !loading && (
              <div className="mt-4 flex items-center text-[10px] font-bold text-slate-400 group-hover:text-slate-600 transition-colors">
                Gerenciar <ArrowRight className="ml-1 h-3 w-3 transition-transform group-hover:translate-x-1" />
              </div>
            )}
          </Component>
        );
      })}
    </div>
  );
}
