"use client";

import { useState, useEffect } from "react";

interface Turma {
  id: string;
  nome: string;
}

interface Aluno {
  id: string;
  nome: string;
}

export default function RematriculaPage() {
  const [originTurmaId, setOriginTurmaId] = useState("");
  const [destinationTurmaId, setDestinationTurmaId] = useState("");
  const [turmas, setTurmas] = useState<Turma[]>([]);
  const [alunos, setAlunos] = useState<Aluno[]>([]);
  const [selectedAlunos, setSelectedAlunos] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

  useEffect(() => {
    const fetchAlunos = async () => {
      if (originTurmaId) {
        try {
          // This endpoint does not exist yet. I will create it later.
          const res = await fetch(`/api/secretaria/turmas/${originTurmaId}/alunos`);
          const json = await res.json();
          if (json.ok) {
            setAlunos(json.items);
          }
        } catch (e) {
          setError("Falha ao carregar alunos.");
        }
      } else {
        setAlunos([]);
      }
    };
    fetchAlunos();
  }, [originTurmaId]);

  const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.checked) {
      setSelectedAlunos(alunos.map((a) => a.id));
    } else {
      setSelectedAlunos([]);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/secretaria/rematricula", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          origin_turma_id: originTurmaId,
          destination_turma_id: destinationTurmaId,
          aluno_ids: selectedAlunos,
        }),
      });

      const json = await res.json();
      if (!res.ok || !json.ok) {
        throw new Error(json.error || "Falha ao realizar rematrícula em massa");
      }

      alert("Rematrícula em massa realizada com sucesso!");
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-white rounded-xl shadow border p-5">
      <h1 className="text-lg font-semibold mb-4">Rematrícula em Massa</h1>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label htmlFor="originTurma" className="block text-sm font-medium text-gray-700">
              Turma de Origem
            </label>
            <select
              id="originTurma"
              value={originTurmaId}
              onChange={(e) => setOriginTurmaId(e.target.value)}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-emerald-500 focus:ring-emerald-500 sm:text-sm"
              required
            >
              <option value="">Selecione uma turma</option>
              {turmas.map((turma) => (
                <option key={turma.id} value={turma.id}>
                  {turma.nome}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="destinationTurma" className="block text-sm font-medium text-gray-700">
              Turma de Destino
            </label>
            <select
              id="destinationTurma"
              value={destinationTurmaId}
              onChange={(e) => setDestinationTurmaId(e.target.value)}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-emerald-500 focus:ring-emerald-500 sm:text-sm"
              required
            >
              <option value="">Selecione uma turma</option>
              {turmas.map((turma) => (
                <option key={turma.id} value={turma.id}>
                  {turma.nome}
                </option>
              ))}
            </select>
          </div>
        </div>

        {alunos.length > 0 && (
          <div>
            <h2 className="text-md font-semibold mb-2">Alunos na Turma de Origem</h2>
            <div className="border rounded-md p-4 max-h-64 overflow-y-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr>
                    <th className="py-2 pr-4 text-left">
                      <input type="checkbox" onChange={handleSelectAll} />
                    </th>
                    <th className="py-2 pr-4 text-left">Nome</th>
                  </tr>
                </thead>
                <tbody>
                  {alunos.map((aluno) => (
                    <tr key={aluno.id}>
                      <td>
                        <input
                          type="checkbox"
                          value={aluno.id}
                          checked={selectedAlunos.includes(aluno.id)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedAlunos([...selectedAlunos, aluno.id]);
                            } else {
                              setSelectedAlunos(selectedAlunos.filter((id) => id !== aluno.id));
                            }
                          }}
                        />
                      </td>
                      <td className="py-2 pr-4">{aluno.nome}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {error && <p className="text-sm text-red-600">{error}</p>}

        <div className="flex justify-end">
          <button
            type="submit"
            disabled={loading || selectedAlunos.length === 0}
            className="inline-flex justify-center rounded-md border border-transparent bg-emerald-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 disabled:opacity-50"
          >
            {loading ? "Rematriculando..." : "Rematricular Selecionados"}
          </button>
        </div>
      </form>
    </div>
  );
}
