// apps/web/src/middleware.ts
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { isEscolaUuid } from '@/lib/tenant/escolaSlug';
import { resolveEscolaParam } from '@/lib/tenant/resolveEscolaParam';
import { logAuthEvent } from '@/lib/auth/logAuthEvent';
import {
  buildProductRedirectUrl,
  createMiddlewareSupabaseClient,
  resolveDbAuthContext,
  type DbAuthContext,
} from '@moxi/auth-middleware';
import {
  detectProductContextFromHostname,
  normalizeTenantType,
  type ProductContext,
  type TenantType,
} from '@moxi/tenant-sdk';
import { isRoleAllowedForProduct } from '@/lib/permissions';

type AuthContext = Pick<DbAuthContext, 'userId' | 'role' | 'tenantId' | 'tenantType'> & {
  escolaId: string | null;
  tenantSlug: string | null;
};

type TenantContextCookiePayload = {
  uid: string;
  tenant_id: string;
  tenant_slug?: string | null;
  tenant_type: TenantType;
  role: string;
  iat?: number;
  exp: number;
};

type TenantContextCookieCandidate = AuthContext & {
  issuedAt: number;
  expiresAt: number;
};

// Simulação de Rate Limiting simples em memória (Edge Runtime)
// Nota: Em produção real, o Edge Runtime pode resetar a memória entre instâncias.
// Para 100 escolas, o ideal é usar Upstash Redis ou similar.
const rateLimitMap = new Map<string, { count: number, lastReset: number }>();
const escolaSlugCache = new Map<string, { id: string; slug: string; expiresAt: number }>();

const LIMITS = {
  STRICT: { count: 5, windowMs: 60 * 1000 }, // 5 reqs por minuto
  PUBLIC: { count: 30, windowMs: 60 * 1000 }, // 30 reqs por minuto
  OPERATIONAL: { count: 120, windowMs: 60 * 1000 }, // 120 reqs por minuto para APIs operacionais autenticadas
};

const ESCOLA_SLUG_TTL_MS = 5 * 60 * 1000;
const TENANT_CONTEXT_COOKIE = 'klasse_ctx';
const UPSTASH_REDIS_REST_URL = process.env.UPSTASH_REDIS_REST_URL;
const UPSTASH_REDIS_REST_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN;
const CORS_ALLOWED_ORIGINS = (process.env.CORS_ALLOWED_ORIGINS ?? '')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

async function isRateLimited(ip: string, limitKey: keyof typeof LIMITS) {
  const now = Date.now();
  const limit = LIMITS[limitKey];
  const redisEnabled = Boolean(UPSTASH_REDIS_REST_URL && UPSTASH_REDIS_REST_TOKEN);
  const key = `${ip}:${limitKey}`;

  if (redisEnabled) {
    try {
      const redisKey = `rl:${key}`;
      const encodedKey = encodeURIComponent(redisKey);
      const incrRes = await fetch(`${UPSTASH_REDIS_REST_URL}/incr/${encodedKey}`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${UPSTASH_REDIS_REST_TOKEN}`,
        },
      });

      if (incrRes.ok) {
        const incrJson = await incrRes.json() as { result?: number };
        const count = Number(incrJson?.result ?? 0);

        if (count === 1) {
          const ttlSeconds = Math.ceil(limit.windowMs / 1000);
          await fetch(`${UPSTASH_REDIS_REST_URL}/expire/${encodedKey}/${ttlSeconds}`, {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${UPSTASH_REDIS_REST_TOKEN}`,
            },
          });
        }

        return count > limit.count;
      }
    } catch {
      // fallback para memória local caso Redis esteja indisponível
    }
  }

  const record = rateLimitMap.get(key) || { count: 0, lastReset: now };

  if (now - record.lastReset > limit.windowMs) {
    record.count = 1;
    record.lastReset = now;
  } else {
    record.count++;
  }

  rateLimitMap.set(key, record);
  return record.count > limit.count;
}

