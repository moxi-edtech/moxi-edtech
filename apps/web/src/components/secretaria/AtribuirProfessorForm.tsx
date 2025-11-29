"use client";

import { useState, useEffect } from "react";

interface AtribuirProfessorFormProps {
  turmaId: string;
  onSuccess: () => void;
}

interface Disciplina {
  id: string;
  nome: string;
}

interface Professor {
  id: string;
  nome: string;
}

export default function AtribuirProfessorForm({ turmaId, onSuccess }: AtribuirProfessorFormProps) {
  const [disciplinaId, setDisciplinaId] = useState("");
  const [professorId, setProfessorId] = useState("");
  const [horarios, setHorarios] = useState("");
  const [planejamento, setPlanejamento] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [disciplinas, setDisciplinas] = useState<Disciplina[]>([]);
  const [professores, setProfessores] = useState<Professor[]>([]);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [disciplinasRes, professoresRes] = await Promise.all([
          fetch("/api/secretaria/disciplinas"),
          fetch("/api/secretaria/professores"),
        ]);
        const [disciplinasJson, professoresJson] = await Promise.all([
          disciplinasRes.json(),
          professoresRes.json(),
        ]);
        if (disciplinasJson.ok) {
          setDisciplinas(disciplinasJson.items);
        }
        if (professoresJson.ok) {
          setProfessores(professoresJson.items);
        }
      } catch (e) {
        setError("Falha ao carregar dados.");
      }
    };
    fetchData();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const res = await fetch(`/api/secretaria/turmas/${turmaId}/atribuir-professor`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          disciplina_id: disciplinaId,
          professor_id: professorId,
          horarios,
          planejamento,
        }),
      });

      const json = await res.json();
      if (!res.ok || !json.ok) {
        throw new Error(json.error || "Falha ao atribuir professor");
      }

      onSuccess();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4 p-4 border rounded-md bg-slate-50">
        <div className="grid grid-cols-2 gap-4">
            <div>
                <label htmlFor="disciplina" className="block text-sm font-medium text-gray-700">
                Disciplina
                </label>
                <select
                id="disciplina"
                value={disciplinaId}
                onChange={(e) => setDisciplinaId(e.target.value)}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-emerald-500 focus:ring-emerald-500 sm:text-sm"
                required
                >
                <option value="">Selecione uma disciplina</option>
                {disciplinas.map((disciplina) => (
                    <option key={disciplina.id} value={disciplina.id}>
                    {disciplina.nome}
                    </option>
                ))}
                </select>
            </div>
            <div>
                <label htmlFor="professor" className="block text-sm font-medium text-gray-700">
                Professor
                </label>
                <select
                id="professor"
                value={professorId}
                onChange={(e) => setProfessorId(e.target.value)}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-emerald-500 focus:ring-emerald-500 sm:text-sm"
                required
                >
                <option value="">Selecione um professor</option>
                {professores.map((professor) => (
                    <option key={professor.id} value={professor.id}>
                    {professor.nome}
                    </option>
                ))}
                </select>
            </div>
        </div>
      <div>
        <label htmlFor="horarios" className="block text-sm font-medium text-gray-700">
          Horários
        </label>
        <textarea
            id="horarios"
            value={horarios}
            onChange={(e) => setHorarios(e.target.value)}
            rows={3}
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-emerald-500 focus:ring-emerald-500 sm:text-sm"
        />
      </div>
      <div>
        <label htmlFor="planejamento" className="block text-sm font-medium text-gray-700">
            Planejamento
        </label>
        <textarea
            id="planejamento"
            value={planejamento}
            onChange={(e) => setPlanejamento(e.target.value)}
            rows={3}
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-emerald-500 focus:ring-emerald-500 sm:text-sm"
        />
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
