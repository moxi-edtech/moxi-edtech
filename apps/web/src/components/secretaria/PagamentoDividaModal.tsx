"use client";

import { useEffect, useMemo, useRef, useState } from "react";
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
  const pendingCheckoutKey = useRef<string | null>(null);
  const [paymentCommitted, setPaymentCommitted] = useState(false);

  useEffect(() => {
    if (!open) return;
    setAmount(total > 0 ? String(total) : "");
    setMethod("cash");
    setReference("");
    setEvidenceUrl("");
    setMessage(null);
    setPaymentHistory([]);
    setRecibos([]);
    setRecoverableMensalidadeId(null);
    pendingCheckoutKey.current = null;
    setPaymentCommitted(false);
  }, [open, total]);

  const numericAmount = Number(String(amount).replace(/[^0-9.,]/g, "").replace(",", ".")) || 0;

  const disabledReason = useMemo(() => {
    if (paymentCommitted) return "Pagamento já registado neste modal.";
    if (!alunoId) return "Aluno em falta.";
    if (ordered.length === 0) return "Não há mensalidades em aberto.";
    if (!Number.isFinite(numericAmount) || numericAmount <= 0) return "Indique um valor válido.";
    if (method !== "cash" && !reference.trim()) return "Referência obrigatória para este método.";
    return null;
  }, [alunoId, method, numericAmount, ordered.length, paymentCommitted, reference]);

  const canSubmit = !disabledReason && !submitting;

  const pay = async () => {
    if (!canSubmit || paymentCommitted) return;
    setSubmitting(true);
    setMessage(null);
    try {
      const allocations = allocateDebtPayment(ordered, numericAmount);
      if (allocations.length === 0) throw new Error("Nada a pagar.");

      // Checkout atómico: um único request aplica o valor às
      // mensalidades. O backend cria um único recibo consolidado
      // das mensalidades caso outra falhe. O backend cria um único recibo
      // consolidado quando possível.
      const res = await fetch("/api/secretaria/pagamentos/divida", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          aluno_id: alunoId,
          ano_letivo_id: anoLetivoId || null,
          amount: numericAmount,
          method,
          reference: reference.trim() || null,
          evidence_url: evidenceUrl.trim() || null,
          allocations: allocations.map((a) => ({
            mensalidade_id: a.mensalidadeId,
            amount: a.amount,
          })),
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json?.ok) throw new Error(json?.error || "Falha ao registar pagamento");

      setPaymentCommitted(true);
      setPaymentHistory((prev) => [...prev, { amount: numericAmount, method }]);

      const lista =
        Array.isArray(json.recibos) && json.recibos.length > 0
          ? json.recibos
          : json.recibo_url
            ? [{ label: `Recibo consolidado (${allocations.length} mensalidades)`, url: json.recibo_url }]
            : toDebtReceiptItems(allocations, json);

      setRecibos(lista);
      setMessage({ type: "success", text: json.message || "Pagamento registado com sucesso." });

      const fullyPaid = Boolean(json.fully_paid) || numericAmount >= total;
      onSuccess();
      if (fullyPaid) onFullyPaid?.();
    } catch (e: any) {
      setMessage({ type: "error", text: e?.message || "Erro inesperado." });
    } finally {
      setSubmitting(false);
    }
  };

  const panel = (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-base font-bold text-foreground">Regularizar mensalidades</h3>
          <p className="mt-0.5 text-sm text-muted-foreground">
            {ordered.length} em aberto · total {money.format(total)}
          </p>
        </div>
      </div>

      {message ? (
        <div
          className={
            message.type === "success"
              ? "rounded-lg border border-emerald-500/20 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-800 dark:text-emerald-300"
              : "rounded-lg border border-rose-500/20 bg-rose-500/10 px-3 py-2 text-xs text-rose-700 dark:text-rose-300"
          }
        >
          {message.text}
        </div>
      ) : null}

      <div className="rounded-xl border border-border bg-muted p-4">
        <label className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">Valor a pagar</label>
        <input
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          inputMode="decimal"
          className="mt-1 w-full rounded-lg border border-border bg-card px-3 py-2.5 text-lg font-bold text-foreground outline-none focus:ring-2 focus:ring-amber/30"
          placeholder="0"
        />
        <p className="mt-1 text-[11px] text-muted-foreground">O valor é aplicado às mensalidades mais antigas primeiro.</p>
      </div>

      <div className="space-y-2">
        <label className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">Método</label>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
          {methods.map((m) => {
            const active = method === m.id;
            const Icon = m.icon;
            return (
              <button
                key={m.id}
                type="button"
                onClick={() => setMethod(m.id)}
                className={
                  active
                    ? "flex w-full flex-col items-center gap-1 rounded-xl border border-border bg-foreground px-2 py-3 text-xs font-bold text-background"
                    : "flex w-full flex-col items-center gap-1 rounded-xl border border-border bg-card px-2 py-3 text-xs font-bold text-foreground hover:bg-muted"
                }
              >
                <Icon className="h-4 w-4" />
                {m.label}
              </button>
            );
          })}
        </div>
      </div>

      {method !== "cash" ? (
        <div className="space-y-3">
          <div className="space-y-1">
            <label className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">Referência</label>
            <input
              value={reference}
              onChange={(e) => setReference(e.target.value)}
              className="w-full rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground outline-none focus:ring-2 focus:ring-amber/30"
              placeholder="Nº do talão / comprovativo"
            />
          </div>
          <div className="space-y-1">
            <label className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">URL do comprovativo (opcional)</label>
            <input
              value={evidenceUrl}
              onChange={(e) => setEvidenceUrl(e.target.value)}
              className="w-full rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground outline-none focus:ring-2 focus:ring-amber/30"
              placeholder="https://…"
            />
          </div>
        </div>
      ) : null}

      {ordered.length > 0 ? (
        <div className="max-h-40 space-y-1 overflow-y-auto rounded-xl border border-border bg-card p-3">
          {ordered.slice(0, 8).map((item) => (
            <div key={item.id} className="flex items-center justify-between text-xs text-muted-foreground">
              <span>
                {item.referencia_mes}/{item.referencia_ano}
              </span>
              <span className="font-mono font-semibold text-foreground">{money.format(item.preco)}</span>
            </div>
          ))}
          {ordered.length > 8 ? (
            <p className="pt-1 text-[11px] text-muted-foreground">+{ordered.length - 8} mensalidades…</p>
          ) : null}
        </div>
      ) : null}

      {recibos.length > 0 ? (
        <div className="space-y-2 rounded-xl border border-emerald-500/20 bg-emerald-500/10 p-3">
          <p className="text-xs font-bold text-emerald-800 dark:text-emerald-300">Recibos disponíveis</p>
          <div className="space-y-2">
            {recibos.map((recibo) => (
              <button
                key={`${recibo.label}-${recibo.url}`}
                type="button"
                onClick={() => window.open(recibo.url, "_blank", "noopener,noreferrer")}
                className="flex w-full items-center justify-between rounded-lg bg-card px-3 py-2 text-left font-semibold text-emerald-800 hover:bg-emerald-500/10 dark:text-emerald-300"
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

      <div className="space-y-2 border-t border-border pt-4">
        <button
          type="button"
          onClick={() => void pay()}
          disabled={!canSubmit}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-foreground px-4 py-3 text-sm font-bold text-background transition hover:opacity-90 disabled:cursor-not-allowed disabled:bg-muted disabled:text-muted-foreground"
        >
          {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
          {submitting
            ? "A registar pagamento…"
            : paymentCommitted
              ? "Pagamento registado — não repetir"
              : numericAmount >= total && total > 0
                ? `Liquidar saldo · ${money.format(total)}`
                : `Registar pagamento · ${money.format(Number.isFinite(numericAmount) ? numericAmount : 0)}`}
        </button>
        {!canSubmit && !submitting && disabledReason ? (
          <p className="text-center text-xs font-medium text-muted-foreground">{disabledReason}</p>
        ) : null}
      </div>
    </div>
  );

  if (embedded) {
    return (
      <div className="rounded-2xl border border-border bg-card p-5 sm:p-6">
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
