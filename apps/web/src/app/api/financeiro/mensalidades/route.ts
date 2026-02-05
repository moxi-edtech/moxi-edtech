// apps/web/src/app/api/financeiro/mensalidades/route.ts
import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { resolveEscolaIdForUser } from '@/lib/tenant/resolveEscolaIdForUser';

export const dynamic = 'force-dynamic';

const normalizeStatus = (raw?: string | null) => {
  const value = (raw ?? 'pendente').toLowerCase();
  if (value === 'pago' || value === 'paga') return 'paga';
  if (value === 'atrasado' || value === 'atrasada') return 'atrasada';
  if (value === 'cancelado' || value === 'cancelada') return 'cancelada';
  return 'pendente';
};

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
    const alunoId = searchParams.get('alunoId');
    const turmaId = searchParams.get('turmaId');

    let query = supabase
      .from('mensalidades')
      .select(`
        aluno_id,
        aluno:alunos(nome),
        matricula:matriculas(turma:turmas(nome)),
        mes_referencia,
        ano_referencia,
        valor,
        data_vencimento,
        status,
        data_pagamento_efetiva,
        metodo_pagamento
      `)
      .eq('escola_id', escolaId);

    if (alunoId) {
      query = query.eq('aluno_id', alunoId);
    }
    if (turmaId && turmaId !== 'todas') {
      // Since we can't join directly, we need to filter on the related table
      // This is less efficient, but necessary without the direct FK.
      // A better solution would be to add a 'turma_id' to 'mensalidades' table.
      // For now, let's assume we can filter if needed. The query below will not work directly.
      // We will filter on the client side for now.
    }
    
    const { data: mensalidades, error } = await query;

    if (error) {
      console.error('Erro ao buscar mensalidades para financeiro:', error);
      throw error;
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const formattedData = mensalidades.map(m => {
        const dataVencimento = m.data_vencimento ? new Date(m.data_vencimento) : null;
        if (dataVencimento) dataVencimento.setHours(0, 0, 0, 0);
        let status = normalizeStatus(m.status);

        if (dataVencimento && status !== 'paga' && status !== 'cancelada') {
            if (dataVencimento.getTime() > today.getTime()) {
                status = 'pendente';
            } else if (dataVencimento.getTime() < today.getTime()) {
                status = 'atrasada';
            }
        }

        const diasAtraso = status === 'atrasada' && dataVencimento
            ? Math.max(0, Math.floor((today.getTime() - dataVencimento.getTime()) / (1000 * 3600 * 24)))
            : 0;

        return {
            alunoId: m.aluno_id,
            alunoNome: m.aluno?.nome,
            turma: m.matricula?.turma?.nome || 'N/A',
            mesReferencia: m.mes_referencia,
            anoReferencia: m.ano_referencia,
            valor: m.valor,
            dataVencimento,
            status,
            diasAtraso: diasAtraso > 0 ? diasAtraso : undefined,
            dataPagamento: m.data_pagamento_efetiva ? new Date(m.data_pagamento_efetiva) : undefined,
            metodoPagamento: m.metodo_pagamento,
        }
    });

    return NextResponse.json(formattedData);
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
