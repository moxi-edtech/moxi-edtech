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
  if (!user) return { ok: false as const, status: 401, error: "Não autenticado" };

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
  if (!allowed) return { ok: false as const, status: 403, error: 'Sem permissão' };
  return { ok: true as const };
}

// PUT /api/escolas/[id]/disciplinas/[disciplinaId]
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; disciplinaId: string }> }
) {
  const { id: escolaId, disciplinaId } = await params;
  const authz = await authorize(escolaId);
  if (!authz.ok) return NextResponse.json({ ok: false, error: authz.error }, { status: authz.status });

  const supabaseUrl = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceRoleKey) return NextResponse.json({ ok: false, error: 'Configuração Supabase ausente.' }, { status: 500 });
  const admin = createAdminClient<Database>(supabaseUrl, serviceRoleKey);

  try {
    const raw = await req.json();
    const schema = z.object({
      nome: z.string().trim().min(1).optional(),
      tipo: z.enum(['core','eletivo']).optional(),
      curso_id: z.string().uuid().nullable().optional(),
      classe_id: z.string().uuid().nullable().optional(),
      descricao: z.string().trim().nullable().optional(),
    });
    const parsed = schema.safeParse(raw);
    if (!parsed.success) {
      const msg = parsed.error.issues?.[0]?.message || 'Dados inválidos';
      return NextResponse.json({ ok: false, error: msg }, { status: 400 });
    }

    const updates = parsed.data as any;
    const { data, error } = await (admin as any)
      .from('disciplinas')
      .update(updates)
      .eq('id', disciplinaId)
      .eq('escola_id', escolaId)
      .select('id, nome, tipo, curso_id, classe_id, descricao')
      .single();
    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 400 });
    return NextResponse.json({ ok: true, data });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Erro inesperado';
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}

// DELETE /api/escolas/[id]/disciplinas/[disciplinaId]
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; disciplinaId: string }> }
) {
  const { id: escolaId, disciplinaId } = await params;
  const authz = await authorize(escolaId);
  if (!authz.ok) return NextResponse.json({ ok: false, error: authz.error }, { status: authz.status });

  const supabaseUrl = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceRoleKey) return NextResponse.json({ ok: false, error: 'Configuração Supabase ausente.' }, { status: 500 });
  const admin = createAdminClient<Database>(supabaseUrl, serviceRoleKey);

  try {
    const { error } = await (admin as any)
      .from('disciplinas')
      .delete()
      .eq('id', disciplinaId)
      .eq('escola_id', escolaId);
    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 400 });
    return NextResponse.json({ ok: true });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Erro inesperado';
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
