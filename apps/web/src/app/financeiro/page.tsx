import { getAbsoluteUrlServer } from "@/lib/serverUrl";
import {
  Wallet,
  TrendingUp,
  Users,
  ArrowRight,
  Radar,
  Receipt,
  Scale,
  BarChart3,
  CheckCircle,
  Clock,
  AlertCircle,
  Search,
  DollarSign,
} from "lucide-react";
import Link from "next/link";
import { supabaseServer } from "@/lib/supabaseServer";
import { resolveEscolaIdForUser } from "@/lib/tenant/resolveEscolaIdForUser";
import { GerarMensalidadesDialog } from "./_components/GerarMensalidadesDialog";
import { RegistrarPagamentoButton } from "@/components/financeiro/RegistrarPagamentoButton";
import { ReciboPrintButton } from "@/components/financeiro/ReciboImprimivel";
import { EstornarMensalidadeButton } from "@/components/financeiro/EstornarMensalidadeButton";
import type { Database } from "~types/supabase";
import { DashboardHeader } from "@/components/dashboard/DashboardHeader";
import { FinanceiroAlerts } from "@/components/financeiro/FinanceiroAlerts";
import { MissingPricingAlert } from "@/components/financeiro/MissingPricingAlert";

export const dynamic = 'force-dynamic';

const kwanza = new Intl.NumberFormat("pt-AO", {
  style: "currency",
  currency: "AOA",
});

type DashboardResumo = {
  inadimplencia: { total: number; percentual: number };
  risco: { total: number };
  confirmados: { total: number };
  pendentes: { total: number };
};

type Notification = Database["public"]["Tables"]["notifications"]["Row"];
type Mensalidade = Database["public"]["Tables"]["mensalidades"]["Row"] & {
  turmas?: { nome?: string | null } | null;
  valor?: number | null;
};

