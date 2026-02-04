"use client";

import { useEffect, useMemo, useState } from "react";
import { Check, CreditCard, FileText, Loader2, Shield, X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";

type ServicoOption = {
  id: string;
  codigo: string;
  nome: string;
  preco: number;
  descricao?: string | null;
};

export type BalcaoDecision =
  | { decision: "GRANTED"; pedido_id: string }
  | { decision: "BLOCKED"; pedido_id: string; reason_code: string; reason_detail?: string | null }
  | {
      decision: "REQUIRES_PAYMENT";
      pedido_id: string;
      payment_intent_id: string;
      amounts: { total: number };
    };

type Props = {
  open: boolean;
  onClose: () => void;
  alunoId: string | null;
  servicos: ServicoOption[];
  initialCodigo?: string | null;
  onDecision: (decision: BalcaoDecision) => void;
};

const kwanza = new Intl.NumberFormat("pt-AO", {
  style: "currency",
  currency: "AOA",
  maximumFractionDigits: 0,
});

export function BalcaoServicoModal({
  open,
  onClose,
  alunoId,
  servicos,
  initialCodigo,
  onDecision,
}: Props) {
  const supabase = createClient();
  const [loading, setLoading] = useState(false);
  const [decision, setDecision] = useState<BalcaoDecision | null>(null);
  const [servicoCodigo, setServicoCodigo] = useState<string>("");

  const available = useMemo(() => servicos.filter((s) => s.codigo), [servicos]);

  useEffect(() => {
    if (!open) return;
    setDecision(null);
    setServicoCodigo(initialCodigo ?? available[0]?.codigo ?? "");
  }, [open, available, initialCodigo]);

  async function handleContinuar() {
    if (!alunoId) {
      toast.error("Aluno não selecionado.");
      return;
    }

    if (!servicoCodigo) {
      toast.error("Selecione um serviço.");
      return;
    }

    setLoading(true);
    setDecision(null);
    const { data, error } = await supabase.rpc("balcao_criar_pedido_e_decidir", {
      p_servico_codigo: servicoCodigo,
      p_aluno_id: alunoId,
      p_contexto: {},
    });
    setLoading(false);

    if (error) {
      toast.error(error.message || "Erro ao criar pedido.");
      return;
    }

    const parsed = data as BalcaoDecision;
    setDecision(parsed);
    onDecision(parsed);
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-sm">
      <div className="w-full max-w-xl overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
          <div className="font-bold text-slate-900">Balcão · Novo Serviço</div>
          <button onClick={onClose} className="rounded-xl p-2 hover:bg-slate-50">
            <X className="h-4 w-4 text-slate-400" />
          </button>
        </div>

        <div className="space-y-4 p-5">
          <label className="block text-xs font-bold uppercase text-slate-500">Serviço</label>
          <select
            value={servicoCodigo}
            onChange={(event) => setServicoCodigo(event.target.value)}
            className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-900 outline-none focus:border-klasse-gold focus:ring-4 focus:ring-klasse-gold/20"
          >
            {available.length === 0 ? (
              <option value="">Sem serviços ativos</option>
            ) : (
              available.map((servico) => (
                <option key={servico.id} value={servico.codigo}>
                  {servico.nome} · {kwanza.format(servico.preco)}
                </option>
              ))
            )}
          </select>

          {decision?.decision === "GRANTED" && (
            <div className="flex gap-2 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-900">
              <Check className="mt-0.5 h-4 w-4" />
              <div>
                <div className="font-bold">Liberado na hora</div>
                <div className="text-xs opacity-80">Pedido: {decision.pedido_id}</div>
              </div>
            </div>
          )}

          {decision?.decision === "BLOCKED" && (
            <div className="flex gap-2 rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-900">
              <Shield className="mt-0.5 h-4 w-4" />
              <div>
                <div className="font-bold">Serviço bloqueado</div>
                <div className="text-xs">{decision.reason_code}</div>
                {decision.reason_detail ? (
                  <div className="text-xs opacity-80">{decision.reason_detail}</div>
                ) : null}
              </div>
            </div>
          )}

          {decision?.decision === "REQUIRES_PAYMENT" && (
            <div className="flex gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
              <CreditCard className="mt-0.5 h-4 w-4" />
              <div>
                <div className="font-bold">Requer pagamento</div>
                <div className="text-xs opacity-80">
                  Total: {kwanza.format(decision.amounts.total ?? 0)}
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="flex justify-end gap-2 border-t border-slate-200 bg-slate-50 px-5 py-4">
          <button
            onClick={onClose}
            className="rounded-xl px-4 py-2 text-sm font-bold text-slate-600 hover:text-slate-900"
          >
            Cancelar
          </button>
          <button
            onClick={handleContinuar}
            disabled={loading || available.length === 0}
            className="inline-flex items-center gap-2 rounded-xl bg-klasse-gold px-5 py-2 text-sm font-bold text-white hover:brightness-95 disabled:opacity-70"
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileText className="h-4 w-4" />}
            Continuar
          </button>
        </div>
      </div>
    </div>
  );
}
