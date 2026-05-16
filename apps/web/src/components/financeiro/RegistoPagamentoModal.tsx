"use client";

import React, { useState } from "react";
import { ModalShell } from "@/components/ui/ModalShell";
import { Input } from "@/components/ui/Input";
import { registrarPagamentoAction, PagamentoMetodo } from "@/features/financeiro/actions";
import { useToast } from "@/components/feedback/FeedbackSystem";
import { Loader2, CheckCircle2 } from "lucide-react";

interface RegistoPagamentoModalProps {
  open: boolean;
  onClose: () => void;
  escolaId: string;
  alunoId: string;
  alunoNome: string;
  mensalidadeId: string;
  valorSugerido: number;
  descricao: string;
}

const METODOS: { value: PagamentoMetodo; label: string }[] = [
  { value: "cash", label: "Dinheiro" },
  { value: "tpa", label: "TPA" },
  { value: "transfer", label: "Transferência" },
  { value: "mcx", label: "Multicaixa" },
  { value: "kwik", label: "Kwik" },
];

export function RegistoPagamentoModal({
  open,
  onClose,
  escolaId,
  alunoId,
  alunoNome,
  mensalidadeId,
  valorSugerido,
  descricao,
}: RegistoPagamentoModalProps) {
  const [loading, setLoading] = useState(false);
  const [metodo, setMetodo] = useState<PagamentoMetodo>("cash");
  const [valor, setValor] = useState(valorSugerido);
  const [reference, setReference] = useState("");
  const [observacao, setObservacao] = useState("");
  const { success, error } = useToast();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);

    const res = await registrarPagamentoAction({
      escola_id: escolaId,
      aluno_id: alunoId,
      mensalidade_id: mensalidadeId,
      valor,
      metodo,
      reference,
      meta: { observacao, origem: "portal_financeiro" },
    });

    setLoading(false);

    if (res.success) {
      success("Pagamento registado", "O pagamento foi processado e liquidado com sucesso.");
      onClose();
    } else {
      error("Erro no registo", res.error || "Não foi possível registar o pagamento.");
    }
  }

  return (
    <ModalShell
      open={open}
      title="Registar Pagamento"
      description={`Recebimento para: ${alunoNome} (${descricao})`}
      onClose={onClose}
    >
      <form onSubmit={handleSubmit} className="space-y-6 py-2">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Input
            label="Valor a Receber (AOA)"
            type="number"
            step="0.01"
            value={valor}
            onChange={(e) => setValor(Number(e.target.value))}
            required
            className="font-mono font-bold text-lg"
          />

          <div className="w-full">
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              Método de Pagamento
            </label>
            <select
              value={metodo}
              onChange={(e) => setMetodo(e.target.value as PagamentoMetodo)}
              className="w-full p-3 border border-gray-300 rounded-lg focus:ring-klasse-gold-500/20 focus:border-klasse-gold-500 outline-none transition-all"
            >
              {METODOS.map((m) => (
                <option key={m.value} value={m.value}>
                  {m.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        {metodo !== "cash" && (
          <Input
            label={metodo === "tpa" ? "Nº do Talão / Referência" : "Referência da Transação / IBAN"}
            placeholder="Ex: 123456789"
            value={reference}
            onChange={(e) => setReference(e.target.value)}
            required
          />
        )}

        <div className="w-full">
          <label className="block text-sm font-medium text-gray-700 mb-1.5">
            Observações Internas
          </label>
          <textarea
            value={observacao}
            onChange={(e) => setObservacao(e.target.value)}
            rows={3}
            className="w-full p-3 border border-gray-300 rounded-lg focus:ring-klasse-gold-500/20 focus:border-klasse-gold-500 outline-none transition-all resize-none text-sm"
            placeholder="Alguma nota sobre este pagamento..."
          />
        </div>

        <div className="flex items-center justify-end gap-3 pt-4">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50 rounded-lg transition-colors"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={loading}
            className="flex items-center gap-2 bg-klasse-gold-500 hover:bg-klasse-gold-600 text-white px-6 py-2.5 rounded-lg font-bold shadow-sm shadow-klasse-gold-500/20 transition-all disabled:opacity-50"
          >
            {loading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <CheckCircle2 className="w-4 h-4" />
            )}
            {loading ? "Processando..." : "Confirmar Recebimento"}
          </button>
        </div>
      </form>
    </ModalShell>
  );
}
