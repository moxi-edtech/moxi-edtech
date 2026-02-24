import { NextResponse } from 'next/server';
import * as XLSX from 'xlsx';
import { supabaseServerTyped } from '@/lib/supabaseServer';
import { resolveEscolaIdForUser } from '@/lib/tenant/resolveEscolaIdForUser';
import { applyKf2ListInvariants } from '@/lib/kf2';
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
    if (!escolaId) return new NextResponse('Escola não encontrada', { status: 403 });

    try {
      await requireFeature('doc_qr_code');
    } catch (err) {
      if (err instanceof HttpError) {
        return NextResponse.json({ ok: false, error: err.message, code: err.code }, { status: err.status });
      }
      throw err;
    }

    const { data: turmaData, error: turmaError } = await supabase
      .from('turmas')
      .select('id, nome')
      .eq('id', turmaId)
      .eq('escola_id', escolaId)
      .single();

    if (turmaError || !turmaData) {
      return new NextResponse('Turma not found', { status: 404 });
    }

    let matriculasQuery = supabase
      .from('matriculas')
      .select('alunos ( id, nome )')
      .eq('turma_id', turmaId)
      .eq('escola_id', escolaId)
      .in('status', ['ativo', 'ativa', 'active']);

    matriculasQuery = applyKf2ListInvariants(matriculasQuery, { defaultLimit: 1000 });

    const { data: matriculasData, error: matriculasError } = await matriculasQuery;

    if (matriculasError) {
      return new NextResponse('Error fetching students', { status: 500 });
    }

    const alunos = (matriculasData || []).map((m: any) => m.alunos).filter(Boolean);
    const header = ['ID Aluno', 'Nome', 'T1', 'T2', 'T3'];
    const body = alunos.map((aluno: any) => ({
      'ID Aluno': aluno.id,
      Nome: aluno.nome,
      T1: '',
      T2: '',
      T3: '',
    }));

    const ws = XLSX.utils.json_to_sheet(body, { header });
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Pauta Branca');

    const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
    const fileName = `Pauta_Branca_${turmaData.nome.replace(/\s+/g, '_')}.xlsx`;

    return new NextResponse(buf, {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${fileName}"`,
      },
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return new NextResponse(message, { status: 500 });
  }
}
