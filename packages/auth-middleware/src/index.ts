import { createServerClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "../../../types/supabase";

export type TenantType = "k12" | "formacao" | "solo_creator";
export type ProductContext = "k12" | "formacao";

type MiddlewareRequestLike = {
  cookies: {
    getAll: () => Array<{ name: string; value: string }>;
  };
  nextUrl: {
    clone: () => URL;
    protocol: string;
    hostname: string;
    pathname: string;
    search: string;
  };
};

type MiddlewareResponseLike = {
  cookies: {
    set: (name: string, value: string, options?: Record<string, unknown>) => void;
  };
};

type EscolaMembershipRow = Pick<
  Database["public"]["Tables"]["escola_users"]["Row"],
  "escola_id" | "papel" | "tenant_type" | "created_at"
> & {
  escola: Pick<Database["public"]["Tables"]["escolas"]["Row"], "tenant_type">[] | null;
};

export type DbAuthContext = {
  hasSession: boolean;
  userId: string | null;
  tenantId: string | null;
  role: string | null;
  tenantType: TenantType | null;
};

export function resolveSharedCookieOptions(params: {
  nodeEnv: string | undefined;
  domainEnv?: string | null;
  sameSiteEnv?: string | null;
  browserHostname?: string | null;
  isHttps?: boolean;
}) {
  const nodeEnv = String(params.nodeEnv ?? "").trim().toLowerCase();
  const isProduction = nodeEnv === "production";
  const browserHost = String(params.browserHostname ?? "").trim().toLowerCase();
  
  // Se estivermos em qualquer subdomínio do klasse.ao, forçamos o uso do domínio wildcard
  const isBrowserHostKlasse = browserHost.endsWith(".klasse.ao") || browserHost === "klasse.ao";

  const configuredDomain = String(params.domainEnv ?? "").trim();
  const domain = configuredDomain || (isBrowserHostKlasse ? ".klasse.ao" : isProduction ? ".klasse.ao" : "");

  const sameSiteRaw = String(params.sameSiteEnv ?? "lax")
    .trim()
    .toLowerCase();
  const sameSite: "lax" | "strict" | "none" =
    sameSiteRaw === "strict" || sameSiteRaw === "none" ? sameSiteRaw : "lax";

  // Se estivermos no klasse.ao, forçamos secure true pois usamos HTTPS sempre lá
  const secure = params.isHttps || isProduction || isBrowserHostKlasse;

  return {
    ...(domain ? { domain } : {}),
    path: "/",
    sameSite,
    secure,
    httpOnly: true,
  };
}

export function createMiddlewareSupabaseClient(params: {
  request: MiddlewareRequestLike;
  response: MiddlewareResponseLike;
  supabaseUrl?: string | null;
  supabaseAnonKey?: string | null;
  cookieDomain?: string | null;
  cookieSameSite?: string | null;
  nodeEnv?: string;
}): SupabaseClient<Database> | null {
  const url = String(params.supabaseUrl ?? "").trim();
  const key = String(params.supabaseAnonKey ?? "").trim();
  if (!url || !key) return null;

  const cookieOptions = resolveSharedCookieOptions({
    nodeEnv: params.nodeEnv,
    domainEnv: params.cookieDomain,
    sameSiteEnv: params.cookieSameSite,
    browserHostname: params.request.nextUrl.hostname,
    isHttps: params.request.nextUrl.protocol === "https:",
  });

  return createServerClient<Database>(url, key, {
    cookieOptions,
    cookies: {
      getAll() {
        return params.request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value, options }) => {
          params.response.cookies.set(name, value, options);
        });
      },
    },
  });
}

function normalizeTenantType(value: unknown): TenantType | null {
  const normalized = String(value ?? "")
    .trim()
    .toLowerCase();
  if (normalized === "k12" || normalized === "formacao" || normalized === "solo_creator") return normalized;
  return null;
}

function resolveMembershipTenantType(row: EscolaMembershipRow | null): TenantType | null {
  if (!row) return null;
  const escolaTenant = Array.isArray(row.escola) ? row.escola[0]?.tenant_type : null;
  return normalizeTenantType(row.tenant_type ?? escolaTenant ?? null);
}

export async function resolveDbAuthContext(params: {
  supabase: SupabaseClient<Database>;
  preferredTenantType?: TenantType | null;
}): Promise<DbAuthContext> {
  const { data: authRes } = await params.supabase.auth.getUser();
  const user = authRes?.user;
  if (!user) {
    return {
      hasSession: false,
      userId: null,
      tenantId: null,
      role: null,
      tenantType: null,
    };
  }

  const { data: profileRows } = await params.supabase
    .from("profiles")
    .select("current_escola_id,created_at")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(1);
  const currentEscolaId = profileRows?.[0]?.current_escola_id ?? null;

  const { data: membershipRows } = await params.supabase
    .from("escola_users")
    .select("escola_id,papel,tenant_type,created_at,escola:escolas(tenant_type)")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });
  const memberships = (membershipRows ?? []) as unknown as EscolaMembershipRow[];

  const selectedMembership =
    memberships.find((row) => row.escola_id === currentEscolaId) ??
    (params.preferredTenantType
      ? memberships.find((row) => resolveMembershipTenantType(row) === params.preferredTenantType)
      : null) ??
    memberships[0] ??
    null;

  return {
    hasSession: true,
    userId: user.id,
    tenantId: selectedMembership?.escola_id ?? null,
    role: selectedMembership?.papel?.trim().toLowerCase() ?? null,
    tenantType: resolveMembershipTenantType(selectedMembership),
  };
}

export function buildProductRedirectUrl(params: {
  requestUrl: URL;
  targetProduct: ProductContext;
  pathname: string;
  localK12Origin?: string;
  localFormacaoOrigin?: string;
}) {
  const redirectUrl = new URL(params.requestUrl.toString());
  const isLocalRequestHost =
    redirectUrl.hostname === "localhost" ||
    redirectUrl.hostname === "127.0.0.1" ||
    redirectUrl.hostname.endsWith(".localhost");

  if (isLocalRequestHost) {
    const originRaw =
      params.targetProduct === "formacao"
        ? params.localFormacaoOrigin ?? "http://localhost:3001"
        : params.localK12Origin ?? "http://localhost:3000";

    try {
      const origin = new URL(originRaw);
      redirectUrl.protocol = origin.protocol;
      redirectUrl.hostname = origin.hostname;
      redirectUrl.port = origin.port;
    } catch {
      redirectUrl.hostname = params.targetProduct === "formacao" ? "formacao.klasse.ao" : "app.klasse.ao";
    }
  } else {
    redirectUrl.hostname = params.targetProduct === "formacao" ? "formacao.klasse.ao" : "app.klasse.ao";
  }

  redirectUrl.pathname = params.pathname;
  if (redirectUrl.protocol === "http:" && redirectUrl.hostname.endsWith("klasse.ao")) {
    redirectUrl.protocol = "https:";
    redirectUrl.port = "";
  }

  return redirectUrl;
}
