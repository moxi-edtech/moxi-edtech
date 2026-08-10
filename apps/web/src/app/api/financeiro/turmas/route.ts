// apps/web/src/app/api/financeiro/turmas/route.ts
import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { resolveEscolaIdForUser } from '@/lib/tenant/resolveEscolaIdForUser';
import { resolveAcademicYearContext } from '@/lib/academic-year/context';

export const dynamic = 'force-dynamic';

const HISTORICAL_MATRICULA_STATUSES = new Set([
  'ativa',
  'ativo',
  'concluida',
  'concluido',
  'encerrada',
  'encerrado',
  'finalizada',
  'finalizado',
  'transferida',
  'transferido',
]);

export async function GET(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const requestedEscolaId =
      searchParams.get('escola_id') ||
      searchParams.get('escolaId') ||
      null;

    const escolaId = await resolveEscolaIdForUser(supabase, user.id, requestedEscolaId);
    if (!escolaId) {
      return NextResponse.json({ error: 'Escola não identificada' }, { status: 403 });
    }

    const academicContext = await resolveAcademicYearContext(supabase, {
      userId: user.id,
      requestedAcademicYearId: searchParams.get('ano_letivo_id'),
      operation: 'READ',
    });
    const academicYear = Number(academicContext.anoLetivoLabel.slice(0, 4));

    const { data: turmas, error } = await supabase
      .from('turmas')
      .select(`
        id,
        nome,
        turno,
        ano_letivo,
        curso:cursos(nome),
        capacidade_maxima,
        status_validacao,
        matriculas(id, status)
      `)
      .eq('escola_id', escolaId)
      .eq('status_validacao', 'ativo')
      .eq('session_id', academicContext.anoLetivoId)
      .eq('ano_letivo', academicYear)
      .order('nome')
      .limit(50);

    if (error) {
      console.error('Erro ao buscar turmas para financeiro:', error);
      throw error;
    }

    const formattedData = turmas.map(t => ({
        id: t.id,
        nome: t.nome,
        turno: t.turno,
        anoLetivo: t.ano_letivo,
        cursoNome: Array.isArray(t.curso) ? t.curso[0]?.nome : t.curso?.nome || 'Não definido',
        capacidadeMaxima: t.capacidade_maxima,
        alunosInscritos: Array.isArray(t.matriculas)
          ? t.matriculas.filter((matricula: any) => HISTORICAL_MATRICULA_STATUSES.has(String(matricula?.status ?? '').toLowerCase())).length
          : 0,
        statusValidacao: t.status_validacao,
    }));

    return NextResponse.json(formattedData);
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
