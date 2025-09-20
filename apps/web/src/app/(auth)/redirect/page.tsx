"use client";

import { useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabaseClient";

export default function RedirectPage() {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);

  useEffect(() => {
    let unsub: (() => void) | null = null;
    let timeout: NodeJS.Timeout | null = null;

    const goLogin = () => router.replace("/login");

    const resolve = async () => {
      try {
        // 🔑 sempre tenta pegar o usuário validado
        const { data: { user } } = await supabase.auth.getUser();

        if (!user) {
          // Espera onAuthStateChange em caso de fresh redirect (magic link ou primeiro login)
          const { data } = supabase.auth.onAuthStateChange(async () => {
            const { data: { user: u } } = await supabase.auth.getUser();
            if (u) {
              await router.refresh(); // 🔑 força sincronizar cookies no server
              await next(u);
            }
          });
          unsub = () => { try { data.subscription.unsubscribe(); } catch {} };

          // fallback em 3s → login
          timeout = setTimeout(goLogin, 3000);
        } else {
          await router.refresh(); // 🔑 força sincronizar cookies no server
          await next(user);
        }

        async function next(user: any) {
          // se tiver timeout/unsub → cancela
          if (timeout) clearTimeout(timeout);
          if (unsub) unsub();

          // Force password change flow
          if (user?.user_metadata?.must_change_password) {
            router.replace("/mudar-senha");
            return;
          }

          // Perfil
          const { data: rows } = await supabase
            .from("profiles")
            .select("role, escola_id, created_at")
            .eq("user_id", user.id)
            .order("created_at", { ascending: false })
            .limit(1);

          const profile = rows?.[0] as { role?: string | null; escola_id?: string | null } | undefined;
          const role: string = profile?.role ?? "guest";
          const escola_id: string | null = profile?.escola_id ?? null;

          // Roteamento por role
          if (escola_id && (role === "admin" || role === "staff_admin")) {
            const { data: esc } = await supabase
              .from("escolas")
              .select("onboarding_finalizado")
              .eq("id", escola_id)
              .limit(1);
            const done = Boolean((esc?.[0] as any)?.onboarding_finalizado);
            router.replace(done ? `/escola/${escola_id}/admin/dashboard` : `/escola/${escola_id}/onboarding`);
            return;
          }

          switch (role) {
            case "super_admin":
              router.replace("/super-admin");
              break;
            case "admin":
              if (escola_id) {
                const { data: esc } = await supabase
                  .from("escolas")
                  .select("onboarding_finalizado")
                  .eq("id", escola_id)
                  .limit(1);
                const done = Boolean((esc?.[0] as any)?.onboarding_finalizado);
                router.replace(done ? `/escola/${escola_id}/admin/dashboard` : `/escola/${escola_id}/onboarding`);
              } else {
                router.replace("/admin");
              }
              break;
            case "professor":
              router.replace("/professor");
              break;
            case "aluno": {
              const { data: prof2 } = await supabase
                .from("profiles")
                .select("escola_id")
                .eq("user_id", user.id)
                .order("created_at", { ascending: false })
                .limit(1);
              const escolaId = (prof2?.[0] as any)?.escola_id ?? null;
              if (escolaId) {
                const { data: esc } = await supabase
                  .from("escolas")
                  .select("aluno_portal_enabled")
                  .eq("id", escolaId)
                  .limit(1);
                const enabled = Boolean((esc?.[0] as any)?.aluno_portal_enabled);
                router.replace(enabled ? "/aluno" : "/aluno/desabilitado");
              } else {
                router.replace("/aluno");
              }
              break;
            }
            case "secretaria":
              router.replace("/secretaria");
              break;
            case "financeiro":
              router.replace("/financeiro");
              break;
            default:
              router.replace("/");
              break;
          }
        }
      } catch {
        goLogin();
      }
    };

    resolve();

    return () => {
      if (unsub) unsub();
      if (timeout) clearTimeout(timeout);
    };
  }, [router, supabase]);

  return (
    <div className="min-h-screen flex items-center justify-center text-moxinexa-gray">
      Redirecionando...
    </div>
  );
}
