"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Banknote, CheckCircle2, CreditCard, Loader2, Printer, QrCode, ArrowRightLeft } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/components/feedback/FeedbackSystem";

const money = new Intl.NumberFormat("pt-AO", {
  style: "currency",
  currency: "AOA",
  maximumFractionDigits: 0,
});

type Metodo = "cash" | "tpa" | "transferencia" | "mcx";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  alunoId: string;
  alunoNome?: string | null;
  saldoDevedor: number;
  onPaid?: () => void;
  embedded?: boolean;
};

export default function PagamentoDividaModal({
  open,
  onOpenChange,
  alunoId,
  alunoNome,
  saldoDevedor,
  onPaid,
  embedded = false,
}: Props) {
  const { success, error } = useToast();
  const [amount, setAmount] = useState<string>("");
  const [method, setMethod] = useState<Metodo>("cash");
  const [reference, setReference] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [paymentCommitted, setPaymentCommitted] = useState(false);
  const [recibos, setRecibos] = useState<Array<{ label: string; url: string }>>([]);
  const committedRef = useRef(false);

  const total = Number(saldoDevedor) || 0;
  const numericAmount = Number(String(amount).replace(/[^0-9.]/g, "")) || 0;

  useEffect(() => {
    if (!open) {
      setAmount("");
      setMethod("cash");
      setReference("");
      setSubmitting(false);
      setPaymentCommitted(false);
      setRecibos([]);
      committedRef.current = false;
      return;
    }
    if (total > 0) setAmount(String(total));
  }, [open, total]);

  const canSubmit = useMemo(() => {
    if (paymentCommitted || submitting) return false;
    if (!alunoId) return false;
    if (!Number.isFinite(numericAmount) || numericAmount <= 0) return false;
    if (method !== "cash" && !reference.trim()) return false;
    return true;
  }, [alunoId, method, numericAmount, paymentCommitted, reference, submitting]);

  const disabledReason = useMemo(() => {
    if (paymentCommitted) return "Pagamento já registado neste modal.";
    if (!alunoId) return "Aluno em falta.";
    if (!Number.isFinite(numericAmount) || numericAmount <= 0) return "Indique um valor válido.";
    if (method !== "cash" && !reference.trim()) return "Referência obrigatória para este método.";
    return null;
  }, [alunoId, method, numericAmount, paymentCommitted, reference]);

  const pay = async () => {
    if (!canSubmit || committedRef.current) return;
    setSubmitting(true);
    try {
      const res = await fetch("/api/secretaria/pagamentos/divida", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          aluno_id: alunoId,
          amount: numericAmount,
          method,
          reference: reference.trim() || null,
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json?.ok) throw new Error(json?.error || "Falha ao registar pagamento");

      committedRef.current = true;
      setPaymentCommitted(true);
      const lista = Array.isArray(json.recibos) ? json.recibos : [];
      setRecibos(lista);
      success("Pagamento registado", json.message || "O valor foi aplicado às mensalidades.");
      onPaid?.();
    } catch (e: any) {
      error("Não foi possível registar", e?.message || "Erro inesperado.");
    } finally {
      setSubmitting(false);
    }
  };

  const methods: Array<{ id: Metodo; label: string; icon: React.ElementType }> = [
    { id: "cash", label: "Numerário", icon: Banknote },
    { id: "tpa", label: "TPA", icon: CreditCard },
    { id: "transferencia", label: "Transferência", icon: ArrowRightLeft },
    { id: "mcx", label: "MCX", icon: QrCode },
  ];

  const panel = (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-base font-bold text-foreground">Regularizar mensalidades</h3>
          <p className="mt-0.5 text-sm text-muted-foreground truncate">
            {alunoNome || "Aluno"} · saldo {money.format(total)}
          </p>
        </div>
      </div>

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
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
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
                    ? "border-border bg-background text-white"
                    : "border-border bg-card text-foreground hover:bg-muted"
                }
                style={active ? undefined : undefined}
              >
                <span
                  className={
                    active
                      ? "flex w-full flex-col items-center gap-1 rounded-xl border border-border bg-foreground px-2 py-3 text-xs font-bold text-background"
                      : "flex w-full flex-col items-center gap-1 rounded-xl border border-border bg-card px-2 py-3 text-xs font-bold text-foreground hover:bg-muted"
                  }
                >
                  <Icon className="h-4 w-4" />
                  {m.label}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {method !== "cash" ? (
        <div className="space-y-1">
          <label className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">Referência</label>
          <input
            value={reference}
            onChange={(e) => setReference(e.target.value)}
            className="w-full rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground outline-none focus:ring-2 focus:ring-amber/30"
            placeholder="Nº do talão / comprovativo"
          />
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
                className="flex w-full items-center justify-between rounded-lg bg-card px-3 py-2 text-left font-semibold text-emerald-800 hover:bg-emerald-100 dark:text-emerald-300"
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
              : numericAmount >= total
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
