import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Activity, Building2, ChevronRight, Clock3, GraduationCap, Plus, Shield, Users, Wallet } from "lucide-react";
import { DashboardHeader } from "@/components/dashboard/DashboardHeader";
import { PortalCulturalSignature } from "@/components/portal/ui/PortalWelcomeCard";
import AcaoRapidaCard from "@/components/shared/AcaoRapidaCard";
import CommandCenterDetails from "@/components/super-admin/CommandCenterDetails";
import ChartsSection from "@/components/super-admin/ChartsSection";
import SchoolsSection from "@/components/super-admin/SchoolsSection";
import { calcularSaudeEscola } from "@/lib/super-admin/escola-saude-utils";
import { isSuperAdminRole } from "@/lib/auth/requireSuperAdminAccess";
import { supabaseServer } from "@/lib/supabaseServer";
import type { ChartsData } from "@/lib/charts";

export const dynamic = "force-dynamic";

type School = {
  id: string;
  nome: string;
  plano: string;
  onboarding_finalizado: boolean;
  progresso_onboarding: number;
  alunos_ativos: number;
  ultimo_acesso?: string | null;
};

const numberFormat = new Intl.NumberFormat("pt-AO");
const format = (value: number | null | undefined) => value == null ? "—" : numberFormat.format(value);

function fulfilled<T>(result: PromiseSettledResult<T>): T | undefined {
  return result.status === "fulfilled" ? result.value : undefined;
}

