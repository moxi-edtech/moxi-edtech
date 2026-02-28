"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabaseClient";
import { isSuperAdminRole } from "@/lib/auth/requireSuperAdminAccess";

export default function RequireSuperAdmin({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const supabase = createClient();
  const [status, setStatus] = useState<"loading" | "authed" | "denied">("loading");

  useEffect(() => {
    let active = true;

    (async () => {
      const { data: { user }, error: authError } = await supabase.auth.getUser();

      if (authError || !user) {
        router.replace("/login");
        return;
      }

      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("role")
        .eq("user_id", user.id)
        .single();

      if (profileError || !profile) {
        console.error("Erro ao buscar perfil:", profileError);
        if (active) setStatus("denied");
        return;
      }

      if (isSuperAdminRole(profile.role)) {
        if (active) setStatus("authed");
      } else {
        if (active) setStatus("denied");
      }
    })();

    return () => {
      active = false;
    };
  }, [router, supabase]);

  if (status === "loading") {
    return <div className="p-6">🔒 Verificando permissões...</div>;
  }

  if (status === "denied") {
    return <div className="p-6">🚫 Acesso negado. Requer privilégios de Super Admin.</div>;
  }

  return <>{children}</>;
}
