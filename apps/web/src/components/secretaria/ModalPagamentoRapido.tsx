"use client";

import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import {
  X,
  CreditCard,
  Wallet,
  Banknote,
  Calculator,
  CheckCircle,
  Smartphone,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/Button";
import { ReciboImprimivel } from "@/components/financeiro/ReciboImprimivel";
import { usePlanFeature } from "@/hooks/usePlanFeature";

type MetodoPagamento = "cash" | "tpa" | "transfer" | "mcx" | "kwik";

interface ModalPagamentoRapidoProps {
  escolaId?: string | null;
  aluno: {
    id: string;
    nome: string;
    turma?: string;
    bi?: string;
  };
  mensalidade: {
    id: string;
    mes: number;
    ano: number;
    valor: number;
    vencimento?: string;
    status: string;
  } | null;
  open: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

const MESES = [
  "Jan",
  "Fev",
  "Mar",
  "Abr",
  "Mai",
  "Jun",
  "Jul",
  "Ago",
  "Set",
  "Out",
  "Nov",
  "Dez",
] as const;

const cx = (...classes: Array<string | false | null | undefined>) =>
  classes.filter(Boolean).join(" ");

const moneyAOA = new Intl.NumberFormat("pt-AO", {
  style: "currency",
  currency: "AOA",
  minimumFractionDigits: 2,
});


function clampMonth(m?: number) {
  if (!m) return null;
  if (m < 1 || m > 12) return null;
  return m;
}

function safeNumber(input: string) {
  // aceita "123", "123.45", "123,45" sem quebrar UX
  const normalized = input.replace(",", ".");
  const n = Number(normalized);
  return Number.isFinite(n) ? n : 0;
}

function formatStatusLabel(status?: string | null) {
  const s = (status ?? "").toLowerCase();
  if (s === "pendente") return "Pendente";
  if (s === "pago_parcial") return "Parcial";
  if (s === "pago") return "Pago";
  if (s === "em_atraso" || s === "atraso") return "Em atraso";
  return status ?? "—";
}

function badgeTone(status?: string | null) {
  const s = (status ?? "").toLowerCase();
  if (s === "pago") return "ok";
  if (s === "pendente" || s === "pago_parcial") return "warn";
  return "danger";
}

type MetodoItem = {
  id: MetodoPagamento;
  label: string;
  helper: string;
  icon: React.ComponentType<{ className?: string }>;
};

const METODOS: MetodoItem[] = [
  { id: "cash", label: "Cash", helper: "Balcão", icon: Banknote },
  { id: "tpa", label: "TPA", helper: "Cartão", icon: CreditCard },
  { id: "transfer", label: "Transfer", helper: "Comprovativo", icon: Wallet },
  { id: "mcx", label: "MCX", helper: "Multicaixa", icon: Smartphone },
  { id: "kwik", label: "KWIK", helper: "Instantâneo", icon: Smartphone },
];

function SegmentedMethod({
  value,
  onChange,
  disabled,
}: {
  value: MetodoPagamento;
  onChange: (v: MetodoPagamento) => void;
  disabled?: boolean;
}) {
  return (
    <div className="grid grid-cols-2 gap-2">
      {METODOS.map((m) => {
        const Icon = m.icon;
        const active = value === m.id;

        return (
          <button
            key={m.id}
            type="button"
            onClick={() => onChange(m.id)}
            disabled={disabled}
            className={cx(
              "group rounded-xl border px-3 py-3 text-left transition",
              "bg-white hover:bg-slate-50",
              "disabled:opacity-60 disabled:cursor-not-allowed",
              active
                ? "border-klasse-gold ring-4 ring-klasse-gold/10"
                : "border-slate-200"
            )}
          >
            <div className="flex items-start gap-3">
              <div
                className={cx(
                  "h-10 w-10 rounded-xl border flex items-center justify-center shrink-0",
                  active ? "border-klasse-gold/30 bg-klasse-gold/10" : "border-slate-200 bg-slate-100"
                )}
              >
                <Icon
                  className={cx(
                    "h-5 w-5",
                    active ? "text-klasse-gold" : "text-slate-600"
                  )}
                />
              </div>

              <div className="min-w-0">
                <div className="text-sm font-semibold text-slate-900">{m.label}</div>
                <div className="text-[11px] text-slate-500">{m.helper}</div>
              </div>
            </div>
          </button>
        );
      })}
    </div>
  );
}

function KpiRow({
  label,
  value,
  strong,
}: {
  label: string;
  value: string;
  strong?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-4">
      <span className="text-slate-600">{label}</span>
      <span className={cx("text-right", strong ? "font-black text-slate-900" : "font-semibold text-slate-900")}>
        {value}
      </span>
    </div>
  );
}

export function ModalPagamentoRapido({
  escolaId,
  aluno,
  mensalidade,
  open,
  onClose,
  onSuccess,
}: ModalPagamentoRapidoProps) {
  const [metodo, setMetodo] = useState<MetodoPagamento>("cash");
  const [valorPago, setValorPago] = useState<string>("");
  const [processando, setProcessando] = useState(false);
  const [concluido, setConcluido] = useState(false);
  const [paymentReference, setPaymentReference] = useState("");
  const [paymentEvidenceUrl, setPaymentEvidenceUrl] = useState("");
  const [paymentGatewayRef, setPaymentGatewayRef] = useState("");
  const [recibo, setRecibo] = useState<{ url_validacao: string | null } | null>(null);
  const [printRequested, setPrintRequested] = useState(false);
  const [escolaNome, setEscolaNome] = useState<string | null>(null);
  const { isEnabled: canEmitirRecibo } = usePlanFeature("fin_recibo_pdf");

  const abortRef = useRef<AbortController | null>(null);
  const confirmBtnRef = useRef<HTMLButtonElement | null>(null);

  const valorDevido = mensalidade?.valor ?? 0;

  const mesAno = useMemo(() => {
    const m = clampMonth(mensalidade?.mes);
    if (!mensalidade || !m) return "Mensalidade";
    return `${MESES[m - 1]}/${mensalidade.ano}`;
  }, [mensalidade?.id, mensalidade?.mes, mensalidade?.ano]);

  const valorPagoNum = useMemo(() => safeNumber(valorPago), [valorPago]);

  const troco = useMemo(() => valorPagoNum - valorDevido, [valorPagoNum, valorDevido]);
  const trocoValido = useMemo(() => Number.isFinite(troco) && troco >= 0, [troco]);
  const mostraTroco = useMemo(() => metodo === "cash" && valorPagoNum > 0, [metodo, valorPagoNum]);

  const sugestoes = useMemo(() => {
    if (metodo !== "cash" || valorDevido <= 0) return [];
    const s = [
      valorDevido,
      Math.ceil(valorDevido / 100) * 100,
      Math.ceil(valorDevido / 500) * 500,
    ];
    return Array.from(new Set(s)).sort((a, b) => a - b);
  }, [metodo, valorDevido]);

  // reset ao abrir (apenas quando mensalidade muda de verdade)
  useEffect(() => {
    if (!open) return;

    setConcluido(false);
    setProcessando(false);
    setMetodo("cash");
    setValorPago(mensalidade ? String(mensalidade.valor) : "");
    setReferenciaMB("");
    setRecibo(null);
    setPrintRequested(false);

    // foco: botão confirmar (fluxo balcão é teclado-friendly)
    window.setTimeout(() => confirmBtnRef.current?.focus(), 50);
  }, [open, mensalidade?.id]);

  useEffect(() => {
    if (!open || !escolaId) return;
    fetch(`/api/escolas/${escolaId}/nome`, { cache: "no-store" })
      .then((res) => res.json())
      .then((json) => {
        if (json?.ok && json?.nome) setEscolaNome(json.nome);
      })
      .catch(() => {});
  }, [escolaId, open]);

  useEffect(() => {
    if (!printRequested || !recibo) return;
    const id = window.setTimeout(() => {
      window.print();
      setPrintRequested(false);
    }, 300);
    return () => window.clearTimeout(id);
  }, [printRequested, recibo]);

  useEffect(() => {
    if (metodo === "cash") {
      setPaymentReference("");
      setPaymentEvidenceUrl("");
      setPaymentGatewayRef("");
      return;
    }
    if (metodo === "transfer") {
      setPaymentReference("");
      setPaymentGatewayRef("");
      return;
    }
    if (metodo === "tpa") {
      setPaymentEvidenceUrl("");
      setPaymentGatewayRef("");
      return;
    }
    setPaymentEvidenceUrl("");
  }, [metodo]);

  useEffect(() => {
    return () => abortRef.current?.abort();
  }, []);

  const safeClose = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    onClose();
  }, [onClose]);

  const handleConfirmarPagamento = useCallback(async () => {
    if (!mensalidade) return;

    if (!trocoValido) {
      toast.error("O valor pago deve ser maior ou igual ao valor devido.");
      return;
    }

    if (metodo === "tpa" && !paymentReference.trim()) {
      toast.error("Referência obrigatória para TPA.");
      return;
    }

    if (metodo === "transfer" && !paymentEvidenceUrl.trim()) {
      toast.error("Comprovativo obrigatório para Transferência.");
      return;
    }

    if (processando) return;

    setProcessando(true);
    abortRef.current?.abort();
    abortRef.current = new AbortController();

    try {
      const res = await fetch("/api/financeiro/pagamentos/registrar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: abortRef.current.signal,
        body: JSON.stringify({
          aluno_id: aluno.id,
          mensalidade_id: mensalidade.id,
          valor: valorPagoNum || mensalidade.valor,
          metodo,
          reference: paymentReference || null,
          evidence_url: paymentEvidenceUrl || null,
          meta: {
            observacao: `Pagamento rápido - ${mesAno}`,
            origem: "pagamento_rapido",
            gateway_ref: paymentGatewayRef || null,
          },
        }),
      });

      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json?.ok) {
        throw new Error(json?.error || "Falha ao registrar pagamento");
      }

      if (canEmitirRecibo) {
        const reciboRes = await fetch("/api/financeiro/recibos/emitir", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ mensalidadeId: mensalidade.id }),
        }).catch(() => null);

        if (reciboRes?.ok) {
          const reciboJson = await reciboRes.json().catch(() => null);
          if (reciboJson?.ok) {
            setRecibo({ url_validacao: reciboJson.url_validacao ?? null });
            setPrintRequested(true);
          }
        }
      }

      setConcluido(true);
      toast.success("Pagamento registrado. Recibo emitido (quando disponível).");

      window.setTimeout(() => {
        safeClose();
        onSuccess?.();
      }, 1200);
    } catch (err: any) {
      if (err?.name === "AbortError") return;
      toast.error(err instanceof Error ? err.message : "Não foi possível processar o pagamento.");
    } finally {
      setProcessando(false);
    }
  }, [
    escolaId,
    mensalidade,
    trocoValido,
    processando,
    metodo,
    mesAno,
    valorPagoNum,
    paymentReference,
    paymentEvidenceUrl,
    paymentGatewayRef,
    safeClose,
    onSuccess,
    canEmitirRecibo,
  ]);

  // teclado: Enter confirma (exceto se estiver digitando no input)
  useEffect(() => {
    if (!open) return;

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (!concluido && !processando) safeClose();
      }
      if (e.key === "Enter") {
        const target = e.target as HTMLElement | null;
        const typing =
          target?.tagName === "INPUT" || target?.tagName === "TEXTAREA" || (target as any)?.isContentEditable;
        if (!typing) {
          // evita double submit
          e.preventDefault();
          handleConfirmarPagamento();
        }
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, concluido, processando, safeClose, handleConfirmarPagamento]);

  if (!open) return null;

  const statusTone = badgeTone(mensalidade?.status);
  const statusLabel = formatStatusLabel(mensalidade?.status);
  const vencimentoLabel = mensalidade?.vencimento
    ? new Date(mensalidade.vencimento).toLocaleDateString("pt-PT")
    : null;

  const headerTitle = concluido ? "Pagamento concluído" : "Pagamento rápido";
  const canConfirm = !!mensalidade && trocoValido && !processando;

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 p-4">
        <div className="w-full max-w-md overflow-hidden rounded-2xl bg-white shadow-2xl ring-1 ring-slate-200">
        {/* Header (subtle, premium) */}
        <div className="relative border-b border-slate-200 px-6 py-4">
          {/* “luz” sutil no topo (sem virar carnaval) */}
          <div className="pointer-events-none absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-transparent via-klasse-gold/60 to-transparent" />

          <div className="flex items-start justify-between gap-4">
            <div className="flex items-start gap-3 min-w-0">
              <div className="h-11 w-11 rounded-2xl bg-slate-100 border border-slate-200 flex items-center justify-center">
                {concluido ? (
                  <CheckCircle className="h-6 w-6 text-klasse-green" />
                ) : (
                  <CreditCard className="h-6 w-6 text-slate-700" />
                )}
              </div>

              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <h2 className="text-base font-bold text-slate-900">{headerTitle}</h2>
                  {mensalidade ? (
                    <span
                      className={cx(
                        "inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-semibold",
                        statusTone === "ok" && "border-klasse-green/25 bg-klasse-green/10 text-klasse-green",
                        statusTone === "warn" && "border-klasse-gold/25 bg-klasse-gold/10 text-klasse-gold",
                        statusTone === "danger" && "border-red-500/20 bg-red-500/10 text-red-600"
                      )}
                    >
                      {statusLabel}
                    </span>
                  ) : null}
                </div>

                <p className="mt-0.5 text-sm text-slate-600 truncate">{aluno.nome}</p>

                <div className="mt-1 flex flex-wrap gap-2">
                  {aluno.turma ? (
                    <span className="inline-flex items-center rounded-full border border-slate-200 px-2 py-0.5 text-[11px] text-slate-600">
                      {aluno.turma}
                    </span>
                  ) : null}
                  {aluno.bi ? (
                    <span className="inline-flex items-center rounded-full border border-slate-200 px-2 py-0.5 text-[11px] text-slate-600">
                      BI: {aluno.bi}
                    </span>
                  ) : null}
                </div>
              </div>
            </div>

            {!concluido && !processando ? (
              <button
                type="button"
                onClick={safeClose}
                className="rounded-xl p-2 transition hover:bg-slate-100 focus:outline-none focus:ring-4 focus:ring-klasse-gold/20"
                aria-label="Fechar"
              >
                <X className="h-5 w-5 text-slate-700" />
              </button>
            ) : null}
          </div>
        </div>

        {/* Body */}
        <div className="space-y-5 px-6 py-5">
          {!concluido ? (
            <>
              {/* Mensalidade card (neutral + gold accent) */}
              {mensalidade ? (
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                        Mensalidade
                      </div>
                      <div className="mt-1 text-base font-bold text-slate-900">{mesAno}</div>
                      {vencimentoLabel ? (
                        <div className="mt-1 text-xs text-slate-600">
                          Vencimento: <span className="font-semibold text-slate-800">{vencimentoLabel}</span>
                        </div>
                      ) : null}
                    </div>

                    <div className="shrink-0 text-right">
                      <div className="text-xs text-slate-500">Valor</div>
                      <div className="text-xl font-black text-slate-900">
                        {moneyAOA.format(mensalidade.valor)}
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="rounded-2xl border border-klasse-gold/25 bg-klasse-gold/10 p-4 text-sm text-slate-900">
                  Nenhuma mensalidade selecionada.
                </div>
              )}

              {/* Método */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-bold text-slate-900">Método de pagamento</p>
                  <span className="text-xs text-slate-500">Padrão: Cash</span>
                </div>

                <SegmentedMethod
                  value={metodo}
                  onChange={setMetodo}
                  disabled={processando}
                />

                {(metodo === "tpa" || metodo === "mcx" || metodo === "kwik") && (
                  <div className="rounded-2xl border border-slate-200 bg-white p-4 space-y-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                          {metodo === "tpa" ? "Referência obrigatória" : "Referência (opcional)"}
                        </div>
                        <input
                          value={paymentReference}
                          onChange={(e) => setPaymentReference(e.target.value)}
                          className="mt-2 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-900 outline-none focus:border-klasse-gold focus:ring-4 focus:ring-klasse-gold/20"
                          placeholder={metodo === "tpa" ? "TPA-2026-000882" : "Opcional"}
                        />
                        {(metodo === "mcx" || metodo === "kwik") ? (
                          <input
                            value={paymentGatewayRef}
                            onChange={(e) => setPaymentGatewayRef(e.target.value)}
                            className="mt-2 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-900 outline-none focus:border-klasse-gold focus:ring-4 focus:ring-klasse-gold/20"
                            placeholder={metodo === "kwik" ? "KWIK ref (opcional)" : "Gateway ref (opcional)"}
                          />
                        ) : null}
                      </div>
                      <div className="h-10 w-10 rounded-2xl bg-slate-100 border border-slate-200 flex items-center justify-center">
                        <Smartphone className="h-5 w-5 text-slate-700" />
                      </div>
                    </div>
                  </div>
                )}

                {metodo === "transfer" ? (
                  <div className="rounded-2xl border border-slate-200 bg-white p-4 space-y-2">
                    <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                      Comprovativo obrigatório (URL)
                    </div>
                    <input
                      value={paymentEvidenceUrl}
                      onChange={(e) => setPaymentEvidenceUrl(e.target.value)}
                      className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-900 outline-none focus:border-klasse-gold focus:ring-4 focus:ring-klasse-gold/20"
                      placeholder="https://..."
                    />
                  </div>
                ) : null}
              </div>

              {/* Valor recebido */}
              <div className="space-y-2">
                <label className="block text-sm font-bold text-slate-900">
                  Valor recebido
                </label>

                <div className="relative">
                  <input
                    type="text"
                    inputMode="decimal"
                    value={valorPago}
                    onChange={(e) => setValorPago(e.target.value)}
                    placeholder="0,00"
                    className={cx(
                      "w-full rounded-2xl border bg-white px-4 py-3 text-xl font-black outline-none",
                      "focus:ring-4 focus:ring-klasse-gold/20 focus:border-klasse-gold",
                      "border-slate-200"
                    )}
                    disabled={processando}
                    aria-label="Valor recebido em AOA"
                  />
                  <div className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 font-semibold">
                    AOA
                  </div>
                </div>

                {sugestoes.length > 0 ? (
                  <div className="flex flex-wrap gap-2 pt-1">
                    {sugestoes.map((v) => (
                      <button
                        key={v}
                        type="button"
                        onClick={() => setValorPago(String(v))}
                        disabled={processando}
                        className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60"
                      >
                        {moneyAOA.format(v)}
                      </button>
                    ))}
                  </div>
                ) : null}
              </div>

              {/* Troco (só cash) */}
              {mostraTroco ? (
                <div className="rounded-2xl border border-slate-200 bg-white p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="h-9 w-9 rounded-2xl bg-slate-100 border border-slate-200 flex items-center justify-center">
                        <Calculator className="h-5 w-5 text-slate-700" />
                      </div>
                      <div>
                        <div className="text-sm font-bold text-slate-900">Troco</div>
                        <div className="text-xs text-slate-600">A devolver no balcão</div>
                      </div>
                    </div>

                    <div className={cx("text-right", trocoValido ? "text-slate-900" : "text-red-600")}>
                      <div className="text-xs text-slate-500">Valor</div>
                      <div className="text-xl font-black">{moneyAOA.format(troco)}</div>
                    </div>
                  </div>
                </div>
              ) : null}

              {/* Resumo compacto */}
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  Resumo
                </div>

                <div className="mt-3 space-y-2 text-sm">
                  <KpiRow label="Valor da mensalidade" value={moneyAOA.format(valorDevido)} />
                  <KpiRow label="Valor recebido" value={moneyAOA.format(valorPagoNum)} />
                  <div className="pt-2 border-t border-slate-200" />
                  <KpiRow
                    label="Troco"
                    value={moneyAOA.format(troco)}
                    strong
                  />
                </div>

                {!trocoValido ? (
                  <div className="mt-3 rounded-xl border border-red-500/20 bg-red-500/10 px-3 py-2 text-xs text-red-700">
                    O valor recebido precisa ser maior ou igual ao valor da mensalidade.
                  </div>
                ) : null}
              </div>
            </>
          ) : (
            <div className="py-8 text-center">
              <div className="mx-auto mb-5 inline-flex h-16 w-16 items-center justify-center rounded-full bg-klasse-green/10 ring-1 ring-klasse-green/20">
                <CheckCircle className="h-8 w-8 text-klasse-green" />
              </div>
              <h3 className="text-xl font-black text-slate-900">Pagamento registrado</h3>
              <p className="mt-2 text-sm text-slate-600">
                Recibo emitido automaticamente (quando habilitado).
              </p>
              <p className="mt-3 text-xs text-slate-500">
                Dica: Enter confirma • Esc fecha
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-slate-200 bg-white px-6 py-4">
          {!concluido ? (
            <div className="flex gap-3">
              <Button
                variant="outline"
                onClick={safeClose}
                disabled={processando}
                className="flex-1 rounded-xl"
              >
                Cancelar
              </Button>

              <Button
                ref={confirmBtnRef}
                onClick={handleConfirmarPagamento}
                disabled={!canConfirm}
                className={cx(
                  "flex-1 rounded-xl",
                  "bg-klasse-gold text-white hover:brightness-95"
                )}
              >
                {processando ? (
                  <span className="inline-flex items-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Processando...
                  </span>
                ) : (
                  "Confirmar"
                )}
              </Button>
            </div>
          ) : (
            <p className="text-center text-sm text-slate-500">Fechando automaticamente…</p>
          )}
        </div>
        </div>
      </div>
      {recibo ? (
        <ReciboImprimivel
          escolaNome={escolaNome ?? "Escola"}
          alunoNome={aluno.nome}
          valor={mensalidade?.valor ?? 0}
          data={new Date().toISOString()}
          urlValidacao={recibo.url_validacao}
        />
      ) : null}
    </>
  );
}
