"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";
import type { Database } from "~types/supabase";

export type PagamentoPendenteRow = {
  pagamento_id: string;
  escola_id: string;
  mensalidade_id: string;
  aluno_id: string;
  aluno_nome: string;
  turma_codigo: string | null;
  valor_esperado: number;
  valor_enviado: number;
  comprovante_url: string | null;
  mensagem_aluno: string | null;
  reference: string | null;
  metodo: string | null;
  created_at: string;
};

type ValidarPagamentoReturn = {
  ok?: boolean;
  error?: string;
};

type ValidarPagamentoRpc = (
  fn: "validar_pagamento",
  args: { p_pagamento_id: string; p_aprovado: boolean; p_mensagem_secretaria?: string | null },
) => Promise<{ data: ValidarPagamentoReturn | null; error: { message: string } | null }>;

type ExtendedDatabase = Omit<Database, "public"> & {
  public: Omit<Database["public"], "Views" | "Functions"> & {
    Views: Database["public"]["Views"] & {
      vw_pagamentos_pendentes: {
        Row: PagamentoPendenteRow;
      };
    };
    Functions: Database["public"]["Functions"] & {
      validar_pagamento: {
        Args: {
          p_pagamento_id: string;
          p_aprovado: boolean;
          p_mensagem_secretaria?: string | null;
        };
        Returns: ValidarPagamentoReturn;
      };
    };
  };
};

export function usePagamentosPendentes(pageSize = 20) {
  const supabase = useMemo(
    () => createClient() as unknown as SupabaseClient<ExtendedDatabase>,
    [],
  );
  const [rows, setRows] = useState<PagamentoPendenteRow[]>([]);
  const [page, setPage] = useState(0);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actioningById, setActioningById] = useState<Record<string, boolean>>({});

  const load = useCallback(
    async (targetPage: number) => {
      setLoading(true);
      setError(null);

      const from = targetPage * pageSize;
      const to = from + pageSize - 1;

      const { data, count, error: queryError } = await supabase
        .from("vw_pagamentos_pendentes")
        .select("*", { count: "exact" })
        .order("created_at", { ascending: false })
        .range(from, to);

      if (queryError) {
        setRows([]);
        setTotal(0);
        setError(queryError.message || "Falha ao carregar pagamentos pendentes.");
      } else {
        setRows((data as PagamentoPendenteRow[]) ?? []);
        setTotal(count ?? 0);
      }

      setLoading(false);
    },
    [pageSize, supabase],
  );

  useEffect(() => {
    void load(page);
  }, [load, page]);

  const validar = useCallback(
    async (pagamentoId: string, aprovado: boolean, mensagemSecretaria?: string | null) => {
      if (actioningById[pagamentoId]) {
        return { ok: false, error: "Ação já em andamento." };
      }

      const snapshot = rows;
      const target = snapshot.find((row) => row.pagamento_id === pagamentoId);
      if (!target) {
        return { ok: false, error: "Pagamento não encontrado na listagem." };
      }

      setActioningById((prev) => ({ ...prev, [pagamentoId]: true }));
      setRows((prev) => prev.filter((row) => row.pagamento_id !== pagamentoId));

      const { data, error: rpcError } = await supabase.rpc("validar_pagamento", {
        p_pagamento_id: pagamentoId,
        p_aprovado: aprovado,
        p_mensagem_secretaria: mensagemSecretaria ?? undefined,
      });

      const rpcData = (data as ValidarPagamentoReturn) || {};

      if (rpcError || rpcData.ok !== true) {
        setRows(snapshot);
        setActioningById((prev) => ({ ...prev, [pagamentoId]: false }));
        
        const errorMsg = rpcError?.message || rpcData.error || "Falha ao validar pagamento.";
        console.error("[usePagamentosPendentes] Erro na validação:", { rpcError, rpcData });

        return {
          ok: false,
          error: errorMsg,
        };
      }

      setTotal((prev) => Math.max(0, prev - 1));
      setActioningById((prev) => ({ ...prev, [pagamentoId]: false }));
      return { ok: true };
    },
    [actioningById, rows, supabase],
  );

  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const canPrev = page > 0;
  const canNext = page + 1 < pageCount;

  return {
    rows,
    total,
    page,
    pageCount,
    loading,
    error,
    actioningById,
    canPrev,
    canNext,
    setPage,
    reload: () => load(page),
    validar,
  };
}
