// apps/web/src/app/api/financeiro/turmas/route.ts
import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { resolveEscolaIdForUser } from '@/lib/tenant/resolveEscolaIdForUser';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });
    }

    const escolaId = await resolveEscolaIdForUser(supabase, user.id);
    if (!escolaId) {
      return NextResponse.json({ error: 'Escola não identificada' }, { status: 403 });
    }

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
        alunos:matriculas(count)
      `)
      .eq('escola_id', escolaId)
      .eq('status_validacao', 'ativo');

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
        alunosInscritos: t.alunos[0]?.count || 0,
        statusValidacao: t.status_validacao,
    }));

    return NextResponse.json(formattedData);
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
