import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { supabaseServer } from "@/lib/supabaseServer";
import { hasPermission } from "@/lib/permissions";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import type { Database } from "~types/supabase";

// POST /api/escolas/[id]/classes/bulk
export async function POST(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { id: escolaId } = await context.params;
  try {
    const raw = await req.json();
    const bodySchema = z.object({
      nivel: z.string().trim().min(1, 'Nível é obrigatório'),
      classes: z.array(z.string().trim().min(1)).min(1, 'Informe pelo menos uma classe'),
    });
    const parsed = bodySchema.safeParse(raw);
    if (!parsed.success) {
      const msg = parsed.error.issues[0]?.message || 'Dados inválidos';
      return NextResponse.json({ ok: false, error: msg }, { status: 400 });
    }
    const { nivel, classes } = parsed.data;

    const s = await supabaseServer();
    const { data: auth } = await s.auth.getUser();
    const user = auth?.user;
    if (!user) return NextResponse.json({ ok: false, error: 'Não autenticado' }, { status: 401 });

    let allowed = false;
    // Allow super_admin globally (consistent with preferences GET)
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
      // Fallback consistent with onboarding: profiles role linked to this escola
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

    // Hard check: perfil deve pertencer à escola
    const { data: profCheck } = await s
      .from('profiles' as any)
      .select('escola_id')
      .eq('user_id', user.id)
      .maybeSingle();
    if (!profCheck || (profCheck as any).escola_id !== escolaId) {
      return NextResponse.json({ ok: false, error: 'Perfil não vinculado à escola' }, { status: 403 });
    }

    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
      return NextResponse.json({ ok: false, error: 'Configuração Supabase ausente.' }, { status: 500 });
    }
    const admin = createAdminClient<Database>(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    // Busca existentes para evitar duplicar
    const { data: existing } = await (admin as any)
      .from('classes')
      .select('id, nome')
      .eq('escola_id', escolaId)
      .in('nome', classes);
    const existingNames = new Set<string>((existing || []).map((c: any) => c.nome));

    const toInsert = classes
      .filter((n) => !existingNames.has(n))
      .map((n, idx) => ({ escola_id: escolaId, nome: n, nivel, ordem: idx + 1 } as any));

    let inserted: any[] = [];
    if (toInsert.length > 0) {
      const { data: ins, error } = await (admin as any)
        .from('classes')
        .insert(toInsert)
        .select('id, nome, descricao, ordem, nivel');
      if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 400 });
      inserted = ins as any[];
    }

    return NextResponse.json({ ok: true, data: inserted });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Erro inesperado';
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
