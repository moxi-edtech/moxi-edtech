"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import {
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  CircleDollarSign,
  Filter,
  Megaphone,
  MessageCircle,
  Search,
  Users,
  UsersRound,
  WalletCards,
} from "lucide-react";
import { useConfirm, useToast } from "@/components/feedback/FeedbackSystem";
import { ModalPagamentoRapido } from "@/components/secretaria/ModalPagamentoRapido";

type FinancialStatus = "sem_lancamentos" | "regular" | "pendente" | "atrasado";
type RiskStatus = "sem_risco" | "recente" | "atencao" | "critico";

type PortfolioItem = {
  escola_id: string;
  matricula_id: string;
  aluno_id: string;
  numero_matricula: string | null;
  nome_aluno: string;
  responsavel: string | null;
  telefone: string | null;
  turma_id: string | null;
  nome_turma: string | null;
  classe_id: string | null;
  nome_classe: string | null;
  curso_id: string | null;
  nome_curso: string | null;
  ano_letivo: number | null;
  qtd_mensalidades: number;
  qtd_mensalidades_pagas: number;
  qtd_mensalidades_pendentes: number;
  qtd_mensalidades_atrasadas: number;
  valor_previsto_total: number;
  valor_pago_total: number;
  valor_em_aberto: number;
  valor_em_atraso: number;
  proximo_vencimento: string | null;
  vencimento_mais_antigo: string | null;
  dias_maximo_atraso: number;
  status_financeiro: FinancialStatus;
  status_risco: RiskStatus;
};

type PortfolioResponse = {
  ok: boolean;
  items?: PortfolioItem[];
  error?: string;
  pagination?: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
};

type TurmaOption = { id: string; nome: string };

type MensalidadePendente = {
  id: string;
  alunoId: string;
  alunoNome: string | null;
  mesReferencia: number | null;
  anoReferencia: number | null;
  valor: number;
  dataVencimento: string | null;
  status: "pendente" | "atrasada";
};

type PagamentoFlow = {
  aluno: PortfolioItem;
  mensalidades: MensalidadePendente[];
};

const currency = new Intl.NumberFormat("pt-AO", {
  style: "currency",
  currency: "AOA",
  maximumFractionDigits: 0,
});

const financialStatusLabel: Record<FinancialStatus, string> = {
  sem_lancamentos: "Sem lançamentos",
  regular: "Regular",
  pendente: "Pendente",
  atrasado: "Em atraso",
};

const riskLabel: Record<RiskStatus, string> = {
  sem_risco: "Sem risco",
  recente: "Recente",
  atencao: "Atenção",
  critico: "Crítico",
};

const statusClass: Record<FinancialStatus, string> = {
  sem_lancamentos: "bg-slate-100 text-slate-600",
  regular: "bg-emerald-50 text-emerald-700",
  pendente: "bg-amber-50 text-amber-700",
  atrasado: "bg-rose-50 text-rose-700",
};

const riskClass: Record<RiskStatus, string> = {
  sem_risco: "text-slate-500",
  recente: "text-blue-700",
  atencao: "text-amber-700",
  critico: "text-rose-700",
};

function navigateWithinFinance(path: string, query = "") {
  const currentPath = window.location.pathname;
  const marker = "/financeiro/";
  const markerIndex = currentPath.indexOf(marker);
  const financeRoot =
    markerIndex >= 0
      ? currentPath.slice(0, markerIndex + "/financeiro".length)
      : currentPath.replace(/\/+$/, "");
  window.location.assign(`${financeRoot}/${path}${query}`);
}

