"use client";

import { useCallback, useMemo, useRef, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { Activity, Building2, ChevronRight, Clock3, Plus, Shield, Users, Wallet, ArrowLeft } from "lucide-react";
import dynamic from "next/dynamic";
import AcaoRapidaCard from "@/components/shared/AcaoRapidaCard";
import { ModalShell } from "@/components/ui/ModalShell";
import { SuperAdminWorkspaceContext, resolveWorkspaceRoute, type WorkspaceRoute } from "./workspace-navigation";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import AuditPageView from "@/components/audit/AuditPageView";
import { PortalCulturalSignature as PortalSignature } from "@/components/portal/ui/PortalWelcomeCard";

function Loading() { return <div role="status" aria-label="A carregar" className="h-40 rounded-xl bg-muted motion-safe:animate-pulse" />; }
const opts = { ssr: false, loading: Loading };
const Schools = dynamic(() => import("./escolas/SchoolsTableClient"), opts);
const NewSchool = dynamic(() => import("@/app/super-admin/escolas/nova/page"), opts);
const Onboarding = dynamic(() => import("@/app/super-admin/onboarding/page"), opts);
const Billing = dynamic(() => import("./cobrancas/CobrancasListClient"), opts);
const BillingHistory = dynamic(() => import("./cobrancas/BillingAuditHistoryTab"), opts);
const UsersList = dynamic(() => import("./UsuariosListClient").then(m => m.SuperAdminUsuariosListClient), opts);
const NewUser = dynamic(() => import("@/app/super-admin/usuarios/novo/page"), opts);
const Health = dynamic(() => import("@/app/super-admin/health/page"), opts);
const Diagnostics = dynamic(() => import("./DiagnosticsDashboard"), opts);
const Plans = dynamic(() => import("./planos/PlanosComerciaisClient"), opts);
const Partners = dynamic(() => import("@/app/super-admin/parceiros/page"), opts);
const Marketing = dynamic(() => import("@/app/super-admin/marketing/page"), opts);
const Commissions = dynamic(() => import("./comissoes/PartnerCommissionsClient"), opts);
const Subscriptions = dynamic(() => import("./subscricoes/SubscricoesCockpitClient"), opts);
const Students = dynamic(() => import("./StudentReclassificationTool"), opts);
const Centers = dynamic(() => import("./centros-formacao/CentrosFormacaoTableClient"), opts);
const NewCenter = dynamic(() => import("@/app/super-admin/centros-formacao/novo/page"), opts);
const Communication = dynamic(() => import("@/app/super-admin/comunicacao/page"), opts);
const EmailPreview = dynamic(() => import("@/app/super-admin/debug/email-preview/page"), opts);
const ActiveUsers = dynamic(() => import("./ActiveUsersWorkspace"), opts);
const SchoolMonitor = dynamic(() => import("./escola-monitor/SchoolMonitorWorkspace"), opts);

function WorkspaceBody({ route }: { route: WorkspaceRoute }) {
  if (route.schoolId) return <SchoolMonitor escolaId={route.schoolId} />;
  switch (route.path) {
    case "/super-admin/escolas": return <><AuditPageView portal="super_admin" acao="PAGE_VIEW" entity="escolas_list" /><Schools initialSchools={[]} initialProgress={{}} /></>;
    case "/super-admin/escolas/nova": return <NewSchool />;
    case "/super-admin/onboarding": return <Onboarding />;
    case "/super-admin/cobrancas": return <Tabs defaultValue="assinaturas" className="min-w-0"><TabsList><TabsTrigger value="assinaturas">Subscrições</TabsTrigger><TabsTrigger value="historico">Histórico de receitas</TabsTrigger></TabsList><TabsContent value="assinaturas"><Billing /></TabsContent><TabsContent value="historico"><BillingHistory /></TabsContent></Tabs>;
    case "/super-admin/usuarios/activos": return <ActiveUsers />;
    case "/super-admin/usuarios": return <><AuditPageView portal="super_admin" acao="PAGE_VIEW" entity="usuarios_list" /><UsersList /></>;
    case "/super-admin/usuarios/novo": return <NewUser />;
    case "/super-admin/health": return <Health />;
    case "/super-admin/diagnostics": return <Diagnostics />;
    case "/super-admin/planos": return <Plans />;
    case "/super-admin/parceiros": return <Partners />;
    case "/super-admin/marketing": return <Marketing />;
    case "/super-admin/comissoes": return <Commissions />;
    case "/super-admin/subscricoes": return <Subscriptions />;
    case "/super-admin/operacoes-alunos": return <Students />;
    case "/super-admin/centros-formacao": return <Centers />;
    case "/super-admin/centros-formacao/novo": return <NewCenter />;
    case "/super-admin/comunicacao": return <Communication />;
    case "/super-admin/debug/email-preview": return <EmailPreview />;
    default: return <p role="alert">Operação indisponível.</p>;
  }
}

export default function CommandCenterWorkspace({ children, afterActions, date, networkStatus, pending, risk, activeUsers }: { children: ReactNode; afterActions: ReactNode; date: string; networkStatus: string; pending?: number; risk?: number; activeUsers: number | null }) {
  const router = useRouter();
  const [stack, setStack] = useState<WorkspaceRoute[]>([]);
  const [revision, setRevision] = useState(0);
  const [warning, setWarning] = useState<"busy" | "dirty" | null>(null);
  const guards = useRef(new Map<string, "busy" | "dirty">());
  const changed = useRef(false);
  const trigger = useRef<HTMLElement | null>(null);
  const format = (n: number) => n.toLocaleString("pt-AO");
  const current = stack[stack.length - 1];
  const setGuard = useCallback((key: string, state: "busy" | "dirty" | null) => { if (state) guards.current.set(key, state); else guards.current.delete(key); }, []);
  const markChanged = useCallback(() => { changed.current = true; setRevision(v => v + 1); }, []);
  const open = useCallback((href: string) => {
    const route = resolveWorkspaceRoute(href);
    if (!route) return false;
    const states = [...guards.current.values()];
    if (states.length) { setWarning(states.includes("busy") ? "busy" : "dirty"); return true; }
    if (!document.querySelector("[data-workspace-path]")) trigger.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    setWarning(null);
    setStack(previous => {
      if (previous[previous.length - 1]?.href === route.href) return previous;

      const existing = previous.findIndex(item => item.href === route.href);
      return existing >= 0 ? previous.slice(0, existing + 1) : [...previous, route];
    });
    return true;
  }, []);
  const close = useCallback((force = false) => {
    const states = [...guards.current.values()];
    if (states.includes("busy")) { setWarning("busy"); return; }
    if (!force && states.includes("dirty")) { setWarning("dirty"); return; }
    setWarning(null); setStack([]);
    if (changed.current) { changed.current = false; router.refresh(); }
  }, [router]);
  const back = useCallback(() => {
    if (stack.length <= 1) { close(); return; }
    if (guards.current.size) { setWarning([...guards.current.values()].includes("busy") ? "busy" : "dirty"); return; }
    setStack(previous => previous.slice(0, -1));
  }, [stack.length, close]);
  const context = useMemo(() => ({ open, back, markChanged, setGuard, revision }), [open, back, markChanged, setGuard, revision]);
  const actions = [
    { href: "/super-admin/escolas", label: "Gerir escolas", icon: Building2 },
    { href: "/super-admin/escolas/nova", label: "Nova escola", icon: Plus },
    { href: "/super-admin/onboarding", label: "Onboarding", icon: Clock3, count: pending, suffix: " por concluir", indicator: true },
    { href: "/super-admin/cobrancas", label: "Cobranças", icon: Wallet },
    { href: "/super-admin/usuarios", label: "Utilizadores", icon: Users },
    { href: "/super-admin/health", label: "Saúde e alertas", icon: Shield, count: risk, suffix: " sem acesso recente", indicator: true },
  ];
  return <SuperAdminWorkspaceContext.Provider value={context}>
    <section aria-label="Estado da rede" className="klasse-welcome-card klasse-operations-academic-card min-w-0 overflow-hidden rounded-xl">
      <div className="flex flex-wrap items-center justify-between gap-4 px-4 py-4 sm:px-6">
        <div className="min-w-0 space-y-1"><p className="text-xs font-medium">{date}</p><h2 className="text-xl font-semibold tracking-tight">Command Center</h2><p className="text-sm">{networkStatus}</p></div>
        <button type="button" aria-haspopup="dialog" aria-expanded={current?.path === "/super-admin/health"} onClick={() => open("/super-admin/health")} className="inline-flex min-h-10 items-center gap-1 rounded-xl border border-current px-3 text-sm font-medium focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2">Saúde da rede <ChevronRight className="h-4 w-4" aria-hidden /></button>
      </div>
      <PortalSignature />
    </section>
    <section aria-label="Indicadores globais" className="grid grid-cols-2 gap-3 lg:grid-cols-5">
      {children}
      <button type="button" aria-haspopup="dialog" aria-expanded={current?.path === "/super-admin/usuarios/activos"} onClick={() => open("/super-admin/usuarios/activos")} className="group min-w-0 rounded-xl border border-border bg-card p-3 text-left hover:border-ring focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:p-4">
        <span className="flex items-center justify-between gap-2"><span className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-emerald/10 text-emerald dark:text-emerald-300"><Activity className="h-4 w-4" aria-hidden /></span><ChevronRight className="h-4 w-4 text-muted-foreground" aria-hidden /></span>
        <span className="mt-3 block text-xs text-muted-foreground">Utilizadores activos</span><span className="mt-1 block text-xl font-semibold tabular-nums text-foreground">{activeUsers == null ? "—" : format(activeUsers)}</span><span className="mt-1 block text-xs text-muted-foreground">{activeUsers == null ? "Indisponível" : "Últimos 5 minutos"}</span>
      </button>
    </section>
    <section aria-labelledby="super-admin-actions-title" className="space-y-3">
      <h2 id="super-admin-actions-title" className="text-base font-semibold text-foreground">Ações rápidas</h2>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{actions.map(({ href, label, icon: Icon, count, suffix, indicator }) => <AcaoRapidaCard key={href} dashboardCompact icon={<Icon />} label={label} sublabel={indicator ? count == null ? "Dados indisponíveis" : format(count) + suffix : undefined} unavailable={indicator && count == null} needsAttention={indicator && count != null && count > 0} onClick={() => open(href)} dialogOpen={current?.path === href} />)}</div>
    </section>
    {afterActions}
    <ModalShell open={Boolean(current)} title={current?.title ?? "Command Center"} size="wide" mobileFullscreen keyboardAware onClose={() => close()} onRestoreFocus={() => trigger.current?.focus({ preventScroll: true })}
      footer={warning ? <div role="alert" className="flex flex-wrap items-center justify-between gap-3 text-sm"><p>{warning === "busy" ? "Aguarde a conclusão da operação." : "Existem alterações não guardadas."}</p><div className="flex gap-2"><button type="button" className="rounded-xl border border-border px-3 py-2" onClick={() => setWarning(null)}>Continuar</button>{warning === "dirty" && <button type="button" className="rounded-xl bg-destructive px-3 py-2 text-destructive-foreground" onClick={() => close(true)}>Descartar e fechar</button>}</div></div> : undefined}>
      {stack.length > 1 && <button type="button" onClick={back} className="mb-4 inline-flex items-center gap-2 rounded-xl border border-border px-3 py-2 text-sm"><ArrowLeft className="h-4 w-4" />Voltar</button>}
      {stack.map((route, i) => <div key={route.href} hidden={i !== stack.length - 1} className="min-w-0" data-workspace-path={route.path}><SuperAdminWorkspaceContext.Provider value={{ ...context, route }}><WorkspaceBody route={route} /></SuperAdminWorkspaceContext.Provider></div>)}
    </ModalShell>
  </SuperAdminWorkspaceContext.Provider>;
}
