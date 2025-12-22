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
import { GerarMensalidadesModal } from "@/components/financeiro/GerarMensalidadesModal";
import { RegistrarPagamentoButton } from "@/components/financeiro/RegistrarPagamentoButton";
import type { Database } from "~types/supabase";

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

export default async function FinanceiroDashboardPage({
  searchParams,
}: {
  searchParams?: Promise<{ aluno?: string }>;
}) {
  const { aluno } = (await (searchParams || Promise.resolve({}))) || {};
  const supabase = await supabaseServer();

  const { data: userRes } = await supabase.auth.getUser();
  const user = userRes?.user;
  let escolaId: string | null = null;
  if (user) {
    escolaId =
      (user.app_metadata as any)?.escola_id ||
      (user.user_metadata as any)?.escola_id ||
      null;
    if (!escolaId) {
      const { data: prof } = await supabase
        .from("profiles")
        .select("current_escola_id, escola_id")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(1);
      escolaId = (prof?.[0] as any)?.current_escola_id || (prof?.[0] as any)?.escola_id || null;
    }
  }

  // Tentativa de ler cache; fallback para API
  const { data: cacheResumo } = await supabase
    .from("financeiro_dashboard_cache" as any)
    .select("*")
    .limit(1)
    .maybeSingle();

  const resumoData: DashboardResumo =
    (cacheResumo as any) ??
    (await fetch(`${process.env.NEXT_PUBLIC_SITE_URL || ""}/api/financeiro/dashboard`, {
      cache: "no-store",
    }).then((r) => r.json()));

  let mensalidades: Database["public"]["Tables"]["mensalidades"]["Row"][] = [];
  let alunoNome = "";

  if (aluno) {
    const { data } = await supabase
      .from("mensalidades")
      .select("*, turmas(nome)")
      .eq("aluno_id", aluno)
      .order("ano_referencia", { ascending: false })
      .order("mes_referencia", { ascending: false });
    mensalidades = (data as any[]) ?? [];

    const { data: alunoRow } = await supabase
      .from("alunos")
      .select("nome_completo, nome")
      .eq("id", aluno)
      .maybeSingle();
    alunoNome = (alunoRow as any)?.nome_completo || (alunoRow as any)?.nome || "Aluno";
  }

  return (
    <main className="space-y-8 p-4 md:p-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-moxinexa-navy">Financeiro</h1>
          <p className="text-slate-500 text-sm">
            Gestão completa de receita, cobranças e fluxo financeiro da escola.
          </p>
        </div>
        {escolaId ? (
          <GerarMensalidadesModal escolaId={escolaId} />
        ) : (
          <div className="text-xs text-slate-500">Associe-se a uma escola para gerar cobranças.</div>
        )}
      </div>

      {/* Cards Principais */}
      <section className="grid gap-4 md:grid-cols-4">
        <Card
          title="Taxa de Inadimplência"
          value={(resumoData.inadimplencia?.percentual ?? 0).toFixed(1) + "%"}
          icon={<TrendingUp className="text-red-500" />}
          color="bg-red-50"
        />
        <Card
          title="Total em Risco"
          value={(resumoData?.risco?.total ?? 0).toLocaleString("pt-AO") + " Kz"}
          icon={<Wallet className="text-orange-600" />}
          color="bg-orange-50"
        />
        <Card
          title="Pagamentos Confirmados"
          value={resumoData?.confirmados?.total ?? 0}
          icon={<TrendingUp className="text-moxinexa-teal" />}
          color="bg-teal-50"
        />
        <Card
          title="Alunos Pendentes"
          value={resumoData.inadimplencia?.total ?? 0}
          icon={<Users className="text-moxinexa-navy" />}
          color="bg-slate-100"
        />
      </section>

      {/* Acessos Rápidos */}
      <section className="space-y-4">
        <h2 className="text-lg font-bold text-moxinexa-navy">Acessos Rápidos</h2>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <QuickLink
            href="/financeiro/radar"
            title="Radar de Inadimplência"
            description="Acompanhe alunos em atraso e envie cobranças automáticas."
            icon={<Radar className="h-6 w-6" />}
            color="text-red-600"
          />
          <QuickLink
            href="/financeiro/cobrancas"
            title="Histórico de Cobranças"
            description="Veja respostas, pagamentos e eficiência das mensagens."
            icon={<Receipt className="h-6 w-6" />}
            color="text-orange-500"
          />
          <QuickLink
            href="/financeiro/conciliacao"
            title="Conciliação TPA"
            description="Confirme pagamentos Multicaixa/TPA com total precisão."
            icon={<Scale className="h-6 w-6" />}
            color="text-moxinexa-teal"
          />
          <QuickLink
            href="/financeiro/relatorios"
            title="Relatórios Financeiros"
            description="Taxas, gráficos, projeções e análise completa."
            icon={<BarChart3 className="h-6 w-6" />}
            color="text-moxinexa-navy"
          />
        </div>
      </section>

      {/* Extrato do aluno */}
      <section className="space-y-4">
        <h2 className="text-lg font-bold text-moxinexa-navy flex items-center gap-2">
          <DollarSign className="w-5 h-5" /> Extrato por aluno
        </h2>
        {!aluno ? (
          <div className="text-center py-12 bg-gray-50 rounded-lg border border-dashed border-gray-300">
            <Search className="w-12 h-12 mx-auto text-gray-300 mb-3" />
            <h3 className="text-lg font-medium text-gray-900">Nenhum aluno selecionado</h3>
            <p className="text-gray-500">
              Use a Busca Global (Ctrl+K) e vá ao Dossiê para ver o financeiro detalhado.
            </p>
          </div>
        ) : (
          <div className="space-y-6">
            <div className="flex justify-between items-center">
              <div>
                <h3 className="text-lg font-bold">Extrato de: {alunoNome}</h3>
                <p className="text-sm text-gray-500">Histórico completo de cobranças</p>
              </div>
            </div>

            <div className="bg-white shadow-sm rounded-lg border overflow-hidden">
              <table className="min-w-full divide-y divide-gray-200 text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left font-medium text-gray-500 uppercase">Referência</th>
                    <th className="px-6 py-3 text-left font-medium text-gray-500 uppercase">Vencimento</th>
                    <th className="px-6 py-3 text-left font-medium text-gray-500 uppercase">Valor</th>
                    <th className="px-6 py-3 text-center font-medium text-gray-500 uppercase">Status</th>
                    <th className="px-6 py-3 text-right font-medium text-gray-500 uppercase">Ação</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {mensalidades.map((mens) => (
                    <tr key={mens.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 font-medium text-gray-900">
                        {new Date(0, (mens.mes_referencia || 1) - 1).toLocaleString("pt-PT", {
                          month: "long",
                        })}{" "}
                        / {mens.ano_referencia}
                      </td>
                      <td className="px-6 py-4 text-gray-500">
                        {mens.data_vencimento
                          ? new Date(mens.data_vencimento).toLocaleDateString("pt-PT")
                          : "—"}
                      </td>
                      <td className="px-6 py-4 font-bold text-gray-900">
                        {kwanza.format(mens.valor_previsto ?? (mens as any).valor ?? 0)}
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
                            valor={mens.valor_previsto ?? (mens as any).valor ?? 0}
                          />
                        ) : (
                          <button className="text-blue-600 hover:underline text-xs">Ver Recibo</button>
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
        <h2 className="text-lg font-bold text-moxinexa-navy">Resumo da Semana</h2>
        <div className="grid gap-4 md:grid-cols-3">
          <MiniStat label="Cobranças Enviadas" value={0} color="text-moxinexa-teal" />
          <MiniStat
            label="Pagamentos Confirmados"
            value={resumoData?.confirmados?.total ?? 0}
            color="text-green-600"
          />
          <MiniStat label="Conciliações Pendentes" value={resumoData?.pendentes?.total ?? 0} color="text-orange-600" />
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
  color,
}: {
  title: string;
  value: string | number;
  icon: React.ReactNode;
  color: string;
}) {
  return (
    <div
      className={`p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col gap-2 ${color}`}
    >
      <div className="flex items-center justify-between">
        <span className="text-sm text-slate-600">{title}</span>
        <div>{icon}</div>
      </div>
      <div className="text-xl font-bold text-moxinexa-navy">{value}</div>
    </div>
  );
}

function QuickLink({
  href,
  title,
  description,
  icon,
  color,
}: {
  href: string;
  title: string;
  description: string;
  icon: React.ReactNode;
  color: string;
}) {
  return (
    <Link
      href={href}
      className="group bg-white border border-slate-200 p-5 rounded-xl shadow-sm hover:shadow-md transition-all flex flex-col gap-3"
    >
      <div className={`w-10 h-10 rounded-lg bg-slate-100 flex items-center justify-center ${color}`}>
        {icon}
      </div>

      <div>
        <h3 className="text-moxinexa-navy font-bold text-sm">{title}</h3>
        <p className="text-slate-500 text-xs leading-relaxed">{description}</p>
      </div>

      <div className="flex items-center gap-1 text-moxinexa-teal text-sm font-medium group-hover:underline">
        Aceder
        <ArrowRight className="h-4 w-4" />
      </div>
    </Link>
  );
}

function MiniStat({
  label,
  value,
  color,
}: {
  label: string;
  value: number;
  color: string;
}) {
  return (
    <div className="p-4 rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className={`text-2xl font-bold ${color}`}>{value}</div>
      <div className="text-slate-500 text-xs mt-1">{label}</div>
    </div>
  );
}
