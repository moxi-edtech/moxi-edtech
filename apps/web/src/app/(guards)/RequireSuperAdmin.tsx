"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabaseClient";

// Observação:
// O middleware (src/middleware.ts) já garante o acesso apenas a super_admin
// para qualquer rota em /super-admin. Para evitar chamadas de rede no cliente
// (que estavam falhando com "TypeError: Failed to fetch"), este guard apenas
// verifica se há sessão localmente e deixa o middleware cuidar de permissões.

export default function RequireSuperAdmin({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const supabase = createClient();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let active = true;

    (async () => {
      const { data: { session }, error } = await supabase.auth.getSession();

      if (error || !session?.user) {
        router.replace("/login");
        return;
      }

      if (active) setReady(true);
    })();

    return () => { active = false; };
  }, [router, supabase]);

  if (!ready) {
    return <div className="p-6">🔒 Verificando sessão...</div>;
  }

  return <>{children}</>;
}
