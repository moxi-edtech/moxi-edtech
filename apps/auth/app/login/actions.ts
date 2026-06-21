"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { supabaseRouteClient } from "@/lib/supabaseServer";
import { logAuthEvent } from "@/lib/auth-log";
import { readEnv } from "@/lib/env";
import { checkLoginRateLimit } from "@/lib/rateLimit";
import { getUserTenants } from "@/lib/getUserTenants";
import { setTenantContextCookie, clearTenantContextCookie } from "@/lib/tenantContextCookie";

type ResolveIdentifierJobResponse = {
  ok?: boolean;
  data?: { email?: string };
  error?: string;
};

type AccessContext = {
  ip: string;
  userAgent: string | null;
  geo: {
    city: string | null;
    region: string | null;
    country: string | null;
    latitude: string | null;
    longitude: string | null;
    timezone: string | null;
  };
};

const LoginSchema = z.object({
  identifier: z.string().trim().min(1, "Informe o email ou número de processo."),
  password: z.string().min(1, "A senha não pode estar em branco."),
  redirect_to: z.string().optional(),
});

function normalizeReturnTo(raw: string | null | undefined) {
  const value = String(raw ?? "").trim();
  if (!value) return "";
  if (value.startsWith("/")) return value;
  if (value.startsWith("http://") || value.startsWith("https://")) return value;
  return "";
}

function firstForwardedIp(value: string | null) {
  return value?.split(",")[0]?.trim() || null;
}

function decodeHeader(value: string | null) {
  if (!value) return null;
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function getAccessContext(headerStore: Awaited<ReturnType<typeof headers>>): AccessContext {
  const ip =
    firstForwardedIp(headerStore.get("x-forwarded-for")) ??
    headerStore.get("x-real-ip") ??
    headerStore.get("cf-connecting-ip") ??
    "unknown";

  return {
    ip,
    userAgent: headerStore.get("user-agent"),
    geo: {
      city: decodeHeader(headerStore.get("x-vercel-ip-city")),
      region: decodeHeader(headerStore.get("x-vercel-ip-country-region")),
      country: headerStore.get("x-vercel-ip-country") ?? headerStore.get("cf-ipcountry"),
      latitude: headerStore.get("x-vercel-ip-latitude"),
      longitude: headerStore.get("x-vercel-ip-longitude"),
      timezone: decodeHeader(headerStore.get("x-vercel-ip-timezone")),
    },
  };
}

function resolveAuthAdminBaseUrl() {
  if (process.env.NODE_ENV === "development") {
    return readEnv(process.env.KLASSE_K12_LOCAL_ORIGIN, "http://app.lvh.me:3001");
  }
  return readEnv(process.env.AUTH_ADMIN_BASE_URL, "https://app.klasse.ao");
}

function uniqueEmails(values: Array<string | null | undefined>) {
  return Array.from(
    new Set(
      values
        .map((value) => String(value ?? "").trim().toLowerCase())
        .filter((value) => value.includes("@"))
    )
  );
}

function buildCanonicalStudentEmails(identifier: string) {
  const raw = identifier.trim();
  if (raw.includes("@")) return [];

  const upper = raw.toUpperCase();
  const compact = upper.replace(/[^A-Z0-9]/g, "");
  const loginLike = /^(?:[A-Z][A-Z0-9]{2,7}\d{5}|[A-Z]{2,8}-\d{3,}|[A-Z]{2,8}-\d{4}-\d{6})$/i;
  if (!loginLike.test(raw)) return [];

  return uniqueEmails([
    `${upper}@klasse.ao`,
    compact ? `${compact}@klasse.ao` : null,
  ]);
}

async function resolvePreferredTenantIdForUser(
  supabase: Awaited<ReturnType<typeof supabaseRouteClient>>,
  userId: string,
  appMetadata?: Record<string, unknown> | null
) {
  const { data: profile } = await supabase
    .from("profiles")
    .select("current_escola_id")
    .eq("user_id", userId)
    .maybeSingle();

  return (
    String((profile as { current_escola_id?: unknown } | null)?.current_escola_id ?? "").trim() ||
    String(appMetadata?.escola_id ?? "").trim() ||
    null
  );
}

async function resolveIdentifierToEmails(identifier: string): Promise<string[]> {
  if (identifier.includes("@")) return [identifier.toLowerCase()];

  const fallbackEmails = buildCanonicalStudentEmails(identifier);

  const token = readEnv(process.env.AUTH_ADMIN_JOB_TOKEN, process.env.CRON_SECRET);
  if (!token) return fallbackEmails;

  const baseUrl = resolveAuthAdminBaseUrl();

  try {
    const response = await fetch(`${baseUrl.replace(/\/$/, "")}/api/jobs/auth-admin`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-job-token": token,
      },
      body: JSON.stringify({ action: "resolveIdentifierToEmail", payload: { identifier } }),
      cache: "no-store",
    });

    const json = (await response.json().catch(() => null)) as ResolveIdentifierJobResponse | null;
    if (!response.ok || !json?.ok) return fallbackEmails;

    const email = json.data?.email;
    return uniqueEmails([email, ...fallbackEmails]);
  } catch {
    return fallbackEmails;
  }
}

