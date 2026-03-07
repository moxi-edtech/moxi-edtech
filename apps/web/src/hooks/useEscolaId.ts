"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabaseClient";

type UseEscolaIdState = {
  escolaId: string | null;
  escolaSlug: string | null;
  isLoading: boolean;
  error: string | null;
};

export function useEscolaId(): UseEscolaIdState {
  const [escolaId, setEscolaId] = useState<string | null>(null);
  const [escolaSlug, setEscolaSlug] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    const supabase = createClient();

    const loadSlug = async (resolvedId: string) => {
      try {
        const { data } = await supabase
          .from("escolas")
          .select("slug")
          .eq("id", resolvedId)
          .maybeSingle();
        if (active) setEscolaSlug(data?.slug ? String(data.slug) : null);
      } catch {
        if (active) setEscolaSlug(null);
      }
    };

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
          const resolved = String(fromProfile);
          if (active) setEscolaId(resolved);
          await loadSlug(resolved);
          return;
        }

        const metaEscola = (user.app_metadata as any)?.escola_id as string | undefined;
        if (metaEscola) {
          const resolved = String(metaEscola);
          if (active) setEscolaId(resolved);
          await loadSlug(resolved);
          return;
        }

        const { data: vinc } = await supabase
          .from("escola_users")
          .select("escola_id")
          .eq("user_id", user.id)
          .limit(1);
        const fromLink = (vinc?.[0] as any)?.escola_id;
        const resolved = fromLink ? String(fromLink) : null;
        if (active) setEscolaId(resolved);
        if (resolved) {
          await loadSlug(resolved);
        } else if (active) {
          setEscolaSlug(null);
        }
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

  return { escolaId, escolaSlug, isLoading, error };
}