export default async function SuperAdminDashboard() {
  const supabase = await supabaseServer();
  const { data: auth, error: authError } = await supabase.auth.getUser();
  if (authError || !auth.user) redirect("/redirect");
  const { data: profile, error: profileError } = await supabase
    .from("profiles").select("role").eq("user_id", auth.user.id).single();
  if (profileError || !isSuperAdminRole(profile?.role)) notFound();

  // Use the authenticated client and explicit global sources. Do not infer the
  // scope from a selected school or bypass the existing database policies.
  const results = await Promise.allSettled([
    supabase.from("escolas").select("id", { count: "exact", head: true }).eq("status", "ativa"),
    supabase.from("profiles").select("id", { count: "exact", head: true }),
    (supabase.from("vw_admin_dashboard_counts") as any).select("alunos_ativos", { count: "exact" }),
    supabase.rpc("admin_get_escola_health_metrics"),
    (supabase.from("vw_pagamentos_status") as any).select("status, total", { count: "exact" }),
    supabase.from("audit_logs").select("id, created_at, action, entity, escola_id, escolas(nome)")
      .neq("action", "PAGE_VIEW").order("created_at", { ascending: false }).limit(8),
  ] as const);

  const active = fulfilled(results[0]);
  const people = fulfilled(results[1]);
  const students = fulfilled(results[2]);
  const health = fulfilled(results[3]);
  const payments = fulfilled(results[4]);
  const logs = fulfilled(results[5]);

  const schools = health && !health.error && Array.isArray(health.data) ? health.data as unknown as School[] : undefined;
  const now = Date.now();
  const risk = schools?.filter(s => {
    const access = s.ultimo_acesso ? Date.parse(s.ultimo_acesso) : NaN;
    return !Number.isFinite(access) || now - access > 5 * 86400000;
  }).length;
  const score = schools?.length ? Math.round(schools.reduce((sum, s) => sum + calcularSaudeEscola(s), 0) / schools.length) : undefined;
  const pending = schools?.filter(s => !s.onboarding_finalizado).length;
  const studentTotal = students && !students.error && Array.isArray(students.data) && students.count === students.data.length
    && students.data.every((r: { alunos_ativos: unknown }) => typeof r.alunos_ativos === "number" && Number.isFinite(r.alunos_ativos))
    ? students.data.reduce((sum: number, r: { alunos_ativos: number }) => sum + r.alunos_ativos, 0) : undefined;

  let charts: ChartsData | undefined;
  if (payments && !payments.error && Array.isArray(payments.data) && payments.count === payments.data.length) {
    const grouped = new Map<string, number>();
    for (const row of payments.data) {
      const status = String(row.status ?? "desconhecido");
      grouped.set(status, (grouped.get(status) ?? 0) + Number(row.total ?? 0));
    }
    const total = [...grouped.values()].reduce((sum, n) => sum + n, 0);
    if (total > 0 && Number.isFinite(total) && [...grouped.values()].every(n => Number.isFinite(n) && n >= 0)) {
      charts = { pagamentos: [...grouped].map(([status, total]) => ({ status, total })),
        eficiencia: Math.round(((grouped.get("pago") ?? 0) / total) * 1000) / 10 };
    }
  }

  const metrics = [
    { label: "Escolas activas", value: format(active?.error ? null : active?.count), icon: Building2 },
    { label: "Alunos activos", value: format(studentTotal), icon: GraduationCap },
    { label: "Utilizadores", value: format(people?.error ? null : people?.count), icon: Users },
    { label: "Saúde das escolas", value: score == null ? "—" : format(score) + "%", icon: Activity },
  ];
  const date = new Intl.DateTimeFormat("pt-AO", { timeZone: "Africa/Luanda", weekday: "long", day: "numeric", month: "long" }).format(new Date(now));

  return (
    <div data-testid="super-admin-command-center" className="min-w-0 space-y-6 pb-12">
      <DashboardHeader title="Visão geral" description="Gestão da plataforma KLASSE" largeDesktopTitle />
      <section aria-label="Estado da rede" className="klasse-welcome-card klasse-operations-academic-card min-w-0 overflow-hidden rounded-xl">
        <div className="flex flex-wrap items-center justify-between gap-4 px-4 py-4 sm:px-6">
          <div className="min-w-0 space-y-1">
            <p className="text-xs font-medium">{date}</p>
            <h2 className="text-xl font-semibold tracking-tight">Command Center</h2>
            <p className="text-sm">{risk == null ? "Estado da rede indisponível" : schools?.length === 0 ? "Sem escolas para avaliar" : risk > 0 ? format(risk) + " escolas sem acesso recente" : "Nenhuma escola sem acesso recente"}</p>
          </div>
          <Link href="/super-admin/health" prefetch={false} className="inline-flex min-h-10 items-center gap-1 rounded-xl border border-current px-3 text-sm font-medium focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2">
            Saúde da rede <ChevronRight className="h-4 w-4" aria-hidden="true" />
          </Link>
        </div>
        <PortalCulturalSignature />
      </section>
      <section aria-label="Indicadores globais" className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {metrics.map(({ label, value, icon: Icon }) => (
          <article key={label} className="min-w-0 rounded-xl border border-border bg-card p-3 sm:p-4">
            <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-emerald/10 text-emerald dark:text-emerald-300"><Icon aria-hidden="true" className="h-4 w-4" /></span>
            <p className="mt-3 break-words text-xs text-muted-foreground">{label}</p>
            <p className="mt-1 break-words text-xl font-semibold tabular-nums text-foreground">{value}</p>
            {value === "—" && <p className="mt-1 text-xs text-muted-foreground">Indisponível</p>}
          </article>
        ))}
      </section>
      <section aria-labelledby="super-admin-actions-title" className="space-y-3">
        <h2 id="super-admin-actions-title" className="text-base font-semibold text-foreground">Ações rápidas</h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <AcaoRapidaCard dashboardCompact icon={<Building2 />} label="Gerir escolas" href="/super-admin/escolas" prefetch={false} />
          <AcaoRapidaCard dashboardCompact icon={<Plus />} label="Nova escola" href="/super-admin/escolas/nova" prefetch={false} />
          <AcaoRapidaCard dashboardCompact icon={<Clock3 />} label="Onboarding" sublabel={pending == null ? "Dados indisponíveis" : format(pending) + " por concluir"} unavailable={pending == null} needsAttention={pending != null && pending > 0} href="/super-admin/onboarding" prefetch={false} />
          <AcaoRapidaCard dashboardCompact icon={<Wallet />} label="Cobranças" href="/super-admin/cobrancas" prefetch={false} />
          <AcaoRapidaCard dashboardCompact icon={<Users />} label="Utilizadores" href="/super-admin/usuarios" prefetch={false} />
          <AcaoRapidaCard dashboardCompact icon={<Shield />} label="Saúde e alertas" sublabel={risk == null ? "Dados indisponíveis" : format(risk) + " sem acesso recente"} unavailable={risk == null} needsAttention={risk != null && risk > 0} href="/super-admin/health" prefetch={false} />
        </div>
      </section>
      <section aria-labelledby="super-admin-activity-title" className="min-w-0 space-y-3 rounded-xl border border-border bg-card p-4">
        <h2 id="super-admin-activity-title" className="text-base font-semibold text-foreground">Atividade recente</h2>
        {!logs || logs.error || !logs.data ? <p className="text-sm text-muted-foreground">Não foi possível carregar a atividade.</p> :
          logs.data.length === 0 ? <p className="text-sm text-muted-foreground">Nenhuma atividade registada.</p> :
          <div className="divide-y divide-border">
            {logs.data.map(log => (
              <div key={log.id} className="flex flex-wrap items-start justify-between gap-2 py-2.5 text-sm">
                <span className="min-w-0 break-words text-foreground"><span className="block font-medium">{(log.escolas as unknown as { nome?: string } | null)?.nome ?? "Sistema Central"}</span><span className="text-xs text-muted-foreground">{log.action} · {log.entity}</span></span>
                <time className="shrink-0 text-xs text-muted-foreground" dateTime={log.created_at ?? undefined}>{log.created_at ? new Date(log.created_at).toLocaleString("pt-AO", { timeZone: "Africa/Luanda", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }) : "—"}</time>
              </div>
            ))}
          </div>}
      </section>
      <CommandCenterDetails finance={<ChartsSection data={charts} />} schools={schools ? <SchoolsSection escolas={schools} /> : <p className="text-sm text-muted-foreground">Não foi possível carregar as escolas.</p>} />
    </div>
  );
}
