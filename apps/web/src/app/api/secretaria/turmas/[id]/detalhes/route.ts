import { NextResponse } from 'next/server';
import { supabaseServerTyped } from '@/lib/supabaseServer';
import { authorizeTurmasManage } from "@/lib/escola/disciplinas";
import { resolveEscolaIdForUser } from "@/lib/tenant/resolveEscolaIdForUser";
import { applyKf2ListInvariants } from "@/lib/kf2";
import type { Database } from "~types/supabase";

export const dynamic = 'force-dynamic';

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const supabase = await supabaseServerTyped<Database>();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ ok: false, error: 'Não autenticado' }, { status: 401 });
    }

    const escolaId = await resolveEscolaIdForUser(supabase as any, user.id);
    if (!escolaId) {
      return NextResponse.json({ ok: false, error: 'Usuário não vinculado a nenhuma escola' }, { status: 403 });
    }

    const authz = await authorizeTurmasManage(supabase as any, escolaId, user.id);
    if (!authz.allowed) {
      return NextResponse.json({ ok: false, error: authz.reason || 'Sem permissão' }, { status: 403 });
    }

    const disciplinaClient = supabase;

    const { id: turmaId } = await params;
    console.log('Fetching turma ID:', turmaId);

    // 1. Query principal da turma - simplificada primeiro
    const { data: turmaResult, error: turmaError } = await supabase
      .from('turmas')
      .select(`
        id,
        nome,
        turma_codigo,
        ano_letivo,
        turno,
        sala,
        capacidade_maxima,
        diretor_turma_id,
        escola_id,
        classes ( id, nome ),
        cursos ( id, nome, tipo )
      `)
      .eq('id', turmaId)
      .eq('escola_id', escolaId)
      .single();

    if (turmaError || !turmaResult) {
      console.error('Error fetching turma:', turmaError);
      return NextResponse.json({ ok: false, error: 'Turma não encontrada' }, { status: 404 });
    }

    // 2. Ocupação da turma
    const { data: ocupacaoRow, error: ocupacaoError } = await supabase
      .from('vw_turmas_para_matricula')
      .select('ocupacao_atual')
      .eq('escola_id', escolaId)
      .eq('id', turmaId)
      .maybeSingle();

    if (ocupacaoError) {
      console.error('Error fetching ocupacao:', ocupacaoError);
      return NextResponse.json({ ok: false, error: 'Erro ao buscar ocupação' }, { status: 500 });
    }
    const ocupacao = Number(ocupacaoRow?.ocupacao_atual ?? 0);

    // 3. Buscar diretor separadamente para evitar problemas de relacionamento
    let diretor: { id: string; nome: string; email: string } | null = null;
    if (turmaResult.diretor_turma_id) {
      const { data: diretorData, error: diretorError } = await supabase
        .from('escola_users')
        .select('id, user_id')
        .eq('id', turmaResult.diretor_turma_id)
        .single();

      if (!diretorError && diretorData) {
        const { data: perfil } = await supabase
          .from('profiles')
          .select('nome, email')
          .eq('user_id', diretorData.user_id)
          .maybeSingle();
        diretor = {
          id: diretorData.id,
          nome: perfil?.nome || 'Diretor sem nome',
          email: perfil?.email || '',
        };
      }
    }

    // 4. Buscar alunos - usando numero_chamada que existe
    let alunosQuery = supabase
      .from('matriculas')
      .select(`
        id,
        numero_chamada,
        numero_matricula,
        status,
        alunos!inner (
          id,
          nome,
          bi_numero,
          status,
          profile_id,
          profiles!alunos_profile_id_fkey ( avatar_url )
        )
      `)
      .eq('turma_id', turmaId)
      .eq('escola_id', escolaId)
      .in('status', ['ativa', 'ativo'])
      .order('numero_chamada', { ascending: true });

    alunosQuery = applyKf2ListInvariants(alunosQuery, { defaultLimit: 50 });

    const { data: alunosData, error: alunosError } = await alunosQuery;

    if (alunosError) {
      console.error('Error fetching students:', alunosError);
      // Continuar mesmo com erro nos alunos, retornar array vazio
    }

    // 5. Buscar disciplinas e professores separadamente
    let disciplinasData: any[] | null = null;
    let disciplinasError: Error | null = null;
    try {
      const { data: pedagogicoRows, error: pedagogicoError } = await supabase
        .rpc('get_turma_disciplinas_pedagogico', {
          p_escola_id: escolaId,
          p_turma_id: turmaId,
        });

      if (!pedagogicoError && Array.isArray(pedagogicoRows) && pedagogicoRows.length > 0) {
        disciplinasData = pedagogicoRows.map((row: any) => ({
          id: row.disciplina_id ?? row.id,
          turma_id: row.turma_id,
          turma_disciplina_id: row.id,
          disciplina: { id: row.disciplina_id, nome: row.disciplina_nome },
          professores: row.professor_nome
            ? { profiles: { nome: row.professor_nome, email: row.professor_email } }
            : null,
          periodos_ativos: row.periodos_ativos ?? null,
        }));
      } else {
        let disciplinasQuery = disciplinaClient
          .from('turma_disciplinas_professores')
          .select(`
            id,
            turma_id,
            professor_id,
            disciplina_id,
            syllabus_id,
            professores (
              id,
              apelido,
              profile_id,
              profiles!professores_profile_id_fkey ( nome, email )
            ),
            syllabi ( id, nome )
          `)
          .eq('turma_id', turmaId)
          .eq('escola_id', escolaId)
          .order('created_at', { ascending: false });

        disciplinasQuery = applyKf2ListInvariants(disciplinasQuery, { defaultLimit: 50 });

        const { data, error } = await disciplinasQuery;
        disciplinasData = data ?? [];
        disciplinasError = error ? new Error(error.message) : null;
      }
    } catch (e) {
      disciplinasError = e instanceof Error ? e : new Error('Erro ao buscar disciplinas');
    }

    if (disciplinasError) {
      console.error('Error fetching disciplines:', disciplinasError);
      disciplinasData = disciplinasData ?? [];
    }

    const { data: periodosRows } = await disciplinaClient
      .from('turma_disciplinas')
      .select('curso_matriz_id, periodos_ativos, curso_matriz(disciplina_id)')
      .eq('escola_id', escolaId)
      .eq('turma_id', turmaId);

    const periodosByDisciplinaId = new Map<string, number[] | null>();
    for (const row of periodosRows || []) {
      const disciplinaId = (row as any)?.curso_matriz?.disciplina_id as string | undefined;
      if (disciplinaId) {
        periodosByDisciplinaId.set(disciplinaId, (row as any).periodos_ativos ?? null);
      }
    }

    if (!disciplinasData || disciplinasData.length === 0) {
      let fallbackQuery = disciplinaClient
        .from('turma_disciplinas')
        .select(`
          id,
          turma_id,
          curso_matriz_id,
          periodos_ativos,
          curso_matriz (
            id,
            disciplina_id,
            disciplinas_catalogo ( id, nome )
          )
        `)
        .eq('turma_id', turmaId)
        .eq('escola_id', escolaId)
        .order('created_at', { ascending: false });

      fallbackQuery = applyKf2ListInvariants(fallbackQuery, { defaultLimit: 50 });

      const { data: fallbackRows, error: fallbackError } = await fallbackQuery;
      if (fallbackError) {
        console.error('Error fetching turma_disciplinas fallback:', fallbackError);
      }

      disciplinasData = (fallbackRows || []).map((row: any) => ({
        id: row.curso_matriz?.disciplinas_catalogo?.id || row.curso_matriz?.disciplina_id || row.curso_matriz_id,
        turma_id: turmaId,
        turma_disciplina_id: row.id,
        disciplina: row.curso_matriz?.disciplinas_catalogo || null,
        professores: null,
        periodos_ativos: row.periodos_ativos ?? null,
      }));
    }

    if (!disciplinasData || disciplinasData.length === 0) {
      let matrizQuery = disciplinaClient
        .from('curso_matriz')
        .select('id, disciplina_id, periodos_ativos, disciplinas_catalogo ( id, nome )')
        .eq('escola_id', escolaId)
        .eq('classe_id', turmaResult.classes?.id || '')
        .order('ordem', { ascending: true });

      if (turmaResult.cursos?.id) {
        matrizQuery = matrizQuery.eq('curso_id', turmaResult.cursos.id);
      }

      matrizQuery = applyKf2ListInvariants(matrizQuery, { defaultLimit: 50 });

      const { data: matrizRows, error: matrizError } = await matrizQuery;
      if (matrizError) {
        console.error('Error fetching curso_matriz fallback:', matrizError);
      }

      disciplinasData = (matrizRows || []).map((row: any) => ({
        id: row.disciplinas_catalogo?.id || row.disciplina_id || row.id,
        turma_id: turmaId,
        turma_disciplina_id: null,
        disciplina: row.disciplinas_catalogo || null,
        professores: null,
        periodos_ativos: row.periodos_ativos ?? null,
      }));
    }

    // 6. Montar resposta final
    const turma = {
      id: turmaResult.id,
      escola_id: turmaResult.escola_id,
      nome: turmaResult.nome,
      turma_codigo: turmaResult.turma_codigo,
      classe_id: turmaResult.classes?.id || '',
      classe_nome: turmaResult.classes?.nome || 'Não Definida',
      ano_letivo: turmaResult.ano_letivo,
      turno: turmaResult.turno,
      sala: turmaResult.sala || '',
      capacidade: turmaResult.capacidade_maxima,
      ocupacao: ocupacao ?? 0,
      diretor: diretor,
      curso_nome: turmaResult.cursos?.nome || null,
      curso_tipo: turmaResult.cursos?.tipo || null,
    };

    const alunos = (alunosData || []).map(m => ({
      matricula_id: m.id,
      numero: m.numero_chamada,
      aluno_id: m.alunos?.id || '',
      nome: m.alunos?.nome || 'Nome Desconhecido',
      bi: m.alunos?.bi_numero || 'N/A',
      foto: m.alunos?.profiles?.avatar_url || undefined,
      numero_matricula: m.numero_matricula,
      status_matricula: m.status || m.alunos?.status || 'desconhecido',
    }));

    const disciplinas = (disciplinasData || []).map(td => ({
      id: td.syllabi?.id || td.disciplina?.id || td.disciplina_id || '',
      turma_disciplina_id: td.turma_disciplina_id || td.id || null,
      nome: td.syllabi?.nome || td.disciplina?.nome || 'Disciplina Desconhecida',
      sigla: '',
      professor: td.professores?.profiles?.nome || td.professores?.apelido || 'Sem Professor',
      periodos_ativos: td.periodos_ativos ?? periodosByDisciplinaId.get(td.disciplina?.id || td.disciplina_id) ?? null,
    }));

    const responseData = {
      turma,
      alunos,
      disciplinas,
    };

    console.log('API response prepared for turma:', turmaId);
    return NextResponse.json({ ok: true, data: responseData });

  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    console.error('Error in Turma detalhes API:', message);
    console.error('Stack:', e instanceof Error ? e.stack : 'No stack');
    return NextResponse.json({ 
      ok: false, 
      error: message,
      stack: e instanceof Error ? e.stack : undefined 
    }, { status: 500 });
  }
}
