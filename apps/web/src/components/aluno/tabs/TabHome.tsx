"use client";

import { useMemo, useState, useEffect } from "react";
import { format, parseISO } from "date-fns";
import { useSearchParams } from "next/navigation";
import { usePortalSWR } from "@/components/aluno/usePortalSWR";
import { RematriculaBanner } from "@/components/aluno/home/RematriculaBanner";
import { motion } from "framer-motion";
import { CircularProgressbar, buildStyles } from "react-circular-progressbar";
import "react-circular-progressbar/dist/styles.css";
import { 
    TrendingUp, 
    Calendar, 
    Wallet, 
    User, 
    ChevronRight, 
    CreditCard, 
    Star, 
    Clock,
    AlertTriangle
} from "lucide-react";
import Link from "next/link";
import { AlunoCard } from "@/components/aluno/shared/AlunoCard";

type StatusResponse = { 
    nome: string; 
    foto_url: string | null;
    classe: string | null; 
    turma: string | null; 
    estadoAcademico: string;
    assiduidade: number | null;
} | null;

type FinanceResponse = { id: string; valor: number; mes: string | null } | null;
type GradeItem = { disciplina: string; tipo: string; nota: number | null; data: string | null };
type AcademicEvent = { id: string; nome: string; data_inicio: string; data_fim: string; tipo: string };

const money = new Intl.NumberFormat("pt-AO", { style: "currency", currency: "AOA", maximumFractionDigits: 0 });

