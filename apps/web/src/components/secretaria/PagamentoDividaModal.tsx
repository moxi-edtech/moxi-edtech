"use client";

import { useEffect, useMemo, useState } from "react";
import { Banknote, CheckCircle2, CreditCard, Loader2, Printer, QrCode, ArrowRightLeft } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import type { Mensalidade } from "./BalcaoAtendimento";
import { allocateDebtPayment, toDebtReceiptItems } from "@/lib/financeiro/debtBatch";

type Metodo = "cash" | "tpa" | "transfer" | "mcx" | "kiwk";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  embedded?: boolean;
  mensalidades: Mensalidade[];
  alunoId: string;
  anoLetivoId: string | null;
  onSuccess: () => void;
  onFullyPaid?: () => void;
};

const methods: Array<{ id: Metodo; label: string; icon: typeof Banknote }> = [
  { id: "cash", label: "Numerário", icon: Banknote },
  { id: "tpa", label: "TPA", icon: CreditCard },
  { id: "transfer", label: "Transfer.", icon: ArrowRightLeft },
  { id: "mcx", label: "Multicaixa", icon: QrCode },
  { id: "kiwk", label: "Kwik", icon: QrCode },
];

const money = new Intl.NumberFormat("pt-AO", { style: "currency", currency: "AOA", maximumFractionDigits: 0 });

