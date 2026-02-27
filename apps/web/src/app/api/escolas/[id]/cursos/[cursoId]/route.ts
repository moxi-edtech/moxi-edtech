import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createRouteClient } from "@/lib/supabase/route-client";
import { resolveEscolaIdForUser } from "@/lib/tenant/resolveEscolaIdForUser";
import { canManageEscolaResources } from "../../permissions";
import { getSupabaseServerClient } from "@/lib/supabase-server";

// --- AUTH HELPER (Mantido igual) ---
type AuthResult =
  | { ok: true; supabase: Awaited<ReturnType<typeof createRouteClient>> }
  | { ok: false; status: number; error: string };

async function authorize(escolaId: string): Promise<AuthResult> {
  const supabase = await createRouteClient();
  const { data: auth } = await supabase.auth.getUser();
  const user = auth?.user;
  if (!user) return { ok: false as const, status: 401, error: "Não autenticado" };

  const userEscolaId = await resolveEscolaIdForUser(supabase as any, user.id, escolaId);
  if (!userEscolaId || userEscolaId !== escolaId) {
    return { ok: false as const, status: 403, error: 'Sem permissão' };
  }

  const allowed = await canManageEscolaResources(supabase as any, escolaId, user.id);
  if (!allowed) return { ok: false as const, status: 403, error: 'Sem permissão' };
  return { ok: true as const, supabase };
}

// --- PUT: ATUALIZAR CURSO ---
export async function PUT(
  req: NextRequest,
  context: { params: Promise<{ id: string; cursoId: string }> }
) {
  const { id: escolaId, cursoId } = await context.params;
  
  const authz = await authorize(escolaId);
  if (!authz.ok) return NextResponse.json({ ok: false, error: authz.error }, { status: authz.status });
  const supabase = authz.supabase!;

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

    const { data, error } = await (supabase as any)
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
  const supabase = authz.supabase!;
  const adminClient = getSupabaseServerClient();
  const deleteClient = (adminClient ?? supabase) as any;

  try {
    const { count: turmasCount, error: countErr } = await (supabase as any)
      .from('turmas')
      .select('id', { count: 'estimated', head: true })
      .eq('escola_id', escolaId)
      .eq('curso_id', cursoId);

    if (countErr) throw countErr;

    const { data: turmas } = await (supabase as any)
      .from('turmas')
      .select('id')
      .eq('escola_id', escolaId)
      .eq('curso_id', cursoId);
    const turmaIds = (turmas || []).map((t: any) => t.id).filter(Boolean);

    if (!hardDelete && turmasCount && turmasCount > 0) {
      const { count: matriculasCount, error: matriculasErr } = await (supabase as any)
        .from('matriculas')
        .select('id', { count: 'estimated', head: true })
        .in('turma_id', turmaIds.length > 0 ? turmaIds : ['']);
      if (matriculasErr) throw matriculasErr;

      if (matriculasCount && matriculasCount > 0) {
        return NextResponse.json({
          ok: false,
          error: `Não é possível remover este curso. Existem ${matriculasCount} matrículas vinculadas às turmas.`,
        }, { status: 409 });
      }
    }

    if (turmaIds.length > 0) {
      if (hardDelete) {
        const { error: matriculasDeleteErr } = await deleteClient
          .from('matriculas')
          .delete()
          .in('turma_id', turmaIds);
        if (matriculasDeleteErr) throw matriculasDeleteErr;
      }

      const { error: turmaDisciplinasErr } = await deleteClient
        .from('turma_disciplinas')
        .delete()
        .in('turma_id', turmaIds);
      if (turmaDisciplinasErr) throw turmaDisciplinasErr;

      const { error: turmasDeleteErr } = await deleteClient
        .from('turmas')
        .delete()
        .in('id', turmaIds);
      if (turmasDeleteErr) throw turmasDeleteErr;

      const { count: remainingTurmas, error: remainingErr } = await deleteClient
        .from('turmas')
        .select('id', { count: 'estimated', head: true })
        .eq('escola_id', escolaId)
        .eq('curso_id', cursoId);
      if (remainingErr) throw remainingErr;
      if (remainingTurmas && remainingTurmas > 0) {
        return NextResponse.json({
          ok: false,
          error: `Não foi possível remover as turmas vinculadas (${remainingTurmas}).`,
        }, { status: 409 });
      }
    }

    // LIMPEZA EM CASCATA (sem turmas)
    const { data: curriculosRows, error: curriculosErr } = await (supabase as any)
      .from('curso_curriculos')
      .select('id')
      .eq('escola_id', escolaId)
      .eq('curso_id', cursoId);
    if (curriculosErr) throw curriculosErr;

    const curriculoIds = (curriculosRows || []).map((row: any) => row.id).filter(Boolean);

    const matrizIdsSet = new Set<string>();
    if (curriculoIds.length > 0) {
      const { data: matrizByCurriculo, error: matrizErr } = await (supabase as any)
        .from('curso_matriz')
        .select('id')
        .eq('escola_id', escolaId)
        .in('curso_curriculo_id', curriculoIds);
      if (matrizErr) throw matrizErr;
      (matrizByCurriculo || []).forEach((row: any) => row?.id && matrizIdsSet.add(row.id));
    }

    const { data: matrizByCurso, error: matrizCursoErr } = await (supabase as any)
      .from('curso_matriz')
      .select('id')
      .eq('escola_id', escolaId)
      .eq('curso_id', cursoId);
    if (matrizCursoErr) throw matrizCursoErr;
    (matrizByCurso || []).forEach((row: any) => row?.id && matrizIdsSet.add(row.id));

    const matrizIds = Array.from(matrizIdsSet.values());
    if (matrizIds.length > 0) {
      const { error: tdErr } = await (supabase as any)
        .from('turma_disciplinas')
        .delete()
        .in('curso_matriz_id', matrizIds);
      if (tdErr) throw tdErr;
    }

    if (curriculoIds.length > 0) {
      const { error: matrizDeleteByCurriculoErr } = await (supabase as any)
        .from('curso_matriz')
        .delete()
        .eq('escola_id', escolaId)
        .in('curso_curriculo_id', curriculoIds);
      if (matrizDeleteByCurriculoErr) throw matrizDeleteByCurriculoErr;
    }

    const { error: matrizDeleteByCursoErr } = await (supabase as any)
      .from('curso_matriz')
      .delete()
      .eq('escola_id', escolaId)
      .eq('curso_id', cursoId);
    if (matrizDeleteByCursoErr) throw matrizDeleteByCursoErr;

    const { error: curriculoErr } = await (supabase as any)
      .from('curso_curriculos')
      .delete()
      .eq('escola_id', escolaId)
      .eq('curso_id', cursoId);
    if (curriculoErr) throw curriculoErr;

    await (supabase as any).from('disciplinas').delete().eq('curso_escola_id', cursoId);
    await (supabase as any).from('classes').delete().eq('curso_id', cursoId);

    const { error } = await (supabase as any)
      .from('cursos')
      .delete()
      .eq('id', cursoId)
      .eq('escola_id', escolaId);

    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 400 });

    try {
      await (supabase as any).rpc('refresh_mv_escola_cursos_stats');
    } catch (refreshErr) {
      console.warn('Falha ao atualizar mv_escola_cursos_stats:', refreshErr);
    }

    return NextResponse.json({ ok: true, hard: hardDelete });

  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message || 'Erro inesperado' }, { status: 500 });
  }
}