function isOperationalApiPath(pathname: string) {
  return (
    pathname.startsWith('/api/financeiro/') ||
    pathname.startsWith('/api/secretaria/') ||
    pathname.startsWith('/api/professor/') ||
    pathname.startsWith('/api/aluno/')
  );
}

function isApiPath(pathname: string) {
  return pathname.startsWith('/api/');
}

function resolveAllowedOrigin(request: NextRequest, origin: string | null) {
  if (!origin) return null;
  const allowed = new Set<string>([request.nextUrl.origin, ...CORS_ALLOWED_ORIGINS]);
  return allowed.has(origin) ? origin : null;
}

function applyCorsHeaders(response: NextResponse, allowedOrigin: string | null) {
  if (!allowedOrigin) return;
  response.headers.set('Access-Control-Allow-Origin', allowedOrigin);
  response.headers.set('Access-Control-Allow-Methods', 'GET,POST,PUT,PATCH,DELETE,OPTIONS');
  response.headers.set('Access-Control-Allow-Headers', 'Authorization,Content-Type,X-Requested-With');
  response.headers.set('Access-Control-Allow-Credentials', 'true');
  response.headers.set('Vary', 'Origin');
}

function applySecurityHeaders(request: NextRequest, response: NextResponse) {
  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('X-Frame-Options', 'SAMEORIGIN');
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  response.headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  response.headers.set('X-DNS-Prefetch-Control', 'off');
  if (request.nextUrl.protocol === 'https:') {
    response.headers.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  }
}

function finalizeResponse(request: NextRequest, response: NextResponse, allowedOrigin: string | null) {
  applyCorsHeaders(response, allowedOrigin);
  applySecurityHeaders(request, response);
  return response;
}

const PORTAL_RULES: Array<{ prefix: string; roles: string[] }> = [
  {
    prefix: '/admin',
    roles: ['admin', 'admin_escola', 'staff_admin', 'super_admin', 'global_admin', 'formacao_admin'],
  },
  {
    prefix: '/secretaria',
    roles: ['secretaria', 'secretaria_financeiro', 'admin_financeiro', 'admin', 'admin_escola', 'staff_admin', 'super_admin', 'global_admin', 'formacao_secretaria', 'formacao_admin'],
  },
  {
    prefix: '/financeiro',
    roles: ['financeiro', 'secretaria_financeiro', 'admin_financeiro', 'admin', 'admin_escola', 'staff_admin', 'super_admin', 'global_admin', 'formacao_financeiro', 'formacao_admin'],
  },
  {
    prefix: '/professor',
    roles: ['professor', 'admin', 'admin_escola', 'staff_admin', 'super_admin', 'global_admin', 'formador'],
  },
  {
    prefix: '/aluno',
    roles: ['aluno', 'encarregado', 'formando'],
  },
  {
    prefix: '/agenda',
    roles: ['formador'],
  },
  {
    prefix: '/minhas-turmas',
    roles: ['formador'],
  },
  {
    prefix: '/honorarios',
    roles: ['formador'],
  },
  {
    prefix: '/dashboard',
    roles: ['formando'],
  },
  {
    prefix: '/meus-cursos',
    roles: ['formando'],
  },
  {
    prefix: '/pagamentos',
    roles: ['formando'],
  },
  {
    prefix: '/loja-cursos',
    roles: ['formando'],
  },
  {
    prefix: '/conquistas',
    roles: ['formando'],
  },
  {
    prefix: '/formacao',
    roles: ['formacao_admin', 'formacao_secretaria', 'formacao_financeiro', 'formador', 'formando'],
  },
];

function safeAbsoluteUrl(
  value: string | undefined,
  fallback: string
): string {
  const candidate = (value ?? "").trim();
  if (candidate) {
    try {
      const parsed = new URL(candidate);
      if (parsed.protocol === "http:" || parsed.protocol === "https:") {
        return parsed.toString();
      }
    } catch {
      // ignore invalid candidate and fallback below
    }
  }
  return fallback;
}

