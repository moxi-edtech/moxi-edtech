"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabaseClient";

type UseEscolaIdState = {
  escolaId: string | null;
  isLoading: boolean;
  error: string | null;
};

export function useEscolaId(): UseEscolaIdState {
  const [escolaId, setEscolaId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    const supabase = createClient();

    (async () => {
      try {
        setIsLoading(true);
        setError(null);

        const { data: userData } = await supabase.auth.getUser();
        const user = userData?.user;
        if (!user) {
          if (active) setEscolaId(null);
          return;
        }

        const { data: prof } = await supabase
          .from("profiles")
          .select("current_escola_id, escola_id")
          .eq("user_id", user.id)
          .order("created_at", { ascending: false })
          .limit(1);
        const fromProfile = (prof?.[0] as any)?.current_escola_id || (prof?.[0] as any)?.escola_id;
        if (fromProfile) {
          if (active) setEscolaId(String(fromProfile));
          return;
        }

        const metaEscola = (user.app_metadata as any)?.escola_id as string | undefined;
        if (metaEscola) {
          if (active) setEscolaId(String(metaEscola));
          return;
        }

        const { data: vinc } = await supabase
          .from("escola_users")
          .select("escola_id")
          .eq("user_id", user.id)
          .limit(1);
        const fromLink = (vinc?.[0] as any)?.escola_id;
        if (active) setEscolaId(fromLink ? String(fromLink) : null);
      } catch (e) {
        if (active) setError(e instanceof Error ? e.message : "Erro ao resolver escola");
      } finally {
        if (active) setIsLoading(false);
      }
    })();

    return () => {
      active = false;
    };
  }, []);

  return { escolaId, isLoading, error };
}
