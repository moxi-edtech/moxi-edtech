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
        .from("escola_users")
        .select("*")
        .eq("user_id", user.id)
        .limit(10);

      const hasAluno = (vinculos || []).some((v: any) => {
        const papel = (v as any)?.papel ?? (v as any)?.role ?? null;
        return papel === "aluno";
      });

      if (error || !hasAluno) {
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