export function resolveUniversalLoginUrl(): string {
  if (process.env.NODE_ENV !== "production") {
    return safeAbsoluteUrl(
      process.env.KLASSE_AUTH_LOCAL_URL,
      "http://auth.lvh.me:3000/login"
    );
  }

  const configured = process.env.KLASSE_AUTH_URL?.trim();
  if (!configured) {
    throw new Error("Missing KLASSE_AUTH_URL in production");
  }

  return safeAbsoluteUrl(
    configured,
    configured
  );
}

function getLandingPathByContext(ctx: AuthContext): string {
  const escolaParam = ctx.tenantSlug || ctx.escolaId;

  if (ctx.tenantType === 'formacao') {
    if (ctx.role === 'formador') return '/agenda';
    if (ctx.role === 'formando') return '/dashboard';
    if (ctx.role === 'formacao_financeiro') return '/financeiro/dashboard';
    if (ctx.role === 'formacao_secretaria') return '/secretaria/catalogo-cursos';
    return '/admin/dashboard';
  }

  if (ctx.role === 'professor') return escolaParam ? `/escola/${escolaParam}/professor` : '/professor';
  if (ctx.role === 'aluno' || ctx.role === 'encarregado') return escolaParam ? `/escola/${escolaParam}/aluno` : '/aluno';
  if (ctx.role === 'financeiro') return escolaParam ? `/escola/${escolaParam}/financeiro` : '/financeiro';
  if (ctx.role === 'secretaria') return escolaParam ? `/escola/${escolaParam}/secretaria` : '/secretaria';
  return escolaParam ? `/escola/${escolaParam}/admin` : '/admin';
}

function pathRequiresK12Model(pathname: string): boolean {
  return (
    pathname.startsWith('/admin') ||
    pathname.startsWith('/professor') ||
    pathname.startsWith('/aluno') ||
    pathname.startsWith('/secretaria') ||
    pathname.startsWith('/financeiro')
  );
}

function pathRequiresFormacaoModel(pathname: string): boolean {
  return (
    pathname.startsWith('/formacao') ||
    pathname.startsWith('/agenda') ||
    pathname.startsWith('/minhas-turmas') ||
    pathname.startsWith('/honorarios') ||
    pathname.startsWith('/meus-cursos') ||
    pathname.startsWith('/pagamentos') ||
    pathname.startsWith('/loja-cursos') ||
    pathname.startsWith('/conquistas')
  );
}

function resolveTenantContextCookieSecret() {
  return (
    process.env.KLASSE_CONTEXT_COOKIE_SECRET?.trim() ||
    process.env.AUTH_CONTEXT_COOKIE_SECRET?.trim() ||
    process.env.CRON_SECRET?.trim() ||
    process.env.AUTH_ADMIN_JOB_TOKEN?.trim() ||
    'dev-only-klasse-context-secret'
  );
}

