// apps/web/src/app/api/financeiro/alunos/route.ts
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

    const { searchParams } = new URL(request.url);
    const turmaId = searchParams.get('turmaId');

    let query = supabase
      .from('alunos')
      .select(`
        id,
        nome,
        bi_numero,
        telefone_responsavel,
        matriculas!inner(
            turma_id,
            turma:turmas(nome)
        )
      `)
      .eq('escola_id', escolaId)
      .eq('status', 'ativo');

    if (turmaId && turmaId !== 'todas') {
      query = query.eq('matriculas.turma_id', turmaId);
    }
    
    const { data: alunos, error } = await query;

    if (error) {
      console.error('Erro ao buscar alunos para financeiro:', error);
      throw error;
    }

    const formattedData = alunos.map(a => ({
        id: a.id,
        nome: a.nome,
        numeroEstudante: a.id.substring(0, 8), // Placeholder for numeroEstudante
        bi: a.bi_numero,
        telefone: a.telefone_responsavel,
        turmaId: a.matriculas[0]?.turma_id,
        turmaNome: a.matriculas[0]?.turma?.nome,
    }));

    return NextResponse.json(formattedData);
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
