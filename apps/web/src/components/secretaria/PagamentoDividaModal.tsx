"use client";

import { useMemo, useState } from "react";
import { AlertTriangle, Banknote, CheckCircle2, CreditCard, Loader2, QrCode, ArrowRightLeft } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import type { Mensalidade } from "./BalcaoAtendimento";

type Metodo = "cash" | "tpa" | "transfer" | "mcx" | "kiwk";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mensalidades: Mensalidade[];
  alunoId: string;
  anoLetivoId: string | null;
  onSuccess: () => void;
  onFullyPaid?: () => void;
};

const methods: Array<{ id: Metodo; label: string; icon: typeof Banknote }> = [
  { id: "cash", label: "Numerário", icon: Banknote },
  { id: "tpa", label: "TPA", icon: CreditCard },
  { id: "transfer", label: "Transferência", icon: ArrowRightLeft },
  { id: "mcx", label: "Multicaixa", icon: QrCode },
  { id: "kiwk", label: "Kwik", icon: QrCode },
];

const money = new Intl.NumberFormat("pt-AO", { style: "currency", currency: "AOA", maximumFractionDigits: 0 });

export function PagamentoDividaModal({ open, onOpenChange, mensalidades, alunoId, anoLetivoId, onSuccess, onFullyPaid }: Props) {
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

  const pay = async () => {
    const value = Number(amount);
    if (!Number.isFinite(value) || value <= 0 || value > total) {
      setMessage({ type: "error", text: `Informe um valor entre 1 e ${money.format(total)}.` });
      return;
    }
    if (method === "tpa" && !reference.trim()) {
      setMessage({ type: "error", text: "Informe a referência do TPA." });
      return;
    }
    if (method === "transfer" && !evidenceUrl.trim()) {
      setMessage({ type: "error", text: "Informe o comprovativo da transferência." });
      return;
    }

    setSubmitting(true);
    setMessage(null);
    let remaining = value;
    try {
      let paidNow = 0;
      for (const item of ordered) {
        if (remaining <= 0) break;
        const allocated = Math.min(remaining, item.preco);
        const response = await fetch("/api/secretaria/balcao/pagamentos", {
          method: "POST",
          headers: { "Content-Type": "application/json", "Idempotency-Key": crypto.randomUUID() },
          body: JSON.stringify({
            aluno_id: alunoId,
            mensalidade_id: item.id,
            valor: allocated,
            metodo: method,
            reference: reference.trim() || null,
            evidence_url: evidenceUrl.trim() || null,
            ano_letivo_id: anoLetivoId || undefined,
            meta: {
              origem: "pos_virada",
              matricula_origem_id: item.origem_matricula_id,
              origem_pagamento: "regularizacao_divida_balcao",
            },
          }),
        });
        const json = await response.json().catch(() => ({}));
        if (!response.ok || !json?.ok) throw new Error(json?.error || "Não foi possível registar o pagamento.");
        remaining -= allocated;
        paidNow += allocated;
      }
      setPaymentHistory((history) => [...history, { amount: paidNow, method: methods.find((item) => item.id === method)?.label ?? method }]);
      setMessage({ type: "success", text: remaining > 0 ? "Pagamento registado parcialmente." : "Pagamento registado com sucesso." });
      setAmount("");
      onSuccess();
      if (remaining <= 0) onFullyPaid?.();
    } catch (error) {
      setMessage({ type: "error", text: error instanceof Error ? error.message : "Pagamento não concluído." });
      onSuccess();
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(next) => { if (!submitting) onOpenChange(next); }}>
      <DialogContent className="max-w-xl rounded-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><AlertTriangle className="h-5 w-5 text-amber-600" /> Regularizar mensalidades</DialogTitle>
          <DialogDescription>O valor será aplicado às mensalidades mais antigas primeiro. A rematrícula só será liberada quando o saldo for zero.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900"><strong>{ordered.length} mensalidade(s)</strong> em aberto · <strong>{money.format(total)}</strong></div>
          <div className="max-h-36 space-y-1 overflow-y-auto rounded-xl border border-slate-200 p-2">
            {ordered.map((item, index) => <div key={item.id} className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2 text-xs"><span>{index + 1}. {item.nome}</span><strong>{money.format(item.preco)}</strong></div>)}
          </div>
          <div><label className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-slate-500">Quanto deseja pagar agora?</label><input type="number" min="1" max={total} value={amount} onChange={(event) => setAmount(event.target.value)} placeholder={`Até ${money.format(total)}`} className="w-full rounded-xl border border-slate-200 px-3 py-3 text-lg font-black outline-none focus:border-klasse-gold" disabled={submitting} /></div>
          <div className="grid grid-cols-5 gap-1.5">{methods.map(({ id, label, icon: Icon }) => <button key={id} type="button" onClick={() => setMethod(id)} disabled={submitting} className={`flex flex-col items-center gap-1 rounded-xl border py-2 text-[10px] font-bold ${method === id ? "border-klasse-gold bg-klasse-gold/10 text-slate-900" : "border-slate-200 text-slate-500"}`}><Icon className="h-4 w-4" />{label}</button>)}</div>
          {method === "tpa" || method === "mcx" || method === "kiwk" ? <input value={reference} onChange={(event) => setReference(event.target.value)} placeholder="Referência do pagamento" className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm" disabled={submitting} /> : null}
          {method === "transfer" ? <input value={evidenceUrl} onChange={(event) => setEvidenceUrl(event.target.value)} placeholder="URL do comprovativo" className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm" disabled={submitting} /> : null}
          {message && <p className={`flex items-center gap-2 rounded-xl p-3 text-sm ${message.type === "success" ? "bg-emerald-50 text-emerald-800" : "bg-rose-50 text-rose-700"}`}>{message.type === "success" && <CheckCircle2 className="h-4 w-4" />}{message.text}</p>}
          {paymentHistory.length > 0 && <div className="rounded-xl border border-emerald-100 bg-emerald-50/60 p-3 text-xs text-emerald-900"><p className="mb-1 font-bold">Pagamentos nesta regularização</p>{paymentHistory.map((item, index) => <div key={`${item.method}-${index}`} className="flex justify-between"><span>{item.method}</span><strong>{money.format(item.amount)}</strong></div>)}</div>}
          <button type="button" onClick={() => void pay()} disabled={submitting || ordered.length === 0} className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#E3B23C] px-4 py-3 text-sm font-bold text-slate-950 disabled:opacity-60">{submitting && <Loader2 className="h-4 w-4 animate-spin" />} {submitting ? "A registar pagamento…" : "Registar pagamento parcial"}</button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
