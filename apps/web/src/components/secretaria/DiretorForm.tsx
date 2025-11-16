"use client";

import { useState, useEffect } from "react";

interface DiretorFormProps {
  turmaId: string;
  onSuccess: () => void;
}

interface Diretor {
  user_id: string;
  nome: string;
}

export default function DiretorForm({ turmaId, onSuccess }: DiretorFormProps) {
  const [diretorTurma, setDiretorTurma] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [diretores, setDiretores] = useState<Diretor[]>([]);

  useEffect(() => {
    const fetchDiretores = async () => {
      try {
        const res = await fetch("/api/secretaria/professores");
        const json = await res.json();
        if (json.ok) {
          setDiretores(json.items);
        }
      } catch (e) {
        setError("Falha ao carregar diretores.");
      }
    };
    fetchDiretores();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const res = await fetch(`/api/secretaria/turmas/${turmaId}/diretor`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          diretor_turma_id: diretorTurma,
        }),
      });

      const json = await res.json();
      if (!res.ok || !json.ok) {
        throw new Error(json.error || "Falha ao definir diretor");
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
        <label htmlFor="diretorTurma" className="block text-sm font-medium text-gray-700">
          Diretor de Turma
        </label>
        <select
          id="diretorTurma"
          value={diretorTurma}
          onChange={(e) => setDiretorTurma(e.target.value)}
          className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-emerald-500 focus:ring-emerald-500 sm:text-sm"
          required
        >
          <option value="">Selecione um diretor</option>
          {diretores.map((diretor) => (
            <option key={diretor.user_id} value={diretor.user_id}>
              {diretor.nome}
            </option>
          ))}
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
          {loading ? "Salvando..." : "Salvar"}
        </button>
      </div>
    </form>
  );
}
