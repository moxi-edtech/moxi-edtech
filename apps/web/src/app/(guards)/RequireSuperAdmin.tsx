"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabaseClient";

export default function RequireSuperAdmin({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const supabase = createClient();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let active = true;

    (async () => {
      const { data: { user }, error } = await supabase.auth.getUser();

      if (error || !user) {
        router.replace("/login");
        return;
      }

      if (active) setReady(true);
    })();

    return () => {
      active = false;
    };
  }, [router, supabase]);

  if (!ready) {
    return <div className="p-6">🔒 Verificando sessão...</div>;
  }

  return <>{children}</>;
}
