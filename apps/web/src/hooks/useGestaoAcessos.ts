"use client";

import { useEffect, useState, useCallback } from "react";

export type AlunoAcesso = {
  id: string;
  nome: string;
  numero_processo: string | null;
  acesso_liberado: boolean;
  acesso_bloqueado: boolean;
  status: string;
  codigo_ativacao: string | null;
  created_at: string;
  data_ativacao: string | null;
  ultimo_reset_senha: string | null;
  motivo_bloqueio: string | null;
  bloqueado_em: string | null;
  bloqueado_por_nome: string | null;
  last_login: string | null;
  inadimplente?: boolean;
  dias_atraso?: number;
};

type UseGestaoAcessosProps = {
  escolaId: string;
  tab: "pendentes" | "ativos" | "bloqueados";
  search?: string;
  turmaId?: string | null;
};

export function useGestaoAcessos({ escolaId, tab, search, turmaId }: UseGestaoAcessosProps) {
  const [items, setItems] = useState<AlunoAcesso[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchItems = useCallback(async () => {
    if (!escolaId) return;
    
    setLoading(true);
    setError(null);
    
    try {
      const params = new URLSearchParams({
        escolaId,
        tab,
        search: search || "",
      });
      if (turmaId) params.append("turmaId", turmaId);

      const res = await fetch(`/api/secretaria/alunos/gestao-acessos?${params.toString()}`);
      const json = await res.json();

      if (!res.ok || !json.ok) {
        throw new Error(json.error || "Falha ao carregar acessos");
      }

      setItems(json.items || []);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [escolaId, tab, search, turmaId]);

  useEffect(() => {
    fetchItems();
  }, [fetchItems]);

  return { items, loading, error, refetch: fetchItems };
}