export function PagamentoDividaModal({ open, onOpenChange, embedded = false, mensalidades, alunoId, anoLetivoId, onSuccess, onFullyPaid }: Props) {
  const ordered = useMemo(() => [...mensalidades].filter((item) => item.preco > 0).sort((a, b) => {
    const left = (a.referencia_ano ?? 0) * 100 + (a.referencia_mes ?? 0);
    const right = (b.referencia_ano ?? 0) * 100 + (b.referencia_mes ?? 0);
    return left - right;
  }), [mensalidades]);
  const total = ordered.reduce((sum, item) => sum + item.preco, 0);
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState<Metodo>("cash");
  const [reference, setReference] = useState("");
  const [evidenceUrl, setEvidenceUrl] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [paymentHistory, setPaymentHistory] = useState<Array<{ amount: number; method: string }>>([]);
  const [recibos, setRecibos] = useState<Array<{ label: string; url: string }>>([]);
  const [recoverableMensalidadeId, setRecoverableMensalidadeId] = useState<string | null>(null);

  const numericAmount = Number(amount);
  const disabledReason = useMemo(() => {
    if (ordered.length === 0) return "Não há mensalidades em aberto.";
    if (!Number.isFinite(numericAmount) || numericAmount <= 0) return "Informe o valor que será pago agora.";
    if (numericAmount > total) return `O valor não pode ultrapassar ${money.format(total)}.`;
    if (method === "tpa" && !reference.trim()) return "Informe a referência do TPA.";
    if (method === "transfer" && !evidenceUrl.trim()) return "Adicione o comprovativo da transferência.";
    return null;
  }, [ordered.length, numericAmount, total, method, reference, evidenceUrl]);

  const canSubmit = disabledReason === null && !submitting;

  // O diálogo é reutilizado entre atendimentos; não deve transportar o estado
  // (em especial comprovativos) de um aluno para outro.
  useEffect(() => {
    setReference("");
    setEvidenceUrl("");
    setMessage(null);
    setPaymentHistory([]);
    setRecibos([]);
    setRecoverableMensalidadeId(null);
  }, [open, alunoId]);

  useEffect(() => {
    if (open) setAmount(total > 0 ? String(total) : "");
  }, [open, alunoId, total]);

  const pay = async () => {
    const value = Number(amount);
    if (disabledReason) {
      setMessage({ type: "error", text: disabledReason });
      return;
    }

    setSubmitting(true);
    setMessage(null);
    setRecoverableMensalidadeId(null);
    const receiptWindow = window.open("about:blank", "_blank");
    if (receiptWindow) {
      receiptWindow.opener = null;
      receiptWindow.document.title = "A preparar recibo…";
      receiptWindow.document.body.textContent = "Pagamento em processamento. O recibo será apresentado aqui.";
    }
    try {
      const fullyPaid = value >= total;
      const allocations = allocateDebtPayment(ordered, value);

      // Registar o conjunto numa única operação atómica evita liquidar parte
      // das mensalidades caso outra falhe. O backend cria um único recibo
      // consolidado, referenciando todas as competências no snapshot.
      const response = await fetch("/api/secretaria/pagamentos/processar", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Idempotency-Key": crypto.randomUUID() },
        body: JSON.stringify({
          aluno_id: alunoId,
          ano_letivo_id: anoLetivoId || null,
          origem: "pos_virada",
          metodo_pagamento: method,
          detalhes: {
            referencia: reference.trim() || null,
            evidencia_url: evidenceUrl.trim() || null,
          },
          itens: toDebtReceiptItems(allocations),
        }),
      });
      const json = await response.json().catch(() => ({}));
      if (!response.ok || !json?.ok) {
        throw new Error(json?.error || "Não foi possível registar o lote de pagamentos.");
      }

      const paidNow = allocations.reduce((sum, item) => sum + item.amount, 0);
      const reciboUrl = json.recibo?.ok && typeof json.recibo.print_url === "string"
        ? json.recibo.print_url
        : null;
      const recibosEmitidos = reciboUrl ? [{
        label: allocations.length > 1
          ? `Recibo consolidado (${allocations.length} mensalidades)`
          : allocations[0].item.nome,
        url: reciboUrl,
      }] : [];
      if (!reciboUrl) setRecoverableMensalidadeId(allocations[allocations.length - 1]?.item.id ?? null);
      const recibosPendentes = reciboUrl ? [] : [
        typeof json.recibo?.error === "string"
          ? json.recibo.error
          : "O pagamento foi registado, mas não foi possível emitir o recibo.",
      ];
      setPaymentHistory((history) => [...history, { amount: paidNow, method: methods.find((item) => item.id === method)?.label ?? method }]);
      setRecibos((previous) => [...previous, ...recibosEmitidos]);
      const reciboPrincipal = recibosEmitidos[recibosEmitidos.length - 1];
      if (reciboPrincipal) {
        if (receiptWindow) receiptWindow.location.replace(reciboPrincipal.url);
        else window.open(reciboPrincipal.url, "_blank", "noopener,noreferrer");
      } else {
        receiptWindow?.close();
      }
      setMessage({
        type: recibosPendentes.length > 0 ? "error" : "success",
        text: recibosPendentes.length > 0
          ? `Pagamento registado, mas o recibo de ${recibosPendentes.join(", ")} está pendente de emissão.`
          : !fullyPaid
            ? "Pagamento registado parcialmente. O comprovativo está disponível abaixo."
            : "Pagamento registado com sucesso. O comprovativo está disponível abaixo.",
      });
      setAmount("");
      onSuccess();
      if (fullyPaid) onFullyPaid?.();
    } catch (error) {
      receiptWindow?.close();
      setMessage({ type: "error", text: error instanceof Error ? error.message : "Pagamento não concluído." });
      onSuccess();
    } finally {
      setSubmitting(false);
    }
  };

  const recoverReceipt = async () => {
    if (!recoverableMensalidadeId || submitting) return;
    setSubmitting(true);
    // Open synchronously in the click handler so browser popup blockers do not
    // discard the recovered document after the authenticated network request.
    const receiptWindow = window.open("about:blank", "_blank");
    if (receiptWindow) receiptWindow.opener = null;
    try {
      const response = await fetch("/api/secretaria/recibos/recuperar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mensalidade_id: recoverableMensalidadeId }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok || !result?.ok || typeof result.print_url !== "string") {
        throw new Error(result?.error || "Não foi possível recuperar o recibo.");
      }
      setRecibos((previous) => [...previous, {
        label: "Recibo recuperado",
        url: result.print_url,
      }]);
      setRecoverableMensalidadeId(null);
      setMessage({ type: "success", text: "Recibo disponível para impressão. Não foi registado um novo pagamento." });
      if (receiptWindow) receiptWindow.location.replace(result.print_url);
      else window.open(result.print_url, "_blank", "noopener,noreferrer");
    } catch (error) {
      receiptWindow?.close();
      setMessage({ type: "error", text: error instanceof Error ? error.message : "Falha ao recuperar recibo." });
    } finally {
      setSubmitting(false);
    }
  };

  if (!open) return null;

  const panel = (
    <div className="space-y-5">
      <div className="border-b border-slate-100 pb-4">
        <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-400">Regularização</p>
        <div className="mt-1 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h3 className="text-base font-black text-slate-900">Mensalidades em atraso</h3>
            <p className="mt-1 text-xs leading-5 text-slate-500">
              O pagamento é distribuído da mensalidade mais antiga para a mais recente.
            </p>
          </div>
          <strong className="shrink-0 text-xl font-black text-slate-900">{money.format(total)}</strong>
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-slate-200">
        {ordered.map((item, index) => (
          <div
            key={item.id}
            className={[
              "flex items-center justify-between gap-4 px-4 py-3 text-xs",
              index > 0 ? "border-t border-slate-100" : "",
            ].join(" ")}
          >
            <div className="min-w-0">
              <p className="truncate font-bold text-slate-800">{item.nome}</p>
              <p className="mt-0.5 text-[10px] text-slate-400">
                {index === 0 ? "Primeira a ser liquidada" : `Ordem ${index + 1}`}
              </p>
            </div>
            <strong className="shrink-0 text-slate-900">{money.format(item.preco)}</strong>
          </div>
        ))}
      </div>

      <div>
        <div className="mb-1.5 flex items-center justify-between gap-3">
          <label className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-400">
            Valor a pagar agora
          </label>
          <button
            type="button"
            onClick={() => setAmount(String(total))}
            disabled={submitting}
            className="text-[11px] font-bold text-emerald hover:underline disabled:opacity-50"
          >
            Usar saldo total
          </button>
        </div>
        <input
          type="number"
          min="1"
          max={total}
          value={amount}
          onChange={(event) => {
            setAmount(event.target.value);
            setMessage(null);
          }}
          placeholder={`Até ${money.format(total)}`}
          className="w-full rounded-xl border border-slate-200 px-3.5 py-3 text-lg font-black text-slate-900 outline-none transition focus:border-slate-400 focus:ring-4 focus:ring-slate-100"
          disabled={submitting}
        />
        {numericAmount > 0 && numericAmount < total ? (
          <p className="mt-1.5 text-xs text-slate-500">
            Pagamento parcial · ficará {money.format(Math.max(0, total - numericAmount))} em aberto.
          </p>
        ) : null}
      </div>

      <div>
        <p className="mb-2 text-[10px] font-bold uppercase tracking-[0.16em] text-slate-400">
          Forma de pagamento
        </p>
        <div className="grid grid-cols-5 gap-1.5">
          {methods.map(({ id, label, icon: Icon }) => {
            const active = method === id;
            return (
              <button
                key={id}
                type="button"
                onClick={() => {
                  setMethod(id);
                  setMessage(null);
                }}
                disabled={submitting}
                className={[
                  "flex flex-col items-center gap-1 rounded-xl border py-2.5 text-[10px] font-bold transition",
                  active
                    ? "border-slate-950 bg-slate-950 text-white"
                    : "border-slate-200 bg-white text-slate-500 hover:border-slate-300 hover:bg-slate-50",
                ].join(" ")}
              >
                <Icon className="h-4 w-4" />
                {label}
              </button>
            );
          })}
        </div>
      </div>

      {method === "tpa" || method === "mcx" || method === "kiwk" ? (
        <div>
          <label className="mb-1.5 block text-[10px] font-bold uppercase tracking-[0.16em] text-slate-400">
            Referência {method === "tpa" ? "*" : ""}
          </label>
          <input
            value={reference}
            onChange={(event) => {
              setReference(event.target.value);
              setMessage(null);
            }}
            placeholder={method === "tpa" ? "Referência do TPA" : "Referência (opcional)"}
            className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm font-semibold outline-none transition focus:border-slate-400 focus:ring-4 focus:ring-slate-100"
            disabled={submitting}
          />
        </div>
      ) : null}

      {method === "transfer" ? (
        <div>
          <label className="mb-1.5 block text-[10px] font-bold uppercase tracking-[0.16em] text-slate-400">
            Comprovativo *
          </label>
          <input
            value={evidenceUrl}
            onChange={(event) => {
              setEvidenceUrl(event.target.value);
              setMessage(null);
            }}
            placeholder="URL do comprovativo"
            className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm font-semibold outline-none transition focus:border-slate-400 focus:ring-4 focus:ring-slate-100"
            disabled={submitting}
          />
        </div>
      ) : null}

      {message ? (
        <p className={`flex items-center gap-2 rounded-xl p-3 text-sm ${
          message.type === "success" ? "bg-emerald-50 text-emerald-800" : "bg-rose-50 text-rose-700"
        }`}>
          {message.type === "success" ? <CheckCircle2 className="h-4 w-4" /> : null}
          {message.text}
        </p>
      ) : null}

      {recoverableMensalidadeId ? (
        <button
          type="button"
          disabled={submitting}
          onClick={() => void recoverReceipt()}
          className="inline-flex min-h-10 w-full items-center justify-center gap-2 rounded-xl border border-amber px-3 text-xs font-bold text-slate-800 hover:bg-amber/10 disabled:opacity-50"
        >
          <Printer className="h-4 w-4" />
          Recuperar recibo sem repetir o pagamento
        </button>
      ) : null}

      {paymentHistory.length > 0 ? (
        <div className="rounded-xl border border-emerald-100 bg-emerald-50/60 p-3 text-xs text-emerald-900">
          <p className="mb-1 font-bold">Pagamentos nesta regularização</p>
          {paymentHistory.map((item, index) => (
            <div key={`${item.method}-${index}`} className="flex justify-between">
              <span>{item.method}</span>
              <strong>{money.format(item.amount)}</strong>
            </div>
          ))}
        </div>
      ) : null}

      {recibos.length > 0 ? (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-xs text-emerald-950">
          <p className="mb-2 font-bold">Comprovativos emitidos</p>
          <div className="space-y-2">
            {recibos.map((recibo) => (
              <button
                key={`${recibo.label}-${recibo.url}`}
                type="button"
                onClick={() => window.open(recibo.url, "_blank", "noopener,noreferrer")}
                className="flex w-full items-center justify-between rounded-lg bg-white px-3 py-2 text-left font-semibold text-emerald-800 hover:bg-emerald-100"
              >
                <span className="truncate pr-2">{recibo.label}</span>
                <span className="inline-flex shrink-0 items-center gap-1">
                  <Printer className="h-3.5 w-3.5" /> Imprimir
                </span>
              </button>
            ))}
          </div>
        </div>
      ) : null}

      <div className="space-y-2 border-t border-slate-100 pt-4">
        <button
          type="button"
          onClick={() => void pay()}
          disabled={!canSubmit}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-slate-950 px-4 py-3 text-sm font-bold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400"
        >
          {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
          {submitting
            ? "A registar pagamento…"
            : numericAmount >= total
              ? `Liquidar saldo · ${money.format(total)}`
              : `Registar pagamento · ${money.format(Number.isFinite(numericAmount) ? numericAmount : 0)}`}
        </button>
        {!canSubmit && !submitting && disabledReason ? (
          <p className="text-center text-xs font-medium text-slate-500">{disabledReason}</p>
        ) : null}
      </div>
    </div>
  );

  if (embedded) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6">
        {panel}
      </div>
    );
  }

  return (
    <Dialog open={open} onOpenChange={(next) => { if (!submitting) onOpenChange(next); }}>
      <DialogContent className="max-w-xl rounded-2xl">
        <DialogHeader>
          <DialogTitle className="sr-only">Regularizar mensalidades</DialogTitle>
          <DialogDescription className="sr-only">
            O valor será aplicado às mensalidades mais antigas primeiro.
          </DialogDescription>
        </DialogHeader>
        {panel}
      </DialogContent>
    </Dialog>
  );
}
