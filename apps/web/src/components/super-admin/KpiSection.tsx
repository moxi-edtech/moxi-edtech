"use client";

import { Building2, GraduationCap, TrendingUp, Users, ArrowUpRight, ArrowDownRight } from "lucide-react";
import { motion } from "framer-motion";
import { WidgetError, WidgetSkeleton } from "@/components/super-admin/WidgetStates";

interface KpiData {
  escolas?: number;
  usuarios?: number;
  matriculas?: number;
  financeiro?: number;
}

export default function KpiSection({ data, isLoading = false }: { data?: KpiData; isLoading?: boolean }) {
  if (isLoading) return <WidgetSkeleton lines={4} />;

  if (!data) {
    return (
      <WidgetError
        title="Falha ao carregar KPIs de gestão"
        message="As métricas de gestão não foram carregadas nesta sessão."
        nextStep="Atualize o dashboard; se persistir, valide a view `vw_admin_dashboard_counts`."
      />
    );
  }

  const cards = [
    {
      title: "Escolas Ativas",
      value: (data.escolas ?? 0).toLocaleString(),
      desc: "Instituições conectadas",
      icon: Building2,
      trend: "+2.5%",
      trendUp: true,
      color: "text-klasse-green",
      bgColor: "bg-klasse-green/5",
    },
    {
      title: "Pessoas na Rede",
      value: (data.usuarios ?? 0).toLocaleString(),
      desc: "Utilizadores com acesso",
      icon: Users,
      trend: "+124",
      trendUp: true,
      color: "text-slate-950",
      bgColor: "bg-slate-50",
    },
    {
      title: "Alunos Matriculados",
      value: (data.matriculas ?? 0).toLocaleString(),
      desc: "Total no sistema",
      icon: GraduationCap,
      trend: "+4.1%",
      trendUp: true,
      color: "text-slate-950",
      bgColor: "bg-slate-50",
    },
    {
      title: "Eficiência",
      value: `${data.financeiro ?? 0}%`,
      desc: "Taxa de recebimento",
      icon: TrendingUp,
      trend: "-0.5%",
      trendUp: false,
      color: "text-klasse-green",
      bgColor: "bg-klasse-green/5",
    },
  ];

  return (
    <section className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
      {cards.map((card, idx) => (
        <motion.article
          key={card.title}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: idx * 0.1 }}
          className="group relative overflow-hidden rounded-3xl border border-slate-200 bg-white p-6 transition-all hover:border-klasse-gold/30 hover:shadow-xl hover:shadow-klasse-gold/5"
        >
          {/* Efeito Hover */}
          <div className="absolute -right-4 -top-4 h-24 w-24 rounded-full bg-slate-50 transition-transform group-hover:scale-150" />

          <div className="relative z-10">
            <div className="flex items-start justify-between">
              <div className={`flex h-12 w-12 items-center justify-center rounded-2xl ${card.bgColor} ${card.color}`}>
                <card.icon className="h-6 w-6" />
              </div>

              <div className={`flex items-center gap-1 rounded-full px-2 py-1 text-[10px] font-bold ${
                card.trendUp ? "bg-emerald-50 text-emerald-600" : "bg-rose-50 text-rose-600"
              }`}>
                {card.trendUp ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
                {card.trend}
              </div>
            </div>

            <div className="mt-5">
              <p className="text-[10px] font-black uppercase tracking-[0.15em] text-slate-400">{card.title}</p>
              <div className="mt-1 flex items-baseline gap-2">
                <h3 className={`text-3xl font-black tracking-tight ${card.color}`}>{card.value}</h3>
              </div>
              <p className="mt-2 text-xs font-medium text-slate-500">{card.desc}</p>
            </div>
            
            {/* Mini Sparkline Placeholder */}
            <div className="mt-4 flex h-1 items-center gap-1 overflow-hidden rounded-full bg-slate-100">
              <motion.div 
                initial={{ width: 0 }}
                animate={{ width: "60%" }}
                transition={{ duration: 1, delay: 0.5 + idx * 0.1 }}
                className={`h-full rounded-full ${card.trendUp ? "bg-emerald-500" : "bg-rose-500"}`} 
              />
            </div>
          </div>
        </motion.article>
      ))}
    </section>
  );
}
