"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabaseClient";

type UseUserResult = {
  user: any;
  escola: { id: string | null; plano_atual?: string | null } | null;
  loading: boolean;
  error: string | null;
};

export function useUser(): UseUserResult {
  const [user, setUser] = useState<any>(null);
  const [escola, setEscola] = useState<UseUserResult["escola"]>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    const supabase = createClient();

    (async () => {
      try {
        setLoading(true);
        setError(null);

        const { data: userData, error: userError } = await supabase.auth.getUser();
        if (sessionError) throw sessionError;

        const user = userData?.user;
        if (!active) return;

        setUser(currentUser);

        const escolaId =
          ((currentUser?.app_metadata as any)?.escola_id as string | undefined) ??
          null;

        if (escolaId) {
          setEscola({ id: escolaId, plano_atual: (currentUser as any)?.escola?.plano_atual });
          return;
        }

        if (currentUser?.id) {
          const { data: profile } = await supabase
            .from("profiles")
            .select("escola_id, current_escola_id")
            .eq("user_id", currentUser.id)
            .maybeSingle();

          if (!active) return;

          const resolvedId =
            (profile as any)?.current_escola_id ?? (profile as any)?.escola_id ?? null;
          setEscola(resolvedId ? { id: String(resolvedId), plano_atual: null } : null);
        } else {
          setEscola(null);
        }
      } catch (e) {
        if (!active) return;
        setError(e instanceof Error ? e.message : "Erro ao carregar usuário");
        setUser(null);
        setEscola(null);
      } finally {
        if (active) setLoading(false);
      }
    })();

    return () => {
      active = false;
    };
  }, []);

  return { user, escola, loading, error };
}
