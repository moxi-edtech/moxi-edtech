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

    // Resolve escola vinculada mais recente do profile
    const { data: prof } = await supabase
      .from('profiles')
      .select('escola_id')
      .order('created_at', { ascending: false })
      .limit(1);
    const escolaId = (prof?.[0] as any)?.escola_id as string | undefined;
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

    const [alunosRes, turmasRes, matsRes, matsStatusRes, matsTurmaStatusRes, avisosRes, ultimasMatriculasRes] = await Promise.all([
      supabase.from('alunos').select('*', { count: 'exact', head: true }).eq('escola_id', escolaId),
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

    const resumoStatus = (matsStatusRes.data || []).map((row: MatriculaResumo) => ({
      status: row.status ?? 'indefinido',
      total: Number((row as any)?.count ?? row.count ?? 0),
    }));

    const turmaStatus = new Map<string, Record<string, number>>();
    for (const row of matsTurmaStatusRes.data || []) {
      const turmaId = (row as TurmaResumo).turma_id;
      if (!turmaId) continue;
      const status = ((row as TurmaResumo).status ?? 'indefinido').toString();
      const total = Number((row as any)?.count ?? (row as TurmaResumo).count ?? 0);
      if (!turmaStatus.has(turmaId)) turmaStatus.set(turmaId, {});
      turmaStatus.get(turmaId)![status] = (turmaStatus.get(turmaId)![status] ?? 0) + total;
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
        alunos: alunosRes.count ?? 0,
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

function normalizeStatus(status: string) {
  const value = (status || '').toLowerCase();
  if (["ativa", "ativo", "active"].includes(value)) return { label: "Ativo", context: "success" as const };
  if (["concluida", "concluido", "graduado"].includes(value)) return { label: "Concluído", context: "muted" as const };
  if (["transferido", "transferida"].includes(value)) return { label: "Transferido", context: "alert" as const };
  if (["pendente", "aguardando"].includes(value)) return { label: "Pendente", context: "alert" as const };
  if (["trancado", "suspenso", "desistente", "inativo"].includes(value)) return { label: "Irregular", context: "alert" as const };
  return { label: status || 'Indefinido', context: "neutral" as const };
}

