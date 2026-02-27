import {
  Wallet,
  TrendingUp,
  Radar,
  Receipt,
  Scale,
  BarChart3,
  CheckCircle,
  Clock,
  AlertCircle,
  Search,
  DollarSign,
  LayoutDashboard,
  AlertTriangle,
  BadgePercent,
  ClipboardCheck,
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
import AcaoRapidaCard from "@/components/shared/AcaoRapidaCard";
import { RadarOperacional, type OperationalAlert } from "@/components/feedback/FeedbackSystem";

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
type PagamentoStatusRow = { status: string | null; total: number | null };
type MissingItem = {
  curso_nome: string;
  classe_nome: string;
  missing_type: string;
};


export default async function FinanceiroDashboardPage({
  searchParams,
}: {
  searchParams?: Promise<{ aluno?: string; view?: string }>;
}) {
  const params = (searchParams ? await searchParams : {}) as { aluno?: string; view?: string };
  const { aluno } = params;
  const view = params.view === "atrasos" || params.view === "descontos" || params.view === "fecho" ? params.view : "visao";
  const supabase = await supabaseServer();

  const { data: userRes } = await supabase.auth.getUser();
  const user = userRes?.user;
  let escolaId: string | null = null;
  if (user) {
    const metaEscolaId = (user.app_metadata as { escola_id?: string | null } | null)?.escola_id ?? null;
    escolaId = await resolveEscolaIdForUser(
      supabase as Parameters<typeof resolveEscolaIdForUser>[0],
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
    const json = (await res.json().catch(() => null)) as { ok?: boolean } & T | null;
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

  const totalConfirmados = ((pagamentosStatus as PagamentoStatusRow[] | null) || []).reduce((acc, row) => {
    const status = String(row.status ?? "").toLowerCase();
    return ["settled", "concluido", "pago"].includes(status) ? acc + Number(row.total ?? 0) : acc;
  }, 0);
  const totalPendentes = ((pagamentosStatus as PagamentoStatusRow[] | null) || []).reduce((acc, row) => {
    const status = String(row.status ?? "").toLowerCase();
    return ["pending", "pendente"].includes(status) ? acc + Number(row.total ?? 0) : acc;
  }, 0);

  let mensalidades: Mensalidade[] = [];
  let alunoNome = "";
  let financeNotifications: Notification[] = [];
  let escolaNome = "Escola";
  let anoLetivo = new Date().getFullYear();
  let missingPricingItems: MissingItem[] = [];

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

    const missingPricingRes = await fetchJson(
      `/api/financeiro/missing-pricing?escola_id=${escolaId}&ano_letivo=${anoLetivo}`,
      { ok: false, items: [] as MissingItem[] }
    );
    if (missingPricingRes?.ok) {
      missingPricingItems = (missingPricingRes.items as MissingItem[]) ?? [];
    }
  }

  const totalPagamentosHoje = pagamentosRecentes.reduce((acc, p) => acc + Number(p.valor_pago ?? 0), 0);
  const tabs = [
    { id: "visao", label: "Visão Geral", icon: LayoutDashboard, badge: null },
    { id: "atrasos", label: "Em Atraso", icon: AlertTriangle, badge: radarResumo.length || null },
    { id: "descontos", label: "Descontos", icon: BadgePercent, badge: totalPendentes > 0 ? totalPendentes : null },
    { id: "fecho", label: "Fecho do Mês", icon: ClipboardCheck, badge: null },
  ] as const;

  const radarAlerts: OperationalAlert[] = [];
  if (alunosInadimplentes > 0) {
    radarAlerts.push({
      id: "inadimplencia",
      severity: alunosInadimplentes >= 10 ? "critical" : "warning",
      categoria: "financeiro",
      titulo: `${alunosInadimplentes} aluno${alunosInadimplentes !== 1 ? "s" : ""} em atraso`,
      descricao: "Cobranças pendentes exigem ação imediata da equipa financeira.",
      count: alunosInadimplentes,
      link: "/financeiro/radar",
      link_label: "Abrir radar",
    });
  }
  if (missingPricingItems.length > 0) {
    radarAlerts.push({
      id: "missing-pricing",
      severity: "warning",
      categoria: "financeiro",
      titulo: "Configuração de preços incompleta",
      descricao: "Há cursos activos sem preço definido para o ano lectivo.",
      count: missingPricingItems.length,
      link: "/financeiro/configuracoes/precos",
      link_label: "Configurar preços",
    });
  }
  if (financeNotifications.length > 0) {
    radarAlerts.push({
      id: "acoes-pendentes",
      severity: "info",
      categoria: "financeiro",
      titulo: "Ações pendentes no financeiro",
      descricao: "Reveja as notificações operacionais e conclua os itens pendentes.",
      count: financeNotifications.length,
      link: "/financeiro",
      link_label: "Ver ações",
    });
  }

  const hrefForTab = (id: string) => {
    const qp = new URLSearchParams();
    if (aluno) qp.set("aluno", aluno);
    if (id !== "visao") qp.set("view", id);
    const query = qp.toString();
    return query ? `/financeiro?${query}` : "/financeiro";
  };

  return (
    <main className="space-y-6 p-4 md:p-6">
      <DashboardHeader
        title="Financeiro"
        description="Controlo total do mês em um único ecrã operacional."
        actions={
          escolaId ? (
            <GerarMensalidadesDialog />
          ) : (
            <div className="text-xs text-slate-500">Associe-se a uma escola para gerar cobranças.</div>
          )
        }
      />

      <RadarOperacional alerts={radarAlerts} role="secretaria" />

      {escolaId ? <MissingPricingAlert escolaId={escolaId} anoLetivo={anoLetivo} initialItems={missingPricingItems} /> : null}
      <FinanceiroAlerts notifications={financeNotifications} />

      <section className="rounded-xl border border-slate-200/70 bg-white p-2 shadow-sm">
        <div className="flex flex-wrap items-center gap-2">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const active = view === tab.id;
            return (
              <Link
                key={tab.id}
                href={hrefForTab(tab.id)}
                className={`inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold transition-all ${
                  active
                    ? "bg-slate-900 text-klasse-gold ring-1 ring-klasse-gold/25"
                    : "text-slate-500 hover:bg-slate-100 hover:text-slate-800"
                }`}
              >
                <Icon className="h-4 w-4" />
                {tab.label}
                {tab.badge ? (
                  <span className="rounded-full bg-rose-500 px-1.5 py-0.5 text-[10px] font-bold text-white">
                    {tab.badge}
                  </span>
                ) : null}
              </Link>
            );
          })}
        </div>
      </section>

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="space-y-6">
          {view === "visao" && (
            <>
              <section className="grid gap-4 md:grid-cols-4">
                <Card title="Cobrado" value={kwanza.format(realizado)} valueClassName="text-[#1F6B3B]" helper={`+${percentPago}% do previsto`} icon={<Wallet className="h-5 w-5" />} />
                <Card title="Previsto" value={kwanza.format(previsto)} valueClassName="text-slate-700" helper="Meta do mês" icon={<TrendingUp className="h-5 w-5" />} />
                <Card title="Em Atraso" value={kwanza.format(inadimplenciaTotal)} valueClassName="text-rose-600" helper={`${alunosInadimplentes} alunos`} icon={<AlertCircle className="h-5 w-5" />} />
                <Card title="Descontos / Pendências" value={kwanza.format(totalPendentes)} valueClassName="text-amber-600" helper="Itens a regularizar" icon={<BadgePercent className="h-5 w-5" />} />
              </section>

              <section className="rounded-xl border border-slate-200/70 bg-white p-5 shadow-sm">
                <div className="mb-3 flex items-center justify-between">
                  <div>
                    <h2 className="text-lg font-semibold text-slate-900">Previsão de receita</h2>
                    <p className="text-xs text-slate-500">{kwanza.format(realizado)} de {kwanza.format(previsto)}</p>
                  </div>
                  <span className="font-mono text-2xl font-bold text-[#1F6B3B]">{percentPago}%</span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-[#1F6B3B] to-klasse-gold shadow-[0_0_14px_rgba(227,178,60,0.35)]"
                    style={{ width: `${Math.max(0, Math.min(100, percentPago))}%` }}
                  />
                </div>
              </section>

              <section className="space-y-4">
                <h2 className="text-lg font-semibold text-slate-900">Acessos rápidos</h2>
                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                  <AcaoRapidaCard
                    href="/financeiro/radar"
                    icon={<Radar className="h-5 w-5" />}
                    label="Radar"
                    sublabel="Inadimplência"
                  />
                  <AcaoRapidaCard
                    href="/financeiro/cobrancas"
                    icon={<Receipt className="h-5 w-5" />}
                    label="Cobranças"
                    sublabel="Histórico e ações"
                  />
                  <AcaoRapidaCard
                    href="/financeiro/conciliacao"
                    icon={<Scale className="h-5 w-5" />}
                    label="Conciliação"
                    sublabel="TPA e Multicaixa"
                  />
                  <AcaoRapidaCard
                    href="/financeiro/relatorios"
                    icon={<BarChart3 className="h-5 w-5" />}
                    label="Relatórios"
                    sublabel="Fluxo e métricas"
                  />
                </div>
              </section>
            </>
          )}

          {view === "atrasos" && (
            <section className="rounded-xl border border-slate-200/70 bg-white p-5 shadow-sm">
              <div className="mb-4 flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-semibold text-slate-900">Em Atraso</h2>
                  <p className="text-xs text-slate-500">Ação direta por linha: cobrar ou regularizar.</p>
                </div>
                <Link href="/financeiro/cobrancas" className="text-xs font-semibold text-[#1F6B3B] hover:underline">
                  Abrir gestão de cobranças
                </Link>
              </div>
              <div className="space-y-3">
                {radarResumo.length === 0 ? (
                  <div className="text-sm text-slate-500">Nenhuma pendência encontrada.</div>
                ) : (
                  radarResumo.map((row) => (
                    <div key={row.aluno_id} className="flex flex-col gap-3 rounded-lg border border-slate-100 p-3 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <div className="text-sm font-semibold text-slate-900">{row.aluno_nome || "Aluno"}</div>
                        <div className="text-xs text-slate-500">{row.dias_em_atraso ? `${row.dias_em_atraso} dias em atraso` : "Sem histórico de dias"}</div>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="font-mono text-sm font-bold text-rose-600">{kwanza.format(Number(row.valor_em_atraso ?? 0))}</div>
                        <Link href={`/financeiro/pagamentos?aluno=${row.aluno_id}`} className="rounded-lg bg-klasse-gold px-3 py-2 text-xs font-semibold text-white hover:brightness-95">
                          Registar
                        </Link>
                        <Link href={`/financeiro/cobrancas?aluno=${row.aluno_id}`} className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 hover:border-[#1F6B3B] hover:text-[#1F6B3B]">
                          Avisar
                        </Link>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </section>
          )}

          {view === "descontos" && (
            <section className="rounded-xl border border-slate-200/70 bg-white p-5 shadow-sm">
              <h2 className="text-lg font-semibold text-slate-900">Descontos e Isenções</h2>
              <p className="mt-1 text-xs text-slate-500">Ajuste de política e revisão sem sair do fluxo financeiro.</p>
              <div className="mt-4 grid gap-3 md:grid-cols-2">
                <Link href="/financeiro/tabelas-mensalidade" className="rounded-xl border border-slate-200 p-4 text-sm font-semibold text-slate-800 hover:border-[#1F6B3B] hover:text-[#1F6B3B]">
                  Tabelas de mensalidade
                  <p className="mt-1 text-xs font-normal text-slate-500">Configurar preço-base e regras por turma.</p>
                </Link>
                <Link href="/financeiro/configuracoes/precos" className="rounded-xl border border-slate-200 p-4 text-sm font-semibold text-slate-800 hover:border-[#1F6B3B] hover:text-[#1F6B3B]">
                  Preços e benefícios
                  <p className="mt-1 text-xs font-normal text-slate-500">Revisar descontos activos e pendências.</p>
                </Link>
              </div>
            </section>
          )}

          {view === "fecho" && (
            <section className="rounded-xl border border-slate-200/70 bg-white p-5 shadow-sm">
              <h2 className="text-lg font-semibold text-slate-900">Fecho do mês</h2>
              <p className="mt-1 text-xs text-slate-500">Checklist progressiva para não deixar passos críticos para trás.</p>
              <div className="mt-4 space-y-3">
                <ChecklistItem ok={pagamentosRecentes.length > 0} label="Pagamentos do dia sincronizados" detail={`${pagamentosRecentes.length} eventos capturados`} />
                <ChecklistItem ok={previsto > 0} label="Meta mensal carregada" detail={kwanza.format(previsto)} />
                <ChecklistItem ok={percentPago >= 60} label="Cobrança dentro do nível esperado" detail={`${percentPago}% do previsto`} />
                <ChecklistItem ok={totalPendentes === 0} label="Conciliações pendentes resolvidas" detail={`${totalPendentes} pendências`} />
              </div>
              <div className="mt-5 flex flex-wrap items-center gap-2">
                <Link href="/financeiro/fecho" className="rounded-lg bg-klasse-gold px-4 py-2 text-sm font-semibold text-white hover:brightness-95">
                  Abrir fecho do mês
                </Link>
                <Link href="/financeiro/relatorios/fluxo-caixa" className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 hover:border-[#1F6B3B] hover:text-[#1F6B3B]">
                  Relatório de fluxo
                </Link>
              </div>
            </section>
          )}

          <section className="space-y-4">
            <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-900">
              <DollarSign className="h-4 w-4 text-slate-400" /> Extrato por aluno
            </h2>
            {!aluno ? (
              <div className="rounded-xl border border-dashed border-slate-200/70 bg-slate-50 py-12 text-center">
                <Search className="mx-auto mb-3 h-12 w-12 text-slate-300" />
                <h3 className="text-lg font-medium text-slate-800">Nenhum aluno selecionado</h3>
                <p className="text-slate-500">Use a Busca Global (Ctrl+K) para abrir o dossiê financeiro.</p>
              </div>
            ) : (
              <div className="space-y-6">
                <div>
                  <h3 className="text-lg font-bold text-slate-900">Extrato de: {alunoNome}</h3>
                  <p className="text-sm text-slate-500">Histórico completo de cobranças</p>
                </div>

                <div className="overflow-hidden rounded-xl border border-slate-200/70 bg-white shadow-sm">
                  <table className="min-w-full divide-y divide-slate-200/70 text-sm">
                    <thead className="bg-slate-50">
                      <tr>
                        <th className="px-6 py-3 text-left font-medium uppercase text-slate-500">Referência</th>
                        <th className="px-6 py-3 text-left font-medium uppercase text-slate-500">Vencimento</th>
                        <th className="px-6 py-3 text-left font-medium uppercase text-slate-500">Valor</th>
                        <th className="px-6 py-3 text-center font-medium uppercase text-slate-500">Status</th>
                        <th className="px-6 py-3 text-right font-medium uppercase text-slate-500">Ação</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200/70 bg-white">
                      {mensalidades.map((mens) => (
                        <tr key={mens.id} className="hover:bg-slate-50">
                          <td className="px-6 py-4 font-medium text-slate-800">
                            {new Date(0, (mens.mes_referencia || 1) - 1).toLocaleString("pt-PT", { month: "long" })} / {mens.ano_referencia}
                          </td>
                          <td className="px-6 py-4 text-slate-500">
                            {mens.data_vencimento ? new Date(mens.data_vencimento).toLocaleDateString("pt-PT") : "—"}
                          </td>
                          <td className="px-6 py-4 font-mono font-bold text-slate-800">{kwanza.format(mens.valor_previsto ?? mens.valor ?? 0)}</td>
                          <td className="px-6 py-4 text-center">
                            {mens.status === "pago" ? (
                              <span className="inline-flex items-center rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-medium text-green-800">
                                <CheckCircle className="mr-1 h-3 w-3" /> Pago
                              </span>
                            ) : mens.data_vencimento && new Date(mens.data_vencimento) < new Date() ? (
                              <span className="inline-flex items-center rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-medium text-red-800">
                                <AlertCircle className="mr-1 h-3 w-3" /> Atrasado
                              </span>
                            ) : (
                              <span className="inline-flex items-center rounded-full bg-yellow-100 px-2.5 py-0.5 text-xs font-medium text-yellow-800">
                                <Clock className="mr-1 h-3 w-3" /> Pendente
                              </span>
                            )}
                          </td>
                          <td className="px-6 py-4 text-right">
                            {mens.status !== "pago" ? (
                              <RegistrarPagamentoButton mensalidadeId={mens.id} valor={mens.valor_previsto ?? mens.valor ?? 0} />
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
        </div>

        <aside className="space-y-4 lg:sticky lg:top-24">
          <section className="rounded-xl border border-slate-200/70 bg-white p-5 shadow-sm">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold text-slate-900">Pagamentos do dia</h2>
                <p className="text-xs text-slate-500">Total acumulado: {kwanza.format(totalPagamentosHoje)}</p>
              </div>
              <Link href="/financeiro/pagamentos" className="text-xs font-semibold text-[#1F6B3B] hover:underline">
                Ver todos
              </Link>
            </div>
            <div className="space-y-3">
              {pagamentosRecentes.length === 0 ? (
                <div className="text-sm text-slate-500">Nenhum pagamento hoje.</div>
              ) : (
                pagamentosRecentes.slice(0, 8).map((pagamento) => (
                  <div key={pagamento.id} className="flex items-center justify-between gap-3 rounded-lg border border-slate-100 p-3">
                    <div className="min-w-0">
                      <div className="truncate text-sm font-semibold text-slate-900">
                        {pagamento.aluno_id ? `Aluno ${pagamento.aluno_id.slice(0, 8)}…` : "Aluno"}
                      </div>
                      <div className="text-xs text-slate-500">{pagamento.metodo ?? "—"}</div>
                    </div>
                    <div className="text-right">
                      <div className="font-mono text-sm font-semibold text-slate-900">{kwanza.format(Number(pagamento.valor_pago ?? 0))}</div>
                      <div className="text-xs text-slate-500">
                        {pagamento.created_at
                          ? new Date(pagamento.created_at).toLocaleTimeString("pt-PT", { hour: "2-digit", minute: "2-digit" })
                          : "—"}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </section>

          <section className="space-y-4 rounded-xl border border-slate-200/70 bg-white p-5 shadow-sm">
            <h2 className="text-lg font-semibold text-slate-900">Resumo do mês</h2>
            <div className="grid gap-3">
              <MiniStat label="Alunos Inadimplentes" value={alunosInadimplentes} />
              <MiniStat label="Alunos em Dia" value={alunosEmDia} />
              <MiniStat label="Pagamentos Confirmados" value={totalConfirmados} />
              <MiniStat label="Conciliações Pendentes" value={totalPendentes} />
            </div>
          </section>
        </aside>
      </div>
    </main>
  );
}

//
// --- COMPONENTES DE APOIO ---
//


function ChecklistItem({ ok, label, detail }: { ok: boolean; label: string; detail: string }) {
  return (
    <div className="flex items-start gap-3 rounded-lg border border-slate-100 p-3">
      <span className={`mt-0.5 inline-flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold ${ok ? "bg-[#1F6B3B] text-white" : "bg-slate-100 text-slate-500"}`}>
        {ok ? "✓" : "•"}
      </span>
      <div className="min-w-0">
        <p className={`text-sm font-semibold ${ok ? "text-slate-500 line-through" : "text-slate-900"}`}>{label}</p>
        <p className="text-xs text-slate-500">{detail}</p>
      </div>
    </div>
  );
}

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
      <div className={`font-mono text-2xl font-bold ${valueClassName || "text-slate-900"}`}>{value}</div>
      {helper && <div className="text-xs text-slate-500">{helper}</div>}
    </div>
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
      <div className="font-mono text-2xl font-bold text-slate-900">{value}</div>
      <div className="text-slate-500 text-xs mt-1">{label}</div>
    </div>
  );
}
