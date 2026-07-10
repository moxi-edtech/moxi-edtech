import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabaseServer";
import { validateUserTenant } from "@/lib/getUserTenants";
import { resolveTenantRoute } from "@/lib/resolveTenantRoute";
import { logAuthEvent } from "@/lib/auth-log";
import { setTenantContextCookie } from "@/lib/tenantContextCookie";
import { createSessionHandoffPayload, shouldUseSessionHandoff } from "@/lib/sessionHandoff";

export const dynamic = "force-dynamic";

function buildSessionHandoffUrl(destination: string, payload: string) {
  const handoffUrl = new URL("/api/auth/handoff", new URL(destination).origin);
  handoffUrl.searchParams.set("payload", payload);
  return handoffUrl.toString();
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
  const hints = redirectHints.map((hint) => String(hint ?? "").toLowerCase());
  const isLocalHost =
    isLocalOrigin(host) ||
    hints.some((hint) => isLocalOrigin(hint)) ||
    process.env.NODE_ENV !== "production";

  if (isLocalHost) {
    const lanHostname = getPrivateLanHostname(host) || hints.map((hint) => getPrivateLanHostname(hint)).find(Boolean);
    if (lanHostname) {
      return {
        k12: `http://${lanHostname}:3001`,
        formacao: `http://${lanHostname}:3002`,
      };
    }

    const prefersLocalhost =
      host.includes("localhost") ||
      host.includes(".localhost") ||
      hints.some((hint) => hint.includes("localhost"));

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

  return {
    k12: process.env.NEXT_PUBLIC_KLASSE_K12_URL?.trim() || "https://app.klasse.ao",
    formacao: process.env.NEXT_PUBLIC_KLASSE_FORMACAO_URL?.trim() || "https://formacao.klasse.ao",
  };
}

function normalizeRedirectTarget(raw: string | null, expectedBase: string) {
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

function shouldForcePasswordChange(userMetadata: unknown) {
  return Boolean((userMetadata as Record<string, unknown> | null | undefined)?.must_change_password);
}

function resolvePasswordChangeDestination(productBase: string, product: string) {
  if (product !== "k12") return null;
  return `${productBase.replace(/\/$/, "")}/mudar-senha`;
}

export async function POST(req: Request) {
  const supabase = await supabaseServer();
  const { data: authData } = await supabase.auth.getUser();
  const user = authData.user;
  if (!user) {
    return NextResponse.redirect(new URL("/login", req.url));
  }

  const formData = await req.formData();
  const tenantId = formData.get("tenantId");
  const redirectTo = formData.get("redirect_to");
  return handleSelection(req, supabase, user, tenantId, redirectTo);
}

export async function GET(req: Request) {
  const supabase = await supabaseServer();
  const { data: authData } = await supabase.auth.getUser();
  const user = authData.user;
  if (!user) {
    return NextResponse.redirect(new URL("/login", req.url));
  }

  const url = new URL(req.url);
  const tenantId = url.searchParams.get("tenantId");
  const redirectTo = url.searchParams.get("redirect_to");
  return handleSelection(req, supabase, user, tenantId, redirectTo);
}

async function handleSelection(
  req: Request,
  supabase: Awaited<ReturnType<typeof supabaseServer>>,
  user: NonNullable<Awaited<ReturnType<typeof supabaseServer>> extends infer T ? any : never>,
  tenantId: FormDataEntryValue | string | null,
  redirectTo: FormDataEntryValue | string | null
) {
  const tenant = await validateUserTenant(user.id, tenantId);
  if (!tenant) {
    logAuthEvent({
      action: "deny",
      route: "/select-context/choose",
      user_id: user.id,
      details: { reason: "invalid_tenant_selection" },
    });
    return NextResponse.redirect(new URL("/select-context?error=invalid_tenant", req.url));
  }

  const headerStore = await headers();
  const host = (headerStore.get("x-forwarded-host") ?? headerStore.get("host") ?? "")
    .split(",")[0]
    .trim()
    .toLowerCase();
  const originHint = headerStore.get("origin");
  const refererHint = headerStore.get("referer");
  const bases = resolveProductBases(host, typeof redirectTo === "string" ? redirectTo : null, originHint, refererHint);

  const destinationConfig = resolveTenantRoute(tenant);
  const productBase = destinationConfig.product === "formacao" ? bases.formacao : bases.k12;
  const passwordChangeDestination = shouldForcePasswordChange(user.user_metadata)
    ? resolvePasswordChangeDestination(productBase, destinationConfig.product)
    : null;
  const preferred = normalizeRedirectTarget(
    typeof redirectTo === "string" ? redirectTo : null,
    productBase
  );
  const destination = passwordChangeDestination ?? preferred ?? `${productBase.replace(/\/$/, "")}${destinationConfig.path}`;

  await setTenantContextCookie({
    uid: user.id,
    tenant_id: tenant.tenantId,
    tenant_slug: tenant.tenantSlug,
    tenant_type: tenant.tenantType,
    role: tenant.role,
  });

  const { error: profileUpdateError } = await supabase
    .from("profiles")
    .update({ current_escola_id: tenant.tenantId })
    .eq("user_id", user.id);
  if (profileUpdateError) {
    console.warn(
      JSON.stringify({
        event: "select_context_profile_update_failed",
        user_id: user.id,
        tenant_id: tenant.tenantId,
        error: profileUpdateError.message,
        timestamp: new Date().toISOString(),
      })
    );
  }

  logAuthEvent({
    action: "redirect",
    route: "/select-context/choose",
    user_id: user.id,
    tenant_id: tenant.tenantId,
    tenant_type: tenant.tenantType,
      details: { destination, selected_tenant_id: tenant.tenantId },
  });

  const { data: sessionData } = await supabase.auth.getSession();
  const session = sessionData?.session ?? null;
  const finalDestination =
    session?.access_token &&
    session?.refresh_token &&
    shouldUseSessionHandoff(destination, bases.k12)
      ? buildSessionHandoffUrl(
          destination,
          createSessionHandoffPayload({
            accessToken: session.access_token,
            refreshToken: session.refresh_token,
            destination,
          })
        )
      : destination;

  return NextResponse.redirect(finalDestination);
}
