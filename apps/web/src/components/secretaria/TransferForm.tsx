"use client";

import { useState, useEffect } from "react";
import { AlertCircle, Loader2 } from "lucide-react";

interface TransferFormProps {
  matriculaId: string;
  onSuccess: () => void;
}

interface Turma {
  id: string;
  nome?: string;
  turma_nome?: string;
  classe_nome?: string;
  turno?: string;
}

interface ImpactoTransferencia {
  allow: boolean;
  lotada: boolean;
  vagas_restantes: number;
  mudanca_turno: boolean;
  financeiro: {
    altera_valor: boolean;
    valor_antigo: number;
    valor_novo: number;
    diferenca: number;
    mensagem: string;
  };
}

export default function TransferForm({ matriculaId, onSuccess }: TransferFormProps) {
  const [turmaId, setTurmaId] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [turmas, setTurmas] = useState<Turma[]>([]);
  const [impacto, setImpacto] = useState<ImpactoTransferencia | null>(null);
  const [checking, setChecking] = useState(false);

  useEffect(() => {
    const fetchTurmas = async () => {
      try {
        const res = await fetch("/api/secretaria/turmas-simples");
        const json = await res.json();
        if (json.ok) setTurmas(json.items);
      } catch (e) {
        setError("Falha ao carregar turmas.");
      }
    };
    fetchTurmas();
  }, []);

  useEffect(() => {
    if (!turmaId) {
      setImpacto(null);
      return;
    }
    setChecking(true);
    setError(null);
    fetch(`/api/secretaria/matriculas/${matriculaId}/check-transfer?target_turma_id=${encodeURIComponent(turmaId)}`)
      .then((r) => r.json().then((j) => ({ ok: r.ok, body: j })))
      .then(({ ok, body }) => {
        if (!ok) throw new Error(body?.error || "Falha ao simular transferência");
        setImpacto(body as ImpactoTransferencia);
      })
      .catch((e) => {
        setImpacto(null);
        setError(e instanceof Error ? e.message : String(e));
      })
      .finally(() => setChecking(false));
  }, [turmaId, matriculaId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!turmaId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/secretaria/matriculas/${matriculaId}/transfer`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ turma_id: turmaId }),
      });
      const json = await res.json();
      if (!res.ok || !json.ok) {
        throw new Error(json.error || "Falha ao transferir aluno");
      }
      onSuccess();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  };

  const disableConfirm = !turmaId || checking || loading || (impacto && impacto.lotada && !impacto.allow);

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label htmlFor="turma" className="block text-sm font-medium text-gray-700">
          Nova Turma
        </label>
        <select
          id="turma"
          value={turmaId}
          onChange={(e) => setTurmaId(e.target.value)}
          className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-emerald-500 focus:ring-emerald-500 sm:text-sm"
          required
        >
          <option value="">Selecione uma turma</option>
          {turmas.map((turma) => {
            const displayName = turma.turma_nome || turma.nome || "Turma sem nome";
            const details = [turma.turno, turma.classe_nome].filter(Boolean).join(" • ");
            return (
              <option key={turma.id} value={turma.id}>
                {details ? `${displayName} (${details})` : displayName}
              </option>
            );
          })}
        </select>
      </div>

      {checking && (
        <div className="flex items-center gap-2 text-sm text-slate-600">
          <Loader2 className="h-4 w-4 animate-spin" /> Calculando impacto...
        </div>
      )}

      {impacto && !checking && (
        <div className="space-y-3 rounded-xl border border-slate-200 bg-slate-50 p-4">
          {impacto.lotada && (
            <div className="flex items-start gap-2 rounded-lg bg-red-50 p-3 text-sm text-red-700 border border-red-200">
              <AlertCircle className="h-4 w-4 mt-0.5" />
              <span>Turma lotada. Se prosseguir, confirme com permissão administrativa.</span>
            </div>
          )}

          <div className="flex flex-wrap gap-2 text-xs text-slate-700">
            <span className="rounded-full bg-white px-3 py-1 ring-1 ring-slate-200">Vagas restantes: {impacto.vagas_restantes ?? 0}</span>
            {impacto.mudanca_turno && (
              <span className="rounded-full bg-amber-100 px-3 py-1 text-amber-800 ring-1 ring-amber-200">Mudança de turno</span>
            )}
          </div>

          <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
            <div className="font-semibold mb-1">Impacto financeiro</div>
            <div className="text-xs text-amber-800">{impacto.financeiro.mensagem}</div>
            <div className="mt-2 text-xs text-amber-900">
              Atual: {impacto.financeiro.valor_antigo.toLocaleString('pt-AO')} Kz → Novo: {impacto.financeiro.valor_novo.toLocaleString('pt-AO')} Kz ({impacto.financeiro.diferenca >= 0 ? '+' : ''}{impacto.financeiro.diferenca.toLocaleString('pt-AO')} Kz)
            </div>
          </div>
        </div>
      )}

      {error && <p className="text-sm text-red-600">{error}</p>}

      <div className="flex justify-end gap-4 pt-2">
        <button
          type="button"
          onClick={onSuccess}
          className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2"
        >
          Cancelar
        </button>
        <button
          type="submit"
          disabled={disableConfirm}
          className="inline-flex justify-center rounded-md border border-transparent bg-emerald-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 disabled:opacity-50"
        >
          {loading ? "Transferindo..." : "Confirmar transferência"}
        </button>
      </div>
    </form>
  );
}
