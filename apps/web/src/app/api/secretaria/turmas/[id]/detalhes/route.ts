import { NextResponse } from 'next/server';
import { supabaseServerTyped } from '@/lib/supabaseServer';

export const dynamic = 'force-dynamic';

export async function GET(req: Request, { params }: { params: { id: string } }) {
  try {
    const supabase = await supabaseServerTyped();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ ok: false, error: 'Não autenticado' }, { status: 401 });
    }

    const turmaId = params.id;
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
      .single();

    if (turmaError || !turmaResult) {
      console.error('Error fetching turma:', turmaError);
      return NextResponse.json({ ok: false, error: 'Turma não encontrada' }, { status: 404 });
    }

    // 2. Ocupação da turma
    const { data: ocupacaoResult, error: ocupacaoError } = await supabase
      .from('matriculas')
      .select('id')
      .eq('turma_id', turmaId)
      .in('status', ['ativa', 'ativo']);

    if (ocupacaoError) {
      console.error('Error fetching ocupacao:', ocupacaoError);
      return NextResponse.json({ ok: false, error: 'Erro ao buscar ocupação' }, { status: 500 });
    }

    const ocupacao = ocupacaoResult?.length || 0;

    // 3. Buscar diretor separadamente para evitar problemas de relacionamento
    let diretor = null;
    if (turmaResult.diretor_turma_id) {
      const { data: diretorData, error: diretorError } = await supabase
        .from('escola_usuarios')
        .select(`
          id,
          user_id,
          perfis ( nome_completo, email )
        `)
        .eq('id', turmaResult.diretor_turma_id)
        .single();

      if (!diretorError && diretorData) {
        diretor = {
          id: diretorData.id,
          nome: diretorData.perfis?.nome_completo || 'Diretor sem nome',
          email: diretorData.perfis?.email || '',
        };
      }
    }

    // 4. Buscar alunos - usando numero_chamada que existe
    const { data: alunosData, error: alunosError } = await supabase
      .from('matriculas')
      .select(`
        id,
        numero_chamada,
        alunos!inner ( id, nome, bi_numero, foto_url, status )
      `)
      .eq('turma_id', turmaId)
      .in('status', ['ativa', 'ativo'])
      .order('numero_chamada', { ascending: true });

    if (alunosError) {
      console.error('Error fetching students:', alunosError);
      // Continuar mesmo com erro nos alunos, retornar array vazio
    }

    // 5. Buscar disciplinas e professores separadamente
    const { data: disciplinasData, error: disciplinasError } = await supabase
      .from('turma_disciplinas_professores')
      .select(`
        id,
        turma_id,
        professor_id,
        syllabus_id,
        professores ( id, nome_completo, profile_id ),
        syllabi ( id, nome, codigo )
      `)
      .eq('turma_id', turmaId);

    if (disciplinasError) {
      console.error('Error fetching disciplines:', disciplinasError);
      // Continuar mesmo com erro
    }

    // 6. Montar resposta final
    const turma = {
      id: turmaResult.id,
      nome: turmaResult.nome,
      turma_codigo: turmaResult.turma_codigo,
      classe_id: turmaResult.classes?.id || '',
      classe_nome: turmaResult.classes?.nome || 'Não Definida',
      ano_letivo: turmaResult.ano_letivo,
      turno: turmaResult.turno,
      sala: turmaResult.sala || '',
      capacidade: turmaResult.capacidade_maxima,
      ocupacao: ocupacao,
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
      foto: m.alunos?.foto_url || undefined,
      status_matricula: m.alunos?.status || 'desconhecido',
    }));

    const disciplinas = (disciplinasData || []).map(td => ({
      id: td.syllabi?.id || '',
      nome: td.syllabi?.nome || 'Disciplina Desconhecida',
      sigla: td.syllabi?.codigo || '',
      professor: td.professores?.nome_completo || 'Sem Professor',
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