// apps/web/src/middleware.ts
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { isEscolaUuid } from '@/lib/tenant/escolaSlug';
import { resolveEscolaParam } from '@/lib/tenant/resolveEscolaParam';
import { logAuthEvent } from '@/lib/auth/logAuthEvent';
import {
  buildProductRedirectUrl,
  createMiddlewareSupabaseClient,
  resolveDbAuthContext,
  type DbAuthContext,
} from '@moxi/auth-middleware';
import type { Database } from '~types/supabase';
import {
  detectProductContextFromHostname,
  normalizeTenantType,
  type ProductContext,
  type TenantType,
} from '@moxi/tenant-sdk';
import { isRoleAllowedForProduct } from '@/lib/permissions';

type AuthContext = Pick<DbAuthContext, 'userId' | 'role' | 'tenantId' | 'tenantType'> & {
  escolaId: string | null;
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

const PRODUCT_HOSTNAMES: Record<Exclude<ProductContext, 'unknown' | 'landing'>, string> = {
  k12: 'app.klasse.ao',
  formacao: 'formacao.klasse.ao',
};
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
  if (ctx.tenantType === 'formacao') {
    if (ctx.role === 'formador') return '/agenda';
    if (ctx.role === 'formando') return '/dashboard';
    if (ctx.role === 'formacao_financeiro') return '/financeiro/dashboard';
    if (ctx.role === 'formacao_secretaria') return '/secretaria/catalogo-cursos';
    return '/admin/dashboard';
  }

  if (ctx.role === 'professor') return '/professor';
  if (ctx.role === 'aluno' || ctx.role === 'encarregado') return '/aluno';
  if (ctx.role === 'financeiro') return '/financeiro';
  if (ctx.role === 'secretaria') return '/secretaria';
  return '/admin';
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

async function resolveAuthContext(request: NextRequest, response: NextResponse): Promise<AuthContext | null> {
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
  escolaParam: string
) {
  const cacheKey = escolaParam.toLowerCase();
  const cached = escolaSlugCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) {
    return cached;
  }

  const supabase = createSupabaseClient(request, response);
  if (!supabase) return null;

  const resolved = await resolveEscolaParam(supabase as any, escolaParam);
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

  if (pathname === '/login' || pathname === '/login/') {
    console.info(`[Middleware:Web] Intercepted ${pathname} for host ${host}. Redirecting to Central Auth.`);
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

  const { pathname } = request.nextUrl;

  // Força redirecionamento imediato para Central Auth se acessar /login local
  if (pathname === '/login' || pathname === '/login/') {
    const centralLogin = new URL(resolveUniversalLoginUrl());
    centralLogin.searchParams.set('redirect', request.nextUrl.origin + '/redirect');
    return NextResponse.redirect(centralLogin);
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

  const escolaMatch = pathname.match(/^\/(api\/)?escolas?\/([^/]+)(\/.*)?$/);
  if (escolaMatch) {
    const isApi = Boolean(escolaMatch[1]);
    const isPlural = pathname.includes('/escolas/');
    const escolaParam = escolaMatch[2];
    const suffix = escolaMatch[3] ?? '';

    if (escolaParam !== 'suspensa') {
      const resolved = await resolveEscolaSlugMapping(request, response, escolaParam);
      if (resolved) {
        const tenant = await resolveAuthContext(request, response);
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

  const authContext = await resolveAuthContext(request, response);
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
