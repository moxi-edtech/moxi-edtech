"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabaseClient";

// Definimos o tipo do perfil esperado
type Profile = {
  role: "super_admin" | "professor" | "aluno";
};

export default function RequireSuperAdmin({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const supabase = createClient();
  const [ok, setOk] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;

    (async () => {
      try {
        // 1. Verifica autenticação
        const {
          data: { user },
          error: userError,
        } = await supabase.auth.getUser();

        if (userError || !user) {
          router.replace("/login");
          return;
        }

        // 2. Verifica role direto na tabela profiles, tipado corretamente
        const { data: profile, error: profileError } = await supabase
          .from("profiles")
          .select("role")
          .eq("user_id", user.id)
          .maybeSingle<Profile>();

        if (profileError) {
          console.error("Erro ao buscar perfil:", profileError);
          router.replace("/");
          return;
        }

        if (profile?.role === "super_admin") {
          if (active) setOk(true);
          return;
        }

        // 3. Se não for super_admin, redireciona
        router.replace("/");
      } catch (err) {
        console.error("Erro inesperado:", err);
        router.replace("/");
      } finally {
        if (active) setLoading(false);
      }
    })();

    return () => {
      active = false;
    };
  }, [router, supabase]);

  if (loading) {
    return <div className="p-6">🔒 Verificando permissões...</div>;
  }

  return ok ? <>{children}</> : null;
}
