"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { ArrowRight, BookOpen, CalendarDays, FileText, Wallet, Bell, GraduationCap, Clock3 } from "lucide-react";
import { ErrorState } from "@/components/feedback/FeedbackSystem";
import { buildPortalHref, getEscolaParamFromPath } from "@/lib/navigation";
import { buildStudentAttention, nextLessonLabel, type StudentDocument, type StudentRematricula } from "@/lib/aluno/dashboardPresentation";

type DashboardData = {
  ok: boolean;
  proxima_aula: { weekday: number | null; inicio: string | null; fim?: string | null; sala?: string | null; disciplina?: string | null; professor?: string | null } | null;
  status_financeiro: { pendentes: number; error?: string } | null;
  avisos_recentes: { id: string; titulo: string | null; resumo: string | null; origem: string | null; data: string | null }[];
  ano_letivo?: number | null;
  turma_nome?: string | null;
};
type BoletimData = { ok: boolean; nome_aluno?: string | null; is_liberado?: boolean };
type CatalogoData = { ok: boolean; documentos?: StudentDocument[]; boletim_pago?: boolean };
type RaaData = { ok: boolean; result?: { status: string; mensagem: string } | null };
type ScreenData = { dashboard: DashboardData; boletim: BoletimData | null; catalogo: CatalogoData | null; rematricula: StudentRematricula | null; raa: RaaData | null };
async function fetchJson<T>(path: string, signal: AbortSignal): Promise<T | null> {
  try {
    const res = await fetch(path, { cache: "no-store", signal });
    if (!res.ok) return null;
    const value: unknown = await res.json();
    if (!value || typeof value !== "object" || !("ok" in value) || (value as {ok:unknown}).ok !== true) return null;
    return value as T;
  } catch (error) {
    if (signal.aborted) throw error;
    return null;
  }
}
const heading = "text-lg font-semibold tracking-tight text-foreground sm:text-xl";
const focus = "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2B6044] focus-visible:ring-offset-2";
const action = `inline-flex min-h-10 items-center gap-1.5 rounded-lg text-sm font-semibold text-emerald-800 underline-offset-4 hover:underline ${focus}`;
function LoadingDashboard() {
  return <div className="mx-auto max-w-6xl animate-pulse space-y-8 px-4 py-6 sm:px-8" aria-label="A carregar a tua página">
    <div className="space-y-4"><div className="h-4 w-40 rounded-lg bg-slate-200"/><div className="h-9 w-56 rounded-lg bg-slate-200"/><div className="h-4 w-44 rounded-lg bg-slate-200"/></div>
    <div className="grid gap-6 lg:grid-cols-5"><div className="h-52 rounded-2xl bg-slate-100 lg:col-span-3"/><div className="h-52 rounded-2xl bg-slate-100 lg:col-span-2"/></div>
    <div className="h-48 rounded-2xl bg-slate-100"/><div className="h-32 rounded-2xl bg-slate-100"/>
  </div>;
}
export default function DashboardLoader() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const school = getEscolaParamFromPath(pathname ?? "") ?? "default";
  const studentId = searchParams?.get("aluno") ?? null;
  const academicYearId = searchParams?.get("ano_letivo_id") ?? null;
  const go = (path: string) => {
    const [route, rawQuery] = path.split("?");
    const params = new URLSearchParams(rawQuery ?? "");
    if (studentId) params.set("aluno", studentId);
    if (academicYearId) params.set("ano_letivo_id", academicYearId);
    const suffix = params.toString();
    return `${buildPortalHref(school, route)}${suffix ? `?${suffix}` : ""}`;
  };
  const [screen, setScreen] = useState<ScreenData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reload, setReload] = useState(0);
  const refresh = useCallback(() => setReload(n => n + 1), []);
  useEffect(() => {
    const controller = new AbortController();
    const load = async () => {
      setLoading(true);
      setError(null);
      setScreen(null);
      try {
        // Só o resumo é obrigatório para mostrar a página. Os restantes endpoints
        // mantêm as suas próprias regras de autorização e bloqueio financeiro.
        const dashRes = await fetch("/api/aluno/dashboard", { cache: "no-store", signal: controller.signal });
        const dash = await dashRes.json() as DashboardData & { error?: string };
        if (!dashRes.ok || !dash.ok) throw new Error(dash.error || "Não foi possível carregar a tua página.");
        if (controller.signal.aborted) return;

        setScreen({ dashboard: dash, boletim: null, catalogo: null, rematricula: null, raa: null });

        // Dados facultativos chegam em paralelo e atualizam a interface independentemente.
        // O skeleton principal não deve aguardar por boletim, catálogo, RAA ou rematrícula.
        const update = <K extends Exclude<keyof ScreenData, "dashboard">>(key: K, value: ScreenData[K]) => {
          if (controller.signal.aborted) return;
          setScreen(current => current ? { ...current, [key]: value } : current);
        };
        void Promise.allSettled([
          fetchJson<BoletimData>("/api/aluno/boletim", controller.signal).then(data => update("boletim", data)),
          fetchJson<CatalogoData>("/api/aluno/documentos/catalogo", controller.signal).then(data => update("catalogo", data)),
          fetchJson<StudentRematricula & { ok: boolean }>("/api/aluno/rematricula/status", controller.signal).then(data => update("rematricula", data)),
          fetchJson<RaaData>("/api/aluno/home/raa-status", controller.signal).then(data => update("raa", data)),
        ]);
      } catch(e) {
        if (!controller.signal.aborted) setError(e instanceof Error ? e.message : "Não foi possível carregar a tua página.");
      } finally { if (!controller.signal.aborted) setLoading(false); }
    };
    void load();
    return () => controller.abort();
  }, [reload]);
  const attentions = useMemo(() => screen ? buildStudentAttention({
    pendentes: screen.dashboard.status_financeiro?.pendentes ?? 0,
    financialError: Boolean(screen.dashboard.status_financeiro?.error),
    documentos: screen.catalogo?.documentos,
    rematricula: screen.rematricula,
    academic: screen.raa?.result,
  }) : [], [screen]);
  if (loading) return <LoadingDashboard/>;
  if (error || !screen) return <div className="mx-auto max-w-6xl px-4 py-8"><ErrorState title="Não foi possível carregar" description={error || "Tenta novamente."} onRetry={refresh}/></div>;
  const lesson = nextLessonLabel(screen.dashboard.proxima_aula);
  const firstName = screen.boletim?.nome_aluno?.trim().split(/\s+/)[0] || "aluno";
  const today = new Intl.DateTimeFormat("pt-AO",{weekday:"long",day:"numeric",month:"long"}).format(new Date());
  const shortcuts = [
    {label:"Disciplinas",hint:"Matérias da turma",href:"/aluno/academico?aba=disciplinas",icon:GraduationCap},
    {label:"Notas",hint:"Avaliações e boletim",href:"/aluno/academico",icon:FileText},
    {label:"Pagamentos",hint:"Mensalidades e comprovativos",href:"/aluno/financeiro",icon:Wallet},
    {label:"Horário",hint:"Aulas da semana",href:"/aluno/horario",icon:CalendarDays},
  ];
  return <main className="mx-auto w-full max-w-6xl space-y-6 rounded-2xl bg-background px-3 pb-20 pt-4 text-foreground sm:space-y-8 sm:px-6 sm:pt-8" data-testid="aluno-dashboard-editorial">
    <header className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-4">
        <p className="flex items-center gap-2 text-sm font-semibold text-[#2B6044]"><BookOpen className="h-4 w-4"/> KLASSE <span className="font-normal text-slate-500">/ Portal do aluno</span></p>
        <nav aria-label="Navegação rápida" className="hidden gap-5 text-sm lg:flex">
          {[["Início","/aluno/dashboard"],["Disciplinas","/aluno/academico?aba=disciplinas"],["Notas","/aluno/academico"],["Documentos","/aluno/documentos"]].map(([label,path])=><Link key={label} href={go(path)} className={`min-h-11 content-center text-slate-600 hover:text-[#2B6044] ${focus}`}>{label}</Link>)}
        </nav>
      </div>
      <div className="relative overflow-hidden rounded-2xl bg-[#142D3B] px-5 py-5 text-white shadow-[0_18px_42px_-28px_rgba(15,42,54,0.65)] sm:px-8 sm:py-7">
        <div aria-hidden="true" className="pointer-events-none absolute -right-12 -top-20 h-64 w-64 rounded-full border-[36px] border-[#C2DDBF]/10 sm:right-8" />
        <div aria-hidden="true" className="pointer-events-none absolute -bottom-24 right-24 h-44 w-44 rounded-full bg-[#75B59A]/10 blur-2xl" />
        <div className="relative max-w-2xl space-y-3">
          <p className="text-sm capitalize tracking-wide text-[#C2DDBF]">{today}</p>
          <h1 className="text-3xl font-semibold tracking-tight text-white sm:text-4xl">Olá, {firstName}</h1>
          {(screen.dashboard.turma_nome || screen.dashboard.ano_letivo) && <p className="text-sm text-slate-200">{[screen.dashboard.turma_nome, screen.dashboard.ano_letivo ? `Ano letivo ${screen.dashboard.ano_letivo}` : ""].filter(Boolean).join(" · ")}</p>}
          <p className="pt-1 text-base text-slate-100">O que precisas de saber hoje.</p>
        </div>
      </div>
    </header>
    <div className="grid items-start gap-5 lg:grid-cols-5">
      <section aria-labelledby="next-class" className="space-y-2 lg:col-span-3">
        <h2 id="next-class" className={heading}>A tua próxima aula</h2>
        <div className="rounded-xl border border-[#D7E5DC] bg-[#E5F0E8] p-4 sm:p-5">
          {lesson ? <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-4">
              <div className="rounded-xl bg-white/85 px-4 py-3 text-[#24573e] shadow-sm"><p className="text-2xl font-semibold tabular-nums">{lesson.time}</p></div>
              <div className="min-w-0"><p className="text-sm text-slate-500">{lesson.day}</p><p className="mt-1 text-lg font-semibold text-slate-900">{lesson.subject}</p></div>
            </div>
            {lesson.details.length > 0 && <p className="text-sm text-slate-600">{lesson.details.join(" · ")}</p>}
          </div> : <div className="flex items-start gap-3"><Clock3 className="mt-1 h-5 w-5 shrink-0 text-slate-400"/><div><p className="font-medium">Ainda não há uma próxima aula publicada.</p><p className="mt-1 text-sm leading-6 text-slate-600">Podes consultar o horário da tua turma quando a escola o disponibilizar.</p></div></div>}
          <Link className={`${action} mt-5`} href={go("/aluno/horario")}>Ver o horário completo <ArrowRight className="h-4 w-4"/></Link>
        </div>
      </section>
      {attentions.length > 0 && <section aria-labelledby="attention-title" className="space-y-2 lg:col-span-2" data-testid="attention">
        <h2 id="attention-title" className={heading}>A acompanhar</h2>
        <div className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-card">
          {attentions.slice(0,3).map(item => {
            const needsAction = item.kind === "rejected" || item.kind === "mensalidade" || item.kind === "rematricula";
            return <article key={item.kind + item.href} className="flex min-w-0 items-start gap-3 px-4 py-3.5">
              <span aria-hidden="true" className={needsAction ? "mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full bg-amber-500" : "mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full bg-emerald-700/50"}/>
              <div className="min-w-0 flex-1">
                <h3 className="text-sm font-semibold leading-5 text-foreground">{item.title}</h3>
                <p className="mt-1 text-sm leading-5 text-muted-foreground">{item.description}</p>
                <Link href={go(item.href)} className={action}>{item.action}<ArrowRight aria-hidden="true" className="h-4 w-4"/></Link>
              </div>
            </article>;
          })}
        </div>
      </section>}
    </div>
    <section aria-labelledby="school-links" className="space-y-4">
      <h2 id="school-links" className={heading}>A tua vida escolar</h2>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 sm:gap-4">
        {shortcuts.map(({label,hint,href,icon:Icon})=><Link key={label} href={go(href)} className={`flex min-h-32 min-w-0 flex-col gap-3 rounded-2xl border border-[#DEE5E2] p-4 shadow-sm transition-[background-color,border-color,transform] hover:-translate-y-0.5 hover:border-[#2B6044]/50 motion-reduce:transform-none motion-reduce:transition-none ${focus} ${label === "Disciplinas" ? "bg-[#E6EDEB]" : label === "Boletim" ? "bg-[#EBE8F3]" : label === "Pagamentos" ? "bg-[#F5EBDD]" : "bg-[#E4EBF5]"}`}>
          <Icon className="h-6 w-6 text-[#2B6044]" aria-hidden="true"/><div><p className="text-sm font-semibold text-slate-900">{label}</p><p className="mt-1 text-xs leading-5 text-slate-600 sm:text-sm">{hint}</p></div>
        </Link>)}
      </div>
    </section>
    <section aria-labelledby="notices" className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3"><h2 id="notices" className={heading}>Avisos da escola</h2><Link className={action} href={go("/aluno/avisos")}>Ver todos<ArrowRight className="h-4 w-4"/></Link></div>
      {(screen.dashboard.avisos_recentes??[]).length===0 ? <p className="flex items-start gap-3 rounded-xl border border-[#DEE5E2] bg-white/85 px-4 py-5 text-sm text-slate-600"><Bell className="h-5 w-5 shrink-0"/> Ainda não há avisos recentes. As novidades da escola vão aparecer aqui.</p> : <ul className="divide-y divide-slate-200 rounded-2xl border border-[#DEE5E2] bg-white/90 px-5 shadow-sm">
        {screen.dashboard.avisos_recentes.map(a=><li key={a.id} className="py-4"><p className="font-medium text-slate-900">{a.titulo?.trim() || "Aviso da escola"}</p>{a.resumo?.trim() && <p className="mt-1 text-sm leading-6 text-slate-600">{a.resumo}</p>}<p className="mt-2 text-xs text-slate-500">{[a.origem?.trim(),a.data && !Number.isNaN(Date.parse(a.data))?new Intl.DateTimeFormat("pt-AO",{day:"numeric",month:"long",year:"numeric"}).format(new Date(a.data)):""].filter(Boolean).join(" · ")}</p></li>)}
      </ul>}
    </section>
  </main>;
}
