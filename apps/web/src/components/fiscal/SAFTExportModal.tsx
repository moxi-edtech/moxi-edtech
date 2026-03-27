"use client";

import { FormEvent, useMemo, useState } from "react";
import { Loader2, X } from "lucide-react";

import { useToast } from "@/components/feedback/FeedbackSystem";

type SAFTExportModalProps = {
  empresaId: string | null;
  onClose: () => void;
  onSubmittingChange?: (loading: boolean) => void;
  onSuccess?: () => void;
};

type ApiResponse = {
  ok?: boolean;
  error?: {
    code?: string;
    message?: string;
  };
};

const monthNames = [
  "01 - Janeiro",
  "02 - Fevereiro",
  "03 - Março",
  "04 - Abril",
  "05 - Maio",
  "06 - Junho",
  "07 - Julho",
  "08 - Agosto",
  "09 - Setembro",
  "10 - Outubro",
  "11 - Novembro",
  "12 - Dezembro",
];

function toMonthRange(year: number, month: number) {
  const start = new Date(Date.UTC(year, month - 1, 1));
  const end = new Date(Date.UTC(year, month, 0));
  return {
    periodo_inicio: start.toISOString().slice(0, 10),
    periodo_fim: end.toISOString().slice(0, 10),
  };
}

export function SAFTExportModal({ empresaId, onClose, onSubmittingChange, onSuccess }: SAFTExportModalProps) {
  const now = new Date();
  const [ano, setAno] = useState(now.getUTCFullYear());
  const [mes, setMes] = useState(now.getUTCMonth() + 1);
  const [loading, setLoading] = useState(false);
  const { success, error } = useToast();

  const yearOptions = useMemo(() => {
    const current = new Date().getUTCFullYear();
    const years: number[] = [];
    for (let y = 2024; y <= current; y += 1) {
      years.push(y);
    }
    return years.reverse();
  }, []);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (loading) return;

    if (!empresaId) {
      error("Falha na exportação. Tente de novo ou contacte suporte.", "Empresa fiscal não identificada.");
      return;
    }

    const { periodo_inicio, periodo_fim } = toMonthRange(ano, mes);

    setLoading(true);
    onSubmittingChange?.(true);

    try {
      const response = await fetch("/api/fiscal/saft/export", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ano,
          mes,
          empresa_id: empresaId,
          periodo_inicio,
          periodo_fim,
          xsd_version: "AO_SAFT_1.01",
        }),
      });

      const json = (await response.json().catch(() => ({}))) as ApiResponse;

      if (response.status === 202 || response.status === 201) {
        success(
          "Exportação enfileirada com sucesso. Acompanhe o estado no histórico abaixo."
        );
        onSuccess?.();
        onClose();
        return;
      }

      if (response.status >= 500) {
        error("Falha na exportação. Tente de novo ou contacte suporte.");
        return;
      }

      error("Falha na exportação. Tente de novo ou contacte suporte.", json.error?.message);
    } catch {
      error("Falha na exportação. Tente de novo ou contacte suporte.");
    } finally {
      setLoading(false);
      onSubmittingChange?.(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4">
      <div className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-5 shadow-xl">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="font-sora text-lg font-semibold text-slate-900">Exportar SAF-T(AO)</h3>
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
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="space-y-1 text-sm text-slate-700">
              <span className="font-medium">Ano Fiscal</span>
              <select
                value={ano}
                onChange={(event) => setAno(Number(event.target.value))}
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 outline-none focus:border-[#1F6B3B] focus:ring-2 focus:ring-[#1F6B3B]/20"
              >
                {yearOptions.map((value) => (
                  <option key={value} value={value}>
                    {value}
                  </option>
                ))}
              </select>
            </label>

            <label className="space-y-1 text-sm text-slate-700">
              <span className="font-medium">Mês</span>
              <select
                value={mes}
                onChange={(event) => setMes(Number(event.target.value))}
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 outline-none focus:border-[#1F6B3B] focus:ring-2 focus:ring-[#1F6B3B]/20"
              >
                {monthNames.map((label, index) => (
                  <option key={label} value={index + 1}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
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
              disabled={loading}
              className="inline-flex items-center gap-2 rounded-xl bg-[#1F6B3B] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#18542e] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              {loading ? "A gerar..." : "Gerar Exportação"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
