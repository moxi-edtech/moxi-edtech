import { redirect } from "next/navigation";
import { FunnelViewTracker } from "@/components/analytics/FunnelViewTracker";
import { TrackedFunnelLink } from "@/components/analytics/TrackedFunnelLink";
import { getFormacaoAuthContext } from "@/lib/auth-context";
import { supabaseServer } from "@/lib/supabaseServer";
import type { FormacaoSupabaseClient } from "@/lib/db-types";

export const dynamic = "force-dynamic";

async function countEvents(
  s: FormacaoSupabaseClient,
  params: {
    tenantId: string;
    event: string;
    fromIso: string;
    sourceIn?: string[];
  }
) {
  let query = s
    .from("formacao_funnel_eventos")
    .select("id", { count: "exact", head: true })
    .eq("tenant_id", params.tenantId)
    .eq("event", params.event)
    .gte("created_at", params.fromIso);

  if (params.sourceIn && params.sourceIn.length > 0) {
    query = query.in("source", params.sourceIn);
  }

  const { count } = await query;
  return count ?? 0;
}

function toPercent(numerator: number, denominator: number) {
  if (!denominator) return "0%";
  return `${Math.round((numerator / denominator) * 100)}%`;
}

export default async function MentorVendasPage() {
  const auth = await getFormacaoAuthContext();
  if (!auth) redirect("/login");

  if (auth.role !== "formador" && !["super_admin", "global_admin", "formacao_admin"].includes(String(auth.role))) {
    redirect("/forbidden");
  }

  if (!auth.tenantId) {
    redirect("/mentor/dashboard");
  }

  const from = new Date();
  from.setDate(from.getDate() - 30);
  const fromIso = from.toISOString();

  const s = (await supabaseServer()) as FormacaoSupabaseClient;

  const [
    vendasViews,
    ctaToNovaMentoria,
    submitStarted,
    submitSuccess,
    checkoutSuccess,
    inscricaoSuccess,
  ] = await Promise.all([
    countEvents(s, { tenantId: auth.tenantId, event: "mentor_vendas_view", fromIso }),
    countEvents(s, {
      tenantId: auth.tenantId,
      event: "mentor_cta_click",
      fromIso,
      sourceIn: ["dashboard_primary_cta_mentorias", "vendas_cta_nova_mentoria"],
    }),
    countEvents(s, { tenantId: auth.tenantId, event: "mentor_mentoria_submit_started", fromIso }),
    countEvents(s, { tenantId: auth.tenantId, event: "mentor_mentoria_submit_success", fromIso }),
    countEvents(s, { tenantId: auth.tenantId, event: "mentor_checkout_submit_success", fromIso }),
    countEvents(s, { tenantId: auth.tenantId, event: "self_service_inscricao_submit_success", fromIso }),
  ]);

  return (
    <main className="space-y-6">
      <FunnelViewTracker
        event="mentor_vendas_view"
        stage="vendas"
        source="mentor_vendas"
        tenant_id={auth.tenantId}
        tenant_slug={auth.tenantSlug}
        user_id={auth.userId}
      />
      <header className="rounded-2xl border border-slate-200 bg-white p-5">
        <p className="m-0 text-xs font-semibold uppercase tracking-[0.2em] text-slate-600">solo creator</p>
        <h1 className="mt-1 text-2xl font-black tracking-tight text-slate-900">Vendas</h1>
        <p className="mt-3 max-w-2xl text-sm leading-relaxed text-slate-600">
          Priorize ações que convertem: publicar mentoria, distribuir link e fechar inscrição.
        </p>
      </header>

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        <MetricCard title="Visitas em Vendas (30d)" value={String(vendasViews)} subtitle="Topo do funil" />
        <MetricCard title="Cliques p/ Lançar Mentoria" value={String(ctaToNovaMentoria)} subtitle={toPercent(ctaToNovaMentoria, vendasViews)} />
        <MetricCard title="Mentorias Publicadas" value={String(submitSuccess)} subtitle={toPercent(submitSuccess, submitStarted)} />
        <MetricCard title="Checkouts Confirmados" value={String(checkoutSuccess)} subtitle={toPercent(checkoutSuccess, submitSuccess)} />
        <MetricCard title="Inscrições Concluídas" value={String(inscricaoSuccess)} subtitle={toPercent(inscricaoSuccess, checkoutSuccess)} />
        <MetricCard
          title="Conversão Final (Vendas -> Inscrição)"
          value={toPercent(inscricaoSuccess, vendasViews)}
          subtitle={`${inscricaoSuccess}/${vendasViews} no período`}
        />
      </section>

      <section className="grid gap-3 sm:grid-cols-2">
        <TrackedFunnelLink
          href="/mentor/mentorias/nova"
          eventName="mentor_cta_click"
          stage="vendas"
          source="vendas_cta_nova_mentoria"
          className="rounded-2xl border border-slate-200 bg-white p-4 text-sm font-semibold text-slate-900 transition hover:bg-slate-50"
        >
          Lançar mentoria e gerar link
        </TrackedFunnelLink>
        <TrackedFunnelLink
          href="/mentor/mentorias"
          eventName="mentor_cta_click"
          stage="vendas"
          source="vendas_cta_mentorias_ativas"
          className="rounded-2xl border border-slate-200 bg-white p-4 text-sm font-semibold text-slate-900 transition hover:bg-slate-50"
        >
          Acompanhar mentorias ativas
        </TrackedFunnelLink>
      </section>
    </main>
  );
}

function MetricCard({ title, value, subtitle }: { title: string; value: string; subtitle: string }) {
  return (
    <article className="rounded-2xl border border-slate-200 bg-white p-5">
      <p className="m-0 text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">{title}</p>
      <p className="mt-2 text-3xl font-black tracking-tight text-slate-900">{value}</p>
      <p className="mt-1 text-xs font-medium text-slate-500">{subtitle}</p>
    </article>
  );
}
