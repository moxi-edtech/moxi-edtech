"use client";
import { PortalPullToRefresh } from "@/components/portal/ui/PortalPullToRefresh";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { ArrowRight, BookOpen, FileText, Wallet, Bell, Clock3, AlertCircle, CalendarCheck } from "lucide-react";
import { ErrorState } from "@/components/feedback/FeedbackSystem";
import { buildPortalHref, getEscolaParamFromPath } from "@/lib/navigation";
import { buildStudentAttention, nextLessonLabel, type StudentDocument, type StudentRematricula } from "@/lib/aluno/dashboardPresentation";
import { TabHorario } from "@/components/aluno/tabs/TabHorario";
import { PortalDrawerNavigator, PortalDrawerPushButton } from "@/components/portal/ui/PortalDrawerNavigator";
import { StudentDrawerWorkspace } from "@/components/aluno/dashboard/StudentDrawerWorkspace";
import { TabNotificacoes } from "@/components/aluno/tabs/TabNotificacoes";
import AuditPageView from "@/components/audit/AuditPageView";
import { PortalAction } from "@/components/portal/ui/PortalAction";
import { PortalEmptyState } from "@/components/portal/ui/PortalEmptyState";
import { PortalSection } from "@/components/portal/ui/PortalSection";
import { PortalWelcomeCard } from "@/components/portal/ui/PortalWelcomeCard";
import AcaoRapidaCard from "@/components/shared/AcaoRapidaCard";

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
function LoadingDashboard() {
  return <div role="status" aria-live="polite" className="w-full motion-safe:animate-pulse space-y-5 py-2" aria-label="A carregar a tua página"><span className="sr-only">A carregar a tua página</span><div aria-hidden="true">
    <div className="h-36 rounded-xl bg-muted"/>
    <div className="grid gap-2 md:grid-cols-3"><div className="h-16 rounded-xl bg-muted"/><div className="h-16 rounded-xl bg-muted"/><div className="h-16 rounded-xl bg-muted"/></div>
    <div className="h-48 rounded-xl bg-muted"/><div className="h-32 rounded-xl bg-muted"/>
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
  const [refreshing, setRefreshing] = useState(false);
  const drawerScope = `${school}:${scopedQuery}`;
  const [drawer, setDrawer] = useState<{ scope: string; kind: "daily" | "notices" | "notice" | "academic" | "finance" | "documents" | "enrollment"; noticeId?: string } | null>(null);
  useEffect(() => { setDrawer(null); }, [drawerScope]);
  const activeDrawer = drawer?.scope === drawerScope ? drawer.kind : null;
  const openDrawer = (kind: "daily" | "notices" | "academic" | "finance" | "documents" | "enrollment") => setDrawer({ scope: drawerScope, kind });
  const lessonOpen = activeDrawer === "daily";
  const selectedNotice = activeDrawer === "notice" ? screen?.dashboard.avisos_recentes.find(item => item.id === drawer?.noticeId) : null;
  const lastLoadedScope = useRef<string | null>(null);
  const refresh = useCallback(() => { setRefreshing(true); setReload(n => n + 1); }, []);
  useEffect(() => {
    const controller = new AbortController();
    const load = async () => {
      const background = lastLoadedScope.current === drawerScope;
      setRefreshing(true);
      if (!background) { setLoading(true); setScreen(null); }
      setError(null);
      try {
        // Só o resumo é obrigatório para mostrar a página. Os restantes endpoints
        // mantêm as suas próprias regras de autorização e bloqueio financeiro.
        const dashRes = await fetch("/api/aluno/dashboard", { cache: "no-store", signal: controller.signal });
        const dash = await dashRes.json() as DashboardData & { error?: string };
        if (!dashRes.ok || !dash.ok) throw new Error(dash.error || "Não foi possível carregar a tua página.");
        if (controller.signal.aborted) return;

        lastLoadedScope.current = drawerScope;
        setScreen(previous => background && previous ? { ...previous, dashboard: dash } : { dashboard: dash, boletim: null, catalogo: null, rematricula: null, raa: null });
        setLoading(false);

        // Dados facultativos chegam em paralelo e atualizam a interface independentemente.
        // O skeleton principal não deve aguardar por boletim, catálogo, RAA ou rematrícula.
        const update = <K extends Exclude<keyof ScreenData, "dashboard">>(key: K, value: ScreenData[K]) => {
          if (controller.signal.aborted) return;
          setScreen(current => current ? { ...current, [key]: value } : current);
        };
        await Promise.allSettled([
          fetchJson<BoletimData>("/api/aluno/boletim", controller.signal, scopedQuery).then(data => update("boletim", data)),
          fetchJson<CatalogoData>("/api/aluno/documentos/catalogo", controller.signal, scopedQuery).then(data => update("catalogo", data)),
          scopedQuery ? Promise.resolve() : fetchJson<StudentRematricula & { ok: boolean }>("/api/aluno/rematricula/status", controller.signal).then(data => update("rematricula", data)),
          fetchJson<RaaData>("/api/aluno/home/raa-status", controller.signal).then(data => update("raa", data)),
        ]);
      } catch(e) {
        if (!controller.signal.aborted) setError(e instanceof Error ? e.message : "Não foi possível carregar a tua página.");
      } finally { if (!controller.signal.aborted) { setLoading(false); setRefreshing(false); } }
    };
    void load();
    return () => controller.abort();
  }, [reload, scopedQuery, drawerScope]);
  const attentions = useMemo(() => screen ? buildStudentAttention({
    pendentes: screen.dashboard.status_financeiro?.pendentes ?? 0,
    financialError: Boolean(screen.dashboard.status_financeiro?.error),
    documentos: screen.catalogo?.documentos,
    rematricula: scopedQuery ? null : screen.rematricula,
    academic: screen.raa?.result,
  }) : [], [screen, scopedQuery]);
  if (loading || (!error && lastLoadedScope.current !== drawerScope)) return <LoadingDashboard/>;
  if (error || !screen) return <PortalPullToRefresh onRefresh={refresh} busy={refreshing} className="mx-auto max-w-6xl px-4 py-8"><ErrorState title="Não foi possível carregar" description={error || "Tenta novamente."} onRetry={refresh}/></PortalPullToRefresh>;
  const lesson = nextLessonLabel(screen.dashboard.proxima_aula);
  const firstName = screen.boletim?.nome_aluno?.trim().split(/\s+/)[0] || "aluno";
  const today = new Date();
  return <PortalPullToRefresh onRefresh={refresh} busy={loading || refreshing} disabled={activeDrawer !== null} className="w-full min-w-0 space-y-6 text-foreground sm:space-y-8" data-testid="aluno-dashboard-editorial">
    <PortalWelcomeCard role="aluno" name={firstName} context={screen.dashboard.ano_letivo ? `Ano lectivo ${screen.dashboard.ano_letivo}` : null} date={today} />
    <PortalSection id="aluno-summary" title="Em resumo">
      <div className="grid grid-cols-2 gap-3 min-[380px]:grid-cols-3" data-testid="aluno-summary-cards">
        <AcaoRapidaCard dashboardCompact mobileCompact label="Avisos" portalTile portalClean
          icon={<Bell className="h-4 w-4" />} sublabel={`${(screen.dashboard.avisos_recentes ?? []).length} recentes`}
          onClick={() => openDrawer("notices")} dialogOpen={activeDrawer === "notices"} />
        <AcaoRapidaCard dashboardCompact mobileCompact label="Notas" portalTile portalClean
          icon={<BookOpen className="h-4 w-4" />} unavailable={typeof screen.boletim?.is_liberado !== "boolean"}
          sublabel={typeof screen.boletim?.is_liberado === "boolean" ? (screen.boletim.is_liberado ? "Acesso livre" : "Protegidas") : "Dados indisponíveis"}
          onClick={() => openDrawer("academic")} dialogOpen={activeDrawer === "academic"} />
        <AcaoRapidaCard dashboardCompact mobileCompact label="Propinas vencidas" portalTile portalClean
          icon={<Wallet className="h-4 w-4" />}
          unavailable={!screen.dashboard.status_financeiro || Boolean(screen.dashboard.status_financeiro.error)}
          needsAttention={Boolean(screen.dashboard.status_financeiro && !screen.dashboard.status_financeiro.error && screen.dashboard.status_financeiro.pendentes > 0)}
          sublabel={screen.dashboard.status_financeiro && !screen.dashboard.status_financeiro.error
            ? String(screen.dashboard.status_financeiro.pendentes) : "Dados indisponíveis"}
          onClick={() => openDrawer("finance")} dialogOpen={activeDrawer === "finance"} />
      </div>
    </PortalSection>
    <div className="grid items-start gap-6 lg:grid-cols-5">
      <PortalSection id="next-class" title="Próxima aula" className="lg:col-span-3">
        <AcaoRapidaCard dashboardCompact mobileCompact portalClean icon={<Clock3 className="h-4 w-4"/>}
          label={lesson ? lesson.subject : "Sem próxima aula publicada"}
          sublabel={lesson ? [lesson.day, lesson.time, ...lesson.details].join(" · ") : "Ver horário"}
          onClick={() => openDrawer("daily")} dialogOpen={lessonOpen} />
      </PortalSection>
      {attentions.length > 0 && <PortalSection id="attention-title" title="A acompanhar" className="lg:col-span-2" testId="attention">
        <div className="grid gap-3">
          {attentions.slice(0,3).map(item => {
            const Icon = item.kind === "mensalidade" ? Wallet : item.kind === "rejected" ? AlertCircle : item.kind === "rematricula" ? CalendarCheck : FileText;
            const needsAttention = item.kind === "rejected" || item.kind === "mensalidade" || item.kind === "rematricula" || item.kind === "academico";
            const contextual = item.href === "/aluno/academico" && item.kind !== "academico" ? "enrollment" : item.href === "/aluno/financeiro" ? "finance" : item.href === "/aluno/documentos" ? "documents" : item.kind === "academico" ? "academic" : null;
            return <AcaoRapidaCard key={item.kind + item.href} dashboardCompact mobileCompact portalClean
              icon={<Icon className="h-4 w-4"/>} label={item.title} needsAttention={needsAttention}
              sublabel={item.kind === "rejected" || item.kind === "academico" ? [item.description, item.action].filter(Boolean).join(" · ") : item.action}
              {...(contextual ? { onClick: () => openDrawer(contextual), dialogOpen: activeDrawer === contextual } : { href: go(item.href) })} />;
          })}
        </div>
      </PortalSection>}
    </div>
    <PortalSection id="notices" title="Avisos da escola" action={
      <PortalAction onClick={() => openDrawer("notices")}>Ver todos <ArrowRight aria-hidden="true" className="h-4 w-4" /></PortalAction>
    }>
      {(screen.dashboard.avisos_recentes??[]).length===0 ? <PortalEmptyState
        icon={<Bell className="h-5 w-5" />} title="Sem avisos recentes" /> : <ul className="divide-y divide-border rounded-xl border border-border bg-card px-4">
        {screen.dashboard.avisos_recentes.map(a=><li key={a.id}><button type="button" aria-haspopup="dialog" onClick={() => setDrawer({ scope: drawerScope, kind: "notice", noticeId: a.id })} className="klasse-portal-press block w-full py-3 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"><p className="text-sm font-medium text-foreground">{a.titulo?.trim() || "Aviso da escola"}</p>{a.resumo?.trim() && <p className="mt-1 line-clamp-2 text-sm leading-5 text-muted-foreground">{a.resumo}</p>}<p className="mt-1 text-xs text-muted-foreground">{[a.origem?.trim(),a.data && !Number.isNaN(Date.parse(a.data))?new Intl.DateTimeFormat("pt-AO",{day:"numeric",month:"long",year:"numeric"}).format(new Date(a.data)):""].filter(Boolean).join(" · ")}</p></button></li>)}
      </ul>}
    </PortalSection>
    <PortalDrawerNavigator key={drawerScope} open={activeDrawer !== null} onReopen={() => setDrawer(drawer)} onClose={() => setDrawer(null)} onChanged={refresh}
      root={activeDrawer === "enrollment" ? {
        id: `${drawerScope}:enrollment`, title: "Rematrícula", description: "Consulta o pedido e acompanha o comprovativo.",
        content: <StudentDrawerWorkspace scope={drawerScope} kind="enrollment" />,
      } : activeDrawer === "academic" ? {
        id: `${drawerScope}:academic`, title: "Académico", description: "Notas, disciplinas, faltas e documentos.",
        content: <StudentDrawerWorkspace scope={drawerScope} kind="academic" initialTab="notas" />,
      } : activeDrawer === "finance" ? {
        id: `${drawerScope}:finance`, title: "Situação financeira", description: "Consulta propinas, recibos e pagamentos.",
        content: <StudentDrawerWorkspace scope={drawerScope} kind="finance" />,
      } : activeDrawer === "documents" ? {
        id: `${drawerScope}:documents:all`, title: "Documentos e serviços", description: "Consulta e acompanha os teus pedidos.",
        content: <StudentDrawerWorkspace scope={drawerScope} kind="documents" />,
      } : selectedNotice ? {
        id: `${drawerScope}:notice:${selectedNotice.id}`, title: selectedNotice.titulo || "Aviso da escola", description: selectedNotice.origem || "Comunicação da escola",
        content: <><AuditPageView portal="aluno" acao="PAGE_VIEW" entity="avisos" /><p className="whitespace-pre-wrap break-words text-sm leading-relaxed">{selectedNotice.resumo || "Sem informação adicional."}</p><PortalDrawerPushButton frame={{ id: `${drawerScope}:notices`, title: "Avisos", description: "Comunicações publicadas pela escola.", content: <TabNotificacoes /> }} className="min-h-11 rounded-xl border border-border px-4 text-sm font-semibold text-primary">Ver todos os avisos</PortalDrawerPushButton></>,
      } : activeDrawer === "notices" ? {
        id: `${drawerScope}:notices`, title: "Avisos", description: "Comunicações publicadas pela escola.",
        content: <><AuditPageView portal="aluno" acao="PAGE_VIEW" entity="avisos" /><TabNotificacoes /></>,
      } : {
        id: `${drawerScope}:daily`, title: "Horário diário", description: "Consulta as aulas publicadas por dia da semana.",
        content: lessonOpen ? <>
          <TabHorario dailyOnly>{snapshot => (
          <PortalDrawerPushButton className="klasse-portal-cta min-h-11 w-full rounded-xl px-4 py-2 text-sm font-semibold"
            frame={{ id: `${drawerScope}:weekly`, title: "Horário completo", description: "Consulta todas as aulas da semana.", content: <TabHorario snapshot={snapshot} /> }}>
            Consultar horário completo
          </PortalDrawerPushButton>
          )}</TabHorario>
        </> : null,
      }} />
  </PortalPullToRefresh>;
}