export default async function FinanceiroDashboardPage({
  searchParams,
}: {
  searchParams?: Promise<{ aluno?: string }>;
}) {
  const params = (searchParams ? await searchParams : {}) as { aluno?: string };
  const { aluno } = params;
  const supabase = await supabaseServer();

  const { data: userRes } = await supabase.auth.getUser();
  const user = userRes?.user;
  let escolaId: string | null = null;
  if (user) {
    escolaId = await resolveEscolaIdForUser(supabase, user.id);
  }

  const resumoData: DashboardResumo = await fetch(await getAbsoluteUrlServer("/api/financeiro"), {
    cache: "no-store",
  })
    .then((r) => r.json())
    .catch(() => ({
      inadimplencia: { total: 0, percentual: 0 },
      risco: { total: 0 },
      confirmados: { total: 0 },
      pendentes: { total: 0 },
    }));

  let mensalidades: Mensalidade[] = [];
  let alunoNome = "";
  let financeNotifications: Notification[] = [];
  let escolaNome = "Escola";

  if (aluno) {
    const { data } = await supabase
      .from("mensalidades")
      .select("*, turmas(nome)")
      .eq("aluno_id", aluno)
      .order("ano_referencia", { ascending: false })
      .order("mes_referencia", { ascending: false });
    mensalidades = (data as Mensalidade[]) ?? [];

    const { data: alunoRow } = await supabase
      .from("alunos")
      .select("nome_completo, nome")
      .eq("id", aluno)
      .maybeSingle();
    alunoNome = alunoRow?.nome_completo || alunoRow?.nome || "Aluno";
  }

  if (escolaId) {
    const { data: escolaRow } = await supabase
      .from("escolas")
      .select("nome")
      .eq("id", escolaId)
      .maybeSingle();

    escolaNome = escolaRow?.nome ?? escolaNome;

    const { data } = await supabase
      .from("notifications")
      .select("id, titulo, mensagem, link_acao, lida, created_at, tipo, target_role")
      .eq("escola_id", escolaId)
      .eq("target_role", "financeiro")
      .eq("lida", false)
      .order("created_at", { ascending: false })
      .limit(5);

    financeNotifications = (data as Notification[]) || [];
  }

  return (
    <main className="space-y-8 p-4 md:p-6">
      {/* Header */}
      <DashboardHeader
        title="Financeiro"
        description="Gestão completa de receita, cobranças e fluxo financeiro da escola."
        actions={
          escolaId ? (
            <GerarMensalidadesDialog />
          ) : (
            <div className="text-xs text-slate-500">Associe-se a uma escola para gerar cobranças.</div>
          )
        }
      />

      {escolaId ? (
        <MissingPricingAlert escolaId={escolaId} anoLetivo={new Date().getFullYear()} />
      ) : null}

      <FinanceiroAlerts notifications={financeNotifications} />

      {/* Cards Principais */}
      <section className="grid gap-4 md:grid-cols-4">
        <Card
          title="Taxa de Inadimplência"
          value={(resumoData.inadimplencia?.percentual ?? 0).toFixed(1) + "%"}
          icon={<TrendingUp />}
        />
        <Card
          title="Total em Risco"
          value={(resumoData?.risco?.total ?? 0).toLocaleString("pt-AO") + " Kz"}
          icon={<Wallet />}
        />
        <Card
          title="Pagamentos Confirmados"
          value={resumoData?.confirmados?.total ?? 0}
          icon={<TrendingUp />}
        />
        <Card
          title="Alunos Pendentes"
          value={resumoData.inadimplencia?.total ?? 0}
          icon={<Users />}
        />
      </section>

      {/* Acessos Rápidos */}
      <section className="space-y-4">
        <h2 className="text-lg font-semibold text-slate-900">Acessos Rápidos</h2>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <QuickLink
            href="/financeiro/radar"
            title="Radar de Inadimplência"
            description="Acompanhe alunos em atraso e envie cobranças automáticas."
            icon={<Radar className="h-6 w-6" />}
          />
          <QuickLink
            href="/financeiro/cobrancas"
            title="Histórico de Cobranças"
            description="Veja respostas, pagamentos e eficiência das mensagens."
            icon={<Receipt className="h-6 w-6" />}
          />
          <QuickLink
            href="/financeiro/conciliacao"
            title="Conciliação TPA"
            description="Confirme pagamentos Multicaixa/TPA com total precisão."
            icon={<Scale className="h-6 w-6" />}
          />
          <QuickLink
            href="/financeiro/relatorios"
            title="Relatórios Financeiros"
            description="Taxas, gráficos, projeções e análise completa."
            icon={<BarChart3 className="h-6 w-6" />}
          />
        </div>
      </section>

      {/* Extrato do aluno */}
      <section className="space-y-4">
        <h2 className="text-lg font-semibold text-slate-900 flex items-center gap-2">
          <DollarSign className="w-5 h-5" /> Extrato por aluno
        </h2>
        {!aluno ? (
          <div className="text-center py-12 bg-slate-50 rounded-xl border border-dashed border-slate-200/70">
            <Search className="w-12 h-12 mx-auto text-slate-300 mb-3" />
            <h3 className="text-lg font-medium text-slate-800">Nenhum aluno selecionado</h3>
            <p className="text-slate-500">
              Use a Busca Global (Ctrl+K) e vá ao Dossiê para ver o financeiro detalhado.
            </p>
          </div>
        ) : (
          <div className="space-y-6">
            <div className="flex justify-between items-center">
              <div>
                <h3 className="text-lg font-bold text-slate-900">Extrato de: {alunoNome}</h3>
                <p className="text-sm text-slate-500">Histórico completo de cobranças</p>
              </div>
            </div>

            <div className="bg-white shadow-sm rounded-xl border border-slate-200/70 overflow-hidden">
              <table className="min-w-full divide-y divide-slate-200/70 text-sm">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="px-6 py-3 text-left font-medium text-slate-500 uppercase">Referência</th>
                    <th className="px-6 py-3 text-left font-medium text-slate-500 uppercase">Vencimento</th>
                    <th className="px-6 py-3 text-left font-medium text-slate-500 uppercase">Valor</th>
                    <th className="px-6 py-3 text-center font-medium text-slate-500 uppercase">Status</th>
                    <th className="px-6 py-3 text-right font-medium text-slate-500 uppercase">Ação</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-slate-200/70">
                  {mensalidades.map((mens) => (
                    <tr key={mens.id} className="hover:bg-slate-50">
                      <td className="px-6 py-4 font-medium text-slate-800">
                        {new Date(0, (mens.mes_referencia || 1) - 1).toLocaleString("pt-PT", {
                          month: "long",
                        })}{" "}
                        / {mens.ano_referencia}
                      </td>
                      <td className="px-6 py-4 text-slate-500">
                        {mens.data_vencimento
                          ? new Date(mens.data_vencimento).toLocaleDateString("pt-PT")
                          : "—"}
                      </td>
                      <td className="px-6 py-4 font-bold text-slate-800">
                        {kwanza.format(mens.valor_previsto ?? mens.valor ?? 0)}
                      </td>
                      <td className="px-6 py-4 text-center">
                        {mens.status === "pago" ? (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                            <CheckCircle className="w-3 h-3 mr-1" /> Pago
                          </span>
                        ) : mens.data_vencimento && new Date(mens.data_vencimento) < new Date() ? (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
                            <AlertCircle className="w-3 h-3 mr-1" /> Atrasado
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                            <Clock className="w-3 h-3 mr-1" /> Pendente
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-right">
                        {mens.status !== "pago" ? (
                          <RegistrarPagamentoButton
                            mensalidadeId={mens.id}
                            valor={mens.valor_previsto ?? mens.valor ?? 0}
                          />
                        ) : (
                          <div className="flex flex-wrap items-center justify-end gap-2">
                            <ReciboPrintButton
                              mensalidadeId={mens.id}
                              escolaNome={escolaNome}
                              alunoNome={alunoNome}
                              valor={mens.valor_pago_total ?? mens.valor_previsto ?? mens.valor ?? 0}
                              dataPagamento={mens.data_pagamento_efetiva ?? new Date().toISOString()}
                            />
                            <EstornarMensalidadeButton mensalidadeId={mens.id} />
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </section>

      {/* Resumo da semana (placeholder) */}
      <section className="space-y-4">
        <h2 className="text-lg font-semibold text-slate-900">Resumo da Semana</h2>
        <div className="grid gap-4 md:grid-cols-3">
          <MiniStat label="Cobranças Enviadas" value={0} />
          <MiniStat
            label="Pagamentos Confirmados"
            value={resumoData?.confirmados?.total ?? 0}
          />
          <MiniStat label="Conciliações Pendentes" value={resumoData?.pendentes?.total ?? 0} />
        </div>
      </section>
    </main>
  );
}

//
// --- COMPONENTES DE APOIO ---
//

function Card({
  title,
  value,
  icon,
}: {
  title: string;
  value: string | number;
  icon: React.ReactNode;
}) {
  return (
    <div
      className="p-4 rounded-xl border border-slate-200/70 bg-white shadow-sm flex flex-col gap-2"
    >
      <div className="flex items-center justify-between">
        <span className="text-sm text-slate-600">{title}</span>
        <div className="text-klasse-gold-400">{icon}</div>
      </div>
      <div className="text-2xl font-bold text-slate-900">{value}</div>
    </div>
  );
}

function QuickLink({
  href,
  title,
  description,
  icon,
}: {
  href: string;
  title: string;
  description: string;
  icon: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className="group bg-white border border-slate-200/70 p-5 rounded-xl shadow-sm hover:shadow-md transition-all flex flex-col gap-3"
    >
      <div className="w-10 h-10 rounded-lg bg-slate-100 flex items-center justify-center text-klasse-gold-500">
        {icon}
      </div>

      <div>
        <h3 className="text-slate-800 font-semibold text-sm">{title}</h3>
        <p className="text-slate-500 text-xs leading-relaxed">{description}</p>
      </div>

      <div className="flex items-center gap-1 text-klasse-green-500 text-sm font-medium group-hover:underline mt-auto pt-2">
        Aceder
        <ArrowRight className="h-4 w-4" />
      </div>
    </Link>
  );
}

function MiniStat({
  label,
  value,
}: {
  label: string;
  value: number;
}) {
  return (
    <div className="p-4 rounded-xl border border-slate-200/70 bg-white shadow-sm">
      <div className="text-2xl font-bold text-slate-900">{value}</div>
      <div className="text-slate-500 text-xs mt-1">{label}</div>
    </div>
  );
}
