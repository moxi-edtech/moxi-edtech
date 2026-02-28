// apps/web/src/components/super-admin/KpiSection.tsx
"use client"

import { Building2, Users, GraduationCap, TrendingUp } from "lucide-react"

interface KpiData {
  escolas?: number
  usuarios?: number
  matriculas?: number
  financeiro?: number
}

export default function KpiSection({ data }: { data?: KpiData }) {
  const cards = [
    { 
      title: "Escolas Ativas", 
      value: (data?.escolas ?? 12).toLocaleString(), 
      desc: "Instituições conectadas",
      icon: Building2,
      color: "text-[#1F6B3B]",
      bg: "bg-[#1F6B3B]/5"
    },
    { 
      title: "Pessoas na Rede", 
      value: (data?.usuarios ?? 230).toLocaleString(), 
      desc: "Utilizadores com acesso",
      icon: Users,
      color: "text-[#E3B23C]",
      bg: "bg-[#E3B23C]/5"
    },
    { 
      title: "Alunos Matriculados", 
      value: (data?.matriculas ?? 1245).toLocaleString(), 
      desc: "Total agregado no sistema",
      icon: GraduationCap,
      color: "text-slate-900",
      bg: "bg-slate-100"
    },
    { 
      title: "Saúde Financeira", 
      value: `${data?.financeiro ?? 87}%`, 
      desc: "Taxa de pagamentos",
      icon: TrendingUp,
      color: "text-[#1F6B3B]",
      bg: "bg-[#1F6B3B]/10"
    },
  ]

  return (
    <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
      {cards.map((card, i) => (
        <div
          key={i}
          className="group relative bg-white p-8 rounded-[2rem] border border-slate-200/60 shadow-[0_8px_30px_rgb(0,0,0,0.04)] hover:shadow-[0_20px_40px_rgba(0,0,0,0.06)] transition-all duration-300 hover:-translate-y-1 overflow-hidden"
        >
          <div className="relative flex flex-col h-full">
            <div className={`h-12 w-12 rounded-2xl ${card.bg} ${card.color} flex items-center justify-center mb-6`}>
              <card.icon size={24} strokeWidth={2} />
            </div>
            
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-1">
                {card.title}
              </p>
              <div className="flex items-baseline gap-1">
                <span className={`text-3xl font-bold tracking-tight ${card.color}`}>
                  {card.value}
                </span>
              </div>
              <p className="text-[11px] font-medium text-slate-400 mt-2">
                {card.desc}
              </p>
            </div>
          </div>
        </div>
      ))}
    </section>
  )
}
