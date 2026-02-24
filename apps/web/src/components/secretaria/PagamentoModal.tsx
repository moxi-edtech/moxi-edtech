"use client";

import { useMemo, useState } from "react";
import { Banknote, CreditCard, Loader2, ReceiptText, Upload, X } from "lucide-react";
import { useToast } from "@/components/feedback/FeedbackSystem";

type Method = "cash" | "tpa" | "transfer" | "mcx" | "kiwk";

type Props = {
  open: boolean;
  onClose: () => void;
  alunoId: string | null;
  intentId: string | null;
  totalKz: number;
  pedidoId?: string | null;
};

const kwanza = new Intl.NumberFormat("pt-AO", {
  style: "currency",
  currency: "AOA",
  maximumFractionDigits: 0,
});

export function PagamentoModal({
  open,
  onClose,
  alunoId,
  intentId,
  totalKz,
  pedidoId,
}: Props) {
  const [method, setMethod] = useState<Method>("cash");
  const [reference, setReference] = useState("");
  const [terminalId, setTerminalId] = useState("");
  const [evidenceUrl, setEvidenceUrl] = useState("");
  const [gatewayRef, setGatewayRef] = useState("");
  const [loading, setLoading] = useState(false);
  const [feedback, setFeedback] = useState<{ status: "success" | "error"; message: string } | null>(null);
  const { success, error } = useToast();

  const needsRef = useMemo(() => method === "tpa", [method]);
  const needsEvidence = useMemo(() => method === "transfer", [method]);
  const needsGatewayRef = useMemo(() => method === "mcx" || method === "kiwk", [method]);
  const handleClose = () => {
    setMethod("cash");
    setReference("");
    setTerminalId("");
    setEvidenceUrl("");
    setGatewayRef("");
    setFeedback(null);
    onClose();
  };

  async function handleConfirmar() {
    if (!alunoId) {
      error("Aluno não selecionado.");
      return;
    }
    if (needsRef && !reference.trim()) {
      error("Referência obrigatória.");
      return;
    }
    if (needsEvidence && !evidenceUrl.trim()) {
      error("Comprovativo obrigatório.");
      return;
    }

    setLoading(true);
    setFeedback(null);

    const idempotencyKey =
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(16).slice(2)}`;

    const response = await fetch("/api/secretaria/balcao/pagamentos", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Idempotency-Key": idempotencyKey,
      },
      cache: "no-store",
      body: JSON.stringify({
        aluno_id: alunoId,
        mensalidade_id: null,
        valor: totalKz,
        metodo: method,
        reference: reference || null,
        evidence_url: evidenceUrl || null,
        gateway_ref: gatewayRef || null,
        meta: {
          origem: "balcao_servico",
          pedido_id: pedidoId || null,
          pagamento_intent_id: intentId || null,
        },
      }),
    });
    const json = await response.json().catch(() => ({}));
    if (!response.ok || !json?.ok) {
      setLoading(false);
      error(json?.error || "Falha ao registrar pagamento.");
      setFeedback({
        status: "error",
        message: json?.error || "Falha ao registrar pagamento.",
      });
      return;
    }

    const status = json?.data?.status ?? (method === "cash" ? "settled" : "pending");
    if (status === "settled") {
      success("Pagamento liquidado.", "Serviço liberado.");
    } else {
      success("Pagamento registado.", "Serviço pendente de confirmação.");
    }
    setFeedback({
      status: "success",
      message:
        status === "settled"
          ? "Pagamento liquidado e serviço liberado."
          : "Pagamento registrado como pendente.",
    });
    setLoading(false);
    window.setTimeout(() => {
      handleClose();
    }, 1200);
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-sm">
      <div className="w-full max-w-xl overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
          <div className="font-bold text-slate-900">Pagamento · {kwanza.format(totalKz)} </div>
          <button onClick={handleClose} className="rounded-xl p-2 hover:bg-slate-50">
            <X className="h-4 w-4 text-slate-400" />
          </button>
        </div>

        <div className="space-y-4 p-5">
          {feedback ? (
            <div
              className={`rounded-xl border px-4 py-3 text-sm font-semibold ${
                feedback.status === "success"
                  ? "border-emerald-200 bg-emerald-50 text-emerald-900"
                  : "border-rose-200 bg-rose-50 text-rose-900"
              }`}
            >
              {feedback.message}
            </div>
          ) : null}
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setMethod("cash")}
              className={`flex items-center gap-2 rounded-xl border px-3 py-2 text-sm font-bold ${
                method === "cash"
                  ? "border-klasse-gold ring-4 ring-klasse-gold/20"
                  : "border-slate-200"
              }`}
            >
              <Banknote className="h-4 w-4 text-slate-500" /> Cash
            </button>
            <button
              type="button"
              onClick={() => setMethod("tpa")}
              className={`flex items-center gap-2 rounded-xl border px-3 py-2 text-sm font-bold ${
                method === "tpa"
                  ? "border-klasse-gold ring-4 ring-klasse-gold/20"
                  : "border-slate-200"
              }`}
            >
              <CreditCard className="h-4 w-4 text-slate-500" /> TPA
            </button>
            <button
              type="button"
              onClick={() => setMethod("transfer")}
              className={`flex items-center gap-2 rounded-xl border px-3 py-2 text-sm font-bold ${
                method === "transfer"
                  ? "border-klasse-gold ring-4 ring-klasse-gold/20"
                  : "border-slate-200"
              }`}
            >
              <Upload className="h-4 w-4 text-slate-500" /> Transferência
            </button>
            <button
              type="button"
              onClick={() => setMethod("mcx")}
              className={`flex items-center gap-2 rounded-xl border px-3 py-2 text-sm font-bold ${
                method === "mcx"
                  ? "border-klasse-gold ring-4 ring-klasse-gold/20"
                  : "border-slate-200"
              }`}
            >
              <ReceiptText className="h-4 w-4 text-slate-500" /> Multicaixa
            </button>
            <button
              type="button"
              onClick={() => setMethod("kiwk")}
              className={`flex items-center gap-2 rounded-xl border px-3 py-2 text-sm font-bold ${
                method === "kiwk"
                  ? "border-klasse-gold ring-4 ring-klasse-gold/20"
                  : "border-slate-200"
              }`}
            >
              <ReceiptText className="h-4 w-4 text-slate-500" /> KIWK
            </button>
          </div>

          {needsRef || needsGatewayRef ? (
            <div className="space-y-2">
              {needsRef ? (
                <>
                  <label className="text-xs font-bold uppercase text-slate-500">Referência (obrigatório)</label>
                  <input
                    value={reference}
                    onChange={(event) => setReference(event.target.value)}
                    className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-900 outline-none focus:border-klasse-gold focus:ring-4 focus:ring-klasse-gold/20"
                    placeholder="Ex: TPA-2026-000882"
                  />
                </>
              ) : null}
              {method === "tpa" ? (
                <input
                  value={terminalId}
                  onChange={(event) => setTerminalId(event.target.value)}
                  className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-900 outline-none focus:border-klasse-gold focus:ring-4 focus:ring-klasse-gold/20"
                  placeholder="Terminal ID (opcional)"
                />
              ) : null}
              {needsGatewayRef ? (
                <>
                  <label className="text-xs font-bold uppercase text-slate-500">
                    {method === "kiwk" ? "KIWK ref (opcional)" : "Gateway ref (opcional)"}
                  </label>
                  <input
                    value={gatewayRef}
                    onChange={(event) => setGatewayRef(event.target.value)}
                    className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-900 outline-none focus:border-klasse-gold focus:ring-4 focus:ring-klasse-gold/20"
                    placeholder="MCX-..."
                  />
                </>
              ) : null}
            </div>
          ) : null}

          {needsEvidence ? (
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
              <div className="text-sm font-bold text-slate-900">Comprovativo (obrigatório)</div>
              <div className="text-xs text-slate-500">
                Faça upload e cole a URL do comprovativo.
              </div>
              <input
                value={evidenceUrl}
                onChange={(event) => setEvidenceUrl(event.target.value)}
                className="mt-2 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-900 outline-none focus:border-klasse-gold focus:ring-4 focus:ring-klasse-gold/20"
                placeholder="https://..."
              />
            </div>
          ) : null}

          <div className="text-xs text-slate-500">
            * TPA/Transfer/MCX/KIWK entram como pendente até conciliação.
          </div>
        </div>

        <div className="flex justify-end gap-2 border-t border-slate-200 bg-slate-50 px-5 py-4">
          <button
            onClick={handleClose}
            className="rounded-xl px-4 py-2 text-sm font-bold text-slate-600 hover:text-slate-900"
          >
            Voltar
          </button>
          <button
            onClick={handleConfirmar}
            disabled={loading || !intentId}
            className="inline-flex items-center gap-2 rounded-xl bg-klasse-gold px-5 py-2 text-sm font-bold text-white hover:brightness-95 disabled:opacity-70"
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <CreditCard className="h-4 w-4" />}
            Confirmar
          </button>
        </div>
      </div>
    </div>
  );
}
