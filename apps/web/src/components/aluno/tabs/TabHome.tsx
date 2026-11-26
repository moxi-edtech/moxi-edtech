"use client";

import { useMemo, useState, useEffect } from "react";
import { format, parseISO } from "date-fns";
import { usePathname, useSearchParams } from "next/navigation";
import { buildStudentPortalHref } from "@/lib/navigation";
import { usePortalSWR } from "@/components/aluno/usePortalSWR";
import { RematriculaBanner } from "@/components/aluno/home/RematriculaBanner";
import { motion } from "framer-motion";
import { CircularProgressbar, buildStyles } from "react-circular-progressbar";
import "react-circular-progressbar/dist/styles.css";
import { 
    TrendingUp, 
    Calendar,
    Printer, 
    Wallet, 
    User, 
    ChevronRight, 
    CreditCard, 
    Star, 
    Clock,
    AlertTriangle,
    Lock as LockIcon
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
type AcademicEvent = { id: string; nome: string; data_inicio: string; data_fim: string; tipo: string; descricao?: string | null };

const money = new Intl.NumberFormat("pt-AO", { style: "currency", currency: "AOA", maximumFractionDigits: 0 });

export function TabHome() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const studentId = useMemo(() => searchParams?.get("aluno") ?? null, [searchParams]);
  const searchValue = searchParams?.toString() ?? "";
  const href = (target: string) => buildStudentPortalHref(pathname, searchValue, target);

  const [status, setStatus] = useState<StatusResponse>(null);
  const [alert, setAlert] = useState<FinanceResponse>(null);
  const [grades, setGrades] = useState<GradeItem[]>([]);
  const [events, setEvents] = useState<AcademicEvent[]>([]);
  const [restrictedGrades, setRestrictedGrades] = useState(false);
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
    parse: (payload) => payload as { items?: GradeItem[], restricted?: boolean },
    onData: (data) => {
        setGrades(data.items ?? []);
        setRestrictedGrades(!!data.restricted);
    },
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
    if (!validas.length) return null;
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
            <div className="h-20 bg-muted rounded-xl w-2/3" />
            <div className="grid grid-cols-2 gap-4">
                <div className="h-32 bg-muted rounded-xl" />
                <div className="h-32 bg-muted rounded-xl" />
            </div>
            <div className="h-64 bg-muted rounded-xl" />
        </div>
    );
  }

  return (
    <motion.div 
      initial={false}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-5 pb-4"
    >
      <RematriculaBanner />

      {/* HEADER: Saudação e Perfil */}
      <header className="flex items-center justify-between px-1">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-primary">
            {greeting}, <span className="text-primary">{status?.nome.split(' ')[0]}!</span>
          </h1>
          <p className="text-xs font-bold text-muted-foreground  mt-1">
            {status?.classe} • {status?.turma}
          </p>
        </div>
        <Link href={href("/aluno/perfil")} className="group relative rounded-xl focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-klasse-gold/20" aria-label="Abrir perfil">
            <div className="h-11 w-11 overflow-hidden rounded-xl border border-border bg-muted shadow-sm">
                {status?.foto_url ? (
                    <img src={status.foto_url} alt="Perfil" className="h-full w-full object-cover" />
                ) : (
                    <div className="h-full w-full flex items-center justify-center text-muted-foreground">
                        <User size={24} />
                    </div>
                )}
            </div>
        </Link>
      </header>

      {/* RINGS: Desempenho Acadêmico */}
      <div className="grid grid-cols-2 gap-4">
         <AlunoCard className="flex flex-col items-center justify-center gap-2 border-border bg-card p-4 text-center shadow-sm">
            <div className="h-20 w-20 mb-4">
                <CircularProgressbar
                    value={mediaNotas ?? 0}
                    maxValue={20}
                    text={mediaNotas === null ? "—" : String(mediaNotas)}
                    styles={buildStyles({
                        pathColor: mediaNotas === null ? "#94A3B8" : mediaNotas >= 14 ? "var(--primary)" : mediaNotas >= 10 ? "var(--color-klasse-gold)" : "#E11D48",
                        textColor: "#0F172A",
                        trailColor: "#F1F5F9",
                        textSize: "24px",
                    })}
                />
            </div>
            <p className="text-xs font-semibold  text-muted-foreground">Média recente</p>
            <p className="mt-2 text-xs text-muted-foreground">
              {mediaNotas === null ? "Sem notas publicadas" : "Avaliações disponíveis"}
            </p>
         </AlunoCard>

         <AlunoCard className="flex flex-col items-center justify-center gap-2 border-border bg-card p-4 text-center shadow-sm">
            <div className="h-20 w-20 mb-4">
                <CircularProgressbar
                    value={status?.assiduidade ?? 0}
                    text={status?.assiduidade == null ? "—" : `${status.assiduidade}%`}
                    styles={buildStyles({
                        pathColor: "var(--primary)",
                        textColor: "#0F172A",
                        trailColor: "#F1F5F9",
                        textSize: "24px",
                    })}
                />
            </div>
            <p className="text-xs font-semibold  text-muted-foreground">Assiduidade</p>
            <p className="mt-2 text-xs text-muted-foreground">
              {status?.assiduidade == null ? "Sem registos" : "Presenças registadas"}
            </p>
         </AlunoCard>
      </div>

      {/* FINANCEIRO: Status Rápido */}
      {alert && (
        <motion.div 
            whileTap={{ scale: 0.98 }}
            className="group relative overflow-hidden rounded-xl border border-amber-200 bg-card p-4 text-foreground shadow-sm"
        >
            <div className="relative z-10 flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-50 text-amber-700">
                        <AlertTriangle size={24} />
                    </div>
                    <div>
                        <p className="text-xs font-semibold  text-muted-foreground">Pendência Financeira</p>
                        <p className="text-lg font-semibold">{money.format(alert.valor)}</p>
                        <p className="text-xs text-muted-foreground">Referente a {alert.mes}</p>
                    </div>
                </div>
                <Link href={href("/aluno/financeiro")} className="klasse-portal-cta flex min-h-11 min-w-11 items-center justify-center rounded-xl focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-klasse-gold/20">
                    <ChevronRight size={20} />
                </Link>
            </div>
        </motion.div>
      )}

      <section className="space-y-3 rounded-xl border border-border bg-card p-4">
        <div className="flex flex-wrap items-center justify-between gap-2"><h3 className="text-sm font-semibold text-klasse-green">Próximas avaliações</h3><a href={"/api/aluno/home/academic-events?"+new URLSearchParams({modo:"imprimir",...(studentId?{studentId}:{})})} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 items-center gap-2 text-xs font-semibold text-klasse-green"><Printer size={16}/> Ver / imprimir calendário</a></div>
        {events.filter(e=>e.tipo==="AVALIACAO_ESCOLAR").slice(0,3).map(e=><div key={e.id} className="flex items-start gap-3 border-t border-border pt-2 text-sm"><Calendar size={18} className="shrink-0 text-klasse-green"/><div className="min-w-0"><p className="font-medium break-words">{e.nome}</p><p className="text-xs text-muted-foreground">{format(parseISO(e.data_inicio),"dd/MM/yyyy")} {e.descricao??""}</p></div></div>)}
        {!events.some(e=>e.tipo==="AVALIACAO_ESCOLAR")&&<p className="text-xs text-muted-foreground">Nenhuma avaliação publicada na agenda próxima.</p>}
      </section>
      {/* TIMELINE: Próximas Avaliações / Eventos */}
      <section className="space-y-4">
        <div className="flex items-center justify-between px-1">
            <h3 className="text-sm font-semibold  text-foreground">Agenda do Aluno</h3>
            <Link href={href("/aluno/academico")} className="text-xs font-semibold uppercase text-primary underline underline-offset-4">Ver tudo</Link>
        </div>
        
        <div className="grid gap-3">
            {events.filter(e=>e.tipo!=="AVALIACAO_ESCOLAR").slice(0, 2).map((ev) => (
                <div key={ev.id} className="flex items-center gap-4 rounded-xl bg-card p-4 border border-border shadow-sm">
                    <div className={`flex h-12 w-12 shrink-0 flex-col items-center justify-center rounded-xl ${
                        ev.tipo === 'FERIADO' ? 'bg-rose-50 text-rose-600' : 
                        ev.tipo === 'PROVA_TRIMESTRAL' ? 'bg-amber-50 text-amber-600' : 'bg-blue-50 text-blue-600'
                    }`}>
                        <p className="text-xs font-semibold uppercase">{format(parseISO(ev.data_inicio), 'MMM', { locale: require('date-fns/locale/pt-BR') })}</p>
                        <p className="text-lg font-semibold leading-none">{format(parseISO(ev.data_inicio), 'dd')}</p>
                    </div>
                    <div className="flex-1 min-w-0">
                        <p className="text-sm font-bold text-foreground truncate">{ev.nome}</p>
                        <div className="flex items-center gap-2 mt-0.5">
                            <Clock size={10} className="text-muted-foreground" />
                            <p className="text-xs font-medium text-muted-foreground uppercase">Evento {ev.tipo.replace('_', ' ')}</p>
                        </div>
                    </div>
                </div>
            ))}
            
            {/* NOTAS RECENTES INTEGRADO */}
            {restrictedGrades ? (
                <div className="rounded-xl border border-border bg-card p-4 text-foreground shadow-sm">
                    <div className="relative z-10 flex flex-col items-center text-center">
                        <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-amber-50 text-amber-700">
                            <LockIcon size={24} />
                        </div>
                        <h4 className="text-sm font-semibold tracking-tight">Notas Bloqueadas</h4>
                        <p className="mt-1 text-xs text-muted-foreground leading-relaxed max-w-[200px]">
                            Regularize o seu Boletim para visualizar os últimos lançamentos.
                        </p>
                        <Link 
                            href={href("/aluno/documentos")}
                            className="klasse-portal-cta mt-4 inline-flex min-h-11 w-full items-center justify-center rounded-xl px-3 py-2.5 text-sm font-semibold focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-klasse-gold/20"
                        >
                            Liberar Agora
                        </Link>
                    </div>
                </div>
            ) : grades.length > 0 && (
                <div className="rounded-xl bg-muted/40 p-5 border border-border">
                    <p className="text-xs font-semibold  text-muted-foreground mb-4">Últimos Lançamentos</p>
                    <div className="space-y-4">
                        {grades.slice(0, 2).map((item, idx) => (
                            <div key={idx} className="flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <div className="h-8 w-8 rounded-lg bg-card flex items-center justify-center text-muted-foreground shadow-sm">
                                        <Star size={14} />
                                    </div>
                                    <div>
                                        <p className="text-xs font-bold text-foreground">{item.disciplina}</p>
                                        <p className="text-xs text-muted-foreground">{item.tipo}</p>
                                    </div>
                                </div>
                                <div className={`text-sm font-semibold ${item.nota && item.nota >= 10 ? 'text-foreground' : 'text-rose-500'}`}>
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
      <section className="grid grid-cols-3 gap-2">
        <Link href={href("/aluno/identidade")} className="flex flex-col items-center justify-center gap-2 p-4 rounded-xl bg-card border border-border shadow-sm  transition">
            <div className="h-10 w-10 rounded-full bg-amber-50 text-amber-600 flex items-center justify-center">
                <CreditCard size={20} />
            </div>
            <span className="text-xs font-semibold uppercase text-muted-foreground">ID Digital</span>
        </Link>
        <Link href={href("/aluno/horario")} className="flex flex-col items-center justify-center gap-2 p-4 rounded-xl bg-card border border-border shadow-sm  transition">
            <div className="h-10 w-10 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center">
                <Calendar size={20} />
            </div>
            <span className="text-xs font-semibold uppercase text-muted-foreground">Horário</span>
        </Link>
        <button 
            onClick={pullToRefresh}
            className="flex flex-col items-center justify-center gap-2 p-4 rounded-xl bg-card border border-border shadow-sm  transition"
        >
            <div className={`h-10 w-10 rounded-full bg-muted/40 text-muted-foreground flex items-center justify-center ${refreshing ? 'animate-spin' : ''}`}>
                <Clock size={20} />
            </div>
            <span className="text-xs font-semibold uppercase text-muted-foreground">Atualizar</span>
        </button>
      </section>
    </motion.div>
  );
}
