"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { ArrowRight, BookOpen, FileText, Wallet, Bell, Clock3, ChevronRight, AlertCircle, CalendarCheck } from "lucide-react";
import { ErrorState } from "@/components/feedback/FeedbackSystem";
import { buildPortalHref, getEscolaParamFromPath } from "@/lib/navigation";
import { buildStudentAttention, nextLessonLabel, type StudentDocument, type StudentRematricula } from "@/lib/aluno/dashboardPresentation";
import { PortalAction } from "@/components/portal/ui/PortalAction";
import { PortalEmptyState } from "@/components/portal/ui/PortalEmptyState";
import { PortalSection } from "@/components/portal/ui/PortalSection";
import { PortalStatCard } from "@/components/portal/ui/PortalStatCard";
import { PortalSurface } from "@/components/portal/ui/PortalSurface";

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
async function fetchJson<T>(path: string, signal: AbortSignal, scopedQuery = ""): Promise<T | null> {
  try {
    const res = await fetch(`${path}${scopedQuery}`, { cache: "no-store", signal });
    if (!res.ok) return null;
    const value: unknown = await res.json();
    if (!value || typeof value !== "object" || !("ok" in value) || (value as {ok:unknown}).ok !== true) return null;
    return value as T;
  } catch (error) {
    if (signal.aborted) throw error;
    return null;
  }
}
const focus = "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2";
function LoadingDashboard() {
  return <div role="status" aria-live="polite" className="w-full animate-pulse space-y-5 py-2" aria-label="A carregar a tua página"><span className="sr-only">A carregar a tua página</span><div aria-hidden="true">
    <div className="h-28 rounded-xl bg-muted"/>
    <div className="grid grid-cols-3 gap-2"><div className="h-24 rounded-xl bg-muted"/><div className="h-24 rounded-xl bg-muted"/><div className="h-24 rounded-xl bg-muted"/></div>
    <div className="h-48 rounded-2xl bg-muted"/><div className="h-32 rounded-2xl bg-muted"/>
    </div>
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
  // APIs com suporte de seleção só recebem IDs já validados pelo próprio endpoint.
  // Os outros endpoints conservam o contexto da sessão existente.
  const serviceScope = new URLSearchParams();
  if (studentId) serviceScope.set("studentId", studentId);
  if (academicYearId) serviceScope.set("ano_letivo_id", academicYearId);
  const scopedQuery = serviceScope.size ? `?${serviceScope.toString()}` : "";
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
          fetchJson<BoletimData>("/api/aluno/boletim", controller.signal, scopedQuery).then(data => update("boletim", data)),
          fetchJson<CatalogoData>("/api/aluno/documentos/catalogo", controller.signal, scopedQuery).then(data => update("catalogo", data)),
          fetchJson<StudentRematricula & { ok: boolean }>("/api/aluno/rematricula/status", controller.signal).then(data => update("rematricula", data)),
          fetchJson<RaaData>("/api/aluno/home/raa-status", controller.signal).then(data => update("raa", data)),
        ]);
      } catch(e) {
        if (!controller.signal.aborted) setError(e instanceof Error ? e.message : "Não foi possível carregar a tua página.");
      } finally { if (!controller.signal.aborted) setLoading(false); }
    };
    void load();
    return () => controller.abort();
  }, [reload, scopedQuery]);
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
  const today = new Intl.DateTimeFormat("pt-AO",{timeZone:"Africa/Luanda",weekday:"long",day:"numeric",month:"long"}).format(new Date());
  return <div className="w-full min-w-0 space-y-4 text-foreground sm:space-y-6" data-testid="aluno-dashboard-editorial">
    <header className="rounded-xl bg-klasse-green px-4 py-4 text-white sm:px-6 sm:py-5">
      <p className="text-xs text-white/90">{today}</p>
      <h1 className="mt-1 break-words text-2xl font-semibold tracking-tight sm:text-3xl">Olá, {firstName}</h1>
      {screen.dashboard.ano_letivo && <p className="mt-2 text-sm text-white/90">Ano letivo {screen.dashboard.ano_letivo}</p>}
    </header>
    <PortalSection id="aluno-summary" title="Em resumo">
      <div className="grid grid-cols-3 gap-2 sm:gap-3" data-testid="aluno-summary-cards">
        <PortalStatCard label="Avisos" tone="info" accessibleLabel="Consultar avisos recentes"
          icon={<Bell className="h-4 w-4" aria-hidden="true" />}
          value={(screen.dashboard.avisos_recentes ?? []).length} href={go("/aluno/avisos")} />
        <PortalStatCard label="Notas" tone={screen.boletim?.is_liberado ? "success" : "neutral"} accessibleLabel="Consultar o estado das notas"
          icon={<BookOpen className="h-4 w-4" aria-hidden="true" />}
          value={typeof screen.boletim?.is_liberado === "boolean" ? (screen.boletim.is_liberado ? "Acesso livre" : "Protegidas") : null}
          href={go("/aluno/academico")} />
        <PortalStatCard label="Vencidas" tone={screen.dashboard.status_financeiro && !screen.dashboard.status_financeiro.error ? (screen.dashboard.status_financeiro.pendentes > 0 ? "warning" : "success") : "neutral"} accessibleLabel="Consultar mensalidades vencidas"
          icon={<Wallet className="h-4 w-4" aria-hidden="true" />}
          value={screen.dashboard.status_financeiro && !screen.dashboard.status_financeiro.error
            ? screen.dashboard.status_financeiro.pendentes : null}
          href={go("/aluno/financeiro")} />
      </div>
    </PortalSection>
    <div className="grid items-start gap-4 lg:grid-cols-5">
      <PortalSection id="next-class" title="Próxima aula" className="lg:col-span-3">
        <PortalSurface>
          {lesson ? <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-4">
              <div className="rounded-lg bg-muted px-3 py-2 text-primary"><p className="text-2xl font-semibold tabular-nums">{lesson.time}</p></div>
              <div className="min-w-0"><p className="text-sm text-muted-foreground">{lesson.day}</p><p className="mt-1 text-lg font-semibold text-foreground">{lesson.subject}</p></div>
            </div>
            {lesson.details.length > 0 && <p className="text-sm text-muted-foreground">{lesson.details.join(" · ")}</p>}
          </div> : <div className="flex items-center gap-3"><span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-muted text-primary"><Clock3 className="h-5 w-5" aria-hidden="true"/></span><p className="text-sm text-muted-foreground">Sem próxima aula publicada.</p></div>}
          <PortalAction className="mt-1 -ml-3" href={go("/aluno/horario")}>
            Ver horário <ArrowRight aria-hidden="true" className="h-4 w-4" />
          </PortalAction>
        </PortalSurface>
      </PortalSection>
      {attentions.length > 0 && <PortalSection id="attention-title" title="A acompanhar" className="lg:col-span-2" testId="attention">
        <div className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-card">
          {attentions.slice(0,3).map(item => {
            const Icon = item.kind === "mensalidade" ? Wallet : item.kind === "rejected" ? AlertCircle : item.kind === "rematricula" ? CalendarCheck : FileText;
            const iconStyle = item.kind === "rejected" ? "bg-red-50 text-red-800" : item.kind === "mensalidade" || item.kind === "rematricula" ? "bg-amber-50 text-amber-800" : "bg-blue-50 text-blue-800";
            return <Link key={item.kind + item.href} href={go(item.href)} className={`flex min-h-14 min-w-0 items-center gap-3 px-3 py-2.5 hover:bg-muted/40 ${focus}`}>
              <span aria-hidden="true" className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${iconStyle}`}><Icon className="h-4 w-4"/></span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-semibold leading-5 text-foreground">{item.title}</span>
                <span className="block text-xs leading-4 text-muted-foreground">{item.kind === "rejected" || item.kind === "academico" ? item.description : item.action}</span>
                {(item.kind === "rejected" || item.kind === "academico") && <span className="sr-only">{item.action}</span>}
              </span>
              <ChevronRight aria-hidden="true" className="h-4 w-4 shrink-0 text-muted-foreground"/>
            </Link>;
          })}
        </div>
      </PortalSection>}
    </div>
    <PortalSection id="notices" title="Avisos da escola" action={
      <PortalAction href={go("/aluno/avisos")}>Ver todos <ArrowRight aria-hidden="true" className="h-4 w-4" /></PortalAction>
    }>
      {(screen.dashboard.avisos_recentes??[]).length===0 ? <PortalEmptyState
        icon={<Bell className="h-5 w-5" />} title="Sem avisos recentes" /> : <ul className="divide-y divide-border rounded-xl border border-border bg-card px-4">
        {screen.dashboard.avisos_recentes.map(a=><li key={a.id} className="py-3"><p className="text-sm font-medium text-foreground">{a.titulo?.trim() || "Aviso da escola"}</p>{a.resumo?.trim() && <p className="mt-1 line-clamp-2 text-sm leading-5 text-muted-foreground">{a.resumo}</p>}<p className="mt-1 text-xs text-muted-foreground">{[a.origem?.trim(),a.data && !Number.isNaN(Date.parse(a.data))?new Intl.DateTimeFormat("pt-AO",{day:"numeric",month:"long",year:"numeric"}).format(new Date(a.data)):""].filter(Boolean).join(" · ")}</p></li>)}
      </ul>}
    </PortalSection>
  </div>;
}
