import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { supabaseServer } from "@/lib/supabaseServer";
import { hasPermission } from "@/lib/permissions";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import type { Database } from "~types/supabase";

// --- AUTH HELPER (Mantido igual) ---
async function authorize(escolaId: string) {
  const s = await supabaseServer();
  const { data: auth } = await s.auth.getUser();
  const user = auth?.user;
  if (!user) return { ok: false as const, status: 401, error: "Não autenticado" };

  let allowed = false;
  
  // 1. Super Admin
  try {
    const { data: prof } = await s.from('profiles').select('role').eq('user_id', user.id).order('created_at', { ascending: false }).limit(1);
    if ((prof?.[0] as any)?.role === 'super_admin') allowed = true;
  } catch {}

  // 2. Permissões na Escola
  if (!allowed) {
    try {
      const { data: vinc } = await s.from('escola_usuarios').select('papel').eq('escola_id', escolaId).eq('user_id', user.id).maybeSingle();
      const papel = (vinc as any)?.papel;
      if (papel && (hasPermission(papel, 'configurar_escola') || hasPermission(papel, 'gerenciar_disciplinas'))) allowed = true;
    } catch {}
  }

  // 3. Admin Vinculado
  if (!allowed) {
    try {
      const { data: adminLink } = await s.from('escola_administradores').select('user_id').eq('escola_id', escolaId).eq('user_id', user.id).limit(1);
      if (adminLink && adminLink.length > 0) allowed = true;
    } catch {}
  }

  if (!allowed) return { ok: false as const, status: 403, error: 'Sem permissão' };
  return { ok: true as const };
}

// --- PUT: ATUALIZAR CURSO ---
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; cursoId: string }> }
) {
  const { id: escolaId, cursoId } = await params;
  
  const authz = await authorize(escolaId);
  if (!authz.ok) return NextResponse.json({ ok: false, error: authz.error }, { status: authz.status });

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  
  if (!supabaseUrl || !serviceRoleKey) return NextResponse.json({ ok: false, error: 'Configuração ausente.' }, { status: 500 });
  
  const admin = createAdminClient<Database>(supabaseUrl, serviceRoleKey);

  try {
    const raw = await req.json();
    const schema = z.object({
      nome: z.string().trim().min(1).optional(),
      nivel: z.string().trim().nullable().optional(),
      descricao: z.string().trim().nullable().optional(),
      codigo: z.string().trim().nullable().optional(),
      tipo: z.string().trim().nullable().optional(),
    });

    const parsed = schema.safeParse(raw);
    if (!parsed.success) {
      return NextResponse.json({ ok: false, error: parsed.error.issues[0].message }, { status: 400 });
    }

    const { data, error } = await (admin as any)
      .from('cursos')
      .update(parsed.data)
      .eq('id', cursoId)
      .eq('escola_id', escolaId)
      .select()
      .single();

    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 400 });
    
    return NextResponse.json({ ok: true, data });

  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message || 'Erro inesperado' }, { status: 500 });
  }
}

// --- DELETE: REMOVER CURSO (COM SEGURANÇA) ---
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; cursoId: string }> }
) {
  const { id: escolaId, cursoId } = await params;

  const authz = await authorize(escolaId);
  if (!authz.ok) return NextResponse.json({ ok: false, error: authz.error }, { status: authz.status });

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  
  if (!supabaseUrl || !serviceRoleKey) return NextResponse.json({ ok: false, error: 'Configuração ausente.' }, { status: 500 });
  
  const admin = createAdminClient<Database>(supabaseUrl, serviceRoleKey);

  try {
    // 1. VERIFICAÇÃO DE SEGURANÇA: Existem turmas ativas neste curso?
    // Se existirem turmas, NÃO podemos apagar, pois existem alunos matriculados.
    const { count: turmasCount, error: countErr } = await (admin as any)
        .from('turmas')
        .select('*', { count: 'exact', head: true })
        .eq('escola_id', escolaId)
        .eq('curso_id', cursoId);

    if (countErr) throw countErr;

    if (turmasCount && turmasCount > 0) {
        return NextResponse.json({ 
            ok: false, 
            error: `Não é possível remover este curso. Existem ${turmasCount} turmas vinculadas a ele. Remova as turmas primeiro.` 
        }, { status: 409 }); // 409 Conflict
    }

    // 2. LIMPEZA EM CASCATA (Safe Cleanup)
    // Se não há turmas, podemos limpar as dependências estruturais para não deixar lixo.
    
    // Apagar Disciplinas do curso
    await (admin as any).from('disciplinas').delete().eq('curso_id', cursoId);
    
    // Apagar Classes vinculadas exclusivamente a este curso (se houver lógica de vínculo)
    // Nota: Se classes forem genéricas (sem curso_id), isto não as apaga, o que é bom.
    await (admin as any).from('classes').delete().eq('curso_id', cursoId);

    // 3. APAGAR O CURSO
    const { error } = await (admin as any)
      .from('cursos')
      .delete()
      .eq('id', cursoId)
      .eq('escola_id', escolaId);

    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 400 });

    return NextResponse.json({ ok: true });

  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message || 'Erro inesperado' }, { status: 500 });
  }
}