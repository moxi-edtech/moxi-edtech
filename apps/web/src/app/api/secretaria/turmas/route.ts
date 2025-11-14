import { NextResponse } from "next/server";
import { supabaseServerTyped } from "@/lib/supabaseServer";

const withGroup = (group: string) =>
  ({ group } as unknown as { head?: boolean; count?: 'exact' | 'planned' | 'estimated' });

export async function GET(req: Request) {
  try {
    const supabase = await supabaseServerTyped<any>();
    const { data: userRes } = await supabase.auth.getUser();
    const user = userRes?.user;
    if (!user) return NextResponse.json({ ok: false, error: 'Não autenticado' }, { status: 401 });

    const { data: prof } = await supabase
      .from('profiles')
      .select('escola_id')
      .order('created_at', { ascending: false })
      .limit(1);
    const escolaId = (prof?.[0] as any)?.escola_id as string | undefined;
    if (!escolaId) {
      return NextResponse.json({
        ok: true,
        items: [],
        total: 0,
        stats: { totalTurmas: 0, totalAlunos: 0, porTurno: [] },
      });
    }

    const url = new URL(req.url);
    const turnoFilter = url.searchParams.get('turno') || undefined;

    const { data: turmas, error: turmasError } = await supabase
      .from('turmas')
      .select('id, nome, turno, ano_letivo, professor_id, created_at')
      .eq('escola_id', escolaId)
      .order('nome');
    if (turmasError) return NextResponse.json({ ok: false, error: turmasError.message }, { status: 400 });

    const turmaIds = (turmas || []).map((t) => t.id);
    let professoresMap = new Map<string, { nome: string | null; email: string | null }>();
    const professorIds = Array.from(new Set((turmas || []).map((t) => t.professor_id).filter((id): id is string => Boolean(id))));
    if (professorIds.length) {
      const { data: professores } = await supabase
        .from('professores')
        .select('id, profile_id')
        .in('id', professorIds);
      const profileIds = Array.from(new Set((professores || []).map((p) => p.profile_id).filter((id): id is string => Boolean(id))));
      if (profileIds.length) {
        const { data: perfis } = await supabase
          .from('profiles')
          .select('user_id, nome, email')
          .in('user_id', profileIds);
        const profilesMap = new Map<string, { nome: string | null; email: string | null }>();
        for (const perfil of perfis || []) {
          profilesMap.set(perfil.user_id, { nome: perfil.nome ?? null, email: perfil.email ?? null });
        }
        for (const profItem of professores || []) {
          if (!profItem?.id) continue;
          const perfil = profItem.profile_id ? profilesMap.get(profItem.profile_id) : undefined;
          professoresMap.set(profItem.id, { nome: perfil?.nome ?? null, email: perfil?.email ?? null });
        }
      }
    }

    let matriculasResumo: any[] | null = [];
    if (turmaIds.length) {
      const { data } = await supabase
        .from('matriculas')
        .select('turma_id, status, count:turma_id', withGroup('turma_id,status'))
        .eq('escola_id', escolaId)
        .in('turma_id', turmaIds);
      matriculasResumo = data || [];
    }

    const { data: matriculasRecency } = await supabase
      .from('matriculas')
      .select('turma_id, created_at')
      .eq('escola_id', escolaId)
      .order('created_at', { ascending: false })
      .limit(200);

    const lastByTurma = new Map<string, string>();
    for (const row of matriculasRecency || []) {
      if (row.turma_id && !lastByTurma.has(row.turma_id)) {
        lastByTurma.set(row.turma_id, row.created_at ?? '');
      }
    }

    const countsByTurma = new Map<string, Record<string, number>>();
    let totalAlunos = 0;
    for (const row of matriculasResumo || []) {
      const turmaId = (row as any)?.turma_id;
      if (!turmaId) continue;
      const status = ((row as any)?.status ?? 'indefinido').toString();
      const count = Number((row as any)?.count ?? 0);
      if (!countsByTurma.has(turmaId)) countsByTurma.set(turmaId, {});
      const current = countsByTurma.get(turmaId)!;
      current[status] = (current[status] ?? 0) + count;
      totalAlunos += count;
    }

    const items = (turmas || [])
      .filter((turma) => {
        if (!turnoFilter) return true;
        return (turma.turno ?? 'sem_turno') === turnoFilter;
      })
      .map((turma) => {
        const statusCounts = countsByTurma.get(turma.id) ?? {};
        const total = Object.values(statusCounts).reduce((acc, cur) => acc + Number(cur || 0), 0);
        return {
          id: turma.id,
          nome: turma.nome,
          turno: turma.turno ?? 'Sem turno',
          ano_letivo: turma.ano_letivo,
          professor: turma.professor_id ? professoresMap.get(turma.professor_id) ?? { nome: null, email: null } : { nome: null, email: null },
          status_counts: statusCounts,
          total_alunos: total,
          ultima_matricula: lastByTurma.get(turma.id) ?? turma.created_at ?? null,
        };
      });

    const porTurnoMap = new Map<string, number>();
    for (const turma of turmas || []) {
      const key = turma.turno ?? 'Sem turno';
      porTurnoMap.set(key, (porTurnoMap.get(key) ?? 0) + 1);
    }

    const porTurno = Array.from(porTurnoMap.entries()).map(([turno, total]) => ({ turno, total }));

    return NextResponse.json({
      ok: true,
      items,
      total: items.length,
      stats: {
        totalTurmas: turmas?.length ?? 0,
        totalAlunos,
        porTurno,
      },
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