async function recordUserAccess(params: {
  userId: string;
  tenantId: string | null;
  tenantType: "k12" | "formacao" | "solo_creator" | null;
  role: string | null;
  access: AccessContext;
}) {
  const token = readEnv(process.env.AUTH_ADMIN_JOB_TOKEN, process.env.CRON_SECRET);
  if (!token) return;

  const baseUrl = resolveAuthAdminBaseUrl();

  try {
    await fetch(`${baseUrl.replace(/\/$/, "")}/api/jobs/auth-admin`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-job-token": token,
      },
      body: JSON.stringify({
        action: "recordUserAccess",
        payload: {
          userId: params.userId,
          tenantId: params.tenantId,
          tenantType: params.tenantType,
          role: params.role,
          route: "/login",
          ip: params.access.ip,
          userAgent: params.access.userAgent,
          geo: params.access.geo,
        },
      }),
      cache: "no-store",
    });
  } catch {
    // Login não deve falhar por telemetria operacional.
  }
}

export async function loginAction(_: unknown, formData: FormData) {
  const headerStore = await headers();
  const access = getAccessContext(headerStore);
  const rate = await checkLoginRateLimit(access.ip);
  if (!rate.success) {
    logAuthEvent({
      action: "deny",
      route: "/login",
      details: { reason: "rate_limited", ip: rate.ip },
    });
    return { ok: false, message: "Muitas tentativas. Tente novamente em instantes." };
  }

  const parsed = LoginSchema.safeParse({
    identifier: formData.get("identifier"),
    password: formData.get("password"),
    redirect_to: formData.get("redirect_to"),
  });

  if (!parsed.success) {
    const message = parsed.error.errors.map((err) => err.message).join(" ");
    logAuthEvent({
      action: "deny",
      route: "/login",
      details: { reason: "invalid_payload", ip: rate.ip },
    });
    return { ok: false, message };
  }

  console.info(
    JSON.stringify({
      event: "login_attempt",
      user: parsed.data.identifier.trim().toLowerCase(),
      ip: rate.ip,
      timestamp: new Date().toISOString(),
    })
  );

  try {
    const emails = await resolveIdentifierToEmails(parsed.data.identifier);
    if (emails.length === 0) {
      throw new Error("INVALID_CREDENTIALS");
    }

    const supabase = await supabaseRouteClient();
    let signedInUserId: string | null = null;
    let signedInUserAppMetadata: Record<string, unknown> | null = null;
    for (const email of emails) {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password: parsed.data.password,
      });
      if (!error && data.user) {
        signedInUserId = data.user.id;
        signedInUserAppMetadata = (data.user.app_metadata as Record<string, unknown> | null) ?? null;
        break;
      }
    }

    if (!signedInUserId) {
      throw new Error("INVALID_CREDENTIALS");
    }

    logAuthEvent({
      action: "login",
      route: "/login",
      user_id: signedInUserId,
      tenant_type: null,
      details: { ip: rate.ip },
    });
    console.info(
      JSON.stringify({
        event: "login_success",
        path: "/login",
        hasSession: true,
        timestamp: new Date().toISOString(),
      })
    );

    const tenants = await getUserTenants(signedInUserId);
    let selectedTenant: (typeof tenants)[number] | null = null;
    if (tenants.length === 1) {
      const single = tenants[0];
      selectedTenant = single;
      await setTenantContextCookie({
        uid: signedInUserId,
        tenant_id: single.tenantId,
        tenant_slug: single.tenantSlug,
        tenant_type: single.tenantType,
        role: single.role,
      });
    } else {
      const preferredTenantId = await resolvePreferredTenantIdForUser(
        supabase,
        signedInUserId,
        signedInUserAppMetadata
      );
      selectedTenant = preferredTenantId
        ? tenants.find((tenant) => tenant.tenantId === preferredTenantId) ?? null
        : null;

      if (selectedTenant) {
        await setTenantContextCookie({
          uid: signedInUserId,
          tenant_id: selectedTenant.tenantId,
          tenant_slug: selectedTenant.tenantSlug,
          tenant_type: selectedTenant.tenantType,
          role: selectedTenant.role,
        });
      } else {
        await clearTenantContextCookie();
      }
    }

    await recordUserAccess({
      userId: signedInUserId,
      tenantId: selectedTenant?.tenantId ?? null,
      tenantType: selectedTenant?.tenantType ?? null,
      role: selectedTenant?.role ?? null,
      access,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (message.includes("Supabase env")) {
      return { ok: false, message: "Configuração de autenticação inválida no servidor." };
    }
    logAuthEvent({
      action: "deny",
      route: "/login",
      details: { reason: "invalid_credentials", ip: rate.ip },
    });
    return { ok: false, message: "Credenciais inválidas. Verifique os dados e tente novamente." };
  }

  const returnTo = normalizeReturnTo(parsed.data.redirect_to);
  const qs = returnTo ? `?redirect=${encodeURIComponent(returnTo)}` : "";
  redirect(`/redirect${qs}`);
}
