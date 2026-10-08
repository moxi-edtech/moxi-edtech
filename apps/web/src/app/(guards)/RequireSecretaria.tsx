"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabaseClient";
import { roleMatchesAllowedRoles } from "@/lib/permissions";
import { isRefreshTokenNotFoundError } from "@/lib/auth/isRefreshTokenNotFoundError";
import { K12_SECRETARIA_OPERACIONAL_ROLE_GROUP } from "@/lib/roles";

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value.trim()
  );
}

export default function RequireSecretaria({
  children,
  escolaId: propsEscolaId,
}: {
  children: React.ReactNode;
  escolaId?: string | null;
}) {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const [ready, setReady] = useState(false);
  const [authUnavailable, setAuthUnavailable] = useState(false);

  useEffect(() => {
    let active = true;
    (async () => {
      // Validate against Supabase Auth instead of trusting transient browser session hydration.
      const { data: { user }, error: userErr } = await supabase.auth.getUser();
      
      if (isRefreshTokenNotFoundError(userErr) || (!user && !userErr)) {
        // Avoid the /redirect -> portal -> /redirect cycle on stale auth
        // cookies. The recovery route expires shared auth cookies once.
        if (active) window.location.replace("/auth-recover?next=/redirect");
        return;
      }
      if (userErr) {
        // A transient network/Auth outage must not clear a valid session or
        // trigger navigation loops. Leave the shell stable for an explicit retry.
        if (active) setAuthUnavailable(true);
        return;
      }

      // 2. Identify target school
      let targetEscolaId = propsEscolaId;
      if (targetEscolaId && !isUuid(targetEscolaId)) {
        const { data: escolaBySlug } = await supabase
          .from("escolas")
          .select("id")
          .eq("slug", targetEscolaId)
          .maybeSingle();
        targetEscolaId = escolaBySlug?.id ? String(escolaBySlug.id) : "";
      }

      // 3. Fast-track if we have any link (doesn't need to be exact for initial shell)
      const vinculoQuery = supabase
        .from("escola_users")
        .select("escola_id, papel, role")
        .eq("user_id", user.id);

      if (targetEscolaId) {
        vinculoQuery.eq("escola_id", targetEscolaId);
      }

      const { data: vinculos, error } = await vinculoQuery.limit(1);
      
      const hasSecretaria = (vinculos || []).some((v: any) => {
        const papel = v.papel ?? v.role ?? null;
        return roleMatchesAllowedRoles(
          papel,
          [
            ...K12_SECRETARIA_OPERACIONAL_ROLE_GROUP,
            "financeiro",
            "formacao_admin",
            "formacao_secretaria",
            "formacao_financeiro",
          ],
          "k12"
        );
      });

      if (error || !hasSecretaria) { 
        if (active) router.replace("/"); 
        return; 
      }

      if (active) setReady(true);
    })();
    return () => { active = false };
  }, [router, supabase, propsEscolaId]);

  // Use a softer loading state or none if we want instant feel (children will handle their own loading)
  if (authUnavailable) {
    return (
      <div role="alert" className="mx-auto max-w-lg rounded-lg border p-5 text-sm">
        Não foi possível validar a sessão. Verifique a ligação e atualize a página.
      </div>
    );
  }
  if (!ready) return null; 
  return <>{children}</>;
}
