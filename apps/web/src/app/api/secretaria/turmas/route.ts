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
      .select('current_escola_id, escola_id')
      .order('created_at', { ascending: false })
      .limit(1);
    let escolaId = ((prof?.[0] as any)?.current_escola_id || (prof?.[0] as any)?.escola_id) as string | undefined;
    if (!escolaId) {
      try {
        const { data: vinc } = await supabase
          .from('escola_usuarios')
          .select('escola_id')
          .eq('user_id', user.id)
          .limit(1);
        escolaId = (vinc?.[0] as any)?.escola_id as string | undefined;
      } catch {}
    }
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
      .select('id, nome, turno, classe, ano_letivo, diretor_turma_id, created_at')
      .eq('escola_id', escolaId)
      .order('nome');
    if (turmasError) return NextResponse.json({ ok: false, error: turmasError.message }, { status: 400 });

    const turmaIds = (turmas || []).map((t) => t.id);
    const diretorIds = Array.from(new Set((turmas || []).map((t) => t.diretor_turma_id).filter((id): id is string => Boolean(id))));

    let diretoresMap = new Map<string, { nome: string | null; email: string | null }>();
    if (diretorIds.length) {
      const { data: diretores } = await supabase
        .from('profiles')
        .select('user_id, nome, email')
        .in('user_id', diretorIds);

      for (const diretor of diretores || []) {
        diretoresMap.set(diretor.user_id, { nome: diretor.nome ?? null, email: diretor.email ?? null });
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
          classe: turma.classe,
          turno: turma.turno ?? 'Sem turno',
          ano_letivo: turma.ano_letivo,
          professor: turma.diretor_turma_id ? diretoresMap.get(turma.diretor_turma_id) ?? { nome: null, email: null } : { nome: null, email: null },
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

export async function POST(req: Request) {
  try {
    const supabase = await supabaseServerTyped<any>();
    const { data: userRes } = await supabase.auth.getUser();
    const user = userRes?.user;
    if (!user) return NextResponse.json({ ok: false, error: 'Não autenticado' }, { status: 401 });

    const { data: prof } = await supabase
      .from('profiles')
      .select('current_escola_id, escola_id')
      .order('created_at', { ascending: false })
      .limit(1);
    let escolaId = ((prof?.[0] as any)?.current_escola_id || (prof?.[0] as any)?.escola_id) as string | undefined;
    if (!escolaId) {
      try {
        const { data: vinc } = await supabase
          .from('escola_usuarios')
          .select('escola_id')
          .eq('user_id', user.id)
          .limit(1);
        escolaId = (vinc?.[0] as any)?.escola_id as string | undefined;
      } catch {}
    }
    if (!escolaId) {
      return NextResponse.json({ ok: false, error: 'Escola não encontrada' }, { status: 400 });
    }

    const body = await req.json();
    const {
      nome,
      classe_id,
      curso_id,
      turno,
      session_id,
      diretor_turma_id,
      coordenador_pedagogico_id,
      capacidade_maxima,
      sala,
    } = body;

    if (!nome || !classe_id || !curso_id || !turno || !session_id) {
      return NextResponse.json({ ok: false, error: 'Campos obrigatórios em falta' }, { status: 400 });
    }

    const { data: newTurma, error } = await supabase
      .from('turmas')
      .insert({
        nome,
        classe_id,
        curso_id,
        turno,
        session_id,
        diretor_turma_id: diretor_turma_id || null,
        coordenador_pedagogico_id: coordenador_pedagogico_id || null,
        capacidade_maxima,
        sala,
        escola_id: escolaId,
      })
      .select()
      .single();

    if (error) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 400 });
    }

    return NextResponse.json({ ok: true, data: newTurma });

  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
