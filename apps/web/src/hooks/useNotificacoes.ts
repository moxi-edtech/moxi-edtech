"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";

export type Prioridade = "info" | "aviso" | "urgente";
export type Gatilho = "H" | "S";
export type TipoNotificacao = "I" | "A";

export interface Notificacao {
  id: string;
  evento_id: string;
  titulo: string;
  corpo: string | null;
  prioridade: Prioridade;
  action_label: string | null;
  action_url: string | null;
  gatilho: Gatilho | null;
  tipo: TipoNotificacao | null;
  modal_id: string | null;
  agrupamento_chave: string | null;
  arquivada: boolean;
  arquivada_em: string | null;
  lida: boolean;
  lida_em: string | null;
  created_at: string;
}

type UseNotificacoesReturn = {
  notificacoes: Notificacao[];
  naoLidas: number;
  loading: boolean;
  marcarLida: (id: string) => Promise<void>;
  marcarTodasLidas: () => Promise<void>;
  refresh: () => Promise<void>;
};

const NOTIFICACOES_POLL_MS = 30_000;
const REALTIME_ENABLED = process.env.NEXT_PUBLIC_SUPABASE_REALTIME_ENABLED === "true";

const isAbortLikeError = (error: unknown) => {
  const record = error as { message?: unknown; details?: unknown; name?: unknown } | null;
  const text = [
    record?.name,
    record?.message,
    record?.details,
    error instanceof Error ? error.message : null,
  ]
    .filter(Boolean)
    .join(" ");

  return /AbortError|aborted/i.test(text);
};

export function useNotificacoes(): UseNotificacoesReturn {
  const supabase = useMemo(() => createClient(), []);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const [notificacoes, setNotificacoes] = useState<Notificacao[]>([]);
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);

  const fetchNotificacoes = useCallback(async () => {
    const { data, error } = await supabase
      .from("notificacoes")
      .select(
        "id, evento_id, titulo, corpo, prioridade, action_label, action_url, gatilho, tipo, modal_id, agrupamento_chave, arquivada, arquivada_em, lida, lida_em, created_at"
      )
      .eq("arquivada", false)
      .order("created_at", { ascending: false })
      .limit(50);

    if (error) {
      console.error("[useNotificacoes] fetch error:", error.message);
      return;
    }

    setNotificacoes((data ?? []) as Notificacao[]);
    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    let active = true;
    const loadUser = async () => {
      const { data } = await supabase.auth.getUser();
      if (!active) return;
      setUserId(data?.user?.id ?? null);
      if (!data?.user) setLoading(false);
    };

    loadUser();

    return () => {
      active = false;
    };
  }, [supabase]);

  useEffect(() => {
    if (!userId) return;

    // Fix: Avoiding synchronous setState inside effect to satisfy lint/react rules
    // eslint-disable-next-line react-hooks/set-state-in-effect
    Promise.resolve().then(() => fetchNotificacoes());

    if (!REALTIME_ENABLED) {
      const interval = window.setInterval(() => {
        void fetchNotificacoes();
      }, NOTIFICACOES_POLL_MS);

      return () => window.clearInterval(interval);
    }

    const channel = supabase
      .channel("notificacoes-realtime")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "notificacoes",
          filter: `destinatario_id=eq.${userId}`,
        },
        (payload) => {
          const nova = payload.new as Notificacao;
          setNotificacoes((prev) => [nova, ...prev]);
        }
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "notificacoes",
          filter: `destinatario_id=eq.${userId}`,
        },
        (payload) => {
          const atualizada = payload.new as Notificacao;
          setNotificacoes((prev) =>
            prev.map((n) => (n.id === atualizada.id ? atualizada : n))
          );
        }
      )
      .subscribe();

    channelRef.current = channel;

    return () => {
      void supabase.removeChannel(channel).catch((error) => {
        if (!isAbortLikeError(error)) {
          console.warn("[useNotificacoes] removeChannel error:", error);
        }
      });
      channelRef.current = null;
    };
  }, [fetchNotificacoes, supabase, userId]);

  const marcarLida = useCallback(
    async (id: string) => {
      const timestamp = new Date().toISOString();
      setNotificacoes((prev) =>
        prev.map((n) => (n.id === id ? { ...n, lida: true, lida_em: timestamp } : n))
      );

    const { error } = await supabase
      .from("notificacoes")
      .update({ lida: true, lida_em: timestamp })
      .eq("id", id)
      .eq("arquivada", false);

      if (error) {
        console.error("[useNotificacoes] marcarLida error:", error.message);
        await fetchNotificacoes();
      }
    },
    [fetchNotificacoes, supabase]
  );

  const marcarTodasLidas = useCallback(async () => {
    const timestamp = new Date().toISOString();
    setNotificacoes((prev) => prev.map((n) => ({ ...n, lida: true, lida_em: timestamp })));

    const { error } = await supabase
      .from("notificacoes")
      .update({ lida: true, lida_em: timestamp })
      .eq("lida", false)
      .eq("arquivada", false);

    if (error) {
      console.error("[useNotificacoes] marcarTodasLidas error:", error.message);
      await fetchNotificacoes();
    }
  }, [fetchNotificacoes, supabase]);

  const naoLidas = notificacoes.filter((n) => !n.lida).length;

  return {
    notificacoes,
    naoLidas,
    loading,
    marcarLida,
    marcarTodasLidas,
    refresh: fetchNotificacoes,
  };
}
