import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { supabaseServer } from "@/lib/supabaseServer";
import { resolveEscolaIdForUser } from "@/lib/tenant/resolveEscolaIdForUser";
import { resolveEscolaParam } from "@/lib/tenant/resolveEscolaParam";
import { shouldRouteToEscolaAdmin } from "@/lib/escola/onboardingGate";
import { getDefaultK12PortalPathForRole, normalizePapel } from "@/lib/permissions";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

function isLocalHost(host: string) {
  return (
    host.startsWith("localhost") ||
    host.startsWith("127.0.0.1") ||
    host.endsWith(".localhost") ||
    host.endsWith(".lvh.me")
  );
}

function resolveProtocol(host: string) {
  return process.env.NODE_ENV === "development" || isLocalHost(host) ? "http" : "https";
}

function safeUrlWithRedirect(loginUrl: string, returnTo: string) {
  try {
    const url = new URL(loginUrl);
    url.searchParams.set("redirect", returnTo);
    return url.toString();
  } catch {
    return `${loginUrl}?redirect=${encodeURIComponent(returnTo)}`;
  }
}

function resolveAuthLoginUrl(host: string) {
  if (process.env.NODE_ENV !== "production") {
    if (host.startsWith("localhost") || host.startsWith("127.0.0.1")) {
      return (process.env.KLASSE_AUTH_LOCALHOST_URL ?? "http://localhost:3000/login").trim();
    }

    return (
      process.env.KLASSE_AUTH_LOCAL_URL ??
      "http://auth.lvh.me:3000/login"
    ).trim();
  }

  const configured = process.env.KLASSE_AUTH_URL?.trim();
  if (configured) return configured;

  return isLocalHost(host) ? "http://auth.lvh.me:3000/login" : "https://auth.klasse.ao/login";
}

function resolveFormacaoBaseUrl(host: string) {
  if (isLocalHost(host)) {
    return process.env.KLASSE_FORMACAO_LOCAL_ORIGIN?.trim() || "http://formacao.lvh.me:3002";
  }

  return process.env.NEXT_PUBLIC_KLASSE_FORMACAO_URL?.trim() || "https://formacao.klasse.ao";
}

function resolveReturnTo(host: string) {
  const configuredBase = process.env.NEXT_PUBLIC_BASE_URL?.trim().replace(/\/$/, "");
  const origin = host ? `${resolveProtocol(host)}://${host}` : configuredBase || "https://app.klasse.ao";
  return `${origin}/redirect`;
}

export default async function RedirectPage() {
  const headerStore = await headers();
  const host = (headerStore.get("x-forwarded-host") ?? headerStore.get("host") ?? "")
    .split(",")[0]
    .trim()
    .toLowerCase();

  const supabase = await supabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect(safeUrlWithRedirect(resolveAuthLoginUrl(host), resolveReturnTo(host)));
  }

  if (user.user_metadata?.must_change_password) {
    redirect("/mudar-senha");
  }

  const { data: rows } = await supabase
    .from("profiles")
    .select("role, escola_id, created_at")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(1);

  const profile = rows?.[0] as { role?: string | null; escola_id?: string | null } | undefined;
  const profileRole = profile?.role ?? "guest";
  const profileEscolaId = profile?.escola_id ?? null;
  const appMetadata = (user.app_metadata ?? {}) as Record<string, unknown>;
  const tenantType = String(appMetadata.tenant_type ?? appMetadata.modelo_ensino ?? "")
    .trim()
    .toLowerCase();

  const resolvedEscolaId = profileEscolaId || (await resolveEscolaIdForUser(supabase, user.id));
  const resolvedParam = resolvedEscolaId ? await resolveEscolaParam(supabase, resolvedEscolaId) : null;
  const escolaParam = resolvedParam?.slug ? resolvedParam.slug : resolvedEscolaId;

  const isGlobalRole = profileRole === "super_admin" || profileRole === "global_admin";
  let role = profileRole;

  if (resolvedEscolaId) {
    const { data: vinculo } = await supabase
      .from("escola_users")
      .select("papel, role")
      .eq("user_id", user.id)
      .eq("escola_id", resolvedEscolaId)
      .limit(1)
      .maybeSingle();

    const scopedRole = normalizePapel(vinculo?.papel ?? vinculo?.role ?? null);
    if (scopedRole && !isGlobalRole) role = scopedRole;
  }

  const isK12AdminRole = role === "admin" || role === "admin_escola" || role === "staff_admin";
  const isFormacaoRole =
    role === "formacao_admin" ||
    role === "formacao_secretaria" ||
    role === "formacao_financeiro" ||
    role === "formador" ||
    role === "formando";

  if (tenantType === "formacao" || isFormacaoRole) {
    const formacaoBaseUrl = resolveFormacaoBaseUrl(host);

    if (
      role === "formacao_admin" ||
      role === "admin" ||
      role === "admin_escola" ||
      role === "staff_admin"
    ) {
      redirect(`${formacaoBaseUrl}/admin/dashboard`);
    }

    if (role === "formacao_secretaria") {
      redirect(`${formacaoBaseUrl}/secretaria/catalogo-cursos`);
    }

    if (role === "formacao_financeiro") {
      redirect(`${formacaoBaseUrl}/financeiro/dashboard`);
    }

    if (role === "formador") {
      redirect(`${formacaoBaseUrl}/agenda`);
    }

    redirect(`${formacaoBaseUrl}/meus-cursos`);
  }

  if (resolvedEscolaId && isK12AdminRole) {
    const done = await shouldRouteToEscolaAdmin(supabase, resolvedEscolaId);
    const path = done ? "admin" : "onboarding";
    redirect(`/escola/${escolaParam ?? resolvedEscolaId}/${path}`);
  }

  if (role === "aluno") {
    const alunoBase = getDefaultK12PortalPathForRole(role, escolaParam);

    if (!resolvedEscolaId) {
      redirect(alunoBase);
    }

    const { data: esc } = await supabase
      .from("escolas")
      .select("aluno_portal_enabled")
      .eq("id", resolvedEscolaId)
      .limit(1);
    const enabled = Boolean(esc && esc.length > 0 && esc[0]?.aluno_portal_enabled);

    redirect(enabled ? alunoBase : `${alunoBase}/desabilitado`);
  }

  redirect(getDefaultK12PortalPathForRole(role, escolaParam));
}
