import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { supabaseServer } from "@/lib/supabaseServer";
import { hasPermission } from "@/lib/permissions";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import type { Database } from "~types/supabase";

// POST /api/escolas/[id]/disciplinas
export async function POST(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { id: escolaId } = await context.params;
  try {
    const raw = await req.json();
    const schema = z.object({
      nome: z.string().trim().min(1, 'Nome é obrigatório'),
      tipo: z.enum(['core', 'eletivo']).default('core'),
      curso_id: z.string().uuid().optional().nullable(),
      classe_id: z.string().uuid().optional().nullable(),
      descricao: z.string().optional().nullable(),
    });
    const parsed = schema.safeParse(raw);
    if (!parsed.success) {
      const msg = parsed.error.errors[0]?.message || 'Dados inválidos';
      return NextResponse.json({ ok: false, error: msg }, { status: 400 });
    }
    const { nome, tipo, curso_id, classe_id, descricao } = parsed.data;

    const s = await supabaseServer();
    const { data: auth } = await s.auth.getUser();
    const user = auth?.user;
    if (!user) return NextResponse.json({ ok: false, error: 'Não autenticado' }, { status: 401 });

    let allowed = false;
    // Allow super_admin globally
    try {
      const { data: prof } = await s
        .from('profiles')
        .select('role')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(1);
      const role = (prof?.[0] as any)?.role as string | undefined;
      if (role === 'super_admin') allowed = true;
    } catch {}
    try {
      const { data: vinc } = await s
        .from('escola_usuarios')
        .select('papel')
        .eq('escola_id', escolaId)
        .eq('user_id', user.id)
        .maybeSingle();
      const papel = (vinc as any)?.papel as any | undefined;
      allowed = !!papel && (hasPermission(papel, 'configurar_escola') || hasPermission(papel, 'gerenciar_disciplinas'));
    } catch {}
    if (!allowed) {
      try {
        const { data: adminLink } = await s
          .from('escola_administradores')
          .select('user_id')
          .eq('escola_id', escolaId)
          .eq('user_id', user.id)
          .limit(1);
        allowed = Boolean(adminLink && (adminLink as any[]).length > 0);
      } catch {}
    }
    if (!allowed) {
      // Fallback consistent with other routes: profiles admin scoped to this escola
      try {
        const { data: prof } = await s
          .from('profiles')
          .select('role, escola_id')
          .eq('user_id', user.id)
          .eq('escola_id', escolaId)
          .limit(1);
        allowed = Boolean(prof && prof.length > 0 && (prof[0] as any).role === 'admin');
      } catch {}
    }
    if (!allowed) return NextResponse.json({ ok: false, error: 'Sem permissão' }, { status: 403 });

    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
      return NextResponse.json({ ok: false, error: 'Configuração Supabase ausente.' }, { status: 500 });
    }
    const admin = createAdminClient<Database>(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    // Evita duplicidade básica por escola+nome+curso (quando houver curso)
    let existsFilter = (admin as any).from('disciplinas').select('id').eq('escola_id', escolaId).eq('nome', nome);
    if (curso_id) existsFilter = existsFilter.eq('curso_id', curso_id);
    const { data: existing } = await existsFilter.maybeSingle();

    if (existing?.id) {
      return NextResponse.json({ ok: true, data: { id: existing.id, nome, tipo, curso_id: curso_id ?? undefined, descricao: descricao ?? undefined } });
    }

    // Tenta inserir com colunas opcionais
    const { data: ins, error } = await (admin as any)
      .from('disciplinas')
      .insert({ escola_id: escolaId, nome, tipo, curso_id: curso_id ?? null, classe_id: classe_id ?? null, descricao: descricao ?? null } as any)
      .select('id, nome, tipo, curso_id, descricao')
      .single();
    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 400 });

    return NextResponse.json({ ok: true, data: ins });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Erro inesperado';
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}

// GET /api/escolas/[id]/disciplinas
// Lista disciplinas da escola (usa service role com autorização)
export async function GET(
  _req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { id: escolaId } = await context.params;
  try {
    const s = await supabaseServer();
    const { data: auth } = await s.auth.getUser();
    const user = auth?.user;
    if (!user) return NextResponse.json({ ok: false, error: 'Não autenticado' }, { status: 401 });

    let allowed = false;
    try {
      const { data: prof } = await s
        .from('profiles')
        .select('role')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(1);
      const role = (prof?.[0] as any)?.role as string | undefined;
      if (role === 'super_admin') allowed = true;
    } catch {}
    if (!allowed) {
      try {
        const { data: vinc } = await s
          .from('escola_usuarios')
          .select('papel')
          .eq('escola_id', escolaId)
          .eq('user_id', user.id)
          .maybeSingle();
        allowed = Boolean((vinc as any)?.papel);
      } catch {}
    }
    if (!allowed) {
      try {
        const { data: adminLink } = await s
          .from('escola_administradores')
          .select('user_id')
          .eq('escola_id', escolaId)
          .eq('user_id', user.id)
          .limit(1);
        allowed = Boolean(adminLink && (adminLink as any[]).length > 0);
      } catch {}
    }
    if (!allowed) {
      try {
        const { data: prof } = await s
          .from('profiles')
          .select('role, escola_id')
          .eq('user_id', user.id)
          .eq('escola_id', escolaId)
          .limit(1);
        allowed = Boolean(prof && (prof as any[]).length > 0 && (prof as any)[0]?.role === 'admin');
      } catch {}
    }
    if (!allowed) return NextResponse.json({ ok: false, error: 'Sem permissão' }, { status: 403 });

    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
      return NextResponse.json({ ok: false, error: 'Configuração Supabase ausente.' }, { status: 500 });
    }
    const admin = createAdminClient<Database>(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    // Buscar com colunas opcionais em fallback
    let rows: any[] = [];
    {
      const { data, error } = await (admin as any)
        .from('disciplinas')
        .select('id, nome, tipo, curso_id, classe_id, descricao')
        .eq('escola_id', escolaId)
        .order('nome', { ascending: true });
      if (!error) rows = data || [];
      else {
        const retry = await (admin as any)
          .from('disciplinas')
          .select('id, nome')
          .eq('escola_id', escolaId)
          .order('nome', { ascending: true });
        if (retry.error) return NextResponse.json({ ok: false, error: retry.error.message }, { status: 400 });
        rows = retry.data || [];
      }
    }
    const payload = rows.map((r: any) => ({
      id: r.id,
      nome: r.nome,
      tipo: r.tipo ?? 'core',
      curso_id: r.curso_id ?? undefined,
      classe_id: r.classe_id ?? undefined,
      descricao: r.descricao ?? undefined,
    }));
    return NextResponse.json({ ok: true, data: payload });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Erro inesperado';
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
