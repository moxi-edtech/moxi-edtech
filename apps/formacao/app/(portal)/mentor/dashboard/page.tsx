import { redirect } from "next/navigation";
import { getFormacaoAuthContext } from "@/lib/auth-context";
import { supabaseServer } from "@/lib/supabaseServer";
import { Wallet, ChevronRight, Clock, BookOpen } from "lucide-react";
import type { FormacaoSupabaseClient } from "@/lib/db-types";
import { FunnelViewTracker } from "@/components/analytics/FunnelViewTracker";
import { TrackedFunnelLink } from "@/components/analytics/TrackedFunnelLink";

export const dynamic = "force-dynamic";

export default async function MentorDashboardPage() {
  const auth = await getFormacaoAuthContext();
  if (!auth) redirect("/login");

  if (auth.role !== "formador" && !["super_admin", "global_admin", "formacao_admin"].includes(String(auth.role))) {
    redirect("/forbidden");
  }

  const s = (await supabaseServer()) as FormacaoSupabaseClient;

  // Buscar dados reais do mentor
  const [atribuicoesRes, honorariosRes] = await Promise.all([
    s.from("formacao_cohort_formadores").select("id, cohort_id").eq("formador_user_id", auth.userId),
    s.from("formacao_honorarios_lancamentos").select("valor_liquido, status").eq("formador_user_id", auth.userId)
  ]);

  const totalCohorts = (atribuicoesRes.data ?? []).length;
  const honorariosPendentes = (honorariosRes.data ?? [])
    .filter(h => h.status !== 'pago')
    .reduce((acc, h) => acc + Number(h.valor_liquido), 0);

  return (
    <div className="max-w-lg mx-auto space-y-6 pb-12">
      <FunnelViewTracker
        event="mentor_dashboard_view"
        stage="dashboard"
        source="mentor_dashboard"
        tenant_id={auth.tenantId}
        tenant_slug={auth.tenantSlug}
        user_id={auth.userId}
      />
      <header className="rounded-[2rem] border border-slate-200 bg-white p-8 shadow-sm text-center">
        <p className="m-0 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">painel do formador</p>
        <h1 className="mt-2 text-3xl font-black tracking-tight text-slate-900 leading-tight">Olá, {auth.displayName?.split(' ')[0]}</h1>
        <p className="mt-2 text-sm leading-relaxed text-slate-500 font-medium">
          Gere mentorias e acelera vendas a partir de um painel único.
        </p>
      </header>

      {/* Grid de Atalhos Rápidos */}
      <div className="grid grid-cols-2 gap-4">
        <article className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#1F6B3B]/10 text-[#1F6B3B] mb-4">
            <BookOpen size={20} />
          </div>
          <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Ativo</p>
          <div className="mt-1 text-2xl font-black text-slate-900">{totalCohorts}</div>
          <p className="mt-1 text-[10px] font-bold text-slate-500 uppercase tracking-tighter">Turmas em Curso</p>
        </article>

        <article className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-50 text-amber-600 mb-4">
            <Wallet size={20} />
          </div>
          <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Honorários</p>
          <div className="mt-1 text-2xl font-black text-slate-900">{formatMoney(honorariosPendentes)}</div>
          <p className="mt-1 text-[10px] font-bold text-slate-500 uppercase tracking-tighter">A Receber</p>
        </article>
      </div>

      {/* Ações de Gestão */}
      <section className="space-y-3">
        <h3 className="px-2 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Gestão Solo Creator</h3>
        
        <TrackedFunnelLink
          href="/mentor/mentorias"
          eventName="mentor_cta_click"
          stage="dashboard"
          source="dashboard_primary_cta_mentorias"
          className="flex items-center justify-between p-5 rounded-[2rem] bg-white border border-slate-200 group active:scale-[0.98] transition-all"
        >
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#1F6B3B]/10 text-[#1F6B3B]">
              <BookOpen size={24} />
            </div>
            <div>
              <p className="font-bold text-slate-900">Mentorias & Eventos</p>
              <p className="text-xs text-slate-500 font-medium">Abrir oferta, gerir inscritos e publicar rápido</p>
            </div>
          </div>
          <ChevronRight className="text-slate-300 group-hover:text-[#1F6B3B] transition-colors" size={20} />
        </TrackedFunnelLink>

        <TrackedFunnelLink
          href="/mentor/vendas"
          eventName="mentor_cta_click"
          stage="dashboard"
          source="dashboard_secondary_cta_vendas"
          className="flex items-center justify-between p-5 rounded-[2rem] bg-white border border-slate-200 group active:scale-[0.98] transition-all"
        >
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-50 text-amber-600">
              <Wallet size={24} />
            </div>
            <div>
              <p className="font-bold text-slate-900">Vendas</p>
              <p className="text-xs text-slate-500 font-medium">Receita e conversão de mentorias</p>
            </div>
          </div>
          <ChevronRight className="text-slate-300 group-hover:text-amber-600 transition-colors" size={20} />
        </TrackedFunnelLink>
      </section>

      {/* Alerta de Lançamento se não houver cohorts? */}
      {totalCohorts === 0 && (
        <div className="p-6 rounded-[2rem] bg-slate-100 border border-slate-200 text-center">
          <Clock size={32} className="mx-auto text-slate-300 mb-3" />
          <p className="text-sm font-bold text-slate-500">Aguardando atribuição de turmas.</p>
        </div>
      )}
    </div>
  );
}

function formatMoney(value: number) {
  return new Intl.NumberFormat("pt-AO", {
    style: "currency",
    currency: "AOA",
    maximumFractionDigits: 0,
  }).format(Number.isFinite(value) ? value : 0);
}