function base64UrlToBytes(value: string): Uint8Array {
  const normalized = value.replace(/-/g, '+').replace(/_/g, '/');
  const padded = normalized + '='.repeat((4 - (normalized.length % 4)) % 4);
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

function bytesToBase64Url(bytes: Uint8Array): string {
  let binary = '';
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

async function signTenantContextPayload(payloadEncoded: string): Promise<string | null> {
  const cryptoApi = globalThis.crypto;
  if (!cryptoApi?.subtle) return null;
  const key = await cryptoApi.subtle.importKey(
    'raw',
    new TextEncoder().encode(resolveTenantContextCookieSecret()),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const signature = await cryptoApi.subtle.sign('HMAC', key, new TextEncoder().encode(payloadEncoded));
  return bytesToBase64Url(new Uint8Array(signature));
}

function hasLikelySupabaseSessionCookie(request: NextRequest): boolean {
  return request.cookies
    .getAll()
    .some(
      ({ name }) =>
        name.startsWith('sb-') &&
        (name.includes('auth-token') || name.includes('access-token') || name.includes('refresh-token'))
    );
}

function getCookieValues(request: NextRequest, name: string): string[] {
  const values = request.cookies.getAll(name).map((cookie) => cookie.value);
  const rawCookieHeader = request.headers.get('cookie') ?? '';

  for (const part of rawCookieHeader.split(';')) {
    const [rawName, ...rawValueParts] = part.trim().split('=');
    if (rawName === name && rawValueParts.length > 0) {
      values.push(rawValueParts.join('='));
    }
  }

  return values.filter((value, index, all) => value && all.indexOf(value) === index);
}

async function decodeTenantContextCookie(raw: string): Promise<TenantContextCookieCandidate | null> {
  const [payloadEncoded, signature] = raw.split('.');
  if (!payloadEncoded || !signature) return null;

  const expectedSignature = await signTenantContextPayload(payloadEncoded);
  if (!expectedSignature || expectedSignature !== signature) return null;

  try {
    const payloadJson = new TextDecoder().decode(base64UrlToBytes(payloadEncoded));
    const payload = JSON.parse(payloadJson) as TenantContextCookiePayload;
    const tenantType = normalizeTenantType(payload.tenant_type);

    if (!payload.uid || !payload.tenant_id || !tenantType || !payload.role || !payload.exp) return null;
    if (payload.exp <= Math.floor(Date.now() / 1000)) return null;

    return {
      userId: payload.uid,
      tenantId: payload.tenant_id,
      escolaId: payload.tenant_id,
      tenantSlug: payload.tenant_slug ? String(payload.tenant_slug) : null,
      role: String(payload.role).trim().toLowerCase() || null,
      tenantType,
      issuedAt: Number(payload.iat ?? 0),
      expiresAt: Number(payload.exp ?? 0),
    };
  } catch {
    return null;
  }
}

async function resolveAuthContextFromTenantCookie(request: NextRequest): Promise<AuthContext | null> {
  if (!hasLikelySupabaseSessionCookie(request)) return null;

  const rawCookies = getCookieValues(request, TENANT_CONTEXT_COOKIE);
  if (rawCookies.length === 0) return null;

  const candidates = (
    await Promise.all(rawCookies.map((raw) => decodeTenantContextCookie(raw)))
  ).filter((candidate): candidate is TenantContextCookieCandidate => candidate !== null);
  if (candidates.length === 0) return null;

  candidates.sort((a, b) => b.issuedAt - a.issuedAt || b.expiresAt - a.expiresAt);
  const { issuedAt: _issuedAt, expiresAt: _expiresAt, ...authContext } = candidates[0];
  return authContext;
}

async function resolveAuthContext(request: NextRequest, response: NextResponse): Promise<AuthContext | null> {
  const cookieContext = await resolveAuthContextFromTenantCookie(request);
  if (cookieContext) return cookieContext;

  const supabase = createSupabaseClient(request, response);
  if (!supabase) return null;

  const resolved = await resolveDbAuthContext({
    supabase,
    preferredTenantType: null,
  });
  if (!resolved.hasSession) return null;

  return {
    userId: resolved.userId,
    role: resolved.role,
    tenantId: resolved.tenantId,
    escolaId: resolved.tenantId,
    tenantSlug: null,
    tenantType: resolved.tenantType as TenantType | null,
  };
}

function redirectToProductHost(
  request: NextRequest,
  target: Exclude<ProductContext, 'unknown' | 'landing'>,
  pathname: string
) {
  const redirectUrl = buildProductRedirectUrl({
    requestUrl: request.nextUrl,
    targetProduct: target,
    pathname,
    localK12Origin: process.env.KLASSE_K12_LOCAL_ORIGIN ?? 'http://app.lvh.me:3001',
    localFormacaoOrigin: process.env.KLASSE_FORMACAO_LOCAL_ORIGIN ?? 'http://formacao.lvh.me:3002',
  });
  const sameDestination =
    redirectUrl.protocol === request.nextUrl.protocol &&
    redirectUrl.hostname === request.nextUrl.hostname &&
    redirectUrl.port === request.nextUrl.port &&
    redirectUrl.pathname === request.nextUrl.pathname &&
    redirectUrl.search === request.nextUrl.search;
  if (sameDestination) {
    return NextResponse.next();
  }
  return NextResponse.redirect(redirectUrl);
}

function createForbiddenResponse(baseResponse: NextResponse, isApi: boolean) {
  const denied = isApi
    ? NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    : new NextResponse('Forbidden', { status: 403 });
  applyResponseCookies(baseResponse, denied);
  return denied;
}

function redirectToCentralAuth(request: NextRequest, baseResponse: NextResponse) {
  const loginUrl = new URL(resolveUniversalLoginUrl());
  const canonicalOrigin = safeAbsoluteUrl(
    process.env.KLASSE_K12_LOCAL_ORIGIN,
    "http://app.lvh.me:3001"
  );
  const canonicalReturnTo =
    process.env.NODE_ENV !== 'production'
      ? new URL(
          `${request.nextUrl.pathname}${request.nextUrl.search}`,
          canonicalOrigin
        ).toString()
      : request.nextUrl.href;
  loginUrl.searchParams.set('redirect', canonicalReturnTo);
  const redirectResponse = NextResponse.redirect(loginUrl);
  applyResponseCookies(baseResponse, redirectResponse);
  return redirectResponse;
}

function createSupabaseClient(request: NextRequest, response: NextResponse) {
  return createMiddlewareSupabaseClient({
    request,
    response,
    supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL,
    supabaseAnonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    cookieDomain: process.env.KLASSE_COOKIE_DOMAIN?.trim() || process.env.KLASSE_AUTH_COOKIE_DOMAIN?.trim(),
    cookieSameSite: process.env.KLASSE_COOKIE_SAMESITE ?? process.env.KLASSE_AUTH_COOKIE_SAMESITE ?? 'lax',
    nodeEnv: process.env.NODE_ENV,
  });
}

function applyResponseCookies(source: NextResponse, target: NextResponse) {
  source.cookies.getAll().forEach(({ name, value, ...options }) => {
    target.cookies.set(name, value, options);
  });
}

async function resolveEscolaSlugMapping(
  request: NextRequest,
  response: NextResponse,
  escolaParam: string,
  authContext?: AuthContext | null
) {
  const cacheKey = escolaParam.toLowerCase();
  const cached = escolaSlugCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) {
    return cached;
  }

  if (authContext?.escolaId) {
    const tenantSlug = authContext.tenantSlug?.trim() || null;
    const matchesCurrentTenant =
      String(escolaParam) === String(authContext.escolaId) ||
      (tenantSlug ? cacheKey === tenantSlug.toLowerCase() : false);

    if (matchesCurrentTenant) {
      const entry = {
        id: String(authContext.escolaId),
        slug: tenantSlug ?? String(authContext.escolaId),
        expiresAt: Date.now() + ESCOLA_SLUG_TTL_MS,
      };
      escolaSlugCache.set(`id:${entry.id}`, entry);
      escolaSlugCache.set(`slug:${entry.slug.toLowerCase()}`, entry);
      escolaSlugCache.set(cacheKey, entry);
      return entry;
    }
  }

  const supabase = createSupabaseClient(request, response);
  if (!supabase) return null;

  const resolved = await resolveEscolaParam(supabase, escolaParam);
  if (!resolved.escolaId || !resolved.slug) return null;

  const entry = { id: resolved.escolaId, slug: resolved.slug, expiresAt: Date.now() + ESCOLA_SLUG_TTL_MS };
  escolaSlugCache.set(`id:${resolved.escolaId}`, entry);
  escolaSlugCache.set(`slug:${resolved.slug.toLowerCase()}`, entry);
  escolaSlugCache.set(cacheKey, entry);

  return entry;
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const host = (request.headers.get('x-forwarded-host') ?? request.headers.get('host') ?? '')
    .split(',')[0]
    .trim()
    .toLowerCase();

  // Força redirecionamento imediato para Central Auth se acessar /login local
  if (pathname === '/login' || pathname === '/login/') {
    console.info(`[Middleware:Web] Intercepted ${pathname} for host ${host}. Redirecting to Central Auth.`);
    const centralLogin = new URL(resolveUniversalLoginUrl());
    centralLogin.searchParams.set('redirect', request.nextUrl.origin + '/redirect');
    return NextResponse.redirect(centralLogin);
  }

  if (
    process.env.NODE_ENV !== 'production' &&
    (host.startsWith('localhost') || host.startsWith('127.0.0.1') || host.endsWith('.localhost'))
  ) {
    const canonicalOrigin = (process.env.KLASSE_K12_LOCAL_ORIGIN ?? 'http://app.lvh.me:3001').trim();
    try {
      const canonical = new URL(canonicalOrigin);
      if (canonical.host && canonical.host !== host) {
        const next = request.nextUrl.clone();
        next.protocol = canonical.protocol;
        next.hostname = canonical.hostname;
        next.port = canonical.port;
        return NextResponse.redirect(next, 307);
      }
    } catch {
      // ignore invalid canonical origin and continue normal flow
    }
  }

  const productContext = detectProductContextFromHostname(request.headers.get('host'));
  const apiPath = isApiPath(pathname);
  const origin = request.headers.get('origin');
  const allowedOrigin = resolveAllowedOrigin(request, origin);
  
  // Obtém o IP de forma segura para o TypeScript e compatível com Edge/Vercel
  const forwardedFor = request.headers.get('x-forwarded-for');
  const ip = forwardedFor ? forwardedFor.split(',')[0] : '127.0.0.1';

  if (apiPath && request.method === 'OPTIONS') {
    if (origin && !allowedOrigin) {
      return finalizeResponse(
        request,
        NextResponse.json({ error: 'Origin not allowed' }, { status: 403 }),
        null
      );
    }
    return finalizeResponse(request, new NextResponse(null, { status: 204 }), allowedOrigin);
  }

  if (apiPath && origin && !allowedOrigin) {
    return finalizeResponse(
      request,
      NextResponse.json({ error: 'Origin not allowed' }, { status: 403 }),
      null
    );
  }

  // 1. Rate Limiting para Endpoints Críticos (STRICT)
  if (
    pathname.startsWith('/api/escolas/create') || 
    pathname.startsWith('/api/auth/login') ||
    pathname.startsWith('/api/alunos/ativar-acesso')
  ) {
    if (await isRateLimited(ip, 'STRICT')) {
      return finalizeResponse(
        request,
        new NextResponse(
          JSON.stringify({ error: 'Too many requests. Please try again later.' }),
          { status: 429, headers: { 'Content-Type': 'application/json' } }
        ),
        allowedOrigin
      );
    }
  }

  // 2. Rate Limiting para Acesso Público (PUBLIC)
  if (
    pathname.startsWith('/api/public/documentos') ||
    pathname.startsWith('/api/public/admissoes')
  ) {
    const isSubmission = pathname.endsWith('/candidatar');
    const limitTier = isSubmission ? 'STRICT' : 'PUBLIC';

    if (await isRateLimited(ip, limitTier)) {
      return finalizeResponse(
        request,
        new NextResponse(
          JSON.stringify({ error: 'Too many requests. Please try again later.' }),
          { status: 429, headers: { 'Content-Type': 'application/json' } }
        ),
        allowedOrigin
      );
    }
  }

  // 3. Rate Limiting para APIs operacionais (OPERATIONAL)
  if (isOperationalApiPath(pathname)) {
    if (await isRateLimited(ip, 'OPERATIONAL')) {
      return finalizeResponse(
        request,
        new NextResponse(
          JSON.stringify({ error: 'Too many requests. Please try again later.' }),
          { status: 429, headers: { 'Content-Type': 'application/json' } }
        ),
        allowedOrigin
      );
    }
  }

  const response = NextResponse.next();
  const fastAuthContext = await resolveAuthContextFromTenantCookie(request);

  const escolaMatch = pathname.match(/^\/(api\/)?escolas?\/([^/]+)(\/.*)?$/);
  if (escolaMatch) {
    const isApi = Boolean(escolaMatch[1]);
    const isPlural = pathname.includes('/escolas/');
    const escolaParam = escolaMatch[2];
    const suffix = escolaMatch[3] ?? '';

    if (escolaParam !== 'suspensa') {
      const resolved = await resolveEscolaSlugMapping(request, response, escolaParam, fastAuthContext);
      if (resolved) {
        const tenant = fastAuthContext ?? await resolveAuthContext(request, response);
        if (!tenant) {
          if (!isApi) {
            console.info(
              JSON.stringify({
                event: 'redirect_decision',
                path: pathname,
                hasSession: false,
                timestamp: new Date().toISOString(),
              })
            );
            return finalizeResponse(request, redirectToCentralAuth(request, response), allowedOrigin);
          }
          return finalizeResponse(request, createForbiddenResponse(response, isApi), allowedOrigin);
        }

        if (tenant.role !== 'global_admin') {
          if (!tenant.escolaId || tenant.escolaId !== resolved.id) {
            return finalizeResponse(request, createForbiddenResponse(response, isApi), allowedOrigin);
          }
        }

        if (isEscolaUuid(escolaParam) && !isApi && resolved.slug !== escolaParam) {
          const redirectUrl = request.nextUrl.clone();
          // UI is always singular /escola
          redirectUrl.pathname = `/escola/${resolved.slug}${suffix}`;
          const redirectResponse = NextResponse.redirect(redirectUrl, 301);
          applyResponseCookies(response, redirectResponse);
          return finalizeResponse(request, redirectResponse, allowedOrigin);
        }

        if (!isEscolaUuid(escolaParam)) {
          const rewrittenUrl = request.nextUrl.clone();
          const apiPrefix = isPlural ? '/api/escolas' : '/api/escola';
          const prefix = isApi ? apiPrefix : '/escola';
          rewrittenUrl.pathname = `${prefix}/${resolved.id}${suffix}`;
          const rewriteResponse = NextResponse.rewrite(rewrittenUrl);
          applyResponseCookies(response, rewriteResponse);
          return finalizeResponse(request, rewriteResponse, allowedOrigin);
        }
      }
    }
  }

  const portalRule = PORTAL_RULES.find((rule) => pathname.startsWith(rule.prefix));
  if (!portalRule) return finalizeResponse(request, response, allowedOrigin);

  const authContext = fastAuthContext ?? await resolveAuthContext(request, response);
  if (!authContext?.role) {
    console.info(
      JSON.stringify({
        event: 'redirect_decision',
        path: pathname,
        hasSession: false,
        timestamp: new Date().toISOString(),
      })
    );
    logAuthEvent({
      action: 'resolve_context_failed',
      route: pathname,
      user_id: authContext?.userId ?? null,
      tenant_id: authContext?.escolaId ?? null,
      tenant_type: authContext?.tenantType ?? null,
      details: { reason: 'role_not_resolved' },
    });
    return finalizeResponse(request, redirectToCentralAuth(request, response), allowedOrigin);
  }

  if (
    productContext === 'formacao' &&
    pathRequiresK12Model(pathname)
  ) {
    if (apiPath) {
      logAuthEvent({
        action: 'deny',
        route: pathname,
        user_id: authContext.userId,
        tenant_id: authContext.escolaId,
        tenant_type: authContext.tenantType,
        details: { reason: 'k12_path_on_formacao_host' },
      });
      return finalizeResponse(request, createForbiddenResponse(response, true), allowedOrigin);
    }
    logAuthEvent({
      action: 'redirect',
      route: pathname,
      user_id: authContext.userId,
      tenant_id: authContext.escolaId,
      tenant_type: authContext.tenantType,
      details: { target_product: 'k12' },
    });
    return finalizeResponse(
      request,
      redirectToProductHost(request, 'k12', getLandingPathByContext(authContext)),
      allowedOrigin
    );
  }

  if (
    productContext === 'k12' &&
    pathRequiresFormacaoModel(pathname)
  ) {
    if (apiPath) {
      logAuthEvent({
        action: 'deny',
        route: pathname,
        user_id: authContext.userId,
        tenant_id: authContext.escolaId,
        tenant_type: authContext.tenantType,
        details: { reason: 'formacao_path_on_k12_host' },
      });
      return finalizeResponse(request, createForbiddenResponse(response, true), allowedOrigin);
    }
    logAuthEvent({
      action: 'redirect',
      route: pathname,
      user_id: authContext.userId,
      tenant_id: authContext.escolaId,
      tenant_type: authContext.tenantType,
      details: { target_product: 'formacao' },
    });
    return finalizeResponse(
      request,
      redirectToProductHost(request, 'formacao', getLandingPathByContext(authContext)),
      allowedOrigin
    );
  }

  const tenantType = authContext.tenantType ?? 'k12';
  if (tenantType === 'formacao' && pathRequiresK12Model(pathname)) {
    logAuthEvent({
      action: 'redirect',
      route: pathname,
      user_id: authContext.userId,
      tenant_id: authContext.escolaId,
      tenant_type: authContext.tenantType,
      details: { reason: 'tenant_type_formacao_on_k12_path', target_product: 'formacao' },
    });
    return finalizeResponse(
      request,
      redirectToProductHost(request, 'formacao', getLandingPathByContext(authContext)),
      allowedOrigin
    );
  }

  if (tenantType === 'k12' && pathRequiresFormacaoModel(pathname)) {
    logAuthEvent({
      action: 'redirect',
      route: pathname,
      user_id: authContext.userId,
      tenant_id: authContext.escolaId,
      tenant_type: authContext.tenantType,
      details: { reason: 'tenant_type_k12_on_formacao_path', target_product: 'k12' },
    });
    return finalizeResponse(
      request,
      redirectToProductHost(request, 'k12', getLandingPathByContext(authContext)),
      allowedOrigin
    );
  }

  if (
    productContext !== 'unknown' &&
    productContext !== 'landing' &&
    authContext.role &&
    !isRoleAllowedForProduct(authContext.role, productContext)
  ) {
    logAuthEvent({
      action: 'deny',
      route: pathname,
      user_id: authContext.userId,
      tenant_id: authContext.escolaId,
      tenant_type: authContext.tenantType,
      details: { reason: 'product_context_role_mismatch', productContext },
    });
    const deniedUrl = request.nextUrl.clone();
    deniedUrl.pathname = getLandingPathByContext(authContext);
    return finalizeResponse(request, NextResponse.redirect(deniedUrl), allowedOrigin);
  }

  if (!portalRule.roles.includes(String(authContext.role))) {
    logAuthEvent({
      action: 'deny',
      route: pathname,
      user_id: authContext.userId,
      tenant_id: authContext.escolaId,
      tenant_type: authContext.tenantType,
      details: { reason: 'portal_rule_role_mismatch', role: authContext.role },
    });
    const deniedUrl = request.nextUrl.clone();
    deniedUrl.pathname = getLandingPathByContext(authContext);
    return finalizeResponse(request, NextResponse.redirect(deniedUrl), allowedOrigin);
  }

  return finalizeResponse(request, response, allowedOrigin);
}

// Configuração para aplicar o middleware apenas em rotas de API sensíveis
export const config = {
  matcher: [
    '/login',
    '/redirect',
    '/mudar-senha',
    '/escola/:path*',
    '/api/escola/:path*',
    '/api/escolas/:path*',
    '/admin/:path*',
    '/super-admin/:path*',
    '/secretaria/:path*',
    '/financeiro/:path*',
    '/professor/:path*',
    '/aluno/:path*',
    '/agenda/:path*',
    '/minhas-turmas/:path*',
    '/honorarios/:path*',
    '/dashboard/:path*',
    '/meus-cursos/:path*',
    '/pagamentos/:path*',
    '/loja-cursos/:path*',
    '/conquistas/:path*',
    '/formacao/:path*',
    '/api/escolas/create/:path*',
    '/api/auth/login/:path*',
    '/api/alunos/ativar-acesso/:path*',
    '/api/public/documentos/:path*',
    '/api/public/admissoes/:path*',
    '/api/financeiro/:path*',
    '/api/secretaria/:path*',
    '/api/professor/:path*',
    '/api/aluno/:path*',
    '/api/jobs/auth-admin',
  ],
};