export function TabHome() {
  const searchParams = useSearchParams();
  const studentId = useMemo(() => searchParams?.get("aluno") ?? null, [searchParams]);

  const [status, setStatus] = useState<StatusResponse>(null);
  const [alert, setAlert] = useState<FinanceResponse>(null);
  const [grades, setGrades] = useState<GradeItem[]>([]);
  const [events, setEvents] = useState<AcademicEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const query = studentId ? `?studentId=${studentId}` : "";

  const statusReq = usePortalSWR({
    key: `home-status-${studentId ?? "default"}`,
    url: `/api/aluno/home/status${query}`,
    intervalMs: 60000,
    parse: (payload) => (payload as { status?: StatusResponse }).status ?? null,
    onData: (data) => setStatus(data),
  });

  const alertReq = usePortalSWR({
    key: `home-alert-${studentId ?? "default"}`,
    url: `/api/aluno/home/finance-alert${query}`,
    intervalMs: 45000,
    parse: (payload) => (payload as { alert?: FinanceResponse }).alert ?? null,
    onData: (data) => setAlert(data),
  });

  const gradesReq = usePortalSWR({
    key: `home-grades-${studentId ?? "default"}`,
    url: `/api/aluno/home/recent-grades${query}`,
    intervalMs: 90000,
    parse: (payload) => ((payload as { items?: GradeItem[] }).items ?? []).slice(0, 4),
    onData: (data) => setGrades(data),
  });

  const eventsReq = usePortalSWR({
    key: `home-events-${studentId ?? "default"}`,
    url: `/api/aluno/home/academic-events${query}`,
    intervalMs: 120000,
    parse: (payload) => (payload as { items?: AcademicEvent[] }).items ?? [],
    onData: (data) => {
        setEvents(data);
        setLoading(false);
    },
  });

  const pullToRefresh = async () => {
    setRefreshing(true);
    await Promise.all([statusReq.refresh(), alertReq.refresh(), gradesReq.refresh(), eventsReq.refresh()]);
    setRefreshing(false);
  };

  const mediaNotas = useMemo(() => {
    const validas = grades.filter(g => typeof g.nota === 'number');
    if (!validas.length) return 0;
    return Number((validas.reduce((acc, curr) => acc + (curr.nota || 0), 0) / validas.length).toFixed(1));
  }, [grades]);

  const greeting = useMemo(() => {
    const hour = new Date().getHours();
    if (hour < 12) return "Bom dia";
    if (hour < 18) return "Boa tarde";
    return "Boa noite";
  }, []);

  if (loading) {
    return (
        <div className="space-y-6 animate-pulse p-4">
            <div className="h-20 bg-slate-100 rounded-3xl w-2/3" />
            <div className="grid grid-cols-2 gap-4">
                <div className="h-32 bg-slate-100 rounded-3xl" />
                <div className="h-32 bg-slate-100 rounded-3xl" />
            </div>
            <div className="h-64 bg-slate-100 rounded-3xl" />
        </div>
    );
  }

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-6 pb-8"
    >
      <RematriculaBanner />

      {/* HEADER: Saudação e Perfil */}
      <header className="flex items-center justify-between px-1">
        <div>
          <h1 className="text-2xl font-black tracking-tight text-slate-900">
            {greeting}, <span className="text-klasse-green">{status?.nome.split(' ')[0]}!</span>
          </h1>
          <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mt-1">
            {status?.classe} • {status?.turma}
          </p>
        </div>
        <Link href={`/aluno/perfil${query}`} className="relative group">
            <div className="h-14 w-14 rounded-[1.25rem] border-2 border-white shadow-lg overflow-hidden bg-slate-200">
                {status?.foto_url ? (
                    <img src={status.foto_url} alt="Perfil" className="h-full w-full object-cover" />
                ) : (
                    <div className="h-full w-full flex items-center justify-center text-slate-400">
                        <User size={24} />
                    </div>
                )}
            </div>
            <div className="absolute -bottom-1 -right-1 h-5 w-5 bg-klasse-green rounded-full border-2 border-white flex items-center justify-center text-[10px] text-white">
                <Star size={10} fill="white" />
            </div>
        </Link>
      </header>

      {/* RINGS: Desempenho Acadêmico */}
      <div className="grid grid-cols-2 gap-4">
         <AlunoCard className="flex flex-col items-center justify-center p-6 text-center border-0 bg-white shadow-xl shadow-slate-200/50">
            <div className="h-20 w-20 mb-4">
                <CircularProgressbar
                    value={mediaNotas}
                    maxValue={20}
                    text={`${mediaNotas}`}
                    styles={buildStyles({
                        pathColor: mediaNotas >= 14 ? "#1F6B3B" : mediaNotas >= 10 ? "#E3B23C" : "#E11D48",
                        textColor: "#0F172A",
                        trailColor: "#F1F5F9",
                        textSize: "24px",
                    })}
                />
            </div>
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Média Geral</p>
            <div className="mt-2 flex items-center gap-1 text-xs font-bold text-klasse-green">
                <TrendingUp size={12} />
                <span>+0.2</span>
            </div>
         </AlunoCard>

         <AlunoCard className="flex flex-col items-center justify-center p-6 text-center border-0 bg-white shadow-xl shadow-slate-200/50">
            <div className="h-20 w-20 mb-4">
                <CircularProgressbar
                    value={status?.assiduidade ?? 0}
                    text={`${status?.assiduidade ?? 0}%`}
                    styles={buildStyles({
                        pathColor: "#3B82F6",
                        textColor: "#0F172A",
                        trailColor: "#F1F5F9",
                        textSize: "24px",
                    })}
                />
            </div>
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Assiduidade</p>
            <div className="mt-2 text-xs font-bold text-blue-600">
                <span>Meta: 90%</span>
            </div>
         </AlunoCard>
      </div>

      {/* FINANCEIRO: Status Rápido */}
      {alert && (
        <motion.div 
            whileTap={{ scale: 0.98 }}
            className="group relative overflow-hidden rounded-[2rem] bg-slate-900 p-6 text-white shadow-2xl"
        >
            <div className="absolute -right-4 -top-4 h-32 w-32 rounded-full bg-white/5 blur-2xl" />
            <div className="relative z-10 flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-rose-500/20 text-rose-400">
                        <AlertTriangle size={24} />
                    </div>
                    <div>
                        <p className="text-[10px] font-black uppercase tracking-[0.2em] text-white/40">Pendência Financeira</p>
                        <p className="text-lg font-black">{money.format(alert.valor)}</p>
                        <p className="text-xs text-white/60">Referente a {alert.mes}</p>
                    </div>
                </div>
                <Link href={`/aluno/financeiro${query}`} className="flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white transition hover:bg-white/20">
                    <ChevronRight size={20} />
                </Link>
            </div>
        </motion.div>
      )}

      {/* TIMELINE: Próximas Avaliações / Eventos */}
      <section className="space-y-4">
        <div className="flex items-center justify-between px-1">
            <h3 className="text-sm font-black uppercase tracking-widest text-slate-900">Agenda do Aluno</h3>
            <Link href={`/aluno/academico${query}`} className="text-[10px] font-black uppercase text-klasse-green underline underline-offset-4">Ver tudo</Link>
        </div>
        
        <div className="grid gap-3">
            {events.slice(0, 2).map((ev) => (
                <div key={ev.id} className="flex items-center gap-4 rounded-[1.5rem] bg-white p-4 border border-slate-100 shadow-sm">
                    <div className={`flex h-12 w-12 shrink-0 flex-col items-center justify-center rounded-2xl ${
                        ev.tipo === 'FERIADO' ? 'bg-rose-50 text-rose-600' : 
                        ev.tipo === 'PROVA_TRIMESTRAL' ? 'bg-amber-50 text-amber-600' : 'bg-blue-50 text-blue-600'
                    }`}>
                        <p className="text-[10px] font-black uppercase">{format(parseISO(ev.data_inicio), 'MMM', { locale: require('date-fns/locale/pt-BR') })}</p>
                        <p className="text-lg font-black leading-none">{format(parseISO(ev.data_inicio), 'dd')}</p>
                    </div>
                    <div className="flex-1 min-w-0">
                        <p className="text-sm font-bold text-slate-900 truncate">{ev.nome}</p>
                        <div className="flex items-center gap-2 mt-0.5">
                            <Clock size={10} className="text-slate-400" />
                            <p className="text-[10px] font-medium text-slate-500 uppercase">Evento {ev.tipo.replace('_', ' ')}</p>
                        </div>
                    </div>
                </div>
            ))}
            
            {/* NOTAS RECENTES INTEGRADO */}
            {grades.length > 0 && (
                <div className="rounded-[1.5rem] bg-slate-50 p-5 border border-slate-100">
                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-4">Últimos Lançamentos</p>
                    <div className="space-y-4">
                        {grades.slice(0, 2).map((item, idx) => (
                            <div key={idx} className="flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <div className="h-8 w-8 rounded-lg bg-white flex items-center justify-center text-slate-400 shadow-sm">
                                        <Star size={14} />
                                    </div>
                                    <div>
                                        <p className="text-xs font-bold text-slate-900">{item.disciplina}</p>
                                        <p className="text-[10px] text-slate-500">{item.tipo}</p>
                                    </div>
                                </div>
                                <div className={`text-sm font-black ${item.nota && item.nota >= 10 ? 'text-slate-900' : 'text-rose-500'}`}>
                                    {item.nota ?? '—'}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
      </section>

      {/* QUICK ACTIONS: Atalhos */}
      <section className="grid grid-cols-3 gap-3">
        <Link href={`/aluno/identidade${query}`} className="flex flex-col items-center justify-center gap-2 p-4 rounded-2xl bg-white border border-slate-100 shadow-sm active:scale-95 transition">
            <div className="h-10 w-10 rounded-full bg-amber-50 text-amber-600 flex items-center justify-center">
                <CreditCard size={20} />
            </div>
            <span className="text-[10px] font-black uppercase text-slate-600">ID Digital</span>
        </Link>
        <Link href={`/aluno/horario${query}`} className="flex flex-col items-center justify-center gap-2 p-4 rounded-2xl bg-white border border-slate-100 shadow-sm active:scale-95 transition">
            <div className="h-10 w-10 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center">
                <Calendar size={20} />
            </div>
            <span className="text-[10px] font-black uppercase text-slate-600">Horário</span>
        </Link>
        <button 
            onClick={pullToRefresh}
            className="flex flex-col items-center justify-center gap-2 p-4 rounded-2xl bg-white border border-slate-100 shadow-sm active:scale-95 transition"
        >
            <div className={`h-10 w-10 rounded-full bg-slate-50 text-slate-600 flex items-center justify-center ${refreshing ? 'animate-spin' : ''}`}>
                <Clock size={20} />
            </div>
            <span className="text-[10px] font-black uppercase text-slate-600">Atualizar</span>
        </button>
      </section>
    </motion.div>
  );
}
