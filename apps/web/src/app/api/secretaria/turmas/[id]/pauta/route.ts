import { NextResponse } from 'next/server';
import { supabaseServerTyped } from '@/lib/supabaseServer';
import * as XLSX from 'xlsx';
import { applyKf2ListInvariants } from '@/lib/kf2';
import { resolveEscolaIdForUser } from '@/lib/tenant/resolveEscolaIdForUser';
import { requireFeature } from '@/lib/plan/requireFeature';
import { HttpError } from '@/lib/errors';

export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const fetchCache = 'force-no-store';

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const supabase = await supabaseServerTyped();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return new NextResponse('Unauthorized', { status: 401 });
    }

    const { id: turmaId } = await params;
    const escolaId = await resolveEscolaIdForUser(supabase as any, user.id);
    if (!escolaId) {
      return new NextResponse('Escola não encontrada', { status: 403 });
    }

    try {
      await requireFeature('doc_qr_code');
    } catch (err) {
      if (err instanceof HttpError) {
        return NextResponse.json({ ok: false, error: err.message, code: err.code }, { status: err.status });
      }
      throw err;
    }

    // 1. Fetch Turma, Alunos, and Disciplinas
    const { data: turmaData, error: turmaError } = await supabase
      .from('turmas')
      .select('id, nome')
      .eq('id', turmaId)
      .eq('escola_id', escolaId)
      .single();

    if (turmaError || !turmaData) {
      console.error('Error fetching turma:', turmaError);
      return new NextResponse('Turma not found', { status: 404 });
    }
    
    let matriculasQuery = supabase
      .from('matriculas')
      .select(`
        alunos ( id, nome )
      `)
      .eq('turma_id', turmaId)
      .eq('escola_id', escolaId)
      .in('status', ['ativo', 'ativa', 'active']); // Somente alunos com matrícula ativa

    matriculasQuery = applyKf2ListInvariants(matriculasQuery, { defaultLimit: 1000 });

    const { data: matriculasData, error: matriculasError } = await matriculasQuery;

    if (matriculasError) {
      console.error('Error fetching matriculas:', matriculasError);
      return new NextResponse('Error fetching students', { status: 500 });
    }

    const alunos = matriculasData.map(m => m.alunos).filter(Boolean);

    const { data: disciplinasRows } = await supabase
      .from('turma_disciplinas')
      .select('curso_matriz:curso_matriz_id(disciplina:disciplinas_catalogo!curso_matriz_disciplina_id_fkey(id, nome, sigla))')
      .eq('turma_id', turmaId)
      .eq('escola_id', escolaId);

    const disciplinaMap = new Map<string, { id: string; nome: string; sigla: string | null }>();
    (disciplinasRows || []).forEach((row: any) => {
      const disciplina = row?.curso_matriz?.disciplina;
      if (disciplina?.id && !disciplinaMap.has(disciplina.id)) {
        disciplinaMap.set(disciplina.id, disciplina);
      }
    });
    const disciplinas = Array.from(disciplinaMap.values());

    // 2. Prepare data for Excel
    const header = [
      'ID Aluno',
      'Nome',
      ...disciplinas.map(d => d.sigla || d.nome)
    ];

    const body = alunos.map(aluno => ({
      'ID Aluno': aluno.id,
      'Nome': aluno.nome,
    }));

    // 3. Create Excel workbook
    const ws = XLSX.utils.json_to_sheet(body, { header: header });
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Pauta');

    // 4. Generate buffer
    const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

    // 5. Return response
    const trimestre = '1Trimestre'; // This can be dynamic later
    const fileName = `Pauta_${turmaData.nome.replace(/\s+/g, '_')}_${trimestre}.xlsx`;

    return new NextResponse(buf, {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${fileName}"`,
      },
    });

  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    console.error('Error generating pauta:', message);
    return new NextResponse(message, { status: 500 });
  }
}
