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
import { cookies, headers } from "next/headers";
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
    const metaEscolaId = (user.app_metadata as { escola_id?: string | null } | null)?.escola_id ?? null;
    escolaId = await resolveEscolaIdForUser(
      supabase as any,
      user.id,
      null,
      metaEscolaId ? String(metaEscolaId) : null
    );
  }

  const cookieHeader = (await cookies()).toString();
  const host = (await headers()).get("host");
  const protocol = process.env.NODE_ENV === "development" ? "http" : "https";
  const baseUrl = host ? `${protocol}://${host}` : "";

  const fetchJson = async <T,>(path: string, fallback: T) => {
    if (!baseUrl) return fallback;
    const res = await fetch(`${baseUrl}${path}`, {
      cache: "no-store",
      headers: cookieHeader ? { cookie: cookieHeader } : undefined,
    });
    const json = (await res.json().catch(() => null)) as any;
    if (!res.ok || !json?.ok) return fallback;
    return json;
  };

  const today = new Date();
  const rangeStart = new Date(today.getFullYear(), today.getMonth(), 1)
    .toISOString()
    .slice(0, 10);
  const rangeEnd = new Date(today.getFullYear(), today.getMonth() + 1, 0)
    .toISOString()
    .slice(0, 10);

  const [resumoRes, inadimplenciaRes, recentesRes] = escolaId
    ? await Promise.all([
        fetchJson(
          `/api/financeiro/dashboard/resumo?range_start=${rangeStart}&range_end=${rangeEnd}`,
          { ok: false, data: null }
        ),
        fetchJson(
          `/api/financeiro/inadimplencia/top?limit=5`,
          { ok: false, data: [] }
        ),
        fetchJson(
          `/api/financeiro/pagamentos/recentes?limit=20&day_key=${today.toISOString().slice(0, 10)}`,
          { ok: false, data: [] }
        ),
      ])
    : [{ ok: false, data: null }, { ok: false, data: [] }, { ok: false, data: [] }];

  const { data: pagamentosStatus } = escolaId
    ? await supabase
        .from("vw_pagamentos_status")
        .select("status, total")
        .eq("escola_id", escolaId)
    : { data: [] };

  const resumo = resumoRes?.data ?? {
    previsto: 0,
    realizado: 0,
    inadimplencia: 0,
    percent_realizado: 0,
    alunos_inadimplentes: 0,
    alunos_em_dia: 0,
  };

  const previsto = Number(resumo.previsto ?? 0);
  const realizado = Number(resumo.realizado ?? 0);
  const inadimplenciaTotal = Number(resumo.inadimplencia ?? 0);
  const percentPago = Number(resumo.percent_realizado ?? 0);
  const percentInadimplencia = previsto ? Math.round((inadimplenciaTotal / previsto) * 100) : 0;
  const alunosInadimplentes = Number(resumo.alunos_inadimplentes ?? 0);
  const alunosEmDia = Number(resumo.alunos_em_dia ?? 0);

  const radarResumo = (inadimplenciaRes?.data || []) as Array<{
    aluno_id: string;
    aluno_nome: string | null;
    valor_em_atraso: number | null;
    dias_em_atraso: number | null;
  }>;

  const pagamentosRecentes = (recentesRes?.data || []) as Array<{
    id: string;
    aluno_id: string | null;
    valor_pago: number | null;
    metodo: string | null;
    status: string | null;
    created_at: string | null;
  }>;

  const totalConfirmados = (pagamentosStatus || []).reduce((acc, row: any) => {
    const status = String(row.status ?? "").toLowerCase();
    return ["settled", "concluido", "pago"].includes(status) ? acc + Number(row.total ?? 0) : acc;
  }, 0);
  const totalPendentes = (pagamentosStatus || []).reduce((acc, row: any) => {
    const status = String(row.status ?? "").toLowerCase();
    return ["pending", "pendente"].includes(status) ? acc + Number(row.total ?? 0) : acc;
  }, 0);

  let mensalidades: Mensalidade[] = [];
  let alunoNome = "";
  let financeNotifications: Notification[] = [];
  let escolaNome = "Escola";
  let anoLetivo = new Date().getFullYear();

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
    const [anoAtivoRes, escolaRes, notificationsRes] = await Promise.all([
      supabase
        .from("anos_letivos")
        .select("ano")
        .eq("escola_id", escolaId)
        .eq("ativo", true)
        .order("ano", { ascending: false })
        .limit(1)
        .maybeSingle(),
      supabase
        .from("escolas")
        .select("nome")
        .eq("id", escolaId)
        .maybeSingle(),
      supabase
        .from("notifications")
        .select("id, titulo, mensagem, link_acao, lida, created_at, tipo, target_role")
        .eq("escola_id", escolaId)
        .eq("target_role", "financeiro")
        .eq("lida", false)
        .order("created_at", { ascending: false })
        .limit(5),
    ]);

    if (anoAtivoRes.data?.ano) anoLetivo = Number(anoAtivoRes.data.ano);
    escolaNome = escolaRes.data?.nome ?? escolaNome;
    financeNotifications = (notificationsRes.data as Notification[]) || [];
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
        <MissingPricingAlert escolaId={escolaId} anoLetivo={anoLetivo} />
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

      <section className="bg-white rounded-xl border border-slate-200/70 p-5 shadow-sm">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">Pagamentos Recentes</h2>
            <p className="text-xs text-slate-500">Feed do dia</p>
          </div>
          <Link href="/financeiro/pagamentos" className="text-xs font-semibold text-klasse-green-500 hover:underline">
            Ver todos
          </Link>
        </div>

        <div className="mt-4 space-y-3">
          {pagamentosRecentes.length === 0 ? (
            <div className="text-sm text-slate-500">Nenhum pagamento hoje.</div>
          ) : (
            pagamentosRecentes.map((pagamento) => (
              <div
                key={pagamento.id}
                className="flex flex-col gap-2 rounded-lg border border-slate-100 p-3 sm:flex-row sm:items-center sm:justify-between"
              >
                <div>
                  <div className="text-sm font-semibold text-slate-900">
                    {pagamento.aluno_id ? `Aluno ${pagamento.aluno_id.slice(0, 8)}…` : "Aluno"}
                  </div>
                  <div className="text-xs text-slate-500">
                    {pagamento.metodo ?? "—"} • {pagamento.status ?? "—"}
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-sm font-semibold text-slate-900">
                    {kwanza.format(Number(pagamento.valor_pago ?? 0))}
                  </div>
                  <div className="text-xs text-slate-500">
                    {pagamento.created_at ? new Date(pagamento.created_at).toLocaleTimeString("pt-PT", {
                      hour: "2-digit",
                      minute: "2-digit",
                    }) : "—"}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
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
              const dias = row.dias_em_atraso ? `${row.dias_em_atraso} dias` : "—";
              const telefone = "";
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
                      <div className="text-xs text-slate-500">Em atraso: {dias}</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 sm:justify-end">
                    <div className="text-right">
                      <div className="text-sm font-semibold text-amber-700">{kwanza.format(row.valor_em_atraso ?? 0)}</div>
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
