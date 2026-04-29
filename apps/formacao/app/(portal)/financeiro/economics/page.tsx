import { redirect } from "next/navigation";
import { getFormacaoAuthContext } from "@/lib/auth-context";
import { resolveFormacaoSessionContext } from "@/lib/session-context";
import { supabaseServer } from "@/lib/supabaseServer";
import { TrendingUp, Users, Target, Clock, ArrowUpRight, ArrowDownRight, BarChart3, PieChart } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function CohortEconomicsPage() {
  const auth = await getFormacaoAuthContext();
  if (!auth) redirect("/login");

  if (!["formacao_admin", "formacao_financeiro", "super_admin", "global_admin"].includes(String(auth.role))) {
    redirect("/forbidden");
  }

  const session = await resolveFormacaoSessionContext();
  const escolaId = session?.tenantId ?? null;

  let cohorts: any[] = [];
  let courses: any[] = [];

  if (escolaId) {
    const s = await supabaseServer();
    const [cohortsRes, coursesRes] = await Promise.all([
      s.from("vw_formacao_cohort_economics").select("*").order("margem_liquida", { ascending: false }),
      s.from("vw_formacao_course_economics").select("*").order("margem_liquida", { ascending: false })
    ]);

    cohorts = cohortsRes.data ?? [];
    courses = coursesRes.data ?? [];
  }

  const formatCurrency = (val: number) =>
    new Intl.NumberFormat("pt-AO", {
      style: "currency",
      currency: "AOA",
      maximumFractionDigits: 0
    }).format(val);

  const totalReceita = cohorts.reduce((acc, c) => acc + Number(c.receita_total), 0);
  const totalMarketing = cohorts.reduce((acc, c) => acc + Number(c.custo_marketing), 0);
  const totalMargemLiquida = cohorts.reduce((acc, c) => acc + Number(c.margem_liquida), 0);
  const avgCAC = cohorts.length > 0 ? totalMarketing / cohorts.reduce((acc, c) => acc + Number(c.inscritos_pagos), 0) : 0;
  const avgROI = totalMarketing > 0 ? (totalMargemLiquida / totalMarketing) * 100 : 0;

  return (
    <div className="space-y-8 pb-12">
      <header className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex items-center gap-3 mb-2">
            <div className="h-10 w-10 rounded-xl bg-klasse-gold/10 flex items-center justify-center text-klasse-gold">
                <BarChart3 size={20} />
            </div>
            <div>
                <p className="m-0 text-[10px] font-black uppercase tracking-widest text-slate-500">Inteligência Financeira</p>
                <h1 className="m-0 text-2xl font-black tracking-tight text-slate-900">Cohort Economics</h1>
            </div>
        </div>
        <p className="mt-2 max-w-2xl text-sm text-slate-600 font-medium">
          Análise de rentabilidade por edição, custos de aquisição e eficiência de conversão do funil de vendas.
        </p>
      </header>

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <SummaryCard 
            title="Margem Líquida Total" 
            value={formatCurrency(totalMargemLiquida)} 
            icon={<TrendingUp size={18}/>}
            subtitle="Receita - (Honorários + Marketing)"
            trend={totalMargemLiquida > 0 ? "up" : "down"}
        />
        <SummaryCard 
            title="CAC Médio" 
            value={formatCurrency(avgCAC)} 
            icon={<Target size={18}/>}
            subtitle="Custo de aquisição por aluno pago"
        />
        <SummaryCard 
            title="ROI Médio" 
            value={`${avgROI.toFixed(1)}%`} 
            icon={<PieChart size={18}/>}
            subtitle="Retorno sobre investimento marketing"
            trend={avgROI > 0 ? "up" : "down"}
        />
        <SummaryCard 
            title="Receita Agregada" 
            value={formatCurrency(totalReceita)} 
            icon={<Users size={18}/>}
            subtitle="Volume bruto faturado"
        />
      </section>

      <div className="grid gap-6 lg:grid-cols-[1fr_0.4fr]">
        <article className="rounded-3xl border border-slate-200 bg-white shadow-sm overflow-hidden">
            <div className="p-6 border-b border-slate-100 flex items-center justify-between">
                <h2 className="text-lg font-bold text-slate-900">Performance por Cohort</h2>
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{cohorts.length} Edições Ativas</span>
            </div>
            <div className="overflow-x-auto">
                <table className="w-full border-collapse text-left">
                    <thead>
                        <tr className="bg-slate-50/50">
                            <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400">Edição / Curso</th>
                            <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400">Alunos</th>
                            <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400">CAC</th>
                            <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400">ROI</th>
                            <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400">Margem Liq.</th>
                            <th className="px-6 py-4 text-right text-[10px] font-black uppercase tracking-widest text-slate-400 text-right">Conversão</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                        {cohorts.map((c) => (
                            <tr key={c.cohort_id} className="hover:bg-slate-50/50 transition-colors">
                                <td className="px-6 py-4">
                                    <p className="text-sm font-bold text-slate-900">{c.cohort_nome}</p>
                                    <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-tight">{c.curso_nome}</p>
                                </td>
                                <td className="px-6 py-4">
                                    <div className="flex items-center gap-1.5">
                                        <span className="text-sm font-bold text-slate-700">{c.inscritos_pagos}</span>
                                        <span className="text-xs text-slate-300">/ {c.inscritos_total}</span>
                                    </div>
                                </td>
                                <td className="px-6 py-4">
                                    <span className="text-sm font-semibold text-slate-600">{formatCurrency(c.cac)}</span>
                                </td>
                                <td className="px-6 py-4">
                                    {c.roi_percentual !== null ? (
                                        <span className={`inline-flex items-center rounded-lg px-2 py-1 text-[11px] font-black ${
                                            c.roi_percentual > 100 ? "bg-emerald-50 text-emerald-600" : 
                                            c.roi_percentual > 0 ? "bg-blue-50 text-blue-600" : "bg-rose-50 text-rose-600"
                                        }`}>
                                            {c.roi_percentual}%
                                        </span>
                                    ) : <span className="text-slate-300">—</span>}
                                </td>
                                <td className="px-6 py-4">
                                    <p className="text-sm font-bold text-slate-900">{formatCurrency(c.margem_liquida)}</p>
                                </td>
                                <td className="px-6 py-4 text-right">
                                    <div className="flex flex-col items-end">
                                        <span className="text-xs font-bold text-slate-700 flex items-center gap-1">
                                            <Clock size={12} className="text-slate-400" />
                                            {c.avg_horas_conversao > 0 ? `${c.avg_horas_conversao}h` : "N/A"}
                                        </span>
                                        <p className="text-[10px] text-slate-400 font-medium">Inscrição → Pago</p>
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </article>

        <article className="rounded-3xl border border-slate-200 bg-white shadow-sm overflow-hidden flex flex-col">
            <div className="p-6 border-b border-slate-100">
                <h2 className="text-lg font-bold text-slate-900">Top Cursos</h2>
                <p className="text-xs text-slate-500 font-medium">Rentabilidade acumulada por produto.</p>
            </div>
            <div className="p-2 space-y-1">
                {courses.map((course) => (
                    <div key={course.curso_nome} className="p-4 rounded-2xl hover:bg-slate-50 transition-all group">
                        <div className="flex items-center justify-between mb-2">
                            <span className="text-xs font-black text-slate-400 uppercase tracking-widest">{course.curso_nome}</span>
                            <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full">{course.total_cohorts} cohorts</span>
                        </div>
                        <div className="flex items-end justify-between">
                            <div>
                                <p className="text-lg font-black text-slate-900 leading-tight">{formatCurrency(course.margem_liquida)}</p>
                                <p className="text-[10px] font-semibold text-slate-400 mt-0.5">ROI Médio: {course.avg_roi_percentual ?? 0}%</p>
                            </div>
                            <div className="h-8 w-8 rounded-lg bg-slate-50 flex items-center justify-center text-slate-300 group-hover:bg-klasse-gold/10 group-hover:text-klasse-gold transition-colors">
                                <ArrowUpRight size={18} />
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        </article>
      </div>
    </div>
  );
}

function SummaryCard({ title, value, icon, subtitle, trend }: { title: string, value: string, icon: React.ReactNode, subtitle: string, trend?: "up" | "down" }) {
    return (
        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm hover:shadow-md transition-all">
            <div className="flex items-center justify-between mb-4">
                <div className="h-10 w-10 rounded-2xl bg-slate-50 flex items-center justify-center text-slate-400">
                    {icon}
                </div>
                {trend && (
                    <span className={`h-6 w-6 rounded-full flex items-center justify-center ${trend === "up" ? "bg-emerald-50 text-emerald-600" : "bg-rose-50 text-rose-600"}`}>
                        {trend === "up" ? <ArrowUpRight size={14}/> : <ArrowDownRight size={14}/>}
                    </span>
                )}
            </div>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.15em] mb-1">{title}</p>
            <h3 className="text-2xl font-black text-slate-900 mb-1">{value}</h3>
            <p className="text-[10px] font-semibold text-slate-500 leading-relaxed">{subtitle}</p>
        </div>
    )
}
