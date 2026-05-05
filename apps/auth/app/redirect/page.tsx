import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { supabaseServer } from "@/lib/supabaseServer";
import { getUserTenants } from "@/lib/getUserTenants";
import { logAuthEvent } from "@/lib/auth-log";
import { resolveTenantRoute } from "@/lib/resolveTenantRoute";
import { getTenantContextCookieForUser, clearTenantContextCookie } from "@/lib/tenantContextCookie";

type GlobalRole = "super_admin" | "global_admin" | null;

export const dynamic = "force-dynamic";

type SearchParams = Promise<{ redirect?: string }>;

function isLocalOrigin(value: string) {
  const v = value.trim().toLowerCase();
  return (
    v.includes("localhost") ||
    v.includes("127.0.0.1") ||
    v.includes(".localhost") ||
    v.includes(".lvh.me")
  );
}

function resolveProductBases(host: string, redirectHint?: string) {
  const hostIsLocal = isLocalOrigin(host) || isLocalOrigin(redirectHint ?? "");
  const isLocalHost = hostIsLocal && process.env.NODE_ENV !== "production";

  if (isLocalHost) {
    const prefersLocalhost =
      host.includes("localhost") ||
      host.includes(".localhost") ||
      (isLocalOrigin(redirectHint ?? "") && (redirectHint ?? "").toLowerCase().includes("localhost"));

    return {
      k12:
        process.env.KLASSE_K12_LOCAL_ORIGIN?.trim() ||
        (prefersLocalhost ? "http://app.localhost:3001" : "http://app.lvh.me:3001"),
      formacao:
        process.env.KLASSE_FORMACAO_LOCAL_ORIGIN?.trim() ||
        (prefersLocalhost ? "http://formacao.localhost:3002" : "http://formacao.lvh.me:3002"),
    };
  }

  return {
    k12: process.env.NEXT_PUBLIC_KLASSE_K12_URL?.trim() || "https://app.klasse.ao",
    formacao: process.env.NEXT_PUBLIC_KLASSE_FORMACAO_URL?.trim() || "https://formacao.klasse.ao",
  };
}

function normalizeRedirectTarget(raw: string | undefined, expectedBase: string) {
  const value = String(raw ?? "").trim();
  if (!value) return null;

  if (value.startsWith("/")) {
    return `${expectedBase.replace(/\/$/, "")}${value}`;
  }

  try {
    const parsed = new URL(value);
    if (!["http:", "https:"].includes(parsed.protocol)) return null;
    const expectedHost = new URL(expectedBase).host;
    if (parsed.host !== expectedHost) return null;
    return parsed.toString();
  } catch {
    return null;
  }
}

function normalizeRole(value: unknown): string {
  return String(value ?? "")
    .trim()
    .toLowerCase();
}

