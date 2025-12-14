"use client";

import { useState, useEffect } from "react";

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

export default function TransferForm({ matriculaId, onSuccess }: TransferFormProps) {
  const [turmaId, setTurmaId] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [turmas, setTurmas] = useState<Turma[]>([]);

  useEffect(() => {
    const fetchTurmas = async () => {
      try {
        const res = await fetch("/api/secretaria/turmas-simples");
        const json = await res.json();
        if (json.ok) {
          setTurmas(json.items);
        }
      } catch (e) {
        setError("Falha ao carregar turmas.");
      }
    };
    fetchTurmas();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const res = await fetch(`/api/secretaria/matriculas/${matriculaId}/transfer`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          turma_id: turmaId,
        }),
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
            const displayName = turma.turma_nome || turma.nome || 'Turma sem nome';
            const details = [turma.turno, turma.classe_nome].filter(Boolean).join(' • ');
            return (
              <option key={turma.id} value={turma.id}>
                {details ? `${displayName} (${details})` : displayName}
              </option>
            );
          })}
        </select>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <div className="flex justify-end gap-4">
        <button
          type="button"
          onClick={onSuccess}
          className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2"
        >
          Cancelar
        </button>
        <button
          type="submit"
          disabled={loading}
          className="inline-flex justify-center rounded-md border border-transparent bg-emerald-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 disabled:opacity-50"
        >
          {loading ? "Transferindo..." : "Transferir"}
        </button>
      </div>
    </form>
  );
}
