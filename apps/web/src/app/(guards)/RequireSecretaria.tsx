"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabaseClient";

export default function RequireSecretaria({
  children,
  escolaId,
}: {
  children: React.ReactNode;
  escolaId?: string | null;
}) {
  const router = useRouter();
  const supabase = createClient();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let active = true;
    (async () => {
      const { data: userRes, error: userErr } = await supabase.auth.getUser();
      const user = userRes?.user;
      if (userErr || !user) { router.replace("/login"); return; }

      const vinculoQuery = supabase
        .from("escola_users")
        .select("*")
        .eq("user_id", user.id);

      if (escolaId) {
        vinculoQuery.eq("escola_id", escolaId);
      }

      const { data: vinculos, error } = await vinculoQuery.limit(10);
      const hasSecretaria = (vinculos || []).some((v: any) => {
        const papel = (v as any)?.papel ?? (v as any)?.role ?? null;
        return papel === "secretaria" || papel === "admin";
      });
      if (error || !hasSecretaria) { router.replace("/"); return; }

      if (active) setReady(true);
    })();
    return () => { active = false };
  }, [router, supabase]);

  if (!ready) return <div className="p-6">🔒 Verificando permissões da secretaria...</div>;
  return <>{children}</>;
}
