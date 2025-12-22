import { NextResponse } from "next/server";
import { supabaseServerTyped } from "@/lib/supabaseServer";

type MatriculaResumo = {
  status: string | null;
  count: number;
};

type TurmaResumo = {
  turma_id: string;
  status: string | null;
  count: number;
};

const withGroup = (group: string) =>
  ({ group } as unknown as { head?: boolean; count?: 'exact' | 'planned' | 'estimated' });

export async function GET() {
  try {
    const supabase = await supabaseServerTyped<any>();
    const { data: userRes } = await supabase.auth.getUser();
    const user = userRes?.user;
    if (!user) return NextResponse.json({ ok: false, error: 'Não autenticado' }, { status: 401 });

    // Resolve escola do usuário: profiles.current_escola_id -> profiles.escola_id -> escola_users.escola_id
    const { data: prof } = await supabase
      .from('profiles')
      .select('current_escola_id, escola_id, user_id')
      .order('created_at', { ascending: false })
      .limit(1);
    let escolaId = ((prof?.[0] as any)?.current_escola_id || (prof?.[0] as any)?.escola_id) as string | undefined;
    if (!escolaId) {
      try {
        const { data: vinc } = await supabase
          .from('escola_users')
          .select('escola_id')
          .eq('user_id', user.id)
          .limit(1);
        escolaId = (vinc?.[0] as any)?.escola_id as string | undefined;
      } catch {}
    }
    if (!escolaId) {
      return NextResponse.json({
        ok: true,
        counts: { alunos: 0, matriculas: 0, turmas: 0, pendencias: 0 },
        resumo_status: [],
        turmas_destaque: [],
        novas_matriculas: [],
        avisos_recentes: [],
      });
    }

    const [alunosAtivosRes, turmasRes, matsRes, matsStatusRes, matsTurmaStatusRes, avisosRes, ultimasMatriculasRes] = await Promise.all([
      // Número de alunos com matrícula ativa (distinto por aluno_id)
      supabase
        .from('matriculas')
        .select('aluno_id, count:aluno_id', withGroup('aluno_id'))
        .eq('escola_id', escolaId)
        .in('status', ['ativa', 'ativo', 'active'])
        .not('aluno_id', 'is', null),
      supabase.from('turmas').select('id, nome, turno, ano_letivo, professor_id').eq('escola_id', escolaId).order('nome'),
      supabase.from('matriculas').select('*', { count: 'exact', head: true }).eq('escola_id', escolaId),
      supabase
        .from('matriculas')
        .select('status, count:status', withGroup('status'))
        .eq('escola_id', escolaId),
      supabase
        .from('matriculas')
        .select('turma_id, status, count:turma_id', withGroup('turma_id,status'))
        .eq('escola_id', escolaId),
      supabase
        .from('avisos')
        .select('id, titulo, resumo, origem, created_at')
        .eq('escola_id', escolaId)
        .order('created_at', { ascending: false })
        .limit(3),
      supabase
        .from('matriculas')
        .select(`id, status, created_at, turma_id, turmas ( nome, turno ), alunos ( id, profiles!alunos_profile_id_fkey ( nome, email ) )`)
        .eq('escola_id', escolaId)
        .order('created_at', { ascending: false })
        .limit(6),
    ]);

    // Aggregate and normalize status to avoid duplicates from DB inconsistencies
    const resumoAgg = new Map<string, number>();
    for (const row of (matsStatusRes.data || [])) {
      const key = canonicalStatus((row as MatriculaResumo).status);
      const total = Number((row as any)?.count ?? (row as MatriculaResumo).count ?? 0);
      resumoAgg.set(key, (resumoAgg.get(key) ?? 0) + total);
    }
    const resumoStatus = Array.from(resumoAgg.entries()).map(([status, total]) => ({ status, total }));

    const turmaStatus = new Map<string, Record<string, number>>();
    for (const row of matsTurmaStatusRes.data || []) {
      const turmaId = (row as TurmaResumo).turma_id;
      if (!turmaId) continue;
      const statusKey = canonicalStatus((row as TurmaResumo).status);
      const total = Number((row as any)?.count ?? (row as TurmaResumo).count ?? 0);
      if (!turmaStatus.has(turmaId)) turmaStatus.set(turmaId, {});
      turmaStatus.get(turmaId)![statusKey] = (turmaStatus.get(turmaId)![statusKey] ?? 0) + total;
    }

    const professorIds = Array.from(
      new Set((turmasRes.data || []).map((t: any) => t.professor_id).filter((id: string | null | undefined): id is string => Boolean(id)))
    );

    let professoresMap = new Map<string, { nome: string | null; email: string | null }>();
    if (professorIds.length) {
      const { data: professores } = await supabase
        .from('professores')
        .select('id, profile_id')
        .in('id', professorIds);
      const profileIds = Array.from(
        new Set((professores || []).map((p) => p.profile_id).filter((id: string | null | undefined): id is string => Boolean(id)))
      );
      let profilesMap = new Map<string, { nome: string | null; email: string | null }>();
      if (profileIds.length) {
        const { data: perfis } = await supabase
          .from('profiles')
          .select('user_id, nome, email')
          .in('user_id', profileIds);
        for (const perfil of perfis || []) {
          profilesMap.set(perfil.user_id, { nome: perfil.nome ?? null, email: perfil.email ?? null });
        }
      }
      for (const prof of professores || []) {
        if (!prof?.id) continue;
        const perfil = prof.profile_id ? profilesMap.get(prof.profile_id) : undefined;
        professoresMap.set(prof.id, { nome: perfil?.nome ?? null, email: perfil?.email ?? null });
      }
    }

    const turmasDestaque = (turmasRes.data || []).map((turma: any) => {
      const counts = turmaStatus.get(turma.id) ?? {};
      const total = Object.values(counts).reduce((acc, cur) => acc + Number(cur || 0), 0);
      const professorInfo = turma.professor_id ? professoresMap.get(turma.professor_id) : undefined;
      return {
        id: turma.id,
        nome: turma.nome,
        turno: turma.turno,
        ano_letivo: turma.ano_letivo,
        total_alunos: total,
        status_counts: counts,
        professor: professorInfo ?? { nome: null, email: null },
      };
    });

    turmasDestaque.sort((a, b) => (b.total_alunos ?? 0) - (a.total_alunos ?? 0));

    const avisos_recentes = (avisosRes.data || []).map((a: any) => ({
      id: a.id,
      titulo: a.titulo,
      resumo: a.resumo,
      origem: a.origem,
      data: a.created_at,
    }));

    const novasMatriculas = (ultimasMatriculasRes.data || []).map((row: any) => {
      const alunoProfile = row.alunos?.profiles?.[0] ?? row.alunos?.profiles;
      return {
        id: row.id,
        status: row.status,
        created_at: row.created_at,
        turma: {
          id: row.turma_id,
          nome: row.turmas?.nome ?? 'Sem turma',
          turno: row.turmas?.turno ?? null,
        },
        aluno: {
          id: row.alunos?.id ?? null,
          nome: alunoProfile?.nome ?? 'Aluno sem nome',
          email: alunoProfile?.email ?? null,
        },
      };
    });

    const pendencias = resumoStatus
      .filter((item) => normalizeStatus(item.status).context === 'alert')
      .reduce((acc, item) => acc + item.total, 0);

    return NextResponse.json({
      ok: true,
      counts: {
        alunos: (alunosAtivosRes.data?.length ?? 0),
        matriculas: matsRes.count ?? 0,
        turmas: turmasRes.data?.length ?? 0,
        pendencias,
      },
      resumo_status: resumoStatus,
      turmas_destaque: turmasDestaque.slice(0, 4),
      novas_matriculas: novasMatriculas,
      avisos_recentes,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

import { AlunoStatusSchema, AlunoStatus } from '@moxi/tenant-sdk/aluno';

function normalizeStatus(status: string): { label: string; context: 'success' | 'alert' | 'muted' | 'neutral' } {
  const parsedStatus = AlunoStatusSchema.safeParse(status);
  if (!parsedStatus.success) {
    return { label: status || 'Indefinido', context: "neutral" as const };
  }

  const value = parsedStatus.data;

  switch (value) {
    case 'ativo':
      return { label: "Ativo", context: "success" as const };
    case 'concluido':
      return { label: "Concluído", context: "muted" as const };
    case 'transferido':
      return { label: "Transferido", context: "alert" as const };
    case 'pendente':
      return { label: "Pendente", context: "alert" as const };
    case 'inativo':
    case 'suspenso':
    case 'trancado':
    case 'desistente':
      return { label: "Irregular", context: "alert" as const };
    default:
      return { label: status || 'Indefinido', context: "neutral" as const };
  }
}

function canonicalStatus(status: string | null | undefined): AlunoStatus | 'indefinido' {
  const parsedStatus = AlunoStatusSchema.safeParse((status || '').trim().toLowerCase());
  if (parsedStatus.success) {
    if (['ativa', 'active'].includes((status || '').trim().toLowerCase())) return 'ativo';
    if (['concluida', 'graduado'].includes((status || '').trim().toLowerCase())) return 'concluido';
    if (['transferida'].includes((status || '').trim().toLowerCase())) return 'transferido';
    if (['aguardando'].includes((status || '').trim().toLowerCase())) return 'pendente';
    return parsedStatus.data;
  }
  return 'indefinido';
}
