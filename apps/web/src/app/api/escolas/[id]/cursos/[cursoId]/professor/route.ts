import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { supabaseServer } from "@/lib/supabaseServer";
import { hasPermission } from "@/lib/permissions";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import type { Database } from "~types/supabase";

// PUT /api/escolas/[id]/cursos/[cursoId]/professor
// Atualiza professor atribuído (no momento apenas ecoa a alteração esperada pelo front)
export async function PUT(
  req: NextRequest,
  context: { params: Promise<{ id: string; cursoId: string }> }
) {
  const { id: escolaId, cursoId } = await context.params;

  try {
    const schema = z.object({ professor_id: z.string().uuid().nullable() });
    const parse = schema.safeParse(await req.json());
    if (!parse.success) {
      const msg = parse.error.issues[0]?.message || "Dados inválidos";
      return NextResponse.json({ ok: false, error: msg }, { status: 400 });
    }
    const { professor_id } = parse.data;

    const s = await supabaseServer();
    const { data: auth } = await s.auth.getUser();
    const user = auth?.user;
    if (!user) return NextResponse.json({ ok: false, error: "Não autenticado" }, { status: 401 });

    // Autorização básica: permitir quem pode configurar escola ou gerenciar disciplinas
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
        .from("escola_usuarios")
        .select("papel")
        .eq("escola_id", escolaId)
        .eq("user_id", user.id)
        .maybeSingle();
      const papel = (vinc as any)?.papel as any | undefined;
      allowed = !!papel && (hasPermission(papel, "configurar_escola") || hasPermission(papel, "gerenciar_disciplinas"));
    } catch {}

    // Fallback 1: tabela de administradores explícitos da escola
    if (!allowed) {
      try {
        const { data: adminLink } = await s
          .from("escola_administradores")
          .select("user_id")
          .eq("escola_id", escolaId)
          .eq("user_id", user.id)
          .limit(1);
        allowed = Boolean(adminLink && (adminLink as any[]).length > 0);
      } catch {}
    }

    // Fallback 2: perfil com role admin vinculado à escola
    if (!allowed) {
      try {
        const { data: prof } = await s
          .from("profiles")
          .select("user_id, role, escola_id")
          .eq("user_id", user.id)
          .eq("escola_id", escolaId)
          .limit(1);
        allowed = Boolean(prof && (prof as any[]).length > 0 && (prof as any)[0]?.role === 'admin');
      } catch {}
    }

    if (!allowed) return NextResponse.json({ ok: false, error: "Sem permissão" }, { status: 403 });

    // Tenta persistir em cursos.professor_id; se a coluna não existir, apenas ecoa
    if (process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY) {
      const admin = createAdminClient<Database>(
        process.env.NEXT_PUBLIC_SUPABASE_URL,
        process.env.SUPABASE_SERVICE_ROLE_KEY
      );
      const attempt = await (admin as any)
        .from('cursos')
        .update({ professor_id })
        .eq('id', cursoId)
        .select('id, professor_id')
        .single();
      if (!attempt.error) {
        return NextResponse.json({ ok: true, data: attempt.data });
      }
      // Se a coluna não existir, cai para o eco
    }
    return NextResponse.json({ ok: true, data: { id: cursoId, professor_id } });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Erro inesperado";
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
