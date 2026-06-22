import { headers } from "next/headers";
import { redirect } from "next/navigation";
import crypto from "node:crypto";
import { supabaseServer } from "@/lib/supabaseServer";
import { getUserTenants } from "@/lib/getUserTenants";
import { logAuthEvent } from "@/lib/auth-log";
import { resolveTenantRoute } from "@/lib/resolveTenantRoute";
import { createSessionHandoffPayload, shouldUseSessionHandoff } from "@/lib/sessionHandoff";
import {
  clearTenantContextCookie,
  getTenantContextCookieForUser,
  setTenantContextCookie,
} from "@/lib/tenantContextCookie";

type GlobalRole = "super_admin" | "global_admin" | null;

export const dynamic = "force-dynamic";

type SearchParams = Promise<{ redirect?: string }>;

function summarizeCookieHeader(rawCookieHeader: string | null) {
  const cookiePairs = String(rawCookieHeader ?? "")
    .split(";")
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => part.split("=")[0]?.trim())
    .filter(Boolean) as string[];

  const counts = new Map<string, number>();
  for (const name of cookiePairs) {
    counts.set(name, (counts.get(name) ?? 0) + 1);
  }

  const names = Array.from(counts.keys()).sort();
  const duplicates = Array.from(counts.entries())
    .filter(([, count]) => count > 1)
    .map(([name, count]) => `${name}:${count}`);

  return {
    total: cookiePairs.length,
    names,
    klasseCtxCount: counts.get("klasse_ctx") ?? 0,
    supabaseCookieCount: names.filter(
      (name) => name.startsWith("sb-") && (name.includes("auth-token") || name.includes("access-token") || name.includes("refresh-token"))
    ).length,
    duplicates,
  };
}

function logRedirectCookieState(event: string, details: Record<string, unknown>) {
  console.info(
    JSON.stringify({
      event,
      route: "/redirect",
      timestamp: new Date().toISOString(),
      ...details,
    })
  );
}

function isLocalOrigin(value: string) {
  const v = value.trim().toLowerCase();
  return (
    v.includes("localhost") ||
    v.includes("127.0.0.1") ||
    /^https?:\/\/(?:10|172\.(?:1[6-9]|2\d|3[0-1])|192\.168)\.\d{1,3}\.\d{1,3}(?::\d+)?(?:\/|$)/.test(v) ||
    /^(?:10|172\.(?:1[6-9]|2\d|3[0-1])|192\.168)\.\d{1,3}\.\d{1,3}(?::\d+)?$/.test(v) ||
    v.includes(".localhost") ||
    v.includes(".lvh.me")
  );
}

function getPrivateLanHostname(value: string) {
  const raw = value.trim().toLowerCase();
  try {
    const parsed = new URL(raw.startsWith("http://") || raw.startsWith("https://") ? raw : `http://${raw}`);
    const hostname = parsed.hostname;
    return /^(?:10|172\.(?:1[6-9]|2\d|3[0-1])|192\.168)\.\d{1,3}\.\d{1,3}$/.test(hostname) ? hostname : null;
  } catch {
    return null;
  }
}

function resolveLanProductBases() {
  const k12 = process.env.KLASSE_K12_LAN_ORIGIN?.trim();
  const formacao = process.env.KLASSE_FORMACAO_LAN_ORIGIN?.trim();

  if (!k12) return null;

  try {
    const k12Url = new URL(k12);
    if (!getPrivateLanHostname(k12Url.toString())) return null;

    if (formacao) {
      const formacaoUrl = new URL(formacao);
      if (getPrivateLanHostname(formacaoUrl.toString())) {
        return {
          k12: k12Url.toString().replace(/\/$/, ""),
          formacao: formacaoUrl.toString().replace(/\/$/, ""),
        };
      }
    }

    const derivedFormacao = new URL(k12Url.toString());
    derivedFormacao.port = "3002";

    return {
      k12: k12Url.toString().replace(/\/$/, ""),
      formacao: derivedFormacao.toString().replace(/\/$/, ""),
    };
  } catch {
    return null;
  }
}

