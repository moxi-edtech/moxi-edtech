"use client";

import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, CheckCircle2, Loader2, RefreshCw, WalletCards, ShieldAlert, GraduationCap, FileCheck, X } from "lucide-react";
import { ReclassificacaoFinalistasClient } from "@/components/secretaria/virada-ano/ReclassificacaoFinalistasClient";
import { ModalPagamentoRapido } from "@/components/secretaria/ModalPagamentoRapido";
import { useEscolaId } from "@/hooks/useEscolaId";
import { formatTurmaOptionDisplay } from "@/utils/formatters";

type PendingRow = {
  id: string;
  aluno_id: string;
  matricula_id: string;
  reclassificacao_id?: string;
  nome: string;
  turma: string;
  saldo: number;
  motivo: "divida" | "finalista" | "revisao";
  estado: string;
  pode_promover: boolean;
};
type ResponseState = { rows: PendingRow[]; sessions: { current?: { id: string; ano: number }; previous?: { id: string; ano: number } }; summary: { total: number; debt: number; finalists: number; review: number } };
type PaymentMensalidade = { id: string; mes: number; ano: number; valor: number; vencimento?: string; status: string };
type PromotionOption = {
  id: string;
  nome: string;
  turno: string | null;
  letra: string | null;
  classe_num: number | null;
  ocupacao: number;
  capacidade_maxima: number | null;
  vagas: number | null;
  disponivel: boolean;
  mesmo_turno: boolean;
};

const tabs = [
  ["all", "Todos"],
  ["divida", "Dívidas"],
  ["finalista", "Finalistas"],
  ["revisao", "Revisão"],
] as const;

