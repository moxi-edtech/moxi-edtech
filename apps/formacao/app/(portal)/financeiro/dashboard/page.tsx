import Link from "next/link";
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
  let vencidoTotal = 0;
  let clientesB2bCount = 0;
  let faturasCount = 0;

  if (escolaId) {
    const s = (await supabaseServer()) as FormacaoSupabaseClient;
    const today = new Date().toISOString().split("T")[0];

    const [faturasRes, clientesRes] = await Promise.all([
      s
        .from("formacao_faturas_lote")
        .select("total_bruto, total_liquido, status, vencimento_em")
        .eq("escola_id", escolaId)
        .neq("status", "cancelada"),
      s
        .from("formacao_clientes_b2b")
        .select("id", { count: "exact", head: true })
        .eq("escola_id", escolaId)
        .eq("status", "ativo"),
    ]);

    const faturas = faturasRes.data ?? [];
    faturasCount = faturas.length;
    clientesB2bCount = clientesRes.count ?? 0;

    faturas.forEach((f) => {
      const valor = Number(f.total_bruto || 0);
      faturamentoTotal += valor;

      if (["emitida", "parcial"].includes(f.status)) {
        pendenteTotal += valor;
        if (f.vencimento_em && f.vencimento_em < today) {
          vencidoTotal += valor;
        }
      }
    });
  }

  const formatCurrency = (val: number) =>
    new Intl.NumberFormat("pt-AO", {
      style: "currency",
      currency: "AOA",
    }).format(val);

  return (
    <div className="space-y-8 pb-12">
      <header className="rounded-2xl border border-slate-200 bg-white p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="m-0 text-xs font-semibold uppercase tracking-[0.2em] text-slate-600">financeiro centro</p>
          <span className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
            Operação Ativa
          </span>
        </div>
        <h1 className="mt-1 text-2xl font-black tracking-tight text-slate-900">Dashboard Financeira</h1>
        <p className="mt-3 max-w-2xl text-sm leading-relaxed text-slate-600">
          Visão consolidada de faturação, recebimentos e saúde financeira do centro de formação.
        </p>
      </header>

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          title="Faturado Total"
          value={formatCurrency(faturamentoTotal)}
          subtitle={`${faturasCount} faturas emitidas`}
          tone="neutral"
        />
        <MetricCard
          title="Pendente"
          value={formatCurrency(pendenteTotal)}
          subtitle="Aguardando recebimento"
          tone="warning"
        />
        <MetricCard
          title="Vencido"
          value={formatCurrency(vencidoTotal)}
          subtitle="Cobranças em atraso"
          tone="danger"
        />
        <MetricCard
          title="Clientes B2B"
          value={String(clientesB2bCount)}
          subtitle="Carteira ativa"
          tone="positive"
        />
      </section>

      <div className="grid gap-5 xl:grid-cols-[1fr_0.8fr]">
        <article className="rounded-2xl border border-slate-200 bg-white p-5">
          <h2 className="m-0 text-xl font-semibold text-slate-900">Módulos de Gestão</h2>
          <p className="mt-1 text-sm text-slate-600">Acesse as ferramentas operacionais de faturação.</p>

          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            <ModuleCard
              title="Faturação B2B"
              description="Gestão de clientes corporativos, contratos e faturas agregadas por cohort."
              href="/financeiro/faturacao-b2b"
              icon="🏢"
            />
            <ModuleCard
              title="Faturação B2C"
              description="Cobranças individuais de formandos via balcão ou inscrições diretas."
              href="/financeiro/faturacao-b2c"
              icon="👤"
            />
          </div>
        </article>

        <article className="rounded-2xl border border-slate-200 bg-white p-5">
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
          </div>
        </article>
      </div>
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
    <article className={`rounded-2xl border p-4 shadow-sm transition-all duration-200 hover:shadow-md ${tones[tone]}`}>
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
  icon: string;
}) {
  return (
    <Link
      href={href}
      className="group flex flex-col rounded-xl border border-slate-200 bg-white p-4 transition-all duration-200 hover:-translate-y-1 hover:border-klasse-gold hover:shadow-md"
    >
      <span className="text-2xl">{icon}</span>
      <h3 className="mt-3 text-sm font-bold text-slate-900 group-hover:text-klasse-gold">{title}</h3>
      <p className="mt-1 text-xs leading-relaxed text-slate-500">{description}</p>
      <span className="mt-4 text-[10px] font-bold uppercase text-klasse-gold">Acessar Módulo →</span>
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
      className="block rounded-xl border border-slate-100 bg-slate-50 p-4 transition-all duration-200 hover:border-slate-200 hover:bg-white"
    >
      <p className="m-0 text-sm font-bold text-slate-900">{title}</p>
      <p className="mt-0.5 text-xs text-slate-500">{description}</p>
    </Link>
  );
}