async function resolveGlobalRole(
  supabase: Awaited<ReturnType<typeof supabaseServer>>,
  userId: string,
  userMetadata: unknown,
  appMetadata: unknown
): Promise<GlobalRole> {
  try {
    const { data: isSuperAdmin } = await supabase.rpc("check_super_admin_role");
    if (Boolean(isSuperAdmin)) return "super_admin";
  } catch {
    // no-op: fallback below
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("user_id", userId)
    .maybeSingle();

  const profileRole = normalizeRole((profile as { role?: unknown } | null)?.role);
  if (profileRole === "super_admin" || profileRole === "superadmin") return "super_admin";
  if (profileRole === "global_admin") return "global_admin";

  const metadataRole = normalizeRole(
    (userMetadata as Record<string, unknown> | null | undefined)?.role ??
      (appMetadata as Record<string, unknown> | null | undefined)?.role
  );
  if (metadataRole === "super_admin" || metadataRole === "superadmin") return "super_admin";
  if (metadataRole === "global_admin") return "global_admin";

  return null;
}

export default async function RedirectPage({ searchParams }: { searchParams: SearchParams }) {
  const supabase = await supabaseServer();
  const { data: authData } = await supabase.auth.getUser();
  const user = authData.user;

  const params = await searchParams;
  const loginSuffix = params.redirect ? `?redirect=${encodeURIComponent(params.redirect)}` : "";

  if (!user) {
    await clearTenantContextCookie();
    logAuthEvent({
      action: "resolve_context_failed",
      route: "/redirect",
      details: { reason: "no_session" },
    });
    redirect(`/login${loginSuffix}`);
  }

  const headerStore = await headers();
  const host = (headerStore.get("x-forwarded-host") ?? headerStore.get("host") ?? "")
    .split(",")[0]
    .trim()
    .toLowerCase();

  const isLoopback = (url: string | null) => {
    if (!url) return false;
    try {
      const p = new URL(url);
      return p.host === host && (p.pathname === "/redirect" || p.pathname === "/login");
    } catch {
      return false;
    }
  };

  const cachedContext = await getTenantContextCookieForUser(user.id);
  if (cachedContext) {
    const bases = resolveProductBases(host, params.redirect);
    const destinationConfig = resolveTenantRoute({
      tenantId: cachedContext.tenant_id,
      tenantName: "",
      tenantType: cachedContext.tenant_type,
      role: cachedContext.role,
    });
    const productBase = destinationConfig.product === "formacao" ? bases.formacao : bases.k12;
    const preferred = normalizeRedirectTarget(params.redirect, productBase);
    const destination = preferred && !isLoopback(preferred)
      ? preferred
      : `${productBase.replace(/\/$/, "")}${destinationConfig.path}`;

    logAuthEvent({
      action: "redirect",
      route: "/redirect",
      user_id: user.id,
      tenant_id: cachedContext.tenant_id,
      tenant_type: cachedContext.tenant_type,
      details: { destination, source: "tenant_context_cookie" },
    });
    redirect(destination);
  }

  const tenants = await getUserTenants(user.id);
  const globalRole = await resolveGlobalRole(supabase, user.id, user.user_metadata, user.app_metadata);

  if (tenants.length === 0 && globalRole) {
    const bases = resolveProductBases(host, params.redirect);
    const productBase = bases.k12;
    const preferred = normalizeRedirectTarget(params.redirect, productBase);
    const destination = preferred && !isLoopback(preferred)
      ? preferred
      : `${productBase.replace(/\/$/, "")}/super-admin`;

    logAuthEvent({
      action: "redirect",
      route: "/redirect",
      user_id: user.id,
      tenant_type: null,
      details: { reason: "global_admin_without_tenant", role: globalRole, destination },
    });
    redirect(destination);
  }

  if (tenants.length === 0) {
    logAuthEvent({
      action: "resolve_context_failed",
      route: "/redirect",
      user_id: user.id,
      details: { reason: "no_tenant" },
    });
    redirect("/login?error=no_tenant");
  }

  if (tenants.length > 1) {
    const selectUrl = `/select-context${params.redirect ? `?redirect=${encodeURIComponent(params.redirect)}` : ""}`;
    logAuthEvent({
      action: "redirect",
      route: "/redirect",
      user_id: user.id,
      details: { reason: "multi_tenant_requires_selection", tenants: tenants.length },
    });
    redirect(selectUrl);
  }

  const selected = tenants[0];
  const destinationConfig = resolveTenantRoute(selected);

  const bases = resolveProductBases(host, params.redirect);
  const productBase = destinationConfig.product === "formacao" ? bases.formacao : bases.k12;
  const preferred = normalizeRedirectTarget(params.redirect, productBase);
  const destination = preferred && !isLoopback(preferred)
    ? preferred
    : `${productBase.replace(/\/$/, "")}${destinationConfig.path}`;

  logAuthEvent({
    action: "redirect",
    route: "/redirect",
    user_id: user.id,
    tenant_id: selected.tenantId,
    tenant_type: selected.tenantType,
    details: { destination },
  });

  redirect(destination);
}
