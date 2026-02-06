"use client";

import { useEffect, useState } from "react";

type AlunoSemAcesso = {
  id: string;
  nome: string;
  codigo_ativacao: string | null;
  criado_em: string | null;
  telefone: string | null;
};

export function useAlunosSemAcesso(escolaId: string | null) {
  const [alunos, setAlunos] = useState<AlunoSemAcesso[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!escolaId) return;
    let cancelled = false;

    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(
          `/api/secretaria/alunos/sem-acesso?escolaId=${encodeURIComponent(escolaId)}`
        );
        const json = await res.json();
        if (cancelled) return;
        if (!json?.ok) throw new Error(json?.error || "Falha ao carregar");
        setAlunos(json.items || []);
      } catch (err) {
        if (!cancelled) setError((err as Error).message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    load();

    return () => {
      cancelled = true;
    };
  }, [escolaId]);

  const refetch = () => {
    if (!escolaId) return;
    setLoading(true);
    setError(null);
    fetch(`/api/secretaria/alunos/sem-acesso?escolaId=${encodeURIComponent(escolaId)}`)
      .then((res) => res.json())
      .then((json) => {
        if (!json?.ok) throw new Error(json?.error || "Falha ao carregar");
        setAlunos(json.items || []);
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  };

  return { alunos, loading, error, refetch };
}
