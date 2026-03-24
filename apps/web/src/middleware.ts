// apps/web/src/middleware.ts
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { isEscolaUuid } from '@/lib/tenant/escolaSlug';
import { resolveEscolaParam } from '@/lib/tenant/resolveEscolaParam';

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
    roles: ['admin', 'admin_escola', 'staff_admin', 'super_admin', 'global_admin'],
  },
  {
    prefix: '/secretaria',
    roles: ['secretaria', 'secretaria_financeiro', 'admin_financeiro', 'admin', 'admin_escola', 'staff_admin', 'super_admin', 'global_admin'],
  },
  {
    prefix: '/financeiro',
    roles: ['financeiro', 'secretaria_financeiro', 'admin_financeiro', 'admin', 'admin_escola', 'staff_admin', 'super_admin', 'global_admin'],
  },
  {
    prefix: '/professor',
    roles: ['professor', 'admin', 'admin_escola', 'staff_admin', 'super_admin', 'global_admin'],
  },
  {
    prefix: '/aluno',
    roles: ['aluno', 'encarregado'],
  },
];

async function resolveUserRole(request: NextRequest, response: NextResponse) {
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

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  return profile?.role ?? null;
}

async function resolveUserTenant(request: NextRequest, response: NextResponse) {
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

  const { data: profile } = await supabase
    .from('profiles')
    .select('role, escola_id, current_escola_id')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  return {
    role: profile?.role ?? null,
    escolaId: profile?.current_escola_id ?? profile?.escola_id ?? null,
  };
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
        const tenant = await resolveUserTenant(request, response);
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

  const role = await resolveUserRole(request, response);
  if (!role) {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = '/login';
    return finalizeResponse(request, NextResponse.redirect(loginUrl), allowedOrigin);
  }

  if (!portalRule.roles.includes(String(role))) {
    const deniedUrl = request.nextUrl.clone();
    deniedUrl.pathname = '/login';
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
