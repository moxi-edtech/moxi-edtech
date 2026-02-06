"use client";

import { useEffect, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabaseClient";

export type UserMetadata = {
  escola_id?: string | null;
  escola?: { plano_atual?: string | null } | null;
};

type UseUserResult = {
  user: User | null;
  escola: { id: string | null; plano_atual?: string | null } | null;
  loading: boolean;
  error: string | null;
};

export function useUser(): UseUserResult {
  const [user, setUser] = useState<User | null>(null);
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
        if (userError) throw userError;

        const user = userData?.user;
        if (!active) return;

        setUser(user);

        const metadata = user?.app_metadata as UserMetadata | undefined;
        const escolaId = (metadata?.escola_id as string | undefined) ?? null;

        if (escolaId) {
          setEscola({ id: escolaId, plano_atual: metadata?.escola?.plano_atual ?? null });
          return;
        }

        if (user?.id) {
          const { data: profile } = await supabase
            .from("profiles")
            .select("escola_id, current_escola_id")
            .eq("user_id", user.id)
            .maybeSingle();

          if (!active) return;

          const resolvedId =
            (profile as { current_escola_id?: string | null; escola_id?: string | null } | null)
              ?.current_escola_id ??
            (profile as { escola_id?: string | null } | null)?.escola_id ??
            null;
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
