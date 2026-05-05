import { notFound, redirect } from "next/navigation";
import { getFormacaoContext } from "@/lib/auth/formacaoAccess";
import { supabaseServer } from "@/lib/supabaseServer";

export const dynamic = "force-dynamic";

type CohortRow = {
  id: string;
  codigo: string;
  nome: string;
  curso_nome: string;
  carga_horaria_total: number;
  vagas: number;
  status: string;
  data_inicio: string;
  data_fim: string;
};

function formatMoney(value: number) {
  return new Intl.NumberFormat("pt-AO", {
    style: "currency",
    currency: "AOA",
    maximumFractionDigits: 0,
  }).format(Number.isFinite(value) ? value : 0);
}

export default async function CohortOverviewPage({
  params,
}: {
  params: Promise<{ cohort_id: string }>;
}) {
  const context = await getFormacaoContext();
  if (!context?.escolaId) redirect("/redirect");
  const { cohort_id: cohortId } = await params;

  const supabase = await supabaseServer();
  const escolaId = String(context.escolaId);

  const [cohortRes, lotacaoRes, margemRes, formadoresRes, certificadosRes] = await Promise.all([
    supabase
      .from("formacao_cohorts")
      .select("id, codigo, nome, curso_nome, carga_horaria_total, vagas, status, data_inicio, data_fim")
      .eq("escola_id", escolaId)
      .eq("id", cohortId)
      .maybeSingle(),
    supabase
      .from("vw_formacao_cohorts_lotacao")
      .select("inscritos_total, inscritos_pagos, lotacao_percentual")
      .eq("cohort_id", cohortId)
      .maybeSingle(),
    supabase
      .from("vw_formacao_margem_por_edicao")
      .select("receita_total, custo_honorarios, margem_bruta")
      .eq("cohort_id", cohortId)
      .maybeSingle(),
    supabase
      .from("formacao_cohort_formadores")
      .select("id", { count: "exact", head: true })
      .eq("escola_id", escolaId)
      .eq("cohort_id", cohortId),
    supabase
      .from("formacao_certificados_emitidos")
      .select("id", { count: "exact", head: true })
      .eq("escola_id", escolaId)
      .eq("cohort_id", cohortId),
  ]);

  const cohort = cohortRes.data as CohortRow | null;
  if (!cohort) notFound();

  const inscritosTotal = Number(lotacaoRes.data?.inscritos_total ?? 0);
  const inscritosPagos = Number(lotacaoRes.data?.inscritos_pagos ?? 0);
  const lotacaoPercentual = Number(lotacaoRes.data?.lotacao_percentual ?? 0);
  const receitaTotal = Number(margemRes.data?.receita_total ?? 0);
  const custoHonorarios = Number(margemRes.data?.custo_honorarios ?? 0);
  const margemBruta = Number(margemRes.data?.margem_bruta ?? 0);
  const totalFormadores = Number(formadoresRes.count ?? 0);
  const totalCertificados = Number(certificadosRes.count ?? 0);

  return (
    <div className="space-y-6">
      <header className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">{cohort.codigo}</p>
        <h1 className="mt-1 text-lg font-semibold text-slate-900">{cohort.nome}</h1>
        <p className="mt-2 text-sm text-slate-600">
          {cohort.curso_nome} · {cohort.data_inicio} → {cohort.data_fim}
        </p>
      </header>

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard title="Inscritos" value={`${inscritosTotal}/${cohort.vagas}`} subtitle={`${lotacaoPercentual.toFixed(1)}% de lotação`} />
        <MetricCard title="Pagos" value={String(inscritosPagos)} subtitle="Formandos com pagamento confirmado" />
        <MetricCard title="Formadores" value={String(totalFormadores)} subtitle="Vinculados à turma" />
        <MetricCard title="Certificados" value={String(totalCertificados)} subtitle="Emitidos para esta edição" />
      </section>

      <section className="grid gap-3 sm:grid-cols-3">
        <MetricCard title="Receita Total" value={formatMoney(receitaTotal)} subtitle="Fonte: vw_formacao_margem_por_edicao" />
        <MetricCard title="Custo Honorários" value={formatMoney(custoHonorarios)} subtitle="Honorários aprovados/pagos" />
        <MetricCard title="Margem Bruta" value={formatMoney(margemBruta)} subtitle="Receita menos honorários" />
      </section>
    </div>
  );
}

function MetricCard({ title, value, subtitle }: { title: string; value: string; subtitle: string }) {
  return (
    <article className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">{title}</p>
      <p className="mt-2 text-xl font-semibold text-slate-900">{value}</p>
      <p className="mt-1 text-xs text-slate-600">{subtitle}</p>
    </article>
  );
}
