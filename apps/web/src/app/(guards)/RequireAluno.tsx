"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabaseClient";

export default function RequireAluno({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const supabase = createClient();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let active = true;

    (async () => {
      const { data: userRes, error: userErr } = await supabase.auth.getUser();
      const user = userRes?.user;
      if (userErr || !user) {
        router.replace("/login");
        return;
      }

      // Check vínculo do usuário como aluno em alguma escola
      const { data: vinculos, error } = await supabase
        .from("escola_usuarios")
        .select("id, papel")
        .eq("user_id", user.id)
        .eq("papel", "aluno")
        .limit(1);

      if (error || !vinculos || vinculos.length === 0) {
        router.replace("/");
        return;
      }

      if (active) setReady(true);
    })();

    return () => {
      active = false;
    };
  }, [router, supabase]);

  if (!ready) {
    return <div className="p-6">🔒 Verificando permissões do aluno...</div>;
  }

  return <>{children}</>;
}

