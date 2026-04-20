"use client";

import { useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { User } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabaseClient";
import { resolveEscolaIdForUser } from "@/lib/tenant/resolveEscolaIdForUser";
import { resolveEscolaParam } from "@/lib/tenant/resolveEscolaParam";

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

export default function RedirectPage() {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);

  useEffect(() => {
    let unsub: (() => void) | null = null;
    let timeout: NodeJS.Timeout | null = null;

    const goLogin = () => router.replace("/login");

    const resolve = async () => {
      try {
        const shouldRouteToAdmin = async (escolaId: string) => {
          const [{ data: escola }, { data: anoAtivoRows }] = await Promise.all([
            supabase
              .from("escolas")
              .select("onboarding_finalizado")
              .eq("id", escolaId)
              .maybeSingle(),
            supabase
              .from("anos_letivos")
              .select("id")
              .eq("escola_id", escolaId)
              .eq("ativo", true)
              .limit(1),
          ]);

          const onboardingDone = Boolean(escola?.onboarding_finalizado);
          const hasAnoLetivoAtivo = Array.isArray(anoAtivoRows) && anoAtivoRows.length > 0;
          return onboardingDone || hasAnoLetivoAtivo;
        };

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
          const appMetadata = (user.app_metadata ?? {}) as Record<string, unknown>;
          const tenantType = String(
            appMetadata.tenant_type ??
              appMetadata.modelo_ensino ??
              ""
          )
            .trim()
            .toLowerCase();
          const resolvedEscolaId = escola_id || (await resolveEscolaIdForUser(supabase, user.id));
          const baseEscolaId = escola_id || resolvedEscolaId;
          const resolvedParam = baseEscolaId ? await resolveEscolaParam(supabase, baseEscolaId) : null;
          const escolaParam = resolvedParam?.slug ? resolvedParam.slug : baseEscolaId;
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
            if (
              role === "formacao_admin" ||
              role === "admin" ||
              role === "admin_escola" ||
              role === "staff_admin"
            ) {
              window.location.replace(`${formacaoBaseUrl}/admin/dashboard`);
            } else if (role === "formacao_secretaria") {
              window.location.replace(`${formacaoBaseUrl}/secretaria/catalogo-cursos`);
            } else if (role === "formacao_financeiro") {
              window.location.replace(`${formacaoBaseUrl}/financeiro/dashboard`);
            } else if (role === "formador") {
              window.location.replace(`${formacaoBaseUrl}/agenda`);
            } else {
              window.location.replace(`${formacaoBaseUrl}/meus-cursos`);
            }
            return;
          }

          // Roteamento por role
          if (baseEscolaId && isK12AdminRole) {
            const done = await shouldRouteToAdmin(baseEscolaId);
            if (escolaParam) {
              router.replace(done ? `/escola/${escolaParam}/admin` : `/escola/${escolaParam}/onboarding`);
            } else {
              router.replace(done ? `/escola/${baseEscolaId}/admin` : `/escola/${baseEscolaId}/onboarding`);
            }
            return;
          }

          switch (role) {
            case "super_admin":
              router.replace("/super-admin");
              break;
            case "admin":
            case "admin_escola":
            case "staff_admin":
              if (baseEscolaId) {
                const done = await shouldRouteToAdmin(baseEscolaId);
                if (escolaParam) {
                  router.replace(done ? `/escola/${escolaParam}/admin` : `/escola/${escolaParam}/onboarding`);
                } else {
                  router.replace(done ? `/escola/${baseEscolaId}/admin` : `/escola/${baseEscolaId}/onboarding`);
                }
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
              if (escolaParam) {
                router.replace(`/escola/${escolaParam}/secretaria`);
              } else {
                router.replace("/secretaria");
              }
              break;
            case "financeiro":
              router.replace("/financeiro");
              break;
            case "secretaria_financeiro": {
              if (escolaParam) {
                router.replace(`/escola/${escolaParam}/secretaria`)
              } else {
                router.replace('/secretaria')
              }
              break;
            }
            case "admin_financeiro":
              if (escolaParam) {
                router.replace(`/escola/${escolaParam}/admin/dashboard`)
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