export function CentroPendenciasPosViradaClient() {
  const [data, setData] = useState<ResponseState | null>(null);
  const [filter, setFilter] = useState<(typeof tabs)[number][0]>("all");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [resolutionRow, setResolutionRow] = useState<PendingRow | null>(null);
  const [paymentRow, setPaymentRow] = useState<PendingRow | null>(null);
  const [paymentItems, setPaymentItems] = useState<PaymentMensalidade[]>([]);
  const [paymentLoading, setPaymentLoading] = useState(false);
  const [promotionRow, setPromotionRow] = useState<PendingRow | null>(null);
  const [promotionOptions, setPromotionOptions] = useState<PromotionOption[]>([]);
  const [promotionTargetId, setPromotionTargetId] = useState("");
  const [promotionLoading, setPromotionLoading] = useState(false);
  const { escolaId } = useEscolaId();

  async function load() {
    setLoading(true);
    setMessage(null);
    try {
      const response = await fetch("/api/secretaria/operacoes-academicas/pos-virada", { cache: "no-store" });
      const json = await response.json();
      if (!response.ok || !json.ok) throw new Error(json.error || "Não foi possível carregar as pendências");
      setData(json);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Erro ao carregar pendências");
    } finally { setLoading(false); }
  }

  useEffect(() => { void load(); }, []);
  const rows = useMemo(() => data?.rows.filter((row) => filter === "all" || row.motivo === filter) ?? [], [data, filter]);
  const pageSize = 25;
  const totalPages = Math.max(1, Math.ceil(rows.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const visibleRows = rows.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  async function openPromotion(row: PendingRow) {
    setPromotionLoading(true);
    setMessage(null);
    setPromotionTargetId("");
    try {
      const response = await fetch(`/api/secretaria/operacoes-academicas/pos-virada?options_for_matricula_id=${encodeURIComponent(row.matricula_id)}`, { cache: "no-store" });
      const json = await response.json().catch(() => ({}));
      if (!response.ok || !json.ok) throw new Error(json.error || "Não foi possível carregar as turmas de destino.");
      const options = (Array.isArray(json.options) ? json.options : []) as PromotionOption[];
      const available = options.filter((option) => option.disponivel);
      setPromotionOptions(available);
      if (available.length === 1) setPromotionTargetId(available[0].id);
      setPromotionRow(row);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Não foi possível carregar as turmas de destino.");
    } finally {
      setPromotionLoading(false);
    }
  }

  async function promote(row: PendingRow, turmaDestinoId?: string) {
    setBusy(row.id); setMessage(null);
    try {
      const payload = { action: "promote_after_payment", aluno_id: row.aluno_id, turma_destino_id: turmaDestinoId };
      const response = await fetch("/api/secretaria/operacoes-academicas/pos-virada", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      const json = await response.json();
      if (!response.ok || !json.ok) throw new Error(json.error || "Não foi possível promover o aluno");
      await load();
      setResolutionRow(null);
      setPromotionRow(null);
    } catch (error) { setMessage(error instanceof Error ? error.message : "Erro ao promover aluno"); }
    finally { setBusy(null); }
  }

  async function openPayment(row: PendingRow) {
    if (!escolaId) {
      setMessage("Escola não identificada para abrir o pagamento.");
      return;
    }
    setPaymentLoading(true);
    setMessage(null);
    try {
      const response = await fetch(`/api/secretaria/operacoes-academicas/pos-virada/pagamentos?aluno_id=${encodeURIComponent(row.aluno_id)}&matricula_id=${encodeURIComponent(row.matricula_id)}`, { cache: "no-store" });
      const json = await response.json().catch(() => ({}));
      if (!response.ok || !json.ok) throw new Error(json.error || "Não foi possível carregar a dívida da matrícula de origem.");
      const mensalidades = Array.isArray(json.mensalidades) ? json.mensalidades as PaymentMensalidade[] : [];
      if (mensalidades.length === 0) {
        await load();
        throw new Error("Não existem mensalidades abertas para este aluno. Atualize a fila e tente promover novamente.");
      }
      setPaymentItems(mensalidades);
      setPaymentRow(row);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Não foi possível abrir o pagamento.");
    } finally {
      setPaymentLoading(false);
    }
  }

  if (loading) return (
    <div className="rounded-2xl border border-slate-200 bg-white p-12 text-center text-slate-500 shadow-2xs">
      <Loader2 className="mx-auto mb-3 h-8 w-8 animate-spin text-[#1F6B3B]" />
      <p className="text-sm font-semibold text-slate-700 font-sora">A identificar pendências do ano anterior…</p>
      <p className="text-xs text-slate-400 mt-1">Carregando dados académicos e financeiros acumulados.</p>
    </div>
  );

  if (!data) return (
    <div className="rounded-2xl border border-rose-200 bg-rose-50/70 p-6 text-sm text-rose-900 shadow-2xs space-y-3">
      <div className="flex items-center gap-2 font-bold text-rose-950">
        <AlertTriangle className="h-5 w-5 text-rose-600" />
        <span>Erro ao carregar pendências</span>
      </div>
      <p className="text-xs text-rose-700">{message || "Não foi possível carregar o centro de resolução."}</p>
      <button onClick={() => void load()} className="px-3.5 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs transition shadow-2xs">
        Tentar novamente
      </button>
    </div>
  );

  return (
    <section className="space-y-6">
      {/* Metric Cards - Premium Klasse Palette */}
      <div className="grid gap-3 sm:grid-cols-4">
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-2xs space-y-1">
          <div className="flex items-center justify-between">
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Total Pendências</p>
            <div className="h-8 w-8 rounded-xl bg-slate-100 flex items-center justify-center text-slate-700">
              <FileCheck className="h-4 w-4" />
            </div>
          </div>
          <p className="text-2xl font-black text-slate-900 font-sora">{data.summary.total}</p>
        </div>

        <div className="rounded-2xl border border-amber-200/70 bg-amber-50/50 p-4 shadow-2xs space-y-1">
          <div className="flex items-center justify-between">
            <p className="text-[10px] font-bold uppercase tracking-wider text-amber-800">Dívidas</p>
            <div className="h-8 w-8 rounded-xl bg-amber-100 flex items-center justify-center text-amber-800">
              <WalletCards className="h-4 w-4" />
            </div>
          </div>
          <p className="text-2xl font-black text-amber-950 font-sora">{data.summary.debt}</p>
        </div>

        <div className="rounded-2xl border border-purple-200/70 bg-purple-50/50 p-4 shadow-2xs space-y-1">
          <div className="flex items-center justify-between">
            <p className="text-[10px] font-bold uppercase tracking-wider text-purple-800">Finalistas</p>
            <div className="h-8 w-8 rounded-xl bg-purple-100 flex items-center justify-center text-purple-800">
              <GraduationCap className="h-4 w-4" />
            </div>
          </div>
          <p className="text-2xl font-black text-purple-950 font-sora">{data.summary.finalists}</p>
        </div>

        <div className="rounded-2xl border border-blue-200/70 bg-blue-50/50 p-4 shadow-2xs space-y-1">
          <div className="flex items-center justify-between">
            <p className="text-[10px] font-bold uppercase tracking-wider text-blue-800">Revisão</p>
            <div className="h-8 w-8 rounded-xl bg-blue-100 flex items-center justify-center text-blue-800">
              <ShieldAlert className="h-4 w-4" />
            </div>
          </div>
          <p className="text-2xl font-black text-blue-950 font-sora">{data.summary.review}</p>
        </div>
      </div>

      {/* Header Info */}
      <div className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-5 shadow-2xs sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="font-bold text-slate-900 text-sm font-sora">Resolver sem voltar ao wizard</h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Origem <strong className="text-slate-700">{data.sessions.previous?.ano ?? "—"}</strong> &rarr; destino <strong className="text-slate-700">{data.sessions.current?.ano ?? "—"}</strong>. Cada aluno aparece com a causa provável identificada.
          </p>
        </div>
        <button
          onClick={() => void load()}
          className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 px-3.5 py-2 text-xs font-bold text-slate-700 transition"
        >
          <RefreshCw className="h-4 w-4 text-[#1F6B3B]" />
          <span>Atualizar</span>
        </button>
      </div>

      {/* Tabs Filter */}
      <div className="flex gap-1.5 overflow-x-auto pb-1">
        {tabs.map(([value, label]) => (
          <button
            key={value}
            onClick={() => { setFilter(value); setPage(1); }}
            className={`rounded-xl px-4 py-2 text-xs font-bold transition ${
              filter === value
                ? "bg-slate-900 text-white shadow-2xs"
                : "bg-white border border-slate-200 text-slate-600 hover:bg-slate-50"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {message && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-xs text-rose-800 font-semibold flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 text-rose-600 flex-shrink-0" />
          <span>{message}</span>
        </div>
      )}

      {/* Table List */}
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xs">
        {rows.length === 0 ? (
          <div className="p-16 text-center text-slate-500 space-y-2">
            <CheckCircle2 className="mx-auto h-10 w-10 text-emerald-500 opacity-80" />
            <p className="text-sm font-bold text-slate-800">Não há pendências nesta categoria</p>
            <p className="text-xs text-slate-400">Todos os registos deste grupo estão regulares.</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {visibleRows.map((row) => (
              <div key={row.id} className="flex flex-col gap-3 p-4 hover:bg-slate-50/60 transition md:flex-row md:items-center md:justify-between">
                <div className="min-w-0 space-y-1">
                  <p className="font-bold text-slate-900 text-sm">{row.nome}</p>
                  <p className="text-xs text-slate-500">
                    {row.turma} · <span className="font-semibold text-slate-700">{row.estado}</span>
                  </p>
                  {row.saldo > 0 && (
                    <p className="inline-flex items-center gap-1.5 text-xs font-bold text-amber-800 bg-amber-50 border border-amber-200/60 px-2.5 py-0.5 rounded-full">
                      <WalletCards className="h-3.5 w-3.5 text-amber-600" />
                      Saldo pendente: {row.saldo.toLocaleString("pt-PT", { style: "currency", currency: "AOA" })}
                    </p>
                  )}
                </div>

                <div className="flex shrink-0 items-center gap-2">
                  {row.motivo === "divida" && (
                    <button
                      disabled={busy === row.id || paymentLoading}
          onClick={() => void openPayment(row)}
                      className="rounded-xl bg-[#1F6B3B] hover:bg-[#18542e] px-4 py-2 text-xs font-bold text-white transition shadow-2xs disabled:cursor-not-allowed disabled:opacity-40 flex items-center gap-2"
                    >
                      {busy === row.id || (paymentLoading && paymentRow?.id === row.id) ? (
                        <Loader2 className="h-4 w-4 animate-spin text-white" />
                      ) : "Receber pagamento"}
                    </button>
                  )}

                  {row.motivo === "finalista" && (
                    <button
                      type="button"
                      onClick={() => setResolutionRow(row)}
                      className="inline-flex items-center gap-1.5 rounded-xl bg-[#E3B23C] hover:bg-[#d8a733] px-4 py-2 text-xs font-bold text-slate-950 transition shadow-2xs"
                    >
                      <span>Resolver destino</span>
                    </button>
                  )}

                  {row.motivo === "revisao" && (
                    <button
                      type="button"
                      disabled={promotionLoading}
                      onClick={() => void (row.pode_promover ? openPromotion(row) : setResolutionRow(row))}
                      className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 px-4 py-2 text-xs font-bold text-slate-700 transition shadow-2xs"
                    >
                      <AlertTriangle className="h-3.5 w-3.5 text-amber-500" />
                      <span>{row.pode_promover ? "Escolher turma e promover" : "Abrir revisão"}</span>
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {rows.length > 0 && (
          <div className="flex items-center justify-between border-t border-slate-100 bg-slate-50/50 px-4 py-3 text-xs text-slate-500">
            <span>
              {(currentPage - 1) * pageSize + 1}–{Math.min(currentPage * pageSize, rows.length)} de {rows.length}
            </span>
            <div className="flex items-center gap-2">
              <button
                disabled={currentPage === 1}
                onClick={() => setPage((value) => Math.max(1, value - 1))}
                className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
              >
                Anterior
              </button>
              <span className="font-medium text-slate-700">
                Página {currentPage} de {totalPages}
              </span>
              <button
                disabled={currentPage === totalPages}
                onClick={() => setPage((value) => Math.min(totalPages, value + 1))}
                className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
              >
                Seguinte
              </button>
            </div>
          </div>
        )}
      </div>

      {promotionRow && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/45 p-0 backdrop-blur-[2px] sm:items-center sm:p-6" role="dialog" aria-modal="true" aria-label="Escolher turma de destino">
          <div className="w-full max-w-xl rounded-t-3xl bg-white shadow-2xl sm:rounded-3xl">
            <div className="flex items-start justify-between border-b border-slate-200 px-5 py-4 sm:px-6">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">Promoção pós-pagamento</p>
                <h2 className="mt-1 text-base font-bold text-slate-900">{promotionRow.nome}</h2>
                <p className="mt-1 text-xs text-slate-500">Escolha uma turma disponível da classe seguinte no novo ano.</p>
              </div>
              <button type="button" onClick={() => setPromotionRow(null)} className="rounded-xl p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700" aria-label="Fechar escolha de turma">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="space-y-4 p-5 sm:p-6">
              {promotionOptions.length === 0 ? (
                <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950">
                  <p className="font-bold">Não há turmas disponíveis</p>
                  <p className="mt-1 text-xs leading-relaxed">Não foi encontrada uma turma da classe seguinte com vagas no novo ano letivo. Crie/liberte uma turma e tente novamente.</p>
                </div>
              ) : (
                <label className="block space-y-2">
                  <span className="text-xs font-bold text-slate-700">Turma de destino</span>
                  <select value={promotionTargetId} onChange={(event) => setPromotionTargetId(event.target.value)} className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-800 outline-none focus:border-[#1F6B3B] focus:ring-2 focus:ring-[#1F6B3B]/15">
                    <option value="">Selecione a turma disponível...</option>
                    {promotionOptions.map((option) => (
                      <option key={option.id} value={option.id}>
                        {formatTurmaOptionDisplay(
                          { nome: option.nome, turno: option.turno },
                          option.vagas === null
                            ? "Vagas abertas"
                            : `${option.vagas} ${option.vagas === 1 ? "vaga" : "vagas"}`,
                        )}
                      </option>
                    ))}
                  </select>
                </label>
              )}
              <div className="flex justify-end gap-2">
                <button type="button" onClick={() => setPromotionRow(null)} className="rounded-xl border border-slate-200 px-4 py-2.5 text-xs font-bold text-slate-700 hover:bg-slate-50">Cancelar</button>
                {promotionOptions.length > 0 && (
                  <button type="button" disabled={!promotionTargetId || busy === promotionRow.id} onClick={() => void promote(promotionRow, promotionTargetId)} className="inline-flex items-center gap-2 rounded-xl bg-[#1F6B3B] px-4 py-2.5 text-xs font-bold text-white hover:bg-[#18542e] disabled:cursor-not-allowed disabled:opacity-50">
                    {busy === promotionRow.id && <Loader2 className="h-4 w-4 animate-spin" />}
                    Confirmar promoção
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {resolutionRow && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/45 p-0 backdrop-blur-[2px] sm:items-center sm:p-6" role="dialog" aria-modal="true" aria-label="Resolver pendência pós-virada">
          <div className="flex max-h-[92vh] w-full max-w-4xl flex-col overflow-hidden rounded-t-3xl bg-white shadow-2xl sm:rounded-3xl">
            <div className="flex items-start justify-between border-b border-slate-200 px-5 py-4 sm:px-6">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">Resolução rápida</p>
                <h2 className="mt-1 text-base font-bold text-slate-900">{resolutionRow.nome}</h2>
                <p className="mt-1 text-xs text-slate-500">{resolutionRow.turma} · {resolutionRow.estado}</p>
              </div>
              <button type="button" onClick={() => setResolutionRow(null)} className="rounded-xl p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700" aria-label="Fechar resolução">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="min-h-0 overflow-y-auto p-4 sm:p-6">
              {resolutionRow.motivo === "finalista" && resolutionRow.reclassificacao_id ? (
                <ReclassificacaoFinalistasClient
                  initialAlunoId={resolutionRow.aluno_id}
                  isModalContext
                  onPaymentRequired={(alunoId) => {
                    const anoLetivoId = data.sessions.current?.id;
                    if (!anoLetivoId) {
                      setMessage("Ano letivo destino não identificado para abrir o pagamento.");
                      return;
                    }
                    window.location.assign(`/secretaria/balcao?alunoId=${encodeURIComponent(alunoId)}&ano_letivo_id=${encodeURIComponent(anoLetivoId)}`);
                  }}
                  onResolved={() => {
                    setResolutionRow(null);
                    void load();
                  }}
                />
              ) : (
                <div className="space-y-4">
                  <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950">
                    <p className="font-bold">Revisão necessária</p>
                    <p className="mt-1 text-xs leading-relaxed">Este aluno ficou no ano anterior sem dívida identificada. O KLASSE tentará promover para a turma correspondente do ano atual; se não existir uma turma compatível, a mensagem indicará a decisão que a secretaria precisa tomar.</p>
                  </div>
                  <button
                    type="button"
                    disabled={busy === resolutionRow.id}
                    onClick={() => void promote(resolutionRow)}
                    className="inline-flex items-center gap-2 rounded-xl bg-[#1F6B3B] px-4 py-2.5 text-xs font-bold text-white hover:bg-[#18542e] disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {busy === resolutionRow.id && <Loader2 className="h-4 w-4 animate-spin" />}
                    Tentar resolver agora
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      <ModalPagamentoRapido
        escolaId={escolaId}
        aluno={paymentRow ? { id: paymentRow.aluno_id, nome: paymentRow.nome, turma: paymentRow.turma } : { id: "", nome: "" }}
        mensalidade={paymentItems[0] ?? null}
        mensalidades={paymentItems}
        posViradaContext={paymentRow && data?.sessions.current ? {
          anoLetivoId: data.sessions.current.id,
          matriculaOrigemId: paymentRow.matricula_id,
        } : undefined}
        open={Boolean(paymentRow)}
        onClose={() => {
          setPaymentRow(null);
          setPaymentItems([]);
        }}
        onSuccess={() => {
          setPaymentRow(null);
          setPaymentItems([]);
          void load();
        }}
      />
    </section>
  );
}
