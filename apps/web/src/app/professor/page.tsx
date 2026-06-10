"use client";

import AssignmentsBanner from "@/components/professor/AssignmentsBanner";
import { DashboardHeader } from "@/components/layout/DashboardHeader";
import { useEscolaId } from "@/hooks/useEscolaId";
import { buildPortalHref, getEscolaParamFromPath } from "@/lib/navigation";
import { formatTurmaDisplayName } from "@/utils/formatters";
import { ClipboardDocumentListIcon, PencilSquareIcon, MapIcon, BookOpenIcon } from "@heroicons/react/24/outline";
import Link from "next/link";
import { usePathname } from "next/navigation";
import React, { useEffect, useMemo, useState } from "react";

type AtribItem = {
  turma: { id: string; nome: string | null };
  disciplina: { id: string | null; nome: string | null };
};

type AgendaItem = {
  turma_nome: string | null;
  disciplina_nome: string | null;
  sala_nome: string | null;
  dia_semana: number;
  inicio: string;
  fim: string;
};

type PendenciasResumo = {
  avaliacoes_pendentes: number;
  faltas_a_lancar: number;
};

type OverviewInfo = {
  escola_nome: string | null;
  primeiro_nome: string | null;
};

const dayLabel = (day: number) => {
  switch (day) {
    case 1:
      return "Segunda";
    case 2:
      return "Terça";
    case 3:
      return "Quarta";
    case 4:
      return "Quinta";
    case 5:
      return "Sexta";
    case 6:
      return "Sábado";
    case 7:
      return "Domingo";
    default:
      return "";
  }
};

