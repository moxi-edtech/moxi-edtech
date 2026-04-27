import Link from "next/link";
import { redirect } from "next/navigation";
import { getFormacaoAuthContext } from "@/lib/auth-context";
import { resolveFormacaoSessionContext } from "@/lib/session-context";
import { supabaseServer } from "@/lib/supabaseServer";
import type { FormacaoSupabaseClient } from "@/lib/db-types";
import { isCenterAdminDashboardType, mapTenantTypeFromDb } from "@/lib/navigation-engine";
import { TalentPoolTeaser } from "./_components/TalentPoolTeaser";

export const dynamic = "force-dynamic";

export default async function AdminCentroDashboardPage() {
  const auth = await getFormacaoAuthContext();
  if (!auth) redirect("/login");

  if (!["formacao_admin", "super_admin", "global_admin"].includes(String(auth.role))) {
    redirect("/forbidden");
  }

  const session = await resolveFormacaoSessionContext();
  const escolaId = session?.tenantId ?? null;

  let onboardingDone = false;
  let cursosCount = 0;
  let cohortsCount = 0;
  let inscricoesCount = 0;
  if (escolaId) {
    const s = (await supabaseServer()) as FormacaoSupabaseClient;
    
    const [
      cursosRes,
      cohortsRes,
      lotacaoRes,
      fiscalRes,
    ] = await Promise.all([
      s.from("formacao_cursos").select("id", { count: "exact", head: true }).eq("escola_id", escolaId),
      s
        .from("vw_formacao_cohorts_overview")
        .select("id", { count: "exact", head: true })
        .eq("status", "aberta"),
      s.from("vw_formacao_cohorts_lotacao").select("inscritos_total"),
      s.from("fiscal_escola_bindings").select("id").eq("escola_id", escolaId).limit(1),
    ]);

    cursosCount = cursosRes.count ?? 0;
    cohortsCount = cohortsRes.count ?? 0;
    inscricoesCount = ((lotacaoRes.data ?? []) as Array<{ inscritos_total: number | null }>).reduce(
      (acc, row) => acc + Number(row.inscritos_total ?? 0),
      0
    );
    onboardingDone = (fiscalRes.data ?? []).length > 0;
  }

  const type = mapTenantTypeFromDb(String(auth.tenantType ?? ""));
  if (!isCenterAdminDashboardType(type)) {
    redirect("/mentor/dashboard");
  }

  const catalogReady = cursosCount > 0;
  const cohortReady = cohortsCount > 0;
  const operationalCompleted = [catalogReady, cohortReady, onboardingDone].filter(Boolean).length;
  const operationalReady = operationalCompleted === 3;
  const onboardingActions = [
    !onboardingDone
      ? {
          href: "/admin/onboarding",
          title: "Configurar dados fiscais",
          description: "Concluir onboarding operacional para liberar o ciclo financeiro.",
        }
      : null,
    !catalogReady
      ? {
          href: "/admin/cursos",
          title: "Publicar catálogo",
          description: "Definir oferta ativa e preparar base para abertura de turmas.",
        }
      : null,
    !cohortReady
      ? {
          href: "/admin/cohorts",
          title: "Abrir primeira turma",
          description: "Criar turma operacional, vagas e referência financeira padrão.",
        }
      : null,
  ].filter(Boolean) as Array<{ href: string; title: string; description: string }>;

  const recurringActions: Array<{ href: string; title: string; description: string }> = [
    {
      href: "/admin/admissoes-web",
      title: "Nova inscrição",
      description: "Registar formandos no balcão e seguir o fluxo de matrícula com cobrança.",
    },
    {
      href: "/admin/cohorts",
      title: "Gerir turmas",
      description: "Abrir novas edições, atualizar vagas e acompanhar o andamento das turmas.",
    },
    {
      href: "/admin/cursos",
      title: "Atualizar catálogo",
      description: "Manter cursos ativos, preços e estrutura de oferta sempre atualizados.",
    },
  ];

  const quickActions = operationalReady ? recurringActions : onboardingActions;

  return (
    <div className="space-y-8 pb-12">
      <header className="rounded-2xl border border-slate-200 bg-white p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="m-0 text-xs font-semibold uppercase tracking-[0.2em] text-slate-600">admin centro</p>
          <span
            className={`rounded-full border px-3 py-1 text-xs font-semibold ${
              operationalReady
                ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                : "border-amber-200 bg-amber-50 text-amber-700"
            }`}
          >
            {operationalReady
              ? "Centro Operacional"
              : `Operacionalização em curso (${operationalCompleted}/3)`}
          </span>
        </div>
        <h1 className="mt-1 text-2xl font-black tracking-tight text-slate-900">Dashboard de Gestão</h1>
        <p className="mt-3 max-w-2xl text-sm leading-relaxed text-slate-600">
          Visão operacional para arranque do centro. Priorize onboarding fiscal, catálogo e abertura de turmas para destravar o ciclo financeiro e académico.
        </p>
      </header>

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard 
          title="Onboarding" 
          value={onboardingDone ? "Concluído" : "Pendente"} 
          subtitle={onboardingDone ? "Fiscal operacional" : "Bloqueio principal"} 
          tone={onboardingDone ? "positive" : "warning"} 
        />
        <MetricCard title="Cursos" value={String(cursosCount)} subtitle="Catálogo publicado" tone="neutral" />
        <MetricCard title="Turmas" value={String(cohortsCount)} subtitle="Edições ativas" tone="neutral" />
        <MetricCard title="Inscritos" value={String(inscricoesCount)} subtitle="Total de formandos" tone="positive" />
      </section>

      <div className="mt-8">
        <h2 className="text-xs font-black uppercase tracking-widest text-slate-400 mb-4 px-2">
          {operationalReady ? "Ações Recorrentes" : "Ações Rápidas"}
        </h2>
        <section className="grid gap-3 sm:grid-cols-3">
          {quickActions.map((action) => (
            <CenterActionCard
              key={action.title}
              href={action.href}
              title={action.title}
              description={action.description}
            />
          ))}
        </section>
      </div>

      <TalentPoolTeaser />
    </div>
  );
}

function MetricCard({
  title,
  value,
  subtitle,
  tone,
}: {
  title: string;
  value: string;
  subtitle: string;
  tone: "warning" | "neutral" | "positive";
}) {
  const tones = {
    warning: "border-amber-100 text-amber-700 bg-amber-50/50",
    neutral: "border-slate-200 text-slate-900 bg-white",
    positive: "border-emerald-100 text-emerald-700 bg-emerald-50/50",
  };

  return (
    <article className={`rounded-[2rem] border p-6 shadow-sm transition-all ${tones[tone]}`}>
      <span className="text-[10px] font-black uppercase tracking-[0.15em] opacity-60">{title}</span>
      <div className="mt-2 text-3xl font-black tracking-tight">{value}</div>
      <p className="mt-1 text-[10px] font-bold uppercase tracking-widest opacity-50">{subtitle}</p>
    </article>
  );
}

function CenterActionCard({
  href,
  title,
  description,
}: {
  href: string;
  title: string;
  description: string;
}) {
  return (
    <Link
      href={href}
      className="rounded-3xl border border-slate-200 bg-white px-5 py-4 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md active:scale-[0.99]"
    >
      <p className="text-sm font-black tracking-tight text-slate-900">{title}</p>
      <p className="mt-1.5 text-xs leading-relaxed text-slate-500">{description}</p>
      <p className="mt-3 text-[10px] font-black uppercase tracking-widest text-klasse-gold">
        Abrir →
      </p>
    </Link>
  );
}
