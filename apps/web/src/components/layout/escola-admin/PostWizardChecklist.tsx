"use client";

import { useMemo } from "react";
import { 
  Check, 
  Users, 
  ShieldCheck, 
  ArrowRight, 
  School,
  Banknote,
  FileText
} from "lucide-react";
import Link from "next/link";
import { motion } from "framer-motion";
import { useEscolaId } from "@/hooks/useEscolaId";

type SetupStatus = {
  anoLetivoOk: boolean;
  periodosOk: boolean;
  avaliacaoFrequenciaOk: boolean;
  curriculoOk: boolean;
  turmasOk: boolean;
  setupComplete: boolean;
};

type Props = {
  setupStatus: SetupStatus;
  stats: {
    alunos: number;
    professores: number;
    turmas: number;
  };
  missingPricingCount: number;
};

export default function PostWizardChecklist({ setupStatus, stats, missingPricingCount }: Props) {
  const { escolaSlug, escolaId } = useEscolaId();
  // Garante que não usamos a string "null" como ID
  const escolaParam = (escolaSlug && escolaSlug !== "null") ? escolaSlug : (escolaId !== "null" ? (escolaId || null) : null);

  const steps = useMemo(() => {
    if (!escolaParam) return [];
    
    return [
      {
        id: "academico",
        title: "Estrutura Académica",
        description: "Ano letivo, períodos e currículo base.",
        completed: setupStatus.setupComplete,
        current: !setupStatus.setupComplete,
        href: `/escola/${escolaParam}/configuracoes/onboarding`,
        icon: School,
      },
      {
        id: "financeiro",
        title: "Preçário & IBAN",
        description: "Definir valores de propinas e coordenadas.",
        completed: missingPricingCount === 0 && setupStatus.setupComplete,
        current: setupStatus.setupComplete && missingPricingCount > 0,
        href: `/escola/${escolaParam}/admin/configuracoes/mensalidades`,
        icon: Banknote,
      },
      {
        id: "professores",
        title: "Equipa Docente",
        description: "Convidar professores para o portal.",
        completed: stats.professores > 0,
        current: setupStatus.setupComplete && stats.professores === 0,
        href: `/escola/${escolaParam}/admin/usuarios`,
        icon: ShieldCheck,
      },
      {
        id: "alunos",
        title: "Primeiros Alunos",
        description: "Importar lista ou abrir inscrições.",
        completed: stats.alunos > 0,
        current: setupStatus.setupComplete && stats.professores > 0 && stats.alunos === 0,
        href: `/escola/${escolaParam}/admin/alunos`,
        icon: Users,
      },
      {
        id: "fiscal",
        title: "Configuração Fiscal",
        description: "Regime de IVA e dados para facturação.",
        completed: false, 
        current: stats.alunos > 0,
        href: `/escola/${escolaParam}/admin/configuracoes/identidade`,
        icon: FileText,
      }
    ];
  }, [setupStatus, stats, missingPricingCount, escolaParam]);

  const totalSteps = steps.length;
  const completedSteps = steps.filter(s => s.completed).length;
  const progressPct = totalSteps > 0 ? Math.round((completedSteps / totalSteps) * 100) : 0;

  // Não renderiza se o contexto não estiver pronto ou se tudo estiver concluído
  if (!escolaParam || totalSteps === 0 || completedSteps === totalSteps) return null;

  return (
    <section className="space-y-4 animate-in fade-in duration-500">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
            Ativação da Escola
          </h3>
          <p className="text-xs text-slate-500 mt-0.5">
            Conclua estas etapas para operar a 100%.
          </p>
        </div>
        <div className="text-right">
          <span className="text-lg font-black text-brand-900">{progressPct}%</span>
          <div className="w-24 h-1.5 bg-slate-100 rounded-full mt-1 overflow-hidden border border-slate-200">
            <motion.div 
              initial={{ width: 0 }}
              animate={{ width: `${progressPct}%` }}
              className="h-full bg-[#1F6B3B]"
            />
          </div>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1">
        {steps.map((step) => (
          <Link 
            key={step.id} 
            href={step.href}
            className={`
              group relative flex items-center gap-4 p-4 rounded-2xl border transition-all
              ${step.completed 
                ? 'bg-slate-50/50 border-slate-100 opacity-75' 
                : step.current
                ? 'bg-white border-brand-200 shadow-sm ring-1 ring-brand-100 hover:shadow-md'
                : 'bg-white border-slate-200 opacity-60 hover:opacity-100'
              }
            `}
          >
            <div className={`
              w-10 h-10 rounded-xl flex items-center justify-center shrink-0 transition-colors
              ${step.completed 
                ? 'bg-klasse-green-100 text-klasse-green-600' 
                : step.current
                ? 'bg-brand-50 text-brand-900 group-hover:bg-[#1F6B3B] group-hover:text-white'
                : 'bg-slate-100 text-slate-400'
              }
            `}>
              {step.completed ? <Check className="w-5 h-5" /> : <step.icon className="w-5 h-5" />}
            </div>
            
            <div className="flex-1 min-w-0">
              <h4 className={`text-sm font-bold truncate ${step.completed ? 'text-slate-500 line-through' : 'text-slate-900'}`}>
                {step.title}
              </h4>
              <p className="text-[11px] text-slate-500 truncate leading-tight mt-0.5">
                {step.description}
              </p>
            </div>

            {step.current && (
              <div className="w-7 h-7 rounded-full bg-[#1F6B3B] text-white flex items-center justify-center shadow-sm group-hover:translate-x-0.5 transition-transform">
                <ArrowRight className="w-3.5 h-3.5" />
              </div>
            )}
          </Link>
        ))}
      </div>
    </section>
  );
}
