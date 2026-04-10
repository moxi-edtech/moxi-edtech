// apps/web/src/middleware.ts
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { isEscolaUuid } from '@/lib/tenant/escolaSlug';
import { resolveEscolaParam } from '@/lib/tenant/resolveEscolaParam';
import {
  detectProductContextFromHostname,
  normalizeTenantType,
  type ProductContext,
  type TenantType,
} from '@moxi/tenant-sdk';
import { isRoleAllowedForProduct } from '@/lib/permissions';

type AuthContext = {
  role: string | null;
  escolaId: string | null;
  tenantType: TenantType | null;
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

function decodeJwtPayload(token: string): Record<string, unknown> | null {
  const segments = token.split('.');
  if (segments.length < 2) return null;
  try {
    const base64 = segments[1].replace(/-/g, '+').replace(/_/g, '/');
    const padded = base64.padEnd(Math.ceil(base64.length / 4) * 4, '=');
    const json = atob(padded);
    const parsed = JSON.parse(json) as Record<string, unknown>;
    return parsed;
  } catch {
    return null;
  }
}

function extractAccessTokenFromCookies(request: NextRequest): string | null {
  const authCookie = request.cookies
    .getAll()
    .find((cookie) => cookie.name.includes('auth-token') && cookie.name.startsWith('sb-'));
  if (!authCookie?.value) return null;

  try {
    const decoded = decodeURIComponent(authCookie.value);
    const parsed = JSON.parse(decoded) as unknown;
    if (Array.isArray(parsed) && typeof parsed[0] === 'string') return parsed[0];
  } catch {
    // ignore cookie parse issues and fallback below
  }

  return authCookie.value;
}

function extractJwtAuthContext(request: NextRequest): AuthContext | null {
  const bearer = request.headers.get('authorization');
  const accessToken = bearer?.startsWith('Bearer ')
    ? bearer.slice('Bearer '.length).trim()
    : extractAccessTokenFromCookies(request);

  if (!accessToken) return null;
  const payload = decodeJwtPayload(accessToken);
  if (!payload) return null;

  const appMetadata = (payload.app_metadata ?? {}) as Record<string, unknown>;
  const userMetadata = (payload.user_metadata ?? {}) as Record<string, unknown>;

  const role = (appMetadata.role ?? userMetadata.role ?? null) as string | null;
  const escolaId = (appMetadata.escola_id ?? userMetadata.escola_id ?? null) as string | null;
  const tenantType = normalizeTenantType(
    appMetadata.tenant_type ??
      userMetadata.tenant_type ??
      appMetadata.modelo_ensino ??
      userMetadata.modelo_ensino
  );

  return { role, escolaId, tenantType };
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
  const jwtContext = extractJwtAuthContext(request);
  if (jwtContext?.role) {
    return jwtContext;
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return null;

  const supabase = createServerClient(url, key, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
      },
    },
  });

  const { data: userRes } = await supabase.auth.getUser();
  const user = userRes?.user;
  if (!user) return null;

  const appMetadata = (user.app_metadata ?? {}) as Record<string, unknown>;
  const userMetadata = (user.user_metadata ?? {}) as Record<string, unknown>;
  const role = (appMetadata.role ?? userMetadata.role ?? null) as string | null;
  let escolaId = (appMetadata.escola_id ?? userMetadata.escola_id ?? null) as string | null;

  // Fallback para utilizadores legados sem escola_id no JWT metadata.
  if (!escolaId && user.id) {
    const { data: escolaUser } = await supabase
      .from('escola_users')
      .select('escola_id')
      .eq('user_id', user.id)
      .not('escola_id', 'is', null)
      .limit(1)
      .maybeSingle();

    escolaId = (escolaUser?.escola_id as string | null) ?? null;
  }
  const tenantType = normalizeTenantType(
    appMetadata.tenant_type ??
      userMetadata.tenant_type ??
      appMetadata.modelo_ensino ??
      userMetadata.modelo_ensino
  );

  return {
    role,
    escolaId,
    tenantType,
  };
}