function resolveProductBases(host: string, ...redirectHints: Array<string | null | undefined>) {
  const normalizedHost = host.trim().toLowerCase();
  const hostLanHostname = getPrivateLanHostname(normalizedHost);
  const hostUsesLocalhost =
    normalizedHost.includes("localhost") ||
    normalizedHost.includes("127.0.0.1") ||
    normalizedHost.includes(".localhost");
  const hostUsesWildcardLocal = normalizedHost.includes(".lvh.me");
  const hintUsesLocalhost = redirectHints.some((hint) => {
    const value = String(hint ?? "").trim().toLowerCase();
    return value.includes("localhost") || value.includes("127.0.0.1") || value.includes(".localhost");
  });
  const hostIsLocal = Boolean(hostLanHostname || hostUsesLocalhost || hostUsesWildcardLocal || hintUsesLocalhost);
  const isLocalHost = hostIsLocal && process.env.NODE_ENV !== "production";

  if (isLocalHost) {
    const lanHostname =
      hostLanHostname ||
      redirectHints.map((hint) => getPrivateLanHostname(hint ?? "")).find(Boolean);
    if (lanHostname) {
      return {
        k12: `http://${lanHostname}:3001`,
        formacao: `http://${lanHostname}:3002`,
      };
    }

    const prefersLocalhost = hostUsesLocalhost || hintUsesLocalhost;

    if (prefersLocalhost) {
      const lanBases = resolveLanProductBases();
      if (lanBases) return lanBases;

      return {
        k12: process.env.KLASSE_K12_LOCALHOST_ORIGIN?.trim() || "http://localhost:3001",
        formacao: process.env.KLASSE_FORMACAO_LOCALHOST_ORIGIN?.trim() || "http://localhost:3002",
      };
    }

    return {
      k12:
        process.env.KLASSE_K12_LOCAL_ORIGIN?.trim() ||
        "http://app.lvh.me:3001",
      formacao:
        process.env.KLASSE_FORMACAO_LOCAL_ORIGIN?.trim() ||
        "http://formacao.lvh.me:3002",
    };
  }

  const configuredK12 = process.env.NEXT_PUBLIC_KLASSE_K12_URL?.trim();
  const configuredFormacao = process.env.NEXT_PUBLIC_KLASSE_FORMACAO_URL?.trim();

  return {
    k12: configuredK12 && !isLocalOrigin(configuredK12) ? configuredK12 : "https://app.klasse.ao",
    formacao:
      configuredFormacao && !isLocalOrigin(configuredFormacao)
        ? configuredFormacao
        : "https://formacao.klasse.ao",
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

function shouldForcePasswordChange(userMetadata: unknown) {
  return Boolean((userMetadata as Record<string, unknown> | null | undefined)?.must_change_password);
}

function buildLogoutRecoveryUrl(loginSuffix: string) {
  const next = loginSuffix ? `/redirect${loginSuffix}` : "/redirect";
  return `/logout?next=${encodeURIComponent(next)}`;
}

function resolvePasswordChangeDestination(productBase: string, product: string) {
  if (product !== "k12") return null;
  return `${productBase.replace(/\/$/, "")}/mudar-senha`;
}

function buildSessionHandoffUrl(destination: string, payload: string) {
  const handoffUrl = new URL("/api/auth/handoff", new URL(destination).origin);
  handoffUrl.searchParams.set("payload", payload);
  return handoffUrl.toString();
}

function renderSessionHandoff(handoffUrl: string) {
  const handoff = new URL(handoffUrl);
  const payload = handoff.searchParams.get("payload") ?? "";
  console.info(
    JSON.stringify({
      event: "auth_handoff_client_navigation_rendered",
      route: "/redirect",
      timestamp: new Date().toISOString(),
      destination: `${handoff.origin}${handoff.pathname}`,
      payload_size: payload.length,
    })
  );

  return (
    <main className="grid min-h-screen place-items-center bg-white p-6 font-sans">
      <div className="flex flex-col items-center space-y-4 text-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-slate-300 border-t-slate-600" />
        <p className="text-sm font-medium text-slate-600">Redirecionando...</p>
        <p className="text-xs text-slate-400">
          Se não avançar automaticamente,{" "}
          <a
            href={handoffUrl}
            className="text-indigo-600 underline hover:text-indigo-800 font-semibold"
          >
            toque aqui
          </a>.
        </p>
      </div>
      <script
        dangerouslySetInnerHTML={{
          __html: `
            setTimeout(function() {
              window.location.replace(${JSON.stringify(handoffUrl)});
            }, 50);
          `,
        }}
      />
    </main>
  );
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

async function resolvePreferredTenant(
  supabase: Awaited<ReturnType<typeof supabaseServer>>,
  userId: string,
  appMetadata: unknown,
  tenants: Awaited<ReturnType<typeof getUserTenants>>
) {
  if (tenants.length <= 1) return tenants[0] ?? null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("current_escola_id")
    .eq("user_id", userId)
    .maybeSingle();

  const preferredTenantId =
    String((profile as { current_escola_id?: unknown } | null)?.current_escola_id ?? "").trim() ||
    String((appMetadata as Record<string, unknown> | null | undefined)?.escola_id ?? "").trim();

  if (!preferredTenantId) return null;
  return tenants.find((tenant) => tenant.tenantId === preferredTenantId) ?? null;
}

export default async function RedirectPage({ searchParams }: { searchParams: SearchParams }) {
  const supabase = await supabaseServer();
  const { data: sessionData } = await supabase.auth.getSession();
  const session = sessionData.session;
  const user = session?.user ?? null;

  const params = await searchParams;
  const loginSuffix = params.redirect ? `?redirect=${encodeURIComponent(params.redirect)}` : "";

  if (!user) {
    logAuthEvent({
      action: "resolve_context_failed",
      route: "/redirect",
      details: { reason: "no_session" },
    });
    redirect(buildLogoutRecoveryUrl(loginSuffix));
  }

  const forcePasswordChange = shouldForcePasswordChange(user.user_metadata);
  const headerStore = await headers();
  const host = (headerStore.get("x-forwarded-host") ?? headerStore.get("host") ?? "")
    .split(",")[0]
    .trim()
    .toLowerCase();
  const originHint = headerStore.get("origin");
  const refererHint = headerStore.get("referer");
  const cookieSummary = summarizeCookieHeader(headerStore.get("cookie"));
  const bases = resolveProductBases(host, params.redirect, originHint, refererHint);

  const isResolverTarget = (url: string | null) => {
    if (!url) return false;
    try {
      const p = new URL(url);
      return p.pathname === "/redirect" || p.pathname === "/login";
    } catch {
      return false;
    }
  };

  const tenants = await getUserTenants(user.id);
  const cachedContext = await getTenantContextCookieForUser(user.id);
  const cachedTenant =
    cachedContext
      ? tenants.find((tenant) =>
          tenant.tenantId === cachedContext.tenant_id &&
          tenant.tenantType === cachedContext.tenant_type &&
          tenant.role === cachedContext.role
        ) ?? null
      : null;

  logRedirectCookieState("auth_redirect_cookie_inventory", {
    host,
    cookie_total: cookieSummary.total,
    cookie_names: cookieSummary.names,
    cookie_duplicates: cookieSummary.duplicates,
    klasse_ctx_count: cookieSummary.klasseCtxCount,
    supabase_cookie_count: cookieSummary.supabaseCookieCount,
    tenant_count: tenants.length,
    cached_ctx_present: Boolean(cachedContext),
    cached_ctx_tenant_id: cachedContext?.tenant_id ?? null,
    cached_ctx_tenant_type: cachedContext?.tenant_type ?? null,
    cached_ctx_role: cachedContext?.role ?? null,
    cached_tenant_match: Boolean(cachedTenant),
  });

  if (cachedContext && cachedTenant) {
    const destinationConfig = resolveTenantRoute({
      tenantId: cachedContext.tenant_id,
      tenantSlug: cachedContext.tenant_slug,
      tenantName: "",
      tenantType: cachedContext.tenant_type,
      role: cachedContext.role,
    });
    const productBase = destinationConfig.product === "formacao" ? bases.formacao : bases.k12;
    const passwordChangeDestination = forcePasswordChange
      ? resolvePasswordChangeDestination(productBase, destinationConfig.product)
      : null;
    if (passwordChangeDestination) {
      logAuthEvent({
        action: "redirect",
        route: "/redirect",
        user_id: user.id,
        tenant_id: cachedContext.tenant_id,
        tenant_type: cachedContext.tenant_type,
        details: { destination: passwordChangeDestination, source: "must_change_password" },
      });
      redirect(passwordChangeDestination);
    }

    const preferred = normalizeRedirectTarget(params.redirect, productBase);
    const destination = preferred && !isResolverTarget(preferred)
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
    if (
      session?.access_token &&
      session?.refresh_token &&
      shouldUseSessionHandoff(destination, bases.k12)
    ) {
      return renderSessionHandoff(
        buildSessionHandoffUrl(
          destination,
          createSessionHandoffPayload({
            accessToken: session.access_token,
            refreshToken: session.refresh_token,
            destination,
          })
        )
      );
    }
    redirect(destination);
  }

  if (cachedContext && !cachedTenant) {
    await clearTenantContextCookie();
    logRedirectCookieState("auth_redirect_stale_cookie_cleared", {
      host,
      cookie_total: cookieSummary.total,
      cookie_names: cookieSummary.names,
      klasse_ctx_count: cookieSummary.klasseCtxCount,
      supabase_cookie_count: cookieSummary.supabaseCookieCount,
      tenant_count: tenants.length,
      cached_ctx_tenant_id: cachedContext.tenant_id,
      cached_ctx_tenant_type: cachedContext.tenant_type,
      cached_ctx_role: cachedContext.role,
    });
    logAuthEvent({
      action: "resolve_context_failed",
      route: "/redirect",
      user_id: user.id,
      details: { reason: "stale_tenant_context_cookie" },
    });
  }

  const globalRole = await resolveGlobalRole(supabase, user.id, user.user_metadata, user.app_metadata);

  if (tenants.length === 0 && globalRole) {
    const productBase = bases.k12;
    const preferred = normalizeRedirectTarget(params.redirect, productBase);
    const destination = preferred && !isResolverTarget(preferred)
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
    const preferredTenant = await resolvePreferredTenant(supabase, user.id, user.app_metadata, tenants);
    if (preferredTenant) {
      logRedirectCookieState("auth_redirect_preferred_tenant_selected", {
        host,
        tenant_count: tenants.length,
        preferred_tenant_id: preferredTenant.tenantId,
        preferred_tenant_type: preferredTenant.tenantType,
        preferred_tenant_role: preferredTenant.role,
      });
      const preferredDestinationConfig = resolveTenantRoute(preferredTenant);
      const preferredProductBase =
        preferredDestinationConfig.product === "formacao" ? bases.formacao : bases.k12;
      const preferredPasswordChangeDestination = forcePasswordChange
        ? resolvePasswordChangeDestination(preferredProductBase, preferredDestinationConfig.product)
        : null;
      const preferred = normalizeRedirectTarget(params.redirect, preferredProductBase);
      const destination =
        preferredPasswordChangeDestination ??
        (preferred && !isResolverTarget(preferred)
          ? preferred
          : `${preferredProductBase.replace(/\/$/, "")}${preferredDestinationConfig.path}`);

      await setTenantContextCookie({
        uid: user.id,
        tenant_id: preferredTenant.tenantId,
        tenant_slug: preferredTenant.tenantSlug,
        tenant_type: preferredTenant.tenantType,
        role: preferredTenant.role,
      });

      logAuthEvent({
        action: "redirect",
        route: "/redirect",
        user_id: user.id,
        tenant_id: preferredTenant.tenantId,
        tenant_type: preferredTenant.tenantType,
        details: { destination, source: "preferred_profile_context" },
      });
      if (
        session?.access_token &&
        session?.refresh_token &&
        shouldUseSessionHandoff(destination, bases.k12)
      ) {
        return renderSessionHandoff(
          buildSessionHandoffUrl(
            destination,
            createSessionHandoffPayload({
              accessToken: session.access_token,
              refreshToken: session.refresh_token,
              destination,
            })
          )
        );
      }
      redirect(destination);
    }

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

  const productBase = destinationConfig.product === "formacao" ? bases.formacao : bases.k12;
  const passwordChangeDestination = forcePasswordChange
    ? resolvePasswordChangeDestination(productBase, destinationConfig.product)
    : null;
  if (passwordChangeDestination) {
    logAuthEvent({
      action: "redirect",
      route: "/redirect",
      user_id: user.id,
      tenant_id: selected.tenantId,
      tenant_type: selected.tenantType,
      details: { destination: passwordChangeDestination, source: "must_change_password" },
    });
    redirect(passwordChangeDestination);
  }

  const preferred = normalizeRedirectTarget(params.redirect, productBase);
  const destination = preferred && !isResolverTarget(preferred)
    ? preferred
    : `${productBase.replace(/\/$/, "")}${destinationConfig.path}`;

  logAuthEvent({
    action: "redirect",
    route: "/redirect",
    user_id: user.id,
    tenant_id: selected.tenantId,
    tenant_type: selected.tenantType,
    details: { destination, source: "single_tenant_resolved" },
  });

  await setTenantContextCookie({
    uid: user.id,
    tenant_id: selected.tenantId,
    tenant_slug: selected.tenantSlug,
    tenant_type: selected.tenantType,
    role: selected.role,
  });

  if (
    session?.access_token &&
    session?.refresh_token &&
    shouldUseSessionHandoff(destination, bases.k12)
  ) {
    return renderSessionHandoff(
      buildSessionHandoffUrl(
        destination,
        createSessionHandoffPayload({
          accessToken: session.access_token,
          refreshToken: session.refresh_token,
          destination,
        })
      )
    );
  }

  redirect(destination);
}
