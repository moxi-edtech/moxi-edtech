import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { supabaseServer } from "@/lib/supabaseServer";
import { hasPermission } from "@/lib/permissions";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import type { Database } from "~types/supabase";

async function authorize(escolaId: string) {
  const s = await supabaseServer();
  const { data: auth } = await s.auth.getUser();
  const user = auth?.user;
  if (!user) return { ok: false as const, status: 401, error: 'Não autenticado' };

  let allowed = false;
  // Allow super_admin globally
  try {
    const { data: prof } = await s
      .from('profiles')
      .select('role')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(1)
    const role = (prof?.[0] as any)?.role as string | undefined
    if (role === 'super_admin') allowed = true
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
    // Fallback: perfil admin vinculado à escola
    try {
      const { data: prof } = await s
        .from('profiles')
        .select('role, escola_id')
        .eq('user_id', user.id)
        .eq('escola_id', escolaId)
        .limit(1)
      allowed = Boolean(prof && prof.length > 0 && (prof[0] as any).role === 'admin')
    } catch {}
  }
  if (!allowed) return { ok: false as const, status: 403, error: 'Sem permissão' };
  return { ok: true as const };
}

// PUT /api/escolas/[id]/classes/[classId]
export async function PUT(
  req: NextRequest,
  context: { params: Promise<{ id: string; classId: string }> }
) {
  const { id: escolaId, classId } = await context.params;

  const authz = await authorize(escolaId);
  if (!authz.ok) return NextResponse.json({ ok: false, error: authz.error }, { status: authz.status });

  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return NextResponse.json({ ok: false, error: 'Configuração Supabase ausente.' }, { status: 500 });
  }
  const admin = createAdminClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );

  try {
    const raw = await req.json();
    const schema = z.object({
      nome: z.string().trim().min(1).optional(),
      descricao: z.string().nullable().optional(),
      ordem: z.number().int().positive().nullable().optional(),
      nivel: z.string().nullable().optional(),
    });
    const parsed = schema.safeParse(raw);
    if (!parsed.success) {
      const msg = parsed.error.errors[0]?.message || 'Dados inválidos';
      return NextResponse.json({ ok: false, error: msg }, { status: 400 });
    }

    const updates = parsed.data as any;
    const { data, error } = await (admin as any)
      .from('classes')
      .update(updates)
      .eq('id', classId)
      .eq('escola_id', escolaId)
      .select('id, nome, descricao, ordem, nivel')
      .single();
    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 400 });
    return NextResponse.json({ ok: true, data });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Erro inesperado';
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}

// DELETE /api/escolas/[id]/classes/[classId]
export async function DELETE(
  _req: NextRequest,
  context: { params: Promise<{ id: string; classId: string }> }
) {
  const { id: escolaId, classId } = await context.params;

  const authz = await authorize(escolaId);
  if (!authz.ok) return NextResponse.json({ ok: false, error: authz.error }, { status: authz.status });

  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return NextResponse.json({ ok: false, error: 'Configuração Supabase ausente.' }, { status: 500 });
  }
  const admin = createAdminClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );

  try {
    const { error } = await (admin as any)
      .from('classes')
      .delete()
      .eq('id', classId)
      .eq('escola_id', escolaId);
    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 400 });
    return NextResponse.json({ ok: true });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Erro inesperado';
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