export default function CarteiraCobrancasClient() {
  const params = useParams<{ id: string }>();
  const escolaId = params?.id;
  const confirm = useConfirm();
  const { error: showError, success, warning } = useToast();
  const [items, setItems] = useState<PortfolioItem[]>([]);
  const [turmas, setTurmas] = useState<TurmaOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchInput, setSearchInput] = useState("");
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<"todos" | FinancialStatus>("todos");
  const [risk, setRisk] = useState<"todos" | RiskStatus>("todos");
  const [turmaId, setTurmaId] = useState("todos");
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [expandedAlunoId, setExpandedAlunoId] = useState<string | null>(null);
  const [sendingWhatsappAlunoId, setSendingWhatsappAlunoId] = useState<string | null>(null);
  const [loadingPaymentAlunoId, setLoadingPaymentAlunoId] = useState<string | null>(null);
  const [paymentFlow, setPaymentFlow] = useState<PagamentoFlow | null>(null);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setQuery(searchInput.trim());
      setPage(1);
    }, 300);
    return () => window.clearTimeout(timer);
  }, [searchInput]);

  useEffect(() => {
    const controller = new AbortController();

    const loadTurmas = async () => {
      try {
        const response = await fetch("/api/financeiro/turmas", {
          cache: "no-store",
          signal: controller.signal,
        });
        if (!response.ok) return;
        const payload = (await response.json()) as Array<{ id?: string; nome?: string }>;
        setTurmas(
          payload
            .filter((turma): turma is { id: string; nome: string } =>
              Boolean(turma.id && turma.nome)
            )
            .map((turma) => ({ id: turma.id, nome: turma.nome }))
        );
      } catch (loadError) {
        if ((loadError as Error).name !== "AbortError") {
          console.error("Erro ao carregar turmas da carteira:", loadError);
        }
      }
    };

    void loadTurmas();
    return () => controller.abort();
  }, []);

  const loadPortfolio = useCallback(async (signal?: AbortSignal) => {
    setLoading(true);
    setError(null);

    const params = new URLSearchParams({ page: String(page), limit: "25" });
    if (query) params.set("q", query);
    if (status !== "todos") params.set("status", status);
    if (risk !== "todos") params.set("risco", risk);
    if (turmaId !== "todos") params.set("turma_id", turmaId);

    try {
      const response = await fetch(`/api/financeiro/carteira?${params.toString()}`, {
        cache: "no-store",
        signal,
      });
      const payload = (await response.json()) as PortfolioResponse;
      if (!response.ok || !payload.ok) {
        throw new Error(payload.error || "Não foi possível carregar a carteira");
      }

      setItems(payload.items ?? []);
      setTotal(payload.pagination?.total ?? 0);
      setTotalPages(payload.pagination?.totalPages ?? 1);
    } catch (loadError) {
      if ((loadError as Error).name === "AbortError") return;
      setItems([]);
      setError((loadError as Error).message);
    } finally {
      if (!signal?.aborted) setLoading(false);
    }
  }, [page, query, risk, status, turmaId]);

  useEffect(() => {
    const controller = new AbortController();
    void loadPortfolio(controller.signal);
    return () => controller.abort();
  }, [loadPortfolio]);

  const pageDebt = useMemo(
    () => items.reduce((sum, item) => sum + Number(item.valor_em_atraso || 0), 0),
    [items]
  );

  const updateStatus = (nextStatus: "todos" | FinancialStatus) => {
    setStatus(nextStatus);
    setPage(1);
  };

  const handleCobrarWhatsapp = async (item: PortfolioItem) => {
    if (!escolaId) {
      showError("Erro", "Não foi possível identificar a escola.");
      return;
    }
    if (Number(item.valor_em_atraso) <= 0) {
      warning("Sem valor em atraso", "Este aluno não possui propinas em atraso.");
      return;
    }

    const accepted = await confirm({
      title: "Cobrança via WhatsApp",
      message: `Enviar um aviso de cobrança ao encarregado de ${item.nome_aluno}?`,
      confirmLabel: "Enviar cobrança",
    });
    if (!accepted) return;

    setSendingWhatsappAlunoId(item.aluno_id);
    try {
      const response = await fetch(
        `/api/escola/${encodeURIComponent(escolaId)}/admin/comunicacao/whatsapp/bulk`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          cache: "no-store",
          body: JSON.stringify({
            messageType: "finance_charge",
            title: "Aviso de propina",
            body: `Prezado(a) encarregado(a), lembramos que existe uma propina em atraso de ${item.nome_aluno}, no valor de ${currency.format(Number(item.valor_em_atraso))}. Agradecemos a regularização.`,
            filters: { alunoIds: [item.aluno_id] },
            expectedCount: 1,
          }),
        }
      );
      const payload = (await response.json()) as { ok?: boolean; error?: string };
      if (!response.ok || payload.ok === false) {
        throw new Error(payload.error || "Não foi possível enviar a cobrança.");
      }
      success("Cobrança enviada", `O aviso para o encarregado de ${item.nome_aluno} foi enviado.`);
    } catch (sendError) {
      showError("Falha no envio", (sendError as Error).message);
    } finally {
      setSendingWhatsappAlunoId(null);
    }
  };

  const handleRegistarPagamento = async (aluno: PortfolioItem) => {
    if (!escolaId) {
      showError("Erro", "Não foi possível identificar a escola.");
      return;
    }

    setLoadingPaymentAlunoId(aluno.aluno_id);
    try {
      const queryParams = new URLSearchParams({
        alunoId: aluno.aluno_id,
        escola_id: escolaId,
      });
      const response = await fetch(`/api/financeiro/mensalidades?${queryParams.toString()}`, {
        cache: "no-store",
      });
      const payload = (await response.json()) as MensalidadePendente[] | { error?: string };
      if (!response.ok || !Array.isArray(payload)) {
        throw new Error(
          (!Array.isArray(payload) && payload.error) || "Não foi possível carregar as propinas."
        );
      }

      const pendentes = payload.filter(
        (mensalidade) =>
          mensalidade.status === "pendente" || mensalidade.status === "atrasada"
      );
      if (pendentes.length === 0) {
        warning("Sem propinas pendentes", "Não existe uma propina disponível para registar.");
        return;
      }
      setPaymentFlow({ aluno, mensalidades: pendentes });
    } catch (paymentError) {
      showError("Erro ao preparar pagamento", (paymentError as Error).message);
    } finally {
      setLoadingPaymentAlunoId(null);
    }
  };

  return (
    <main className="space-y-6">
      <header className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="space-y-1">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
            Financeiro
          </p>
          <h1 className="text-2xl font-bold text-slate-900 md:text-3xl">Cobranças</h1>
          <p className="max-w-3xl text-sm text-slate-600">
            Carteira única de alunos, mensalidades, propinas e valores em atraso.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => navigateWithinFinance("turmas-alunos")}
            className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:border-slate-400"
          >
            <UsersRound className="h-4 w-4" />
            Ações por turma
          </button>
          <button
            type="button"
            onClick={() => navigateWithinFinance("radar")}
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-slate-800"
          >
            <Megaphone className="h-4 w-4" />
            Campanhas de cobrança
          </button>
        </div>
      </header>

      <section className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
            <Users className="h-4 w-4" /> Carteira encontrada
          </div>
          <p className="mt-2 text-2xl font-bold text-slate-900">{total}</p>
          <p className="text-xs text-slate-500">alunos no filtro atual</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
            <AlertTriangle className="h-4 w-4" /> Em atraso nesta página
          </div>
          <p className="mt-2 text-2xl font-bold text-rose-700">{currency.format(pageDebt)}</p>
          <p className="text-xs text-slate-500">25 alunos por página</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
            <WalletCards className="h-4 w-4" /> Fonte financeira
          </div>
          <p className="mt-2 text-sm font-bold text-emerald-700">Carteira consolidada</p>
          <p className="text-xs text-slate-500">uma fonte para aluno e turma</p>
        </div>
      </section>

      <section className="space-y-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex flex-wrap gap-2" aria-label="Estado financeiro">
          {(
            [
              ["todos", "Todos"],
              ["atrasado", "Em atraso"],
              ["pendente", "Pendentes"],
              ["regular", "Regulares"],
              ["sem_lancamentos", "Sem lançamentos"],
            ] as const
          ).map(([value, label]) => (
            <button
              key={value}
              type="button"
              aria-pressed={status === value}
              onClick={() => updateStatus(value)}
              className={`rounded-lg px-3 py-2 text-sm font-semibold transition-colors ${
                status === value
                  ? "bg-slate-900 text-white"
                  : "bg-slate-50 text-slate-600 hover:bg-slate-100"
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="grid gap-3 md:grid-cols-[minmax(220px,1fr)_220px_180px]">
          <label className="relative block">
            <Search className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-slate-400" />
            <span className="sr-only">Pesquisar aluno</span>
            <input
              value={searchInput}
              onChange={(event) => setSearchInput(event.target.value)}
              placeholder="Pesquisar aluno…"
              className="h-10 w-full rounded-lg border border-slate-200 pl-9 pr-3 text-sm outline-none focus:border-slate-400"
            />
          </label>
          <label className="block">
            <span className="sr-only">Filtrar por turma</span>
            <select
              value={turmaId}
              onChange={(event) => {
                setTurmaId(event.target.value);
                setPage(1);
              }}
              className="h-10 w-full rounded-lg border border-slate-200 px-3 text-sm text-slate-700 outline-none focus:border-slate-400"
            >
              <option value="todos">Todas as turmas</option>
              {turmas.map((turma) => (
                <option key={turma.id} value={turma.id}>{turma.nome}</option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="sr-only">Filtrar por risco</span>
            <select
              value={risk}
              onChange={(event) => {
                setRisk(event.target.value as "todos" | RiskStatus);
                setPage(1);
              }}
              className="h-10 w-full rounded-lg border border-slate-200 px-3 text-sm text-slate-700 outline-none focus:border-slate-400"
            >
              <option value="todos">Todos os riscos</option>
              <option value="critico">Crítico</option>
              <option value="atencao">Atenção</option>
              <option value="recente">Recente</option>
              <option value="sem_risco">Sem risco</option>
            </select>
          </label>
        </div>
      </section>

      <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-slate-500" />
            <h2 className="text-sm font-semibold text-slate-900">Carteira por aluno</h2>
          </div>
          <span className="text-xs text-slate-500">Página {page} de {totalPages}</span>
        </div>

        {loading ? (
          <div className="p-8 text-center text-sm text-slate-500">A carregar carteira financeira…</div>
        ) : error ? (
          <div className="p-8 text-center">
            <p className="text-sm text-rose-700">{error}</p>
            <button
              type="button"
              onClick={() => void loadPortfolio()}
              className="mt-3 rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold"
            >
              Tentar novamente
            </button>
          </div>
        ) : items.length === 0 ? (
          <div className="p-8 text-center text-sm text-slate-500">
            Nenhum aluno corresponde aos filtros selecionados.
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {items.map((item) => {
              const expanded = expandedAlunoId === item.aluno_id;
              return (
                <article key={item.aluno_id} className="px-4 py-4">
                  <div className="grid gap-3 lg:grid-cols-[minmax(220px,1.4fr)_minmax(160px,1fr)_140px_150px_auto] lg:items-center">
                    <div>
                      <button
                        type="button"
                        onClick={() => setExpandedAlunoId(expanded ? null : item.aluno_id)}
                        className="text-left"
                      >
                        <span className="block text-sm font-semibold text-slate-900 hover:underline">
                          {item.nome_aluno}
                        </span>
                        <span className="block text-xs text-slate-500">
                          {item.numero_matricula || "Sem número"} · {item.responsavel || "Sem encarregado"}
                        </span>
                      </button>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-slate-700">{item.nome_turma || "Sem turma"}</p>
                      <p className="text-xs text-slate-500">{item.nome_classe || item.nome_curso || "Sem classificação"}</p>
                    </div>
                    <div>
                      <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${statusClass[item.status_financeiro]}`}>
                        {financialStatusLabel[item.status_financeiro]}
                      </span>
                      <p className={`mt-1 text-xs font-semibold ${riskClass[item.status_risco]}`}>
                        {riskLabel[item.status_risco]}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm font-bold text-slate-900">{currency.format(item.valor_em_atraso)}</p>
                      <p className="text-xs text-slate-500">
                        {item.dias_maximo_atraso > 0 ? `${item.dias_maximo_atraso} dias` : "Sem atraso"}
                      </p>
                    </div>
                    <div className="flex flex-wrap justify-start gap-2 lg:justify-end">
                      {Number(item.valor_em_atraso) > 0 ? (
                        <button
                          type="button"
                          disabled={sendingWhatsappAlunoId === item.aluno_id}
                          onClick={() => void handleCobrarWhatsapp(item)}
                          className="inline-flex items-center justify-center gap-2 rounded-lg bg-emerald-600 px-3 py-2 text-xs font-semibold text-white hover:bg-emerald-700 disabled:cursor-wait disabled:opacity-60"
                        >
                          <MessageCircle className="h-4 w-4" />
                          {sendingWhatsappAlunoId === item.aluno_id ? "A enviar…" : "Cobrar"}
                        </button>
                      ) : null}
                      <button
                        type="button"
                        disabled={loadingPaymentAlunoId === item.aluno_id}
                        onClick={() => void handleRegistarPagamento(item)}
                        className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 hover:border-slate-400"
                      >
                        <CircleDollarSign className="h-4 w-4" />
                        {loadingPaymentAlunoId === item.aluno_id ? "A carregar…" : "Registar"}
                      </button>
                    </div>
                  </div>

                  {expanded ? (
                    <div className="mt-4 grid gap-3 rounded-lg bg-slate-50 p-4 text-sm sm:grid-cols-2 lg:grid-cols-4">
                      <div><span className="block text-xs text-slate-500">Previsto</span><strong>{currency.format(item.valor_previsto_total)}</strong></div>
                      <div><span className="block text-xs text-slate-500">Pago</span><strong>{currency.format(item.valor_pago_total)}</strong></div>
                      <div><span className="block text-xs text-slate-500">Em aberto</span><strong>{currency.format(item.valor_em_aberto)}</strong></div>
                      <div><span className="block text-xs text-slate-500">Mensalidades atrasadas</span><strong>{item.qtd_mensalidades_atrasadas}</strong></div>
                      <div className="sm:col-span-2"><span className="block text-xs text-slate-500">Telefone</span><strong>{item.telefone || "Não informado"}</strong></div>
                      <div className="sm:col-span-2"><span className="block text-xs text-slate-500">Ano letivo</span><strong>{item.ano_letivo || "Não informado"}</strong></div>
                    </div>
                  ) : null}
                </article>
              );
            })}
          </div>
        )}

        <div className="flex items-center justify-between border-t border-slate-200 px-4 py-3">
          <button
            type="button"
            disabled={page <= 1 || loading}
            onClick={() => setPage((current) => Math.max(1, current - 1))}
            className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold disabled:cursor-not-allowed disabled:opacity-40"
          >
            <ChevronLeft className="h-4 w-4" /> Anterior
          </button>
          <span className="text-xs text-slate-500">{total} alunos</span>
          <button
            type="button"
            disabled={page >= totalPages || loading}
            onClick={() => setPage((current) => Math.min(totalPages, current + 1))}
            className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold disabled:cursor-not-allowed disabled:opacity-40"
          >
            Seguinte <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </section>

      {paymentFlow && escolaId ? (
        <ModalPagamentoRapido
          key={`${paymentFlow.aluno.aluno_id}-${paymentFlow.mensalidades.map((item) => item.id).join("-")}`}
          open
          onClose={() => {
            setPaymentFlow(null);
          }}
          escolaId={escolaId}
          aluno={{
            id: paymentFlow.aluno.aluno_id,
            nome: paymentFlow.aluno.nome_aluno,
            turma: paymentFlow.aluno.nome_turma || undefined,
          }}
          mensalidade={null}
          mensalidades={paymentFlow.mensalidades.map((mensalidade) => ({
            id: mensalidade.id,
            mes: Number(mensalidade.mesReferencia || 0),
            ano: Number(mensalidade.anoReferencia || 0),
            valor: Number(mensalidade.valor || 0),
            vencimento: mensalidade.dataVencimento || undefined,
            status: mensalidade.status,
          }))}
          onSuccess={() => {
            void loadPortfolio();
          }}
        />
      ) : null}
    </main>
  );
}
