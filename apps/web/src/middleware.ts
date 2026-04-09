// apps/web/src/middleware.ts
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { isEscolaUuid } from '@/lib/tenant/escolaSlug';
import { resolveEscolaParam } from '@/lib/tenant/resolveEscolaParam';
import { logAuthEvent } from '@/lib/auth/logAuthEvent';
import type { Database } from '~types/supabase';
import {
  detectProductContextFromHostname,
  normalizeTenantType,
  type ProductContext,
  type TenantType,
} from '@moxi/tenant-sdk';
import { isRoleAllowedForProduct } from '@/lib/permissions';

type AuthContext = {
  userId: string | null;
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

type EscolaMembershipRow = Pick<
  Database['public']['Tables']['escola_users']['Row'],
  'escola_id' | 'papel' | 'tenant_type' | 'created_at'
> & {
  escola: Pick<Database['public']['Tables']['escolas']['Row'], 'tenant_type'>[] | null;
};

function resolveMembershipTenantType(row: EscolaMembershipRow | null): string | null {
  if (!row) return null;
  const escolaTenant = Array.isArray(row.escola) ? row.escola[0]?.tenant_type : null;
  return row.tenant_type ?? escolaTenant ?? null;
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

  const { data: userRes } = await supabase.auth.getUser();
  const user = userRes?.user;
  if (!user) return null;

  const { data: profileRows } = await supabase
    .from('profiles')
    .select('role,current_escola_id,created_at')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(1);

  const profile = profileRows?.[0] ?? null;
  const currentEscolaId = profile?.current_escola_id ?? null;

  const { data: membershipRows } = await supabase
    .from('escola_users')
    .select('escola_id,papel,tenant_type,created_at,escola:escolas(tenant_type)')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false });

  const memberships = (membershipRows ?? []) as EscolaMembershipRow[];
  const selectedMembership =
    memberships.find((row) => row.escola_id === currentEscolaId) ??
    memberships[0] ??
    null;

  const appMetadata = (user.app_metadata ?? {}) as Record<string, unknown>;
  const role = (
    selectedMembership?.papel ??
    profile?.role ??
    appMetadata.role ??
    null
  ) as string | null;
  const escolaId = selectedMembership?.escola_id ?? currentEscolaId ?? null;
  const tenantType = normalizeTenantType(
    resolveMembershipTenantType(selectedMembership) ??
      appMetadata.tenant_type ??
      appMetadata.modelo_ensino
  );

  return {
    userId: user.id,
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
  const isLocalRequestHost =
    redirectUrl.hostname === 'localhost' ||
    redirectUrl.hostname === '127.0.0.1' ||
    redirectUrl.hostname.endsWith('.localhost');

  if (isLocalRequestHost) {
    const localOriginRaw = target === 'formacao'
      ? process.env.KLASSE_FORMACAO_LOCAL_ORIGIN ?? 'http://localhost:3001'
      : process.env.KLASSE_K12_LOCAL_ORIGIN ?? 'http://localhost:3000';

    try {
      const localOrigin = new URL(localOriginRaw);
      redirectUrl.protocol = localOrigin.protocol;
      redirectUrl.hostname = localOrigin.hostname;
      redirectUrl.port = localOrigin.port;
    } catch {
      redirectUrl.hostname = PRODUCT_HOSTNAMES[target];
    }
  } else {
    redirectUrl.hostname = PRODUCT_HOSTNAMES[target];
  }

  redirectUrl.pathname = pathname;
  if (redirectUrl.protocol === 'http:' && redirectUrl.hostname.endsWith('klasse.ao')) {
    redirectUrl.protocol = 'https:';
    redirectUrl.port = '';
  }
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

function createSupabaseClient(request: NextRequest, response: NextResponse) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return null;

  const cookieDomain =
    process.env.KLASSE_COOKIE_DOMAIN?.trim() ||
    process.env.KLASSE_AUTH_COOKIE_DOMAIN?.trim() ||
    (process.env.NODE_ENV === 'production' ? '.klasse.ao' : '');
  const sameSiteRaw = (
    process.env.KLASSE_COOKIE_SAMESITE ??
    process.env.KLASSE_AUTH_COOKIE_SAMESITE ??
    'lax'
  )
    .trim()
    .toLowerCase();
  const sameSite: 'lax' | 'strict' | 'none' =
    sameSiteRaw === 'strict' || sameSiteRaw === 'none' ? sameSiteRaw : 'lax';

  return createServerClient(url, key, {
    cookieOptions: {
      ...(cookieDomain ? { domain: cookieDomain } : {}),
      path: '/',
      sameSite,
      secure: process.env.NODE_ENV === 'production',
    },
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
    logAuthEvent({
      action: 'resolve_context_failed',
      route: pathname,
      user_id: authContext?.userId ?? null,
      tenant_id: authContext?.escolaId ?? null,
      tenant_type: authContext?.tenantType ?? null,
      details: { reason: 'role_not_resolved' },
    });
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = '/login';
    return finalizeResponse(request, NextResponse.redirect(loginUrl), allowedOrigin);
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
