"use client";

import { useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { User } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabaseClient";
import { resolveEscolaIdForUser } from "@/lib/tenant/resolveEscolaIdForUser";

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

        async function next(user: User) {
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
          const resolvedEscolaId = escola_id || (await resolveEscolaIdForUser(supabase, user.id));

          // Roteamento por role
          if (escola_id && (role === "admin" || role === "staff_admin")) {
            const { data: esc } = await supabase
              .from("escolas")
              .select("onboarding_finalizado")
              .eq("id", escola_id)
              .limit(1);
            const e0 = (esc && esc.length > 0) ? esc[0] : { onboarding_finalizado: false };
            const done = Boolean(e0.onboarding_finalizado);
            router.replace(done ? `/escola/${escola_id}/admin` : `/escola/${escola_id}/onboarding`);
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
                const e0 = (esc && esc.length > 0) ? esc[0] : { onboarding_finalizado: false };
                const done = Boolean(e0.onboarding_finalizado);
                router.replace(done ? `/escola/${escola_id}/admin` : `/escola/${escola_id}/onboarding`);
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
              const escolaId = (prof2 && prof2.length > 0) ? prof2[0]?.escola_id : null;
              if (escolaId) {
                const { data: esc } = await supabase
                  .from("escolas")
                  .select("aluno_portal_enabled")
                  .eq("id", escolaId)
                  .limit(1);
                const enabled = Boolean(esc && esc.length > 0 && esc[0]?.aluno_portal_enabled);
                router.replace(enabled ? "/aluno" : "/aluno/desabilitado");
              } else {
                router.replace("/aluno");
              }
              break;
            }
            case "secretaria":
              if (resolvedEscolaId) {
                router.replace(`/escola/${resolvedEscolaId}/secretaria`);
              } else {
                router.replace("/secretaria");
              }
              break;
            case "financeiro":
              router.replace("/financeiro");
              break;
            case "secretaria_financeiro": {
              if (resolvedEscolaId) {
                let modo = 'balcao'
                try {
                  const saved = localStorage.getItem('klasse_modo_secretaria')
                  if (saved === 'balcao' || saved === 'financeiro') modo = saved
                } catch {}
                router.replace(`/escola/${resolvedEscolaId}/secretaria?modo=${modo}`)
              } else {
                router.replace('/secretaria')
              }
              break;
            }
            case "admin_financeiro":
              if (resolvedEscolaId) {
                router.replace(`/escola/${resolvedEscolaId}/admin/dashboard?tab=financeiro`)
              } else {
                router.replace('/admin')
              }
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
