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
};

const ESCOLA_SLUG_TTL_MS = 5 * 60 * 1000;

function isRateLimited(ip: string, limitKey: keyof typeof LIMITS) {
  const now = Date.now();
  const limit = LIMITS[limitKey];
  const record = rateLimitMap.get(`${ip}:${limitKey}`) || { count: 0, lastReset: now };

  if (now - record.lastReset > limit.windowMs) {
    record.count = 1;
    record.lastReset = now;
  } else {
    record.count++;
  }

  rateLimitMap.set(`${ip}:${limitKey}`, record);
  return record.count > limit.count;
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
  
  // Obtém o IP de forma segura para o TypeScript e compatível com Edge/Vercel
  const forwardedFor = request.headers.get('x-forwarded-for');
  const ip = forwardedFor ? forwardedFor.split(',')[0] : '127.0.0.1';

  // 1. Rate Limiting para Endpoints Críticos (STRICT)
  if (
    pathname.startsWith('/api/escolas/create') || 
    pathname.startsWith('/api/auth/login') ||
    pathname.startsWith('/api/alunos/ativar-acesso')
  ) {
    if (isRateLimited(ip, 'STRICT')) {
      return new NextResponse(
        JSON.stringify({ error: 'Too many requests. Please try again later.' }),
        { status: 429, headers: { 'Content-Type': 'application/json' } }
      );
    }
  }

  // 2. Rate Limiting para Acesso Público (PUBLIC)
  if (pathname.startsWith('/api/public/documentos')) {
    if (isRateLimited(ip, 'PUBLIC')) {
      return new NextResponse(
        JSON.stringify({ error: 'Too many requests. Please try again later.' }),
        { status: 429, headers: { 'Content-Type': 'application/json' } }
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
        if (isEscolaUuid(escolaParam) && !isApi && resolved.slug !== escolaParam) {
          const redirectUrl = request.nextUrl.clone();
          redirectUrl.pathname = `/escola/${resolved.slug}${suffix}`;
          const redirectResponse = NextResponse.redirect(redirectUrl, 301);
          applyResponseCookies(response, redirectResponse);
          return redirectResponse;
        }

        if (!isEscolaUuid(escolaParam)) {
          const rewrittenUrl = request.nextUrl.clone();
          const prefix = isApi ? '/api/escola' : '/escola';
          rewrittenUrl.pathname = `${prefix}/${resolved.id}${suffix}`;
          const rewriteResponse = NextResponse.rewrite(rewrittenUrl);
          applyResponseCookies(response, rewriteResponse);
          return rewriteResponse;
        }
      }
    }
  }

  const portalRule = PORTAL_RULES.find((rule) => pathname.startsWith(rule.prefix));
  if (!portalRule) return response;

  const role = await resolveUserRole(request, response);
  if (!role) {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = '/login';
    return NextResponse.redirect(loginUrl);
  }

  if (!portalRule.roles.includes(String(role))) {
    const deniedUrl = request.nextUrl.clone();
    deniedUrl.pathname = '/login';
    return NextResponse.redirect(deniedUrl);
  }

  return response;
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
  ],
};
