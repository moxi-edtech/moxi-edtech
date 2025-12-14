import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { supabaseServer } from "@/lib/supabaseServer";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import type { Database } from "~types/supabase";

// GET /api/escolas/[id]/classes
// Lista classes da escola (usa service role com autorização)
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
    // 1. Super Admin
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

    // 2. Vínculo na Escola (CORRIGIDO: escola_users)
    if (!allowed) {
      try {
        const { data: vinc } = await s
          .from('escola_users') // <--- NOME DA TABELA CORRIGIDO
          .select('papel')
          .eq('escola_id', escolaId)
          .eq('user_id', user.id)
          .maybeSingle();
        allowed = Boolean((vinc as any)?.papel);
      } catch {}
    }

    // 3. Admin legado
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

    // 4. Admin Profile
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

    let rows: any[] = [];
    {
      const { data, error } = await (admin as any)
        .from('classes')
        .select('id, nome, descricao, ordem, nivel, curso_id') // Adicionei curso_id
        .eq('escola_id', escolaId)
        .order('ordem', { ascending: true });
      
      if (!error) rows = data || [];
      else {
        // Retry simples (opcional)
        const retry = await (admin as any)
          .from('classes')
          .select('id, nome, ordem')
          .eq('escola_id', escolaId)
          .order('ordem', { ascending: true });
        if (retry.error) return NextResponse.json({ ok: false, error: retry.error.message }, { status: 400 });
        rows = retry.data || [];
      }
    }

    const payload = rows.map((r: any) => ({
      id: r.id,
      nome: r.nome,
      descricao: r.descricao ?? undefined,
      ordem: r.ordem ?? 0,
      nivel: r.nivel ?? undefined,
      curso_id: r.curso_id ?? undefined,
    }));

    return NextResponse.json({ ok: true, data: payload });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Erro inesperado';
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}

// POST /api/escolas/[id]/classes
// Cria uma nova classe na escola (usa service role com autorização)
export async function POST(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { id: escolaId } = await context.params;
  try {
    const s = await supabaseServer();
    const { data: auth } = await s.auth.getUser();
    const user = auth?.user;
    if (!user) return NextResponse.json({ ok: false, error: 'Não autenticado' }, { status: 401 });

    // Autoriza criar
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
          .from('escola_users') // <--- NOME CORRIGIDO
          .select('papel')
          .eq('escola_id', escolaId)
          .eq('user_id', user.id)
          .maybeSingle();
        const papel = (vinc as any)?.papel as any | undefined;
        if (papel) allowed = true; 
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

    if (!allowed) return NextResponse.json({ ok: false, error: 'Sem permissão' }, { status: 403 });

    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
      return NextResponse.json({ ok: false, error: 'Configuração Supabase ausente.' }, { status: 500 });
    }
    const admin = createAdminClient<Database>(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    const body = await req.json().catch(() => ({}));
    
    // [SCHEMA] Adicionei curso_id pois é necessário para a unicidade
    const schema = z.object({
      nome: z.string().trim().min(1),
      nivel: z.string().trim().nullable().optional(),
      descricao: z.string().trim().nullable().optional(),
      curso_id: z.string().uuid().optional().nullable(), 
      ordem: z.number().optional(), // Opcional, se vier usamos, senão calculamos
    });

    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      const msg = parsed.error.issues?.[0]?.message || 'Dados inválidos';
      return NextResponse.json({ ok: false, error: msg }, { status: 400 });
    }

    // Calcula ordem apenas se não foi fornecida
    let ordem = parsed.data.ordem;
    if (ordem === undefined) {
      ordem = 1;
      try {
        const { data } = await (admin as any)
          .from('classes')
          .select('ordem')
          .eq('escola_id', escolaId)
          .order('ordem', { ascending: false })
          .limit(1);
        const top = (data || [])[0] as any;
        ordem = Number(top?.ordem || 0) + 1;
      } catch {}
    }

    const payload: any = {
      escola_id: escolaId,
      nome: parsed.data.nome,
      ordem,
      curso_id: parsed.data.curso_id || null // [IMPORTANTE] Passar o curso para o insert
    };
    if (parsed.data.nivel !== undefined) payload.nivel = parsed.data.nivel;
    if (parsed.data.descricao !== undefined) payload.descricao = parsed.data.descricao;

    const { data: ins, error } = await (admin as any)
      .from('classes')
      .insert(payload)
      .select('id, nome, nivel, descricao, ordem')
      .single();

    if (error) {
      // [BLINDAGEM] Tratamento de erro de chave duplicada
      if (error.code === '23505') {
        return NextResponse.json(
          { ok: false, error: `A classe "${parsed.data.nome}" já existe para este curso.` },
          { status: 409 } // Conflict
        );
      }
      return NextResponse.json({ ok: false, error: error.message }, { status: 400 });
    }

    return NextResponse.json({ ok: true, data: ins });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Erro inesperado';
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}