"use client";

import { FormEvent, useMemo, useState } from "react";
import { Loader2, X } from "lucide-react";

import { useToast } from "@/components/feedback/FeedbackSystem";

type AnularModalProps = {
  docId: string;
  onSuccess: () => void;
  onClose: () => void;
};

type ApiErrorResponse = {
  ok?: boolean;
  error?: {
    code?: string;
    message?: string;
  };
};

export function AnularModal({ docId, onSuccess, onClose }: AnularModalProps) {
  const [motivo, setMotivo] = useState("");
  const [loading, setLoading] = useState(false);
  const { success, warning, error } = useToast();

  const motivoInvalido = useMemo(() => motivo.trim().length < 10, [motivo]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (motivoInvalido || loading) return;

    setLoading(true);
    try {
      const response = await fetch(`/api/fiscal/documentos/${docId}/anular`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ motivo: motivo.trim() }),
      });

      const json = (await response.json().catch(() => ({}))) as ApiErrorResponse;

      if (response.status === 409) {
        warning("Ação não permitida", json.error?.message ?? "O documento não pode ser anulado no estado atual.");
        return;
      }

      if (response.status >= 500) {
        error("Erro interno. Tente novamente.");
        return;
      }

      if (!response.ok) {
        error("Falha ao anular", json.error?.message ?? "Não foi possível concluir a anulação.");
        return;
      }

      success("Documento anulado.");
      onClose();
      onSuccess();
    } catch {
      error("Erro interno. Tente novamente.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4">
      <div className="w-full max-w-lg rounded-xl border border-slate-200 bg-white p-5 shadow-xl">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="font-sora text-lg font-semibold text-slate-900">Anular Documento</h3>
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl p-2 text-slate-500 transition hover:bg-slate-100 hover:text-slate-900"
            aria-label="Fechar"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <label htmlFor="motivo-anulacao" className="text-sm font-medium text-slate-700">
              Motivo da Anulação
            </label>
            <textarea
              id="motivo-anulacao"
              minLength={10}
              value={motivo}
              onChange={(event) => setMotivo(event.target.value)}
              className="h-28 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-[#1F6B3B] focus:ring-2 focus:ring-[#1F6B3B]/20"
              placeholder="Descreva o motivo com no mínimo 10 caracteres"
            />
            <p className="text-xs text-slate-500">{motivo.trim().length}/10 mínimo</p>
          </div>

          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={motivoInvalido || loading}
              className="inline-flex items-center gap-2 rounded-xl bg-red-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              {loading ? "A processar..." : "Confirmar Anulação"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
