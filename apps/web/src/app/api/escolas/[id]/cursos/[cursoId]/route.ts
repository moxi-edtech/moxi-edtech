import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { supabaseServer } from "@/lib/supabaseServer";
import { createClient as createAdminClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "~types/supabase";
import { canManageEscolaResources } from "../../permissions";

// --- AUTH HELPER (Mantido igual) ---
type AuthResult =
  | { ok: true; admin: SupabaseClient<Database> }
  | { ok: false; status: number; error: string };

async function authorize(escolaId: string): Promise<AuthResult> {
  const s = await supabaseServer();
  const { data: auth } = await s.auth.getUser();
  const user = auth?.user;
  if (!user) return { ok: false as const, status: 401, error: "Não autenticado" };

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceRoleKey) return { ok: false as const, status: 500, error: 'Configuração ausente.' };

  const admin = createAdminClient<Database>(supabaseUrl, serviceRoleKey);
  const allowed = await canManageEscolaResources(admin, escolaId, user.id);
  if (!allowed) return { ok: false as const, status: 403, error: 'Sem permissão' };
  return { ok: true as const, admin };
}

// --- PUT: ATUALIZAR CURSO ---
export async function PUT(
  req: NextRequest,
  context: { params: Promise<{ id: string; cursoId: string }> }
) {
  const { id: escolaId, cursoId } = await context.params;
  
  const authz = await authorize(escolaId);
  if (!authz.ok) return NextResponse.json({ ok: false, error: authz.error }, { status: authz.status });
  const admin = authz.admin!;

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
  req: NextRequest,
  context: { params: Promise<{ id: string; cursoId: string }> }
) {
  const { id: escolaId, cursoId } = await context.params;

  const hard = ["1", "true", "yes"].includes(
    req.nextUrl.searchParams.get("hard")?.toLowerCase() || ""
  );
  const hardDelete = hard && process.env.NODE_ENV !== "production";
  if (hard && !hardDelete) {
    return NextResponse.json(
      { ok: false, error: "Hard delete indisponível em produção." },
      { status: 403 }
    );
  }

  const authz = await authorize(escolaId);
  if (!authz.ok) return NextResponse.json({ ok: false, error: authz.error }, { status: authz.status });
  const admin = authz.admin!;

  try {
    const { count: turmasCount, error: countErr } = await (admin as any)
      .from('turmas')
      .select('id', { count: 'exact', head: true })
      .eq('escola_id', escolaId)
      .eq('curso_id', cursoId);

    if (countErr) throw countErr;

    if (!hardDelete && turmasCount && turmasCount > 0) {
      return NextResponse.json({
        ok: false,
        error: `Não é possível remover este curso. Existem ${turmasCount} turmas vinculadas a ele. Remova as turmas primeiro ou use hard delete em dev.`,
      }, { status: 409 });
    }

    if (hardDelete) {
      const { data: turmas } = await (admin as any)
        .from('turmas')
        .select('id')
        .eq('escola_id', escolaId)
        .eq('curso_id', cursoId);
      const turmaIds = (turmas || []).map((t: any) => t.id).filter(Boolean);

      if (turmaIds.length > 0) {
        await (admin as any).from('matriculas').delete().in('turma_id', turmaIds);
        await (admin as any).from('turmas').delete().in('id', turmaIds);
      }
    }

    // LIMPEZA EM CASCATA
    await (admin as any).from('disciplinas').delete().eq('curso_escola_id', cursoId);
    await (admin as any).from('classes').delete().eq('curso_id', cursoId);

    const { error } = await (admin as any)
      .from('cursos')
      .delete()
      .eq('id', cursoId)
      .eq('escola_id', escolaId);

    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 400 });

    return NextResponse.json({ ok: true, hard: hardDelete });

  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message || 'Erro inesperado' }, { status: 500 });
  }
}