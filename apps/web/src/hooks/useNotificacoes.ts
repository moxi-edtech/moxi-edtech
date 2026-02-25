"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";

export type Prioridade = "info" | "aviso" | "urgente";

export interface Notificacao {
  id: string;
  evento_id: string;
  titulo: string;
  corpo: string | null;
  prioridade: Prioridade;
  action_label: string | null;
  action_url: string | null;
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

export function useNotificacoes(): UseNotificacoesReturn {
  const supabase = createClient();
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const [notificacoes, setNotificacoes] = useState<Notificacao[]>([]);
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);

  const fetchNotificacoes = useCallback(async () => {
    const { data, error } = await supabase
      .from("notificacoes")
      .select(
        "id, evento_id, titulo, corpo, prioridade, action_label, action_url, lida, lida_em, created_at"
      )
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
    };

    loadUser();

    return () => {
      active = false;
    };
  }, [supabase]);

  useEffect(() => {
    if (!userId) return;

    fetchNotificacoes();

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
      supabase.removeChannel(channel);
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
        .eq("id", id);

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
      .eq("lida", false);

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