function redirectToProductHost(
  request: NextRequest,
  target: Exclude<ProductContext, 'unknown' | 'landing'>,
  pathname: string
) {
  const redirectUrl = request.nextUrl.clone();
  redirectUrl.hostname = PRODUCT_HOSTNAMES[target];
  redirectUrl.pathname = pathname;
  if (redirectUrl.protocol === 'http:' && redirectUrl.hostname.endsWith('klasse.ao')) {
    redirectUrl.protocol = 'https:';
    redirectUrl.port = '';
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

function createSupabaseClient(request: NextRequest, response: NextResponse) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return null;

  return createServerClient(url, key, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
      },
    },
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
  if (pathname.startsWith('/api/public/documentos')) {
    if (await isRateLimited(ip, 'PUBLIC')) {
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

  const escolaMatch = pathname.match(/^\/(api\/)?escola\/([^/]+)(\/.*)?$/);
  if (escolaMatch) {
    const isApi = Boolean(escolaMatch[1]);
    const escolaParam = escolaMatch[2];
    const suffix = escolaMatch[3] ?? '';

    if (escolaParam !== 'suspensa') {
      const resolved = await resolveEscolaSlugMapping(request, response, escolaParam);
      if (resolved) {
        const tenant = await resolveAuthContext(request, response);
        if (!tenant) {
          return finalizeResponse(request, createForbiddenResponse(response, isApi), allowedOrigin);
        }

        if (tenant.role !== 'global_admin') {
          if (!tenant.escolaId || tenant.escolaId !== resolved.id) {
            return finalizeResponse(request, createForbiddenResponse(response, isApi), allowedOrigin);
          }
        }

        if (isEscolaUuid(escolaParam) && !isApi && resolved.slug !== escolaParam) {
          const redirectUrl = request.nextUrl.clone();
          redirectUrl.pathname = `/escola/${resolved.slug}${suffix}`;
          const redirectResponse = NextResponse.redirect(redirectUrl, 301);
          applyResponseCookies(response, redirectResponse);
          return finalizeResponse(request, redirectResponse, allowedOrigin);
        }

        if (!isEscolaUuid(escolaParam)) {
          const rewrittenUrl = request.nextUrl.clone();
          const prefix = isApi ? '/api/escola' : '/escola';
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
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = '/login';
    return finalizeResponse(request, NextResponse.redirect(loginUrl), allowedOrigin);
  }

  if (
    productContext === 'formacao' &&
    pathRequiresK12Model(pathname)
  ) {
    if (apiPath) {
      return finalizeResponse(request, createForbiddenResponse(response, true), allowedOrigin);
    }
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
      return finalizeResponse(request, createForbiddenResponse(response, true), allowedOrigin);
    }
    return finalizeResponse(
      request,
      redirectToProductHost(request, 'formacao', getLandingPathByContext(authContext)),
      allowedOrigin
    );
  }

  const tenantType = authContext.tenantType ?? 'k12';
  if (tenantType === 'formacao' && pathRequiresK12Model(pathname)) {
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = getLandingPathByContext(authContext);
    return finalizeResponse(request, NextResponse.redirect(redirectUrl), allowedOrigin);
  }

  if (tenantType === 'k12' && pathRequiresFormacaoModel(pathname)) {
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = getLandingPathByContext(authContext);
    return finalizeResponse(request, NextResponse.redirect(redirectUrl), allowedOrigin);
  }

  if (
    productContext !== 'unknown' &&
    productContext !== 'landing' &&
    authContext.role &&
    !isRoleAllowedForProduct(authContext.role, productContext)
  ) {
    const deniedUrl = request.nextUrl.clone();
    deniedUrl.pathname = getLandingPathByContext(authContext);
    return finalizeResponse(request, NextResponse.redirect(deniedUrl), allowedOrigin);
  }

  if (!portalRule.roles.includes(String(authContext.role))) {
    const deniedUrl = request.nextUrl.clone();
    deniedUrl.pathname = getLandingPathByContext(authContext);
    return finalizeResponse(request, NextResponse.redirect(deniedUrl), allowedOrigin);
  }

  return finalizeResponse(request, response, allowedOrigin);
}

// Configuração para aplicar o middleware apenas em rotas de API sensíveis
export const config = {
  matcher: [
    '/escola/:path*',
    '/api/escola/:path*',
    '/admin/:path*',
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
    '/api/financeiro/:path*',
    '/api/secretaria/:path*',
    '/api/professor/:path*',
    '/api/aluno/:path*',
  ],
};
