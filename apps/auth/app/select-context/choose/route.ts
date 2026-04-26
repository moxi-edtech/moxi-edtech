import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabaseServer";
import { validateUserTenant } from "@/lib/getUserTenants";
import { resolveTenantRoute } from "@/lib/resolveTenantRoute";
import { logAuthEvent } from "@/lib/auth-log";
import { setTenantContextCookie } from "@/lib/tenantContextCookie";

export const dynamic = "force-dynamic";

function isLocalOrigin(value: string) {
  const v = value.trim().toLowerCase();
  return (
    v.includes("localhost") ||
    v.includes("127.0.0.1") ||
    v.includes(".localhost") ||
    v.includes(".lvh.me")
  );
}

function resolveProductBases(host: string, redirectHint?: string | null) {
  const hint = String(redirectHint ?? "").toLowerCase();
  const isLocalHost =
    isLocalOrigin(host) ||
    isLocalOrigin(hint) ||
    process.env.NODE_ENV !== "production";

  if (isLocalHost) {
    const prefersLocalhost =
      host.includes("localhost") ||
      host.includes(".localhost") ||
      hint.includes("localhost");

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
  const bases = resolveProductBases(host, typeof redirectTo === "string" ? redirectTo : null);

  const destinationConfig = resolveTenantRoute(tenant);
  const productBase = destinationConfig.product === "formacao" ? bases.formacao : bases.k12;
  const preferred = normalizeRedirectTarget(
    typeof redirectTo === "string" ? redirectTo : null,
    productBase
  );
  const destination = preferred ?? `${productBase.replace(/\/$/, "")}${destinationConfig.path}`;

  await setTenantContextCookie({
    uid: user.id,
    tenant_id: tenant.tenantId,
    tenant_slug: null,
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

  return NextResponse.redirect(destination);
}
