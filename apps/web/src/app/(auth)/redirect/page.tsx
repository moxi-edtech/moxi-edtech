"use client";

import { useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { User } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabaseClient";
import { resolveEscolaIdForUser } from "@/lib/tenant/resolveEscolaIdForUser";
import { resolveEscolaParam } from "@/lib/tenant/resolveEscolaParam";
import { shouldRouteToEscolaAdmin } from "@/lib/escola/onboardingGate";

function getFormacaoBaseUrl() {
  if (typeof window === "undefined") return "https://formacao.klasse.ao";
  const host = window.location.host.toLowerCase();
  if (
    host.startsWith("localhost") ||
    host.startsWith("127.0.0.1") ||
    host.endsWith(".localhost") ||
    host.endsWith(".lvh.me")
  ) {
    return "http://formacao.lvh.me:3002";
  }
  return "https://formacao.klasse.ao";
}

function getCentralLoginUrl() {
  if (typeof window === "undefined") return "https://auth.klasse.ao/login";
  const host = window.location.host.toLowerCase();
  if (
    host.startsWith("localhost") ||
    host.startsWith("127.0.0.1") ||
    host.endsWith(".localhost") ||
    host.endsWith(".lvh.me")
  ) {
    return "http://auth.lvh.me:3000/login";
  }
  return "https://auth.klasse.ao/login";
}

export default function RedirectPage() {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);

  useEffect(() => {
    let unsub: (() => void) | null = null;
    let timeout: NodeJS.Timeout | null = null;

    const goLogin = () => {
      console.warn("[Redirect] Auth timeout or failed resolution. Redirecting to Central Auth...");
      const returnTo = window.location.origin + "/redirect";
      window.location.replace(`${getCentralLoginUrl()}?redirect=${encodeURIComponent(returnTo)}`);
    };

    const resolve = async () => {
      console.info("[Redirect] Initializing auth resolution...");
      try {
        const shouldRouteToAdmin = async (escolaId: string) => {
          return shouldRouteToEscolaAdmin(supabase as any, escolaId);
        };

        // 🔑 sempre tenta pegar o usuário validado
        const { data: { user }, error: userError } = await supabase.auth.getUser();

        if (userError) {
          console.error("[Redirect] Supabase getUser error:", userError);
        }

        if (!user) {
          console.info("[Redirect] No user session found, waiting for auth state change...");
          const { data } = supabase.auth.onAuthStateChange(async (event) => {
            console.info(`[Redirect] Auth state changed: ${event}`);
            const { data: { user: u } } = await supabase.auth.getUser();
            if (u) {
              console.info("[Redirect] User detected after state change. Refreshing and continuing...");
              await router.refresh(); // 🔑 força sincronizar cookies no server
              await next(u);
            }
          });
          unsub = () => { 
            try { 
              console.info("[Redirect] Unsubscribing from auth state changes");
              data.subscription.unsubscribe(); 
            } catch {} 
          };

          // fallback em 5s → login (aumentado para dar mais fôlego em conexões lentas)
          timeout = setTimeout(goLogin, 5000);
        } else {
          console.info("[Redirect] Active session found for user:", user.id);
          await router.refresh(); // 🔑 força sincronizar cookies no server
          await next(user);
        }

        async function next(user: User) {
          console.info("[Redirect] Processing user routing...");
          // se tiver timeout/unsub → cancela
          if (timeout) clearTimeout(timeout);
          if (unsub) unsub();

          // Force password change flow
          if (user?.user_metadata?.must_change_password) {
            console.info("[Redirect] Forced password change required");
            window.location.replace("/mudar-senha");
            return;
          }

          // Perfil
          console.info("[Redirect] Fetching user profile...");
          const { data: rows, error: profileError } = await supabase
            .from("profiles")
            .select("role, escola_id, created_at")
            .eq("user_id", user.id)
            .order("created_at", { ascending: false })
            .limit(1);

          if (profileError) {
            console.error("[Redirect] Profile fetch error:", profileError);
          }

          const profile = rows?.[0] as { role?: string | null; escola_id?: string | null } | undefined;
          const role: string = profile?.role ?? "guest";
          const escola_id: string | null = profile?.escola_id ?? null;
          
          console.info(`[Redirect] Resolved role: ${role}, profile_escola_id: ${escola_id}`);

          const appMetadata = (user.app_metadata ?? {}) as Record<string, unknown>;
          const tenantType = String(
            appMetadata.tenant_type ??
              appMetadata.modelo_ensino ??
              ""
          )
            .trim()
            .toLowerCase();

          console.info(`[Redirect] Tenant type: ${tenantType}`);

          const resolvedEscolaId = escola_id || (await resolveEscolaIdForUser(supabase, user.id));
          const baseEscolaId = escola_id || resolvedEscolaId;
          const resolvedParam = baseEscolaId ? await resolveEscolaParam(supabase, baseEscolaId) : null;
          const escolaParam = resolvedParam?.slug ? resolvedParam.slug : baseEscolaId;
          
          console.info(`[Redirect] Resolved tenant context - ID: ${baseEscolaId}, Param: ${escolaParam}`);

          const isK12AdminRole =
            role === "admin" ||
            role === "admin_escola" ||
            role === "staff_admin";

          const isFormacaoRole =
            role === "formacao_admin" ||
            role === "formacao_secretaria" ||
            role === "formacao_financeiro" ||
            role === "formador" ||
            role === "formando";

          if (tenantType === "formacao" || isFormacaoRole) {
            const formacaoBaseUrl = getFormacaoBaseUrl();
            let target = `${formacaoBaseUrl}/meus-cursos`;

            if (
              role === "formacao_admin" ||
              role === "admin" ||
              role === "admin_escola" ||
              role === "staff_admin"
            ) {
              target = `${formacaoBaseUrl}/admin/dashboard`;
            } else if (role === "formacao_secretaria") {
              target = `${formacaoBaseUrl}/secretaria/catalogo-cursos`;
            } else if (role === "formacao_financeiro") {
              target = `${formacaoBaseUrl}/financeiro/dashboard`;
            } else if (role === "formador") {
              target = `${formacaoBaseUrl}/agenda`;
            }

            console.info(`[Redirect] Redirecting to Formacao Product: ${target}`);
            window.location.replace(target);
            return;
          }

          // Roteamento por role
          if (baseEscolaId && isK12AdminRole) {
            const done = await shouldRouteToAdmin(baseEscolaId);
            const path = done ? "admin" : "onboarding";
            const dest = escolaParam ? `/escola/${escolaParam}/${path}` : `/escola/${baseEscolaId}/${path}`;
            console.info(`[Redirect] K12 Admin routing to: ${dest}`);
            window.location.replace(dest);
            return;
          }

          let finalDest = "/";
          switch (role) {
            case "super_admin":
              finalDest = "/super-admin";
              break;
            case "admin":
            case "admin_escola":
            case "staff_admin":
              if (baseEscolaId) {
                const done = await shouldRouteToAdmin(baseEscolaId);
                const path = done ? "admin" : "onboarding";
                finalDest = escolaParam ? `/escola/${escolaParam}/${path}` : `/escola/${baseEscolaId}/${path}`;
              } else {
                finalDest = "/admin";
              }
              break;
            case "professor":
              finalDest = "/professor";
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
                finalDest = enabled ? "/aluno" : "/aluno/desabilitado";
              } else {
                finalDest = "/aluno";
              }
              break;
            }
            case "secretaria":
              finalDest = escolaParam ? `/escola/${escolaParam}/secretaria` : "/secretaria";
              break;
            case "financeiro":
              finalDest = "/financeiro";
              break;
            case "secretaria_financeiro":
              finalDest = escolaParam ? `/escola/${escolaParam}/secretaria` : "/secretaria";
              break;
            case "admin_financeiro":
              finalDest = escolaParam ? `/escola/${escolaParam}/admin/dashboard` : "/admin";
              break;
            default:
              finalDest = "/";
              break;
          }
          console.info(`[Redirect] Final routing destination: ${finalDest}`);
          window.location.replace(finalDest);
        }
      } catch (err) {
        console.error("[Redirect] Critical error during resolution:", err);
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
