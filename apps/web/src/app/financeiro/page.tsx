import {
  Wallet,
  TrendingUp,
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
import { applyKf2ListInvariants } from "@/lib/kf2";
import { findClassesSemPreco } from "@/lib/financeiro/missing-pricing";

export const dynamic = 'force-dynamic';

const kwanza = new Intl.NumberFormat("pt-AO", {
  style: "currency",
  currency: "AOA",
});

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

  const dashboardQuery = supabase
    .from("vw_financeiro_dashboard")
    .select(
      "total_pendente, total_pago, total_inadimplente, alunos_inadimplentes, alunos_em_dia"
    )
    .eq("escola_id", escolaId || "")
    .maybeSingle();

  let pagamentosStatusQuery = supabase
    .from("pagamentos_status")
    .select("status, total")
    .eq("escola_id", escolaId || "");
  pagamentosStatusQuery = applyKf2ListInvariants(pagamentosStatusQuery, {
    defaultLimit: 50,
    order: [{ column: "status", ascending: true }],
  });

  let radarResumoQuery = supabase
    .from("vw_financeiro_radar_resumo")
    .select("aluno_id, aluno_nome, turma_nome, meses_atraso, valor_total_atraso, responsavel_nome, telefone_responsavel")
    .eq("escola_id", escolaId || "");
  radarResumoQuery = applyKf2ListInvariants(radarResumoQuery, {
    defaultLimit: 5,
    order: [{ column: "valor_total_atraso", ascending: false }],
  });

  const [dashboardRes, pagamentosStatusRes, radarResumoRes] = escolaId
    ? await Promise.all([dashboardQuery, pagamentosStatusQuery, radarResumoQuery])
    : [{ data: null }, { data: [] }, { data: [] }];

  const dashboardRow = dashboardRes.data as {
    total_pendente?: number | null;
    total_pago?: number | null;
    total_inadimplente?: number | null;
    alunos_inadimplentes?: number | null;
    alunos_em_dia?: number | null;
  } | null;
  const totalPago = Number(dashboardRow?.total_pago ?? 0);
  const totalPendente = Number(dashboardRow?.total_pendente ?? 0);
  const totalInadimplente = Number(dashboardRow?.total_inadimplente ?? 0);
  const alunosInadimplentes = Number(dashboardRow?.alunos_inadimplentes ?? 0);
  const alunosEmDia = Number(dashboardRow?.alunos_em_dia ?? 0);
  const previsto = totalPago + totalPendente + totalInadimplente;
  const realizado = totalPago;
  const inadimplenciaTotal = totalInadimplente;
  const percentPago = previsto ? Math.round((realizado / previsto) * 100) : 0;
  const percentInadimplencia = previsto ? Math.round((inadimplenciaTotal / previsto) * 100) : 0;

  const pagamentosStatus = (pagamentosStatusRes.data || []) as Array<{ status?: string | null; total?: number | null }>;
  const totalConfirmados = pagamentosStatus.reduce((acc, row) => {
    const status = String(row.status ?? "").toLowerCase();
    return status === "pago" || status === "concluido" ? acc + Number(row.total ?? 0) : acc;
  }, 0);
  const totalPendentes = pagamentosStatus.reduce((acc, row) => {
    const status = String(row.status ?? "").toLowerCase();
    return status === "pendente" ? acc + Number(row.total ?? 0) : acc;
  }, 0);

  const radarResumo = (radarResumoRes.data || []) as Array<{
    aluno_id: string;
    aluno_nome: string | null;
    turma_nome: string | null;
    meses_atraso: string[] | null;
    valor_total_atraso: number | null;
    responsavel_nome: string | null;
    telefone_responsavel: string | null;
  }>;

  let mensalidades: Mensalidade[] = [];
  let alunoNome = "";
  let financeNotifications: Notification[] = [];
  let escolaNome = "Escola";
  let anoLetivo = new Date().getFullYear();
  let missingPricingItems: Array<{ curso_nome: string; classe_nome: string; missing_type: string }> = [];

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
    const { data: anoAtivo } = await supabase
      .from("anos_letivos")
      .select("ano")
      .eq("escola_id", escolaId)
      .eq("ativo", true)
      .order("ano", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (anoAtivo?.ano) anoLetivo = Number(anoAtivo.ano);

    try {
      const missing = await findClassesSemPreco(supabase as any, escolaId, anoLetivo);
      missingPricingItems = (missing.items || []).map((item) => ({
        curso_nome: item.curso_nome ?? "—",
        classe_nome: item.classe_nome ?? "—",
        missing_type: item.missing_type ?? "desconhecido",
      }));
    } catch (err) {
      console.error("Erro ao carregar preços pendentes", err);
    }

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
        <MissingPricingAlert
          escolaId={escolaId}
          anoLetivo={anoLetivo}
          initialItems={missingPricingItems}
        />
      ) : null}

      <FinanceiroAlerts notifications={financeNotifications} />

      {/* Cards Principais */}
      <section className="grid gap-4 md:grid-cols-3">
        <Card
          title="Previsto"
          value={kwanza.format(previsto)}
          valueClassName="text-slate-600"
          helper="Total esperado"
          icon={<Wallet />}
        />
        <Card
          title="Realizado"
          value={kwanza.format(realizado)}
          valueClassName="text-emerald-600"
          helper={`${percentPago}% do previsto`}
          icon={<TrendingUp />}
        />
        <Card
          title="Inadimplência"
          value={kwanza.format(inadimplenciaTotal)}
          valueClassName="text-rose-600"
          helper={`${percentInadimplencia}% do previsto`}
          icon={<AlertCircle />}
        />
      </section>

      {/* Radar + Ações rápidas */}
      <section className="grid gap-6 lg:grid-cols-[2fr_1fr]">
        <div className="bg-white rounded-xl border border-slate-200/70 p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-slate-900">Inadimplência Recente</h2>
              <p className="text-xs text-slate-500">Top 5 por valor em atraso</p>
            </div>
            <Link href="/financeiro/radar" className="text-xs font-semibold text-klasse-green-500 hover:underline">
              Ver lista completa
            </Link>
          </div>

          <div className="mt-4 space-y-3">
            {radarResumo.length === 0 && (
              <div className="text-sm text-slate-500">Nenhuma pendência encontrada.</div>
            )}
            {radarResumo.map((row) => {
              const nomeAluno = row.aluno_nome || "Aluno";
              const iniciais = nomeAluno.trim().charAt(0).toUpperCase();
              const meses = (row.meses_atraso || [])
                .map((mes) => new Date(mes).toLocaleDateString("pt-PT", { month: "short" }).replace(".", ""))
                .join(", ") || "—";
              const telefone = (row.telefone_responsavel || "").replace(/\D+/g, "");
              const mensagem = `Olá, referente à mensalidade do aluno ${nomeAluno}. Podemos ajudar?`;
              const whatsapp = telefone
                ? `https://wa.me/${telefone}?text=${encodeURIComponent(mensagem)}`
                : null;
              return (
                <div key={row.aluno_id} className="flex flex-col gap-3 rounded-lg border border-slate-100 p-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-full bg-slate-100 text-slate-600 flex items-center justify-center text-sm font-semibold">
                      {iniciais}
                    </div>
                    <div>
                      <div className="text-sm font-semibold text-slate-900">{nomeAluno}</div>
                      <div className="text-xs text-slate-500">{row.turma_nome || "Turma"} • {meses}</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 sm:justify-end">
                    <div className="text-right">
                      <div className="text-sm font-semibold text-amber-700">{kwanza.format(row.valor_total_atraso ?? 0)}</div>
                      <div className="text-xs text-slate-500">Total em atraso</div>
                    </div>
                    {whatsapp ? (
                      <a
                        href={whatsapp}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center justify-center rounded-full border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-700 hover:bg-emerald-100"
                      >
                        WhatsApp
                      </a>
                    ) : (
                      <span className="inline-flex items-center justify-center rounded-full border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-400">
                        Sem contacto
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="bg-white rounded-xl border border-slate-200/70 p-5 shadow-sm space-y-4">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">Ações rápidas</h2>
            <p className="text-xs text-slate-500">Operações do dia</p>
          </div>
          <div className="grid gap-2">
            <Link
              href="/financeiro/pagamentos"
              className="inline-flex items-center justify-center rounded-lg bg-klasse-green-600 px-4 py-2 text-sm font-semibold text-white hover:bg-klasse-green-700"
            >
              + Novo Pagamento
            </Link>
            <Link
              href="/financeiro/fecho"
              className="inline-flex items-center justify-center rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 hover:border-slate-300"
            >
              🖨️ Fecho de Caixa
            </Link>
          </div>
        </div>
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

      {/* Resumo do mês */}
      <section className="space-y-4">
        <h2 className="text-lg font-semibold text-slate-900">Resumo do Mês</h2>
        <div className="grid gap-4 md:grid-cols-4">
          <MiniStat label="Alunos Inadimplentes" value={alunosInadimplentes} />
          <MiniStat label="Alunos em Dia" value={alunosEmDia} />
          <MiniStat label="Pagamentos Confirmados" value={totalConfirmados} />
          <MiniStat label="Conciliações Pendentes" value={totalPendentes} />
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
  helper,
  valueClassName,
}: {
  title: string;
  value: string | number;
  icon: React.ReactNode;
  helper?: string;
  valueClassName?: string;
}) {
  return (
    <div
      className="p-4 rounded-xl border border-slate-200/70 bg-white shadow-sm flex flex-col gap-2"
    >
      <div className="flex items-center justify-between">
        <span className="text-sm text-slate-600">{title}</span>
        <div className="text-klasse-gold-400">{icon}</div>
      </div>
      <div className={`text-2xl font-bold ${valueClassName || "text-slate-900"}`}>{value}</div>
      {helper && <div className="text-xs text-slate-500">{helper}</div>}
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
