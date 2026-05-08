"use client";

import { useEffect, useState } from "react";

type Turma = {
  id: string;
  nome: string;
  turma_codigo: string;
  curso_nome: string;
  classe_nome: string;
};

export function useTurmas(escolaId: string | null) {
  const [turmas, setTurmas] = useState<Turma[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!escolaId) return;
    let cancelled = false;

    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/secretaria/turmas?escolaId=${encodeURIComponent(escolaId)}&limit=100`);
        const json = await res.json();
        if (cancelled) return;
        if (!json?.ok) throw new Error(json?.error || "Falha ao carregar turmas");
        setTurmas(json.items || []);
      } catch (err: any) {
        if (!cancelled) setError(err.message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    load();

    return () => {
      cancelled = true;
    };
  }, [escolaId]);

  return { turmas, loading, error };
}
