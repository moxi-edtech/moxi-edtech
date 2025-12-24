import { NextResponse } from 'next/server';
import { supabaseServerTyped } from '@/lib/supabaseServer';

export const dynamic = 'force-dynamic';

export async function GET(req: Request, { params }: { params: { id: string } }) {
  try {
    const supabase = await supabaseServerTyped();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return new NextResponse('Unauthorized', { status: 401 });
    }

    const turmaId = params.id;

    // Fetch Turma details, including related classes, courses, and director
    const { data: turmaResult, error: turmaError } = await supabase
      .from('turmas')
      .select(`
        id,
        nome,
        ano_letivo,
        turno,
        sala,
        capacidade_maxima,
        classes ( id, nome ),
        cursos ( id, nome, tipo ),
        escola_usuarios (
          id,
          email,
          perfis ( nome_completo )
        )
      `)
      .eq('id', turmaId)
      .single();

    if (turmaError || !turmaResult) {
      console.error('Error fetching turma:', turmaError);
      return new NextResponse('Turma not found', { status: 404 });
    }

    const { data: ocupacaoResult, error: ocupacaoError } = await supabase
      .from('matriculas')
      .select('id')
      .eq('turma_id', turmaId)
      .in('status', ['ativa', 'ativo']);

    if (ocupacaoError) {
        console.error('Error fetching ocupacao:', ocupacaoError);
        return new NextResponse('Error fetching turma occupancy', { status: 500 });
    }

    const ocupacao = ocupacaoResult?.length || 0;

    const director = turmaResult.escola_usuarios ? {
        id: turmaResult.escola_usuarios.id,
        nome: turmaResult.escola_usuarios.perfis?.nome_completo || turmaResult.escola_usuarios.email,
        email: turmaResult.escola_usuarios.email,
    } : null;

    const turma = {
        id: turmaResult.id,
        nome: turmaResult.nome,
        classe_id: turmaResult.classes?.id || '',
        classe_nome: turmaResult.classes?.nome || 'Não Definida',
        ano_letivo: turmaResult.ano_letivo,
        turno: turmaResult.turno,
        sala: turmaResult.sala,
        capacidade: turmaResult.capacidade_maxima,
        ocupacao: ocupacao,
        diretor: director,
        curso_nome: turmaResult.cursos?.nome || null,
        curso_tipo: turmaResult.cursos?.tipo || null,
    };

    // Fetch Alunos
    const { data: alunosData, error: alunosError } = await supabase
      .from('matriculas')
      .select(`
        id,
        numero,
        alunos ( id, nome, bi_numero, foto_url, status )
      `)
      .eq('turma_id', turmaId)
      .in('status', ['ativa', 'ativo'])
      .order('numero', { ascending: true }); // Order by numero

    if (alunosError) {
      console.error('Error fetching students:', alunosError);
      return new NextResponse('Error fetching students', { status: 500 });
    }

    const alunos = alunosData.map(m => ({
        matricula_id: m.id,
        numero: m.numero,
        aluno_id: m.alunos?.id || '',
        nome: m.alunos?.nome || 'Nome Desconhecido',
        bi: m.alunos?.bi_numero || 'N/A',
        foto: m.alunos?.foto_url || undefined,
        status_matricula: m.alunos?.status || 'desconhecido',
        // status_financeiro: 'em_dia' // TODO: Implement real financial status check
    }));

    // Fetch Disciplinas
    const { data: disciplinasData, error: disciplinasError } = await supabase
      .from('turma_disciplinas_professores') // Assuming this view/table exists based on other migrations
      .select(`
        disciplinas ( id, nome, sigla ),
        professores ( id, nome_completo )
      `)
      .eq('turma_id', turmaId);

    if (disciplinasError) {
      console.error('Error fetching disciplines:', disciplinasError);
      return new NextResponse('Error fetching disciplines', { status: 500 });
    }

    const disciplinas = disciplinasData.map(td => ({
        id: td.disciplinas?.id || '',
        nome: td.disciplinas?.nome || 'Disciplina Desconhecida',
        professor: td.professores?.nome_completo || 'Sem Professor',
    }));

    const responseData = {
      turma,
      alunos,
      disciplinas,
    };

    return NextResponse.json({ ok: true, data: responseData });

  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    console.error('Error in Turma detalhes API:', message);
    return new NextResponse(message, { status: 500 });
  }
}
