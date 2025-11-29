"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";

export default function ConfirmarRematriculaPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // In a real implementation, the suggestions would be passed as props or fetched from a shared state
  const [sugestoes, setSugestoes] = useState<any[]>([]);

  const handleSubmit = async () => {
    setLoading(true);
    setError(null);

    const promocoes = sugestoes
      .filter((s) => s.tipo === 'promocao' && s.destino)
      .map((s) => ({
        origem_turma_id: s.origem.id,
        destino_turma_id: s.destino.id,
      }));

    const concluir_turmas = sugestoes
      .filter((s) => s.tipo === 'conclusao')
      .map((s) => ({
        origem_turma_id: s.origem.id,
      }));

    try {
      const res = await fetch("/api/secretaria/rematricula/confirmar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          promocoes,
          concluir_turmas,
        }),
      });

      const json = await res.json();
      if (!res.ok || !json.ok) {
        throw new Error(json.error || "Falha ao confirmar rematrícula em massa");
      }

      alert("Rematrícula em massa confirmada com sucesso!");
      router.push("/secretaria/rematricula");
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  };

  // Fetch suggestions on mount for demonstration purposes
  useEffect(() => {
    const fetchSugestoes = async () => {
      setLoading(true);
      try {
        const res = await fetch("/api/secretaria/rematricula/sugestoes");
        const json = await res.json();
        if (json.ok) {
          setSugestoes(json.sugestoes);
        }
      } catch (e) {
        setError("Falha ao carregar sugestões.");
      } finally {
        setLoading(false);
      }
    };
    fetchSugestoes();
  }, []);

  return (
    <div className="bg-white rounded-xl shadow border p-5">
      <h1 className="text-lg font-semibold mb-4">Confirmar Rematrícula em Massa</h1>
      {error && <p className="text-sm text-red-600">{error}</p>}
      
      <div className="mb-4">
        <p>As seguintes ações serão executadas:</p>
        <ul className="list-disc list-inside">
          {sugestoes.map((s, i) => (
            <li key={i}>
              {s.tipo === 'promocao' ? `Promover alunos de ${s.origem.nome} para ${s.destino?.nome}` : `Concluir turma ${s.origem.nome}`}
            </li>
          ))}
        </ul>
      </div>

      <div className="flex justify-end">
        <button
          onClick={handleSubmit}
          disabled={loading || sugestoes.length === 0}
          className="inline-flex justify-center rounded-md border border-transparent bg-emerald-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 disabled:opacity-50"
        >
          {loading ? "Confirmando..." : "Confirmar Rematrícula"}
        </button>
      </div>
    </div>
  );
}
