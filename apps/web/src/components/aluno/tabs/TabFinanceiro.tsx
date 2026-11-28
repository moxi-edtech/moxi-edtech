"use client";
import { PortalPullToRefresh } from "@/components/portal/ui/PortalPullToRefresh";


import { useContext, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import AcaoRapidaCard from "@/components/shared/AcaoRapidaCard";
import Link from "next/link";
import { Check, Filter, Wallet, ArrowUpCircle, ArrowDownCircle, Printer, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { StudentAppyPayButton } from "@/components/financeiro/AppyPayReferenceButton";
import { PaymentDrawer } from "@/components/aluno/financeiro-portal/PaymentDrawer";
import { PortalFrameActiveContext, usePortalDrawerNavigation } from "@/components/portal/ui/PortalDrawerNavigator";
import { PortalSheet } from "@/components/portal/ui/PortalSheet";
import type { AlunoServicoFinanceiro } from "@/lib/financeiro/servicosPagamento";

type Item = {
  id: string;
  competencia: string;
  valor: number;
  status: "pago" | "pendente" | "atrasado" | "em_verificacao" | "isento" | "cancelado" | "pago_parcial";
  bolsa_isencao_integral?: boolean;
  recibo_id?: string | null;
  vencimento?: string | null;
};
type Movimento = {
  id: string;
  tipo: "debito" | "credito";
  origem: string;
  valor: number;
  data_movimento: string;
  descricao: string;
};
type ComprovativoStatus = {
  pendentes: number;
  ultimo_envio_em: string | null;
};
type DadosPagamento = {
  iban?: string;
  banco?: string;
  titular?: string;
  titular_conta?: string;
  kwik_chave?: string;
};
type ApiResponse = {
  ok: boolean;
  mensalidades: Array<Omit<Item, "status"> & { status: string }>;
  bolsas?: Array<{ ano_letivo: number; vigencia_inicio: string | null; percentagem?: number }>;
  ano_letivo_atual?: number | null;
  servicos?: AlunoServicoFinanceiro[];
  movimentos: Movimento[];
  resumo: {
    saldo_consolidado: number;
    total_pago: number;
    total_pendente: number;
    em_dia: boolean;
  };
  comprovativo_status?: ComprovativoStatus;
  dados_pagamento?: DadosPagamento | null;
};
const money = new Intl.NumberFormat("pt-AO", { style: "currency", currency: "AOA", maximumFractionDigits: 0 });

function normalizeStatus(value: string): Item["status"] {
  if (value === "pago") return "pago";
  if (value === "isento") return "isento";
  if (value === "cancelado") return "cancelado";
  if (value === "pago_parcial") return "pago_parcial";
  if (value === "em_verificacao") return "em_verificacao";
  if (value === "atrasado") return "atrasado";
  return "pendente";
}

function serviceStatusClass(status: AlunoServicoFinanceiro["status"]): string {
  if (status === "pago") return "text-emerald-700";
  if (status === "rejeitado" || status === "cancelado" || status === "erro") return "text-rose-700";
  return "text-amber-700";
}

export function TabFinanceiro({ onOpenDocuments }: { onOpenDocuments?: (serviceCode: string | null) => void } = {}) {
  const searchParams = useSearchParams();
  const studentId = useMemo(() => searchParams?.get("aluno") ?? null, [searchParams]);
  return <FinanceiroScope key={studentId ?? "default"} studentId={studentId} onOpenDocuments={onOpenDocuments} />;
}

function FinanceiroScope({ studentId, onOpenDocuments }: { studentId: string | null; onOpenDocuments?: (serviceCode: string | null) => void }) {
  const frameActive = useContext(PortalFrameActiveContext);
  const navigation = usePortalDrawerNavigation();
  const read = navigation?.read;
  const currentYear = Number(new Intl.DateTimeFormat("en", { year: "numeric", timeZone: "Africa/Luanda" }).format(new Date()));

  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<Item[]>([]);
  const [bolsas, setBolsas] = useState<Array<{ ano_letivo: number; vigencia_inicio: string | null; percentagem?: number }>>([]);
  const [anoLetivoAtual, setAnoLetivoAtual] = useState<number | null>(null);
  const bolsaVigente = bolsas.find(bolsa => bolsa.ano_letivo === anoLetivoAtual);
  const bolsasAnteriores = bolsas.filter(bolsa => bolsa.ano_letivo !== anoLetivoAtual);
  const [movimentos, setMovimentos] = useState<Movimento[]>([]);
  const [resumo, setResumo] = useState<ApiResponse["resumo"] | null>(null);
  const [comprovativoStatus, setComprovativoStatus] = useState<ComprovativoStatus | null>(null);
  const [dadosPagamento, setDadosPagamento] = useState<DadosPagamento | null>(null);
  const [servicos, setServicos] = useState<AlunoServicoFinanceiro[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [paymentOpen, setPaymentOpen] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [fromAno, setFromAno] = useState(currentYear - 1);
  const [toAno, setToAno] = useState(currentYear);
  const [draftFrom, setDraftFrom] = useState(fromAno);
  const [draftTo, setDraftTo] = useState(toAno);
  const [filterOpen, setFilterOpen] = useState(false);
  const [detail, setDetail] = useState<{ kind: "monthly" | "service"; id: string; scope: string } | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [paymentRows, setPaymentRows] = useState<Item[]>([]);
  const paymentLock = useRef(false);
  const [loadedQuery, setLoadedQuery] = useState<string | null>(null);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const activeRequest = useRef<AbortController | null>(null);
  const scopeReady = useRef<string | null>(null);

  const years = useMemo(() => {
    const list: number[] = [];
    for (let year = currentYear + 1; year >= currentYear - 12; year -= 1) list.push(year);
    return list;
  }, [currentYear]);

  const query = useMemo(() => {
    const params = new URLSearchParams();
    if (studentId) params.set("studentId", studentId);
    params.set("fromAno", String(fromAno));
    params.set("toAno", String(toAno));
    return `?${params.toString()}`;
  }, [studentId, fromAno, toAno]);

  // One request per scope. A superseded response cannot publish data or errors.
  const refresh = useCallback(async (fresh = true) => {
    if (activeRequest.current || paymentLock.current) return;
    const controller = new AbortController();
    activeRequest.current = controller;
    setRefreshing(true);
    if (scopeReady.current !== query) setLoading(true);
    setFetchError(null);
    try {
      const response = await (read ? read(`/api/aluno/financeiro${query}`, { signal: controller.signal, fresh }) : fetch(`/api/aluno/financeiro${query}`, { cache: "no-store", signal: controller.signal }));
      const json = await response.json() as ApiResponse;
      if (controller.signal.aborted || activeRequest.current !== controller) return;
      if (!response.ok || !json.ok) {
        if (response.status === 401 || response.status === 403) { scopeReady.current = null; setLoadedQuery(null); setDetailOpen(false); setSelectedIds([]); }
        throw new Error("Não foi possível consultar o financeiro.");
      }
      const mapped = (json.mensalidades ?? []).map(m => ({ ...m, status: normalizeStatus(m.status) }));
      setRows(mapped);
      setBolsas(json.bolsas ?? []);
      setAnoLetivoAtual(json.ano_letivo_atual ?? null);
      setSelectedIds(ids => ids.filter(id => mapped.some(row => row.id === id && row.valor > 0 && ["pendente","atrasado","pago_parcial"].includes(row.status))));
      setMovimentos(json.movimentos ?? []);
      setResumo(json.resumo ?? null);
      setComprovativoStatus(json.comprovativo_status ?? null);
      setDadosPagamento(json.dados_pagamento ?? null);
      setServicos(json.servicos ?? []);
      scopeReady.current = query;
      setLoadedQuery(query);
    } catch (error) {
      if (!controller.signal.aborted && activeRequest.current === controller) setFetchError(error instanceof Error ? error.message : "Não foi possível actualizar.");
    } finally {
      if (activeRequest.current === controller) {
        activeRequest.current = null;
        setLoading(false);
        setRefreshing(false);
      }
    }
  }, [query, read]);
  useEffect(() => {
    void refresh(false);
    return () => {
      activeRequest.current?.abort();
      activeRequest.current = null;
    };
  }, [refresh]);
  useEffect(() => {
    if (!frameActive) return;
    const refreshVisible = () => { if (!document.hidden) void refresh(); };
    const timer = window.setInterval(refreshVisible, 30000);
    window.addEventListener("focus", refreshVisible);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener("focus", refreshVisible);
    };
  }, [frameActive, refresh]);
  const ready = loadedQuery === query;
  const selectedMonthly = ready && detail?.scope === query && detail.kind === "monthly" ? rows.find(item => item.id === detail.id) : undefined;
  const selectedService = ready && detail?.scope === query && detail.kind === "service" ? servicos.find(item => item.id === detail.id) : undefined;
  const detailStatus: Record<Item["status"],string> = { pago:"Pago", pendente:"Pendente", atrasado:"Em atraso", em_verificacao:"Em verificação", isento:"Isento", cancelado:"Cancelado", pago_parcial:"Pago parcialmente" };
  const canPay = (item: Item) => item.valor > 0 && ["pendente","atrasado","pago_parcial"].includes(item.status);
  const applyFilter = () => {
    if (draftFrom > draftTo || !years.includes(draftFrom) || !years.includes(draftTo) || paymentOpen) return;
    if (draftFrom !== fromAno || draftTo !== toAno) {
      activeRequest.current?.abort();
      activeRequest.current = null;
      scopeReady.current = null;
      setSelectedIds([]);
      setPaymentRows([]);
      setDetail(null);
      setDetailOpen(false);
      setLoadedQuery(null);
      setLoading(true);
      setFromAno(draftFrom);
      setToAno(draftTo);
    }
    setFilterOpen(false);
  };

  const sortedMensalidades = useMemo(() => [...rows].sort((a, b) => b.competencia.localeCompare(a.competencia)), [rows]);
  const selectedMensalidades = useMemo(() => rows.filter((item) => selectedIds.includes(item.id)
    && item.valor > 0 && ["pendente", "atrasado", "pago_parcial"].includes(item.status)), [rows, selectedIds]);
  const selectedTotal = useMemo(() => selectedMensalidades.reduce((sum, item) => sum + item.valor, 0), [selectedMensalidades]);
  const openPayment = (items: Item[]) => {
    if (!ready || fetchError || paymentLock.current || !items.length || !items.every(canPay)) return;
    paymentLock.current = true;
    activeRequest.current?.abort(); activeRequest.current = null; setRefreshing(false);
    setPaymentRows(items.map(item => ({...item}))); setPaymentOpen(true);
  };
  const closePayment = () => { paymentLock.current = false; setPaymentOpen(false); };
  const refreshAfterPayment = () => { navigation?.notifyChanged(); activeRequest.current?.abort(); activeRequest.current = null; void refresh(); };

  const handleReprintRecibo = (reciboId: string | null | undefined) => {
    if (!reciboId) return;
    window.open(`/aluno/documentos/${reciboId}/recibo/print`, "_blank", "noopener,noreferrer");
  };

  return (
    <PortalPullToRefresh onRefresh={() => refresh()} busy={loading || refreshing} disabled={filterOpen || detailOpen || paymentOpen || paymentLock.current} className="space-y-6">
      <div hidden={Boolean(navigation && paymentOpen)} className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        {!navigation && <h1 className="text-2xl font-semibold tracking-tight text-primary">Financeiro</h1>}
        <button
          onClick={() => void refresh()}
          className="min-h-11 rounded-xl border border-border bg-card px-4 text-sm font-semibold text-foreground shadow-sm hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring"
        >
          {refreshing ? "A atualizar..." : "Atualizar"}
        </button>
      </div>

      <button type="button" aria-haspopup="dialog" aria-expanded={filterOpen} disabled={paymentOpen} onClick={() => { setDraftFrom(fromAno); setDraftTo(toAno); setFilterOpen(true); }} className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-border bg-card px-4 text-sm font-semibold"><Filter className="h-4 w-4" aria-hidden="true" /> Filtrar período · {fromAno}–{toAno}</button>
      <PortalSheet open={filterOpen} inline={Boolean(navigation)} onClose={() => setFilterOpen(false)} title="Filtrar período" description="Selecciona o intervalo e aplica uma única vez." size="medium">
        <div className="grid grid-cols-2 gap-3">
          <label className="text-sm font-medium">De<select aria-label="De" value={draftFrom} onChange={e => setDraftFrom(Number(e.target.value))} className="mt-1 min-h-11 w-full rounded-xl border border-border bg-card px-3 text-base">{years.map(year => <option key={year} value={year}>{year}</option>)}</select></label>
          <label className="text-sm font-medium">Até<select aria-label="Até" value={draftTo} onChange={e => setDraftTo(Number(e.target.value))} className="mt-1 min-h-11 w-full rounded-xl border border-border bg-card px-3 text-base">{years.map(year => <option key={year} value={year}>{year}</option>)}</select></label>
        </div>
        {draftFrom > draftTo && <p role="alert" className="text-sm text-destructive">O ano inicial deve ser anterior ou igual ao final.</p>}
        <Button tone="gold" className="min-h-11 w-full" disabled={draftFrom > draftTo} onClick={applyFilter}>Aplicar filtro</Button>
      </PortalSheet>
      {fetchError && <p role="alert" className="rounded-xl border border-destructive/30 p-3 text-sm text-foreground">{fetchError} <button type="button" onClick={() => void refresh()} className="font-semibold underline">Tentar novamente</button></p>}
      {!ready ? <p role="status" className="rounded-xl border border-border bg-card p-4 text-sm text-muted-foreground">{loading ? "A carregar o período seleccionado…" : "Dados do período indisponíveis."}</p> : <>
      <div className="grid gap-3 md:grid-cols-3" aria-label="Resumo financeiro">
        <AcaoRapidaCard dashboardCompact mobileCompact emphasizeSublabel label="Por pagar" icon={<Wallet />}
          unavailable={!resumo} needsAttention={Boolean(resumo && resumo.total_pendente > 0)}
          sublabel={resumo ? money.format(resumo.total_pendente) : "Dados indisponíveis"} />
        <AcaoRapidaCard dashboardCompact mobileCompact emphasizeSublabel label="Total pago" icon={<Check />}
          unavailable={!resumo} sublabel={resumo ? money.format(resumo.total_pago) : "Dados indisponíveis"} />
        <AcaoRapidaCard dashboardCompact mobileCompact emphasizeSublabel label="Saldo atual" icon={<ArrowUpCircle />}
          unavailable={!resumo} needsAttention={Boolean(resumo && resumo.saldo_consolidado > 0)}
          sublabel={resumo ? money.format(resumo.saldo_consolidado) : "Dados indisponíveis"} />
      </div>

      {bolsaVigente && (
        <section aria-label="Bolsa de estudo do ano letivo atual" className="flex items-start gap-3 rounded-xl border border-klasse-green/20 bg-klasse-green/5 p-4">
          <Check className="mt-0.5 h-5 w-5 shrink-0 text-klasse-green" aria-hidden="true" />
          <div>
            <p className="text-sm font-semibold text-klasse-green">{(bolsaVigente.percentagem ?? 100) === 100 ? "Bolsa integral de estudo" : `Bolsa parcial de estudo · ${bolsaVigente.percentagem}%`} · Ano atual</p>
            <p className="mt-1 text-sm text-foreground">Ano letivo {bolsaVigente.ano_letivo}/{bolsaVigente.ano_letivo + 1}
              {bolsaVigente.vigencia_inicio ? ` · Desde ${bolsaVigente.vigencia_inicio.slice(0, 7)}` : ""}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">{(bolsaVigente.percentagem ?? 100) === 100 ? "As propinas cobertas estão isentas." : "As propinas abrangidas pela vigência têm desconto percentual."} Outros serviços ou meses anteriores ao início da bolsa podem continuar devidos.</p>
          </div>
        </section>
      )}
      {bolsasAnteriores.length > 0 && (
        <details className="rounded-xl border border-border bg-card p-4">
          <summary className="cursor-pointer text-sm font-medium text-foreground">Histórico de bolsas ({bolsasAnteriores.length})</summary>
          <ul className="mt-2 space-y-1 text-sm text-muted-foreground">
            {bolsasAnteriores.map(bolsa => <li key={bolsa.ano_letivo}>Ano {bolsa.ano_letivo}/{bolsa.ano_letivo + 1} · {bolsa.percentagem ?? 100}% · benefício histórico, não renovado automaticamente</li>)}
          </ul>
        </details>
      )}


      {comprovativoStatus && comprovativoStatus.pendentes > 0 ? (
        <section className="rounded-xl border border-amber-200 bg-amber-50 p-3 dark:border-amber-800 dark:bg-amber-950/40">
          <p className="text-xs font-medium text-amber-700 dark:text-amber-300">Comprovativo</p>
          <p className="mt-1 text-sm font-semibold text-amber-900 dark:text-amber-200">
            Comprovativo enviado, aguardando validação da secretaria.
          </p>
          <p className="mt-1 text-xs text-amber-800 dark:text-amber-300">
            Último envio: {comprovativoStatus.ultimo_envio_em
              ? new Date(comprovativoStatus.ultimo_envio_em).toLocaleString("pt-PT", {
                  day: "2-digit",
                  month: "2-digit",
                  year: "numeric",
                  hour: "2-digit",
                  minute: "2-digit",
                })
              : "—"}
          </p>
        </section>
      ) : null}

      <div className="grid min-w-0 items-start gap-3 lg:grid-cols-2">
        {/* Lado Esquerdo: Mensalidades e Pagamento */}
        <section className="min-w-0 rounded-xl border border-border bg-card p-3 sm:p-4">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-foreground">Mensalidades</h2>
          </div>
          {selectedMensalidades.length ? (
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-200 bg-amber-50 p-3">
              <p className="text-sm font-semibold text-amber-900 dark:text-amber-200">{selectedMensalidades.length} seleccionada(s) · {money.format(selectedTotal)}</p>
              <Button tone="gold" className="min-h-11" size="sm" disabled={Boolean(fetchError)} onClick={() => openPayment(selectedMensalidades)}>Enviar um comprovativo</Button>
            </div>
          ) : null}
          {loading ? (
            <div className="h-28 animate-pulse rounded-xl bg-muted" />
          ) : (
            <ul className="space-y-2">
              {sortedMensalidades.map((item) => (
                <li key={item.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border p-3">
                  <div>
                    <button type="button" aria-haspopup="dialog" aria-expanded={detailOpen && detail?.kind === "monthly" && detail.id === item.id} onClick={() => { setDetail({kind:"monthly",id:item.id,scope:query}); setDetailOpen(true); }} className="min-h-11 break-words text-left text-sm font-semibold text-foreground underline-offset-4 hover:underline focus-visible:ring-2 focus-visible:ring-ring">{item.competencia} <span className="text-xs text-muted-foreground">· Ver detalhes</span></button>
                    <p className="text-xs text-muted-foreground">
                      {item.status === "isento" ? "Propina dispensada" : money.format(item.valor)}
                    </p>
                  </div>
                  {item.status === "isento" ? (
                    <span className="inline-flex items-center gap-1 rounded-full border border-border bg-muted/40 px-3 py-1 text-xs font-medium text-klasse-green">
                      <Check className="h-4 w-4" aria-hidden="true" /> Isento{item.bolsa_isencao_integral ? " · Bolsa" : ""}
                    </span>
                  ) : item.status === "cancelado" ? (
                    <span className="rounded-full border border-border bg-muted px-3 py-1 text-xs text-muted-foreground">Cancelado</span>
                  ) : item.status === "pago" ? (
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-700">
                        <Check className="h-4 w-4" /> {item.bolsa_isencao_integral ? "Pago parcialmente · saldo isento" : "Pago"}
                      </span>
                      {item.recibo_id ? (
                        <button
                          type="button"
                          title="Reimprimir recibo"
                          onClick={() => handleReprintRecibo(item.recibo_id)}
                          className="group inline-flex min-h-11 items-center gap-2 rounded-xl border border-border bg-card px-3 text-xs font-semibold text-muted-foreground shadow-sm transition-colors hover:text-amber"
                        >
                          <Printer className="h-4 w-4 text-muted-foreground transition-colors group-hover:text-amber" />
                          Ver Recibo
                        </button>
                      ) : item.bolsa_isencao_integral ? (
                        <span className="text-xs text-muted-foreground">Sem novo recibo de pagamento</span>
                      ) : (
                        <span className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-border bg-muted/40 px-3 text-xs font-semibold text-muted-foreground cursor-not-allowed">
                          <Loader2 className="h-4 w-4 animate-spin" />
                          A consultar recibo…
                        </span>
                      )}
                    </div>
                  ) : item.status === "em_verificacao" ? (
                    <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-medium text-amber-700">
                      Em Verificação
                    </span>
                  ) : item.valor > 0 ? (
                    <div className="flex flex-wrap items-center gap-2">
                    {item.status === "pago_parcial" && (
                      <span className="text-xs text-muted-foreground">Pago parcialmente · saldo pendente</span>
                    )}
                    <label className="inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-xl border border-amber-200 px-3 text-xs font-semibold text-amber-800">
                      <input type="checkbox" checked={selectedIds.includes(item.id)} onChange={(event) => setSelectedIds((prev) => event.target.checked ? [...prev, item.id] : prev.filter((id) => id !== item.id))} />
                      <Wallet className="h-4 w-4" /> Seleccionar
                    </label>
                    </div>
                  ) : (
                    <span className="text-xs text-muted-foreground">Sem valor a pagar</span>
                  )}
                </li>
              ))}
              {!sortedMensalidades.length ? (
                <li className="rounded-xl border border-border p-4 text-sm text-muted-foreground">
                  {bolsaVigente ? "Nenhuma propina lançada neste intervalo. A bolsa do ano atual está registada." : "Sem mensalidades no intervalo selecionado."}
                </li>
              ) : null}
            </ul>
          )}
        </section>

        {/* Lado Direito: Histórico de Movimentos (Ledger) */}
        <section className="min-w-0 rounded-xl border border-border bg-card p-3 sm:p-4">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-foreground">Histórico de movimentos</h2>
          </div>
          {loading ? (
            <div className="h-28 animate-pulse rounded-xl bg-muted" />
          ) : (
            <div className="space-y-4 relative before:absolute before:left-[17px] before:top-2 before:bottom-2 before:w-[2px] before:bg-muted">
              {movimentos.map((mov) => (
                <div key={mov.id} className="relative pl-10">
                  <div className={`absolute left-0 top-1 p-1 rounded-full bg-card border-2 ${mov.tipo === 'debito' ? 'border-red-200' : 'border-emerald-200'}`}>
                    {mov.tipo === 'debito' ? (
                      <ArrowUpCircle className="h-4 w-4 text-red-500" />
                    ) : (
                      <ArrowDownCircle className="h-4 w-4 text-emerald-600" />
                    )}
                  </div>
                  <div className="flex flex-col">
                    <div className="flex flex-wrap items-baseline justify-between gap-1">
                      <span className="min-w-0 break-words text-sm font-medium text-foreground">{mov.descricao}</span>
                      <span className={`text-xs font-bold ${mov.tipo === 'debito' ? 'text-red-600' : 'text-emerald-700'}`}>
                        {mov.tipo === 'debito' ? '+' : '-'}{money.format(mov.valor)}
                      </span>
                    </div>
                    <span className="text-[10px] text-muted-foreground">
                      {new Date(mov.data_movimento).toLocaleDateString('pt-AO')} • {mov.origem.replace('_', ' ')}
                    </span>
                  </div>
                </div>
              ))}
              {!movimentos.length ? <p className="pl-10 text-sm text-muted-foreground">Sem movimentos neste período.</p> : null}
            </div>
          )}
        </section>
      </div>

      <section className="min-w-0 rounded-xl border border-border bg-card p-3 sm:p-4">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-foreground">Serviços e emolumentos</h2>
        </div>
        {servicos.length ? (
          <div className="grid gap-2 sm:grid-cols-2">
            {servicos.map((servico) => (
              <div key={servico.id} className="min-w-0 rounded-xl border border-border p-3">
                <div className="flex min-w-0 flex-wrap items-start justify-between gap-2">
                <div>
                  <button type="button" aria-haspopup="dialog" aria-expanded={detailOpen && detail?.kind === "service" && detail.id === servico.id} onClick={() => { setDetail({kind:"service",id:servico.id,scope:query}); setDetailOpen(true); }} className="min-h-11 break-words text-left text-sm font-semibold text-foreground hover:underline focus-visible:ring-2 focus-visible:ring-ring">{servico.nome} <span className="text-xs text-muted-foreground">· Ver detalhes</span></button>
                  <p className="text-xs text-muted-foreground">{new Date(servico.data).toLocaleDateString("pt-AO")}</p>
                  <p className="mt-1 text-[10px] text-muted-foreground">Protocolo: {servico.protocolo}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-bold text-foreground">{money.format(servico.valor)}</p>
                  <span className={`text-[10px] font-semibold ${serviceStatusClass(servico.status)}`}>
                    {servico.estado_label}
                  </span>
                </div>
                </div>

              </div>
            ))}
          </div>
        ) : (
          <p className="rounded-xl border border-border bg-muted/40 p-4 text-sm text-muted-foreground">Nenhum serviço registado no período.</p>
        )}
      </section>

      </>}
      <PortalSheet open={detailOpen && Boolean(selectedMonthly || selectedService)} inline={Boolean(navigation)} onClose={() => setDetailOpen(false)} title={selectedMonthly ? `Propina · ${selectedMonthly.competencia}` : selectedService?.nome ?? "Detalhes financeiros"} description={`Período ${fromAno}–${toAno}`} size="medium">
        {selectedMonthly && <>
          <dl className="space-y-3 text-sm"><div><dt className="text-muted-foreground">Estado</dt><dd className="font-semibold">{detailStatus[selectedMonthly.status]}</dd></div><div><dt className="text-muted-foreground">Saldo por liquidar</dt><dd className="text-xl font-semibold tabular-nums text-primary">{money.format(selectedMonthly.valor)}</dd></div><div><dt className="text-muted-foreground">Vencimento</dt><dd>{selectedMonthly.vencimento ? selectedMonthly.vencimento.slice(0,10).split("-").reverse().join("/") : "Indisponível"}</dd></div></dl>
          {selectedMonthly.bolsa_isencao_integral && <p className="text-sm text-muted-foreground">Saldo abrangido por bolsa integral.</p>}
          {selectedMonthly.status === "pago" && selectedMonthly.recibo_id && <Button tone="gray" className="min-h-11 w-full" onClick={() => handleReprintRecibo(selectedMonthly.recibo_id)}>Ver recibo</Button>}
          {!fetchError && canPay(selectedMonthly) && <div className="space-y-2"><StudentAppyPayButton targetId={selectedMonthly.id} kind="monthly" studentId={studentId} descricao={`Propina ${selectedMonthly.competencia}`} onPaid={() => { setSelectedIds(prev => prev.filter(id => id !== selectedMonthly.id)); refreshAfterPayment(); }} /><Button tone="gold" className="min-h-11 w-full" onClick={() => openPayment([selectedMonthly])}>Enviar comprovativo</Button></div>}
          {selectedMonthly.status === "em_verificacao" && <p role="status" className="text-sm text-muted-foreground">A secretaria está a validar o comprovativo. Não pagues novamente.</p>}
        </>}
        {selectedService && <><dl className="space-y-3 text-sm"><div><dt className="text-muted-foreground">Estado</dt><dd className="font-semibold">{selectedService.estado_label}</dd></div><div><dt className="text-muted-foreground">Valor</dt><dd className="text-xl font-semibold tabular-nums text-primary">{money.format(selectedService.valor)}</dd></div><div><dt className="text-muted-foreground">Protocolo</dt><dd className="break-words">{selectedService.protocolo}</dd></div><div><dt className="text-muted-foreground">Data</dt><dd>{new Date(selectedService.data).toLocaleDateString("pt-AO")}</dd></div></dl><p className="text-sm">{selectedService.mensagem_estado}</p><p className="text-sm font-medium">Próximo passo: {selectedService.proximo_passo}</p>
          {!fetchError && selectedService.status === "pendente" && selectedService.appypay_intent_id && <StudentAppyPayButton targetId={selectedService.appypay_intent_id} kind="service" studentId={studentId} descricao={selectedService.nome} onPaid={refreshAfterPayment} />}
          {selectedService.acao && (onOpenDocuments ? <button type="button" onClick={() => onOpenDocuments(new URLSearchParams(selectedService.acao!.href.split("?")[1] ?? "").get("servico"))} className="inline-flex min-h-11 items-center rounded-xl border border-border px-4 text-sm font-semibold text-primary">{selectedService.acao.label} · Secretaria Digital</button> : <Link href={studentId ? `${selectedService.acao.href}&studentId=${encodeURIComponent(studentId)}` : selectedService.acao.href} className="inline-flex min-h-11 items-center rounded-xl border border-border px-4 text-sm font-semibold text-primary">{selectedService.acao.label} · Secretaria Digital</Link>)}
        </>}
      </PortalSheet>
      </div>
      <PaymentDrawer
        open={ready && paymentOpen && paymentRows.length > 0}
        mensalidades={paymentRows}
        dadosPagamento={dadosPagamento}
        onClose={closePayment}
        onUploaded={(ids) => { paymentLock.current = false; refreshAfterPayment(); setRows((prev) => prev.map((r) => (ids.includes(r.id) ? { ...r, status: "em_verificacao" } : r))); setSelectedIds(prev => prev.filter(id => !ids.includes(id))); }}
        studentId={studentId}
      />
    </PortalPullToRefresh>
  );
}