export default function Page() {
  const [atribs, setAtribs] = useState<AtribItem[]>([]);
  const [agenda, setAgenda] = useState<AgendaItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [pendenciasResumo, setPendenciasResumo] = useState<PendenciasResumo | null>(null);
  const [overview, setOverview] = useState<OverviewInfo | null>(null);
  const pathname = usePathname();
  const { escolaId, escolaSlug } = useEscolaId();
  const escolaParam = getEscolaParamFromPath(pathname) ?? escolaSlug ?? escolaId;
  const professorHref = (path: string) => buildPortalHref(escolaParam, path);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        setLoading(true);
        setPendenciasResumo(null);
        const [atribsRes, agendaRes, pendRes, overviewRes] = await Promise.all([
          fetch("/api/professor/atribuicoes", { cache: "no-store" }),
          fetch("/api/professor/agenda", { cache: "no-store" }),
          fetch("/api/professor/dashboard/pendencias", { cache: "no-store" }),
          fetch("/api/professor/dashboard/overview", { cache: "no-store" }),
        ]);
        const atribsJson = await atribsRes.json().catch(() => null);
        const agendaJson = await agendaRes.json().catch(() => null);
        const pendJson = await pendRes.json().catch(() => null);
        const overviewJson = await overviewRes.json().catch(() => null);
        if (!cancelled) {
          setAtribs((atribsJson?.items || []) as AtribItem[]);
          setAgenda((agendaJson?.items || []) as AgendaItem[]);
          if (pendRes.ok && pendJson?.ok) {
            setPendenciasResumo({
              avaliacoes_pendentes: Number(pendJson.avaliacoes_pendentes ?? 0),
              faltas_a_lancar: Number(pendJson.faltas_a_lancar ?? 0),
            });
          } else {
            setPendenciasResumo({ avaliacoes_pendentes: 0, faltas_a_lancar: 0 });
          }
          if (overviewRes.ok && overviewJson?.ok) {
            setOverview({
              escola_nome: overviewJson.escola_nome ?? null,
              primeiro_nome: overviewJson.primeiro_nome ?? null,
            });
          } else {
            setOverview({ escola_nome: null, primeiro_nome: null });
          }
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, []);

  const turmaMap = useMemo(() => {
    const map = new Map<string, { nome: string | null; disciplinas: string[] }>();
    for (const item of atribs) {
      const turmaId = item.turma?.id || "";
      if (!turmaId) continue;
      const entry = map.get(turmaId) || { nome: item.turma?.nome ?? null, disciplinas: [] };
      const disciplinaNome = item.disciplina?.nome || "Disciplina";
      if (!entry.disciplinas.includes(disciplinaNome)) entry.disciplinas.push(disciplinaNome);
      map.set(turmaId, entry);
    }
    return Array.from(map.values());
  }, [atribs]);

  const agendaByDay = useMemo(() => {
    const map = new Map<number, AgendaItem[]>();
    for (const item of agenda) {
      const list = map.get(item.dia_semana) || [];
      list.push(item);
      map.set(item.dia_semana, list);
    }
    for (const [day, list] of map.entries()) {
      list.sort((a, b) => a.inicio.localeCompare(b.inicio));
      map.set(day, list);
    }
    return map;
  }, [agenda]);

  const todayKey = useMemo(() => {
    const day = new Date().getDay();
    return day === 0 ? 7 : day;
  }, []);

  const aulasHoje = useMemo(() => {
    return agenda.filter((item) => item.dia_semana === todayKey).length;
  }, [agenda, todayKey]);

  const turmasAtivas = turmaMap.length;
  const avaliacoesPendentes = pendenciasResumo?.avaliacoes_pendentes ?? 0;
  const faltasALancar = pendenciasResumo?.faltas_a_lancar ?? 0;

  return (
    <div className="min-h-screen bg-[#f8fafc] text-slate-900 pb-24">
      <div className="max-w-6xl mx-auto p-4 sm:p-6 space-y-8">
        
        {/* HEADER PREMIUM */}
        <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
             <div className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-klasse-gold animate-pulse" />
                <span className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400">Portal do Professor</span>
             </div>
             <h1 className="text-3xl font-black tracking-tight text-slate-900">
                Olá, <span className="text-klasse-gold">{overview?.primeiro_nome || "Professor"}</span>
             </h1>
             <p className="text-sm font-medium text-slate-500">
                {overview?.escola_nome || "Bem-vindo de volta ao seu painel académico."}
             </p>
          </div>
          
          <div className="flex items-center gap-3">
             <div className="h-12 w-12 rounded-2xl bg-white shadow-sm border border-slate-200 flex items-center justify-center text-slate-400">
                <MapIcon className="w-6 h-6" />
             </div>
             <div className="hidden sm:block">
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Status</p>
                <p className="text-xs font-bold text-emerald-600 flex items-center gap-1">
                   <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" /> Sistema Online
                </p>
             </div>
          </div>
        </header>

        <AssignmentsBanner />

        {/* RESUMO DE IMPACTO */}
        <section className="relative overflow-hidden rounded-[2.5rem] bg-slate-900 p-8 text-white shadow-2xl shadow-klasse-gold/10">
          {/* Background Elements */}
          <div className="absolute -right-10 -top-10 h-64 w-64 rounded-full bg-klasse-gold/10 blur-3xl" />
          <div className="absolute -bottom-20 -left-10 h-64 w-64 rounded-full bg-emerald-500/5 blur-3xl" />
          
          <div className="relative z-10 grid gap-8 md:grid-cols-2 lg:grid-cols-4">
             <div className="space-y-4 col-span-full lg:col-span-1">
                <div>
                   <p className="text-[10px] font-black uppercase tracking-[0.2em] text-emerald-400/70">Resumo do dia</p>
                   <h2 className="text-2xl font-black text-white mt-1">Sua Agenda</h2>
                </div>
                <p className="text-xs font-medium text-slate-400 leading-relaxed">
                   Acompanhe suas aulas e tarefas pendentes para manter o ciclo académico em dia.
                </p>
             </div>

             <div className="lg:col-span-3 grid grid-cols-2 sm:grid-cols-4 gap-4">
                {[
                  { label: "Aulas hoje", value: aulasHoje, color: "text-white" },
                  { label: "Turmas", value: turmasAtivas, color: "text-white" },
                  { label: "Avaliações", value: avaliacoesPendentes, color: "text-amber-400", alert: avaliacoesPendentes > 0 },
                  { label: "Faltas", value: faltasALancar, color: "text-rose-400", alert: faltasALancar > 0 },
                ].map((item) => (
                  <div key={item.label} className="group relative rounded-3xl bg-white/5 border border-white/10 p-4 transition-all hover:bg-white/10">
                    <p className="text-[9px] font-black uppercase tracking-widest text-slate-500 mb-1">{item.label}</p>
                    <div className="flex items-center gap-2">
                       <p className={`text-2xl font-black ${item.color}`}>{loading ? "—" : item.value}</p>
                       {item.alert && <span className="h-2 w-2 rounded-full bg-current animate-ping" />}
                    </div>
                  </div>
                ))}
             </div>
          </div>
        </section>

        {/* GRID DE OPERAÇÕES */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { 
               title: "Registrar Presenças", 
               desc: "Controle diário de assiduidade", 
               icon: ClipboardDocumentListIcon, 
               href: "/professor/frequencias",
               color: "from-emerald-500 to-teal-600",
               light: "bg-emerald-50 text-emerald-600"
            },
            { 
               title: "Lançar Notas", 
               desc: "Gestão de avaliações e médias", 
               icon: PencilSquareIcon, 
               href: "/professor/notas",
               color: "from-amber-500 to-orange-600",
               light: "bg-amber-50 text-amber-600"
            },
            { 
               title: "Materiais de Estudo", 
               desc: "Upload de guias e manuais", 
               icon: BookOpenIcon, 
               href: "/professor/materiais",
               color: "from-blue-500 to-indigo-600",
               light: "bg-blue-50 text-blue-600"
            },
            { 
               title: "Fluxo Acadêmico", 
               desc: "Visão geral do cronograma", 
               icon: MapIcon, 
               href: "/professor/fluxos",
               color: "from-slate-600 to-slate-800",
               light: "bg-slate-100 text-slate-600"
            }
          ].map((action) => (
            <Link 
               key={action.title} 
               href={professorHref(action.href)} 
               className="group relative overflow-hidden rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm transition-all hover:-translate-y-1 hover:shadow-xl hover:border-klasse-gold/20"
            >
               <div className={`mb-4 flex h-14 w-14 items-center justify-center rounded-2xl shadow-inner transition-transform group-hover:scale-110 ${action.light}`}>
                  <action.icon className="h-7 w-7" />
               </div>
               <div className="space-y-1">
                  <h3 className="font-black text-slate-900 leading-tight">{action.title}</h3>
                  <p className="text-[11px] font-medium text-slate-500">{action.desc}</p>
               </div>
               {/* Arrow Icon on Hover */}
               <div className="absolute bottom-6 right-6 opacity-0 group-hover:opacity-100 transition-opacity">
                  <div className="h-8 w-8 rounded-full bg-slate-900 text-white flex items-center justify-center">
                     <PencilSquareIcon className="h-4 w-4" />
                  </div>
               </div>
            </Link>
          ))}
        </div>

        {/* CONTEÚDO ACADÊMICO */}
        <div className="grid lg:grid-cols-[1.5fr_1fr] gap-8">
          
          {/* TURMAS */}
          <section className="space-y-4">
            <div className="flex items-center justify-between px-2">
              <h2 className="text-sm font-black uppercase tracking-widest text-slate-400">Minhas Turmas Ativas</h2>
              <Link href={professorHref("/professor/frequencias")} className="text-[10px] font-black uppercase text-klasse-gold hover:underline">Novo Registro</Link>
            </div>
            
            {loading ? (
              <div className="grid gap-4 sm:grid-cols-2">
                {[1, 2, 3, 4].map((i) => <div key={i} className="h-28 rounded-[1.5rem] bg-white border border-slate-200 animate-pulse" />)}
              </div>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2">
                {turmaMap.map((turma) => (
                  <div key={turma.nome} className="group rounded-[1.5rem] border border-slate-200 bg-white p-5 shadow-sm transition-all hover:border-klasse-gold/40">
                    <div className="flex items-start justify-between">
                       <div className="h-10 w-10 rounded-xl bg-slate-50 flex items-center justify-center text-slate-400 group-hover:bg-klasse-gold/10 group-hover:text-klasse-gold transition-colors font-black text-xs">
                          {turma.nome?.split("-")[0]}
                       </div>
                       <span className="inline-flex items-center rounded-full bg-emerald-50 px-2 py-0.5 text-[9px] font-black uppercase text-emerald-600 border border-emerald-100">
                          Confirmada
                       </span>
                    </div>
                    <div className="mt-4">
                       <h3 className="font-black text-slate-900">{formatTurmaDisplayName({ nome: turma.nome })}</h3>
                       <p className="mt-1 text-[10px] font-bold text-slate-400 line-clamp-1 italic">
                          {turma.disciplinas.join(" • ")}
                       </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* AGENDA COMPACTA */}
          <section className="space-y-4">
             <div className="flex items-center justify-between px-2">
                <h2 className="text-sm font-black uppercase tracking-widest text-slate-400">Agenda de {dayLabel(todayKey)}</h2>
                <Link href={professorHref("/professor/fluxos")} className="text-[10px] font-black uppercase text-slate-500 hover:text-slate-900 transition-colors">Semana Inteira</Link>
             </div>

             <div className="rounded-[2.5rem] bg-white border border-slate-200 p-6 shadow-sm divide-y divide-slate-100">
                {loading ? (
                   [1,2,3].map(i => <div key={i} className="py-4 h-16 animate-pulse" />)
                ) : (agendaByDay.get(todayKey) || []).length === 0 ? (
                   <div className="py-12 text-center space-y-3">
                      <div className="h-12 w-12 rounded-full bg-slate-50 flex items-center justify-center mx-auto text-slate-300">
                         <MapIcon className="h-6 w-6" />
                      </div>
                      <p className="text-xs font-bold text-slate-400">Sem aulas agendadas para hoje.</p>
                   </div>
                ) : (
                  (agendaByDay.get(todayKey) || []).map((item, idx) => (
                    <div key={idx} className="group py-4 first:pt-0 last:pb-0 flex items-center justify-between gap-4">
                       <div className="flex items-center gap-4">
                          <div className="flex flex-col items-center">
                             <span className="text-[10px] font-black text-slate-900 leading-none">{item.inicio.split(":")[0]}</span>
                             <span className="text-[8px] font-bold text-slate-400 uppercase">{item.inicio.split(":")[1]}</span>
                          </div>
                          <div className="h-8 w-[2px] bg-slate-100 rounded-full" />
                          <div>
                             <p className="text-xs font-black text-slate-900 group-hover:text-klasse-gold transition-colors">{item.disciplina_nome}</p>
                             <p className="text-[10px] font-bold text-slate-400">
                                {formatTurmaDisplayName({ turma_nome: item.turma_nome })}
                                {item.sala_nome && ` • Sala ${item.sala_nome}`}
                             </p>
                          </div>
                       </div>
                       <div className="shrink-0 h-8 w-8 rounded-full bg-slate-50 flex items-center justify-center text-slate-400 group-hover:bg-slate-900 group-hover:text-white transition-all">
                          <PencilSquareIcon className="h-4 w-4" />
                       </div>
                    </div>
                  ))
                )}
             </div>
          </section>

        </div>
      </div>
    </div>
  );
}
