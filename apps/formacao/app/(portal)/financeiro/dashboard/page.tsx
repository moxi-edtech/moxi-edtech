import type { ReactNode } from "react";
import Link from "next/link";
import { BarChart3, CreditCard, Landmark, ReceiptText, Wallet } from "lucide-react";
import { redirect } from "next/navigation";
import { getFormacaoAuthContext } from "@/lib/auth-context";
import { resolveFormacaoSessionContext } from "@/lib/session-context";
import { supabaseServer } from "@/lib/supabaseServer";
import type { FormacaoSupabaseClient } from "@/lib/db-types";

export const dynamic = "force-dynamic";

export default async function FinanceiroDashboardPage() {
  const auth = await getFormacaoAuthContext();
  if (!auth) redirect("/login");

  if (
    ![
      "formacao_financeiro",
      "formacao_admin",
      "super_admin",
      "global_admin",
    ].includes(String(auth.role))
  ) {
    redirect("/forbidden");
  }

  const session = await resolveFormacaoSessionContext();
  const escolaId = session?.tenantId ?? null;

  let faturamentoTotal = 0;
  let pendenteTotal = 0;
  let margemBrutaTotal = 0;
  let clientesB2bCount = 0;
  let titulosEmAbertoCount = 0;
  let copiloto: Array<{
    segmento: "B2B" | "B2C";
    prioridade: "alta" | "media" | "baixa";
    titulo: string;
    recomendacao: string;
    quantidade: number;
    valor: number;
  }> = [];

  if (escolaId) {
    const s = (await supabaseServer()) as FormacaoSupabaseClient;

    const [inadimplenciaRes, margemRes, clientesRes, b2bOpenRes, b2cOpenRes] = await Promise.all([
      s
        .from("vw_formacao_inadimplencia_resumo")
        .select("b2c_titulos_em_aberto, b2b_faturas_em_aberto, total_em_aberto")
        .maybeSingle(),
      s.from("vw_formacao_margem_por_edicao").select("receita_total, margem_bruta"),
      s
        .from("formacao_clientes_b2b")
        .select("id", { count: "exact", head: true })
        .eq("escola_id", escolaId)
        .eq("status", "ativo"),
      s
        .from("formacao_faturas_lote")
        .select("id, status, total_liquido, vencimento_em")
        .eq("escola_id", escolaId)
        .in("status", ["emitida", "parcial"])
        .limit(500),
      s
        .from("formacao_faturas_lote_itens")
        .select("id, status_pagamento, valor_total, formacao_faturas_lote:fatura_lote_id(vencimento_em)")
        .eq("escola_id", escolaId)
        .in("status_pagamento", ["pendente", "parcial"])
        .limit(1000),
    ]);

    clientesB2bCount = clientesRes.count ?? 0;
    pendenteTotal = Number(inadimplenciaRes.data?.total_em_aberto ?? 0);
    titulosEmAbertoCount =
      Number(inadimplenciaRes.data?.b2c_titulos_em_aberto ?? 0) +
      Number(inadimplenciaRes.data?.b2b_faturas_em_aberto ?? 0);
    faturamentoTotal = ((margemRes.data ?? []) as Array<{ receita_total: number | null }>).reduce(
      (acc, row) => acc + Number(row.receita_total ?? 0),
      0
    );
    margemBrutaTotal = ((margemRes.data ?? []) as Array<{ margem_bruta: number | null }>).reduce(
      (acc, row) => acc + Number(row.margem_bruta ?? 0),
      0
    );

    const now = Date.now();
    const msDay = 1000 * 60 * 60 * 24;
    const b2bRows = (b2bOpenRes.data ?? []) as Array<{
      total_liquido?: number | null;
      vencimento_em?: string | null;
    }>;
    const b2cRows = (b2cOpenRes.data ?? []) as Array<{
      valor_total?: number | null;
      formacao_faturas_lote?: { vencimento_em?: string | null } | null;
    }>;

    const buildSeg = (
      segment: "B2B" | "B2C",
      rows: Array<{ amount: number; dueAt: string | null }>
    ) => {
      const overdue30 = rows.filter((r) => r.dueAt && (now - new Date(r.dueAt).getTime()) / msDay > 30);
      const overdue7 = rows.filter((r) => r.dueAt && (now - new Date(r.dueAt).getTime()) / msDay > 7);
      const upcoming3 = rows.filter((r) => r.dueAt && (new Date(r.dueAt).getTime() - now) / msDay <= 3);

      const sum = (arr: Array<{ amount: number }>) => arr.reduce((acc, item) => acc + Number(item.amount || 0), 0);

      const out: typeof copiloto = [];
      if (overdue30.length > 0) {
        out.push({
          segmento: segment,
          prioridade: "alta",
          titulo: "Atrasos críticos (+30d)",
          recomendacao: "Escalar cobrança imediata com contato direto e plano de regularização.",
          quantidade: overdue30.length,
          valor: sum(overdue30),
        });
      }
      if (overdue7.length > 0) {
        out.push({
          segmento: segment,
          prioridade: "media",
          titulo: "Atrasos recorrentes (+7d)",
          recomendacao: "Executar régua de follow-up em 24h (email + telefone).",
          quantidade: overdue7.length,
          valor: sum(overdue7),
        });
      }
      if (upcoming3.length > 0) {
        out.push({
          segmento: segment,
          prioridade: "baixa",
          titulo: "Vencimentos próximos (<=3d)",
          recomendacao: "Enviar lembrete preventivo com instruções de pagamento.",
          quantidade: upcoming3.length,
          valor: sum(upcoming3),
        });
      }
      return out;
    };

    copiloto = [
      ...buildSeg(
        "B2B",
        b2bRows.map((row) => ({
          amount: Number(row.total_liquido ?? 0),
          dueAt: row.vencimento_em ?? null,
        }))
      ),
      ...buildSeg(
        "B2C",
        b2cRows.map((row) => ({
          amount: Number(row.valor_total ?? 0),
          dueAt: row.formacao_faturas_lote?.vencimento_em ?? null,
        }))
      ),
    ].sort((a, b) => {
      const rank = { alta: 3, media: 2, baixa: 1 } as const;
      const priorityDiff = rank[b.prioridade] - rank[a.prioridade];
      if (priorityDiff !== 0) return priorityDiff;
      return b.valor - a.valor;
    });
  }

  const formatCurrency = (val: number) =>
    new Intl.NumberFormat("pt-AO", {
      style: "currency",
      currency: "AOA",
    }).format(val);

  return (
    <div className="space-y-6 pb-12">
      <header className="rounded-xl border border-slate-200 bg-white p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="m-0 text-xs font-semibold uppercase tracking-[0.2em] text-slate-600">financeiro centro</p>
          <span className="rounded-full border border-klasse-gold/25 bg-klasse-gold/10 px-3 py-1 text-xs font-semibold text-klasse-gold">
            Operação ativa
          </span>
        </div>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight text-klasse-green">Dashboard Financeira</h1>
        <p className="mt-3 max-w-2xl text-sm leading-relaxed text-slate-600">
          Visão consolidada de faturação, recebimentos e saúde financeira do centro de formação.
        </p>
      </header>

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          title="Faturado Total"
          value={formatCurrency(faturamentoTotal)}
          subtitle="Receita agregada por edição"
          tone="neutral"
        />
        <MetricCard
          title="Pendente"
          value={formatCurrency(pendenteTotal)}
          subtitle={`${titulosEmAbertoCount} títulos/faturas em aberto`}
          tone="warning"
        />
        <MetricCard
          title="Margem Bruta"
          value={formatCurrency(margemBrutaTotal)}
          subtitle="Receita menos honorários"
          tone="positive"
        />
        <MetricCard
          title="Clientes B2B"
          value={String(clientesB2bCount)}
          subtitle="Carteira ativa"
          tone="neutral"
        />
      </section>

      <div className="grid gap-5 xl:grid-cols-[1fr_0.8fr]">
        <article className="rounded-xl border border-slate-200 bg-white p-5">
          <h2 className="m-0 text-xl font-semibold text-slate-900">Módulos de Gestão</h2>
          <p className="mt-1 text-sm text-slate-600">Acesse as ferramentas operacionais de faturação.</p>

          <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <ModuleCard
              title="Cohort Economics"
              description="Análise de rentabilidade, CAC, ROI e tempo de conversão por edição e curso."
              href="/financeiro/economics"
              icon={<BarChart3 size={16} className="text-slate-400 group-hover:text-klasse-gold" />}
            />
            <ModuleCard
              title="Faturação B2B"
              description="Gestão de clientes corporativos, contratos e faturas agregadas por cohort."
              href="/financeiro/faturacao-b2b"
              icon={<Landmark size={16} className="text-slate-400 group-hover:text-klasse-gold" />}
            />
            <ModuleCard
              title="Faturação B2C"
              description="Cobranças individuais de formandos via balcão ou inscrições diretas."
              href="/financeiro/faturacao-b2c"
              icon={<ReceiptText size={16} className="text-slate-400 group-hover:text-klasse-gold" />}
            />
            <ModuleCard
              title="Recebimentos"
              description="IBAN, conta, Kwik e instruções exibidas no checkout público."
              href="/financeiro/recebimentos"
              icon={<CreditCard size={16} className="text-slate-400 group-hover:text-klasse-gold" />}
            />
            <ModuleCard
              title="Assinatura KLASSE"
              description="Plano do centro, estado da subscrição e envio de comprovativos para validação."
              href="/financeiro/subscricao"
              icon={<Wallet size={16} className="text-slate-400 group-hover:text-klasse-gold" />}
            />
          </div>
        </article>

        <article className="rounded-xl border border-slate-200 bg-white p-5">
          <h2 className="m-0 text-xl font-semibold text-slate-900">Ações Rápidas</h2>
          <p className="mt-1 text-sm text-slate-600">Tarefas financeiras recorrentes do dia-a-dia.</p>

          <div className="mt-5 grid gap-3">
            <QuickActionLink
              href="/financeiro/conciliacao"
              title="Reconciliação Bancária"
              description="Baixar faturas e confirmar recebimentos."
            />
            <QuickActionLink
              href="/admin/onboarding"
              title="Configuração Fiscal"
              description="Gerir NIF, séries e parâmetros de faturamento."
            />
            <QuickActionLink
              href="/financeiro/recebimentos"
              title="Contas e Checkout"
              description="Atualizar os dados de pagamento mostrados aos alunos."
            />
          </div>
        </article>
      </div>

      <article className="rounded-xl border border-slate-200 bg-white p-5">
        <h2 className="m-0 text-xl font-semibold text-slate-900">Copiloto de Cobrança</h2>
        <p className="mt-1 text-sm text-slate-600">Recomendações automáticas de follow-up por segmento de inadimplência.</p>
        <div className="mt-4 grid gap-3">
          {copiloto.length === 0 ? (
            <p className="m-0 text-sm text-slate-600">Sem alertas de follow-up no momento.</p>
          ) : (
            copiloto.map((item, idx) => (
              <div key={`${item.segmento}-${item.titulo}-${idx}`} className="rounded-xl border border-slate-100 bg-slate-50 p-3">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-full border border-slate-200 bg-white px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest text-slate-700">{item.segmento}</span>
                  <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest ${
                    item.prioridade === "alta"
                      ? "border border-rose-200 bg-rose-50 text-rose-700"
                      : item.prioridade === "media"
                        ? "border border-amber-200 bg-amber-50 text-amber-700"
                        : "border border-slate-200 bg-slate-100 text-slate-700"
                  }`}>
                    {item.prioridade}
                  </span>
                  <strong className="text-sm text-slate-900">{item.titulo}</strong>
                </div>
                <p className="mt-1 text-sm text-slate-700">{item.recomendacao}</p>
                <p className="mt-1 text-xs font-semibold text-slate-600">
                  {item.quantidade} casos · {formatCurrency(item.valor)}
                </p>
              </div>
            ))
          )}
        </div>
      </article>
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
  tone: "warning" | "neutral" | "positive" | "danger";
}) {
  const tones = {
    warning: "border-amber-200 text-amber-700 bg-amber-50/30",
    neutral: "border-slate-200 text-slate-900 bg-white",
    positive: "border-emerald-200 text-emerald-700 bg-emerald-50/30",
    danger: "border-rose-200 text-rose-700 bg-rose-50/30",
  };

  return (
    <article className={`rounded-xl border p-4 shadow-sm transition-all duration-200 hover:shadow-md ${tones[tone]}`}>
      <span className="text-[10px] font-bold uppercase tracking-widest opacity-70">{title}</span>
      <div className="mt-2 text-xl font-black">{value}</div>
      <p className="mt-1 text-xs opacity-80">{subtitle}</p>
    </article>
  );
}

function ModuleCard({
  title,
  description,
  href,
  icon,
}: {
  title: string;
  description: string;
  href: string;
  icon: ReactNode;
}) {
  return (
    <Link
      href={href}
      className="group flex flex-col rounded-xl border border-slate-200 bg-white p-4 transition-all duration-200 hover:-translate-y-1 hover:border-klasse-gold hover:shadow-md"
    >
      <span>{icon}</span>
      <h3 className="mt-3 text-sm font-bold text-slate-900 group-hover:text-klasse-gold">{title}</h3>
      <p className="mt-1 text-xs leading-relaxed text-slate-500">{description}</p>
      <span className="mt-4 text-[10px] font-bold uppercase text-klasse-gold">Acessar módulo</span>
    </Link>
  );
}

function QuickActionLink({
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
      className="block rounded-xl border border-slate-200 bg-slate-50 p-4 transition-all duration-200 hover:border-klasse-gold/30 hover:bg-white"
    >
      <p className="m-0 text-sm font-semibold text-slate-900">{title}</p>
      <p className="mt-0.5 text-xs text-slate-500">{description}</p>
    </Link>
  );
}
