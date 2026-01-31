// apps/web/src/app/api/financeiro/cobrancas/alunos/route.ts
import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { resolveEscolaIdForUser } from '@/lib/tenant/resolveEscolaIdForUser';

export const dynamic = 'force-dynamic';

interface AlunoCobranca {
    id: string;
    nome: string;
    turma: string;
    telefone: string;
    email: string;
    responsavel: string;
    mensalidadesAtrasadas: number;
    valorTotal: number;
    diasAtraso: number;
    ultimaCobranca?: Date;
    statusCobranca: 'pendente' | 'enviada' | 'visualizada' | 'respondida' | 'ignorada';
}

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

    // A better implementation would be a dedicated VIEW or RPC in the database
    // For now, fetching and aggregating in JS
    const { data: mensalidadesAtrasadas, error } = await supabase
      .from('mensalidades')
      .select('*, aluno:alunos(*, matriculas!inner(turma:turmas(nome)))')
      .eq('escola_id', escolaId)
      .in('status', ['pendente', 'atrasada']);

    if (error) throw error;

    const alunosComPendencias = new Map<string, AlunoCobranca>();

    for (const m of mensalidadesAtrasadas) {
      if (!m.aluno) continue;

      const diasAtraso = Math.floor((new Date().getTime() - new Date(m.data_vencimento).getTime()) / (1000 * 3600 * 24));

      if (alunosComPendencias.has(m.aluno_id)) {
        const existente = alunosComPendencias.get(m.aluno_id)!;
        existente.mensalidadesAtrasadas += 1;
        existente.valorTotal += m.valor;
        existente.diasAtraso = Math.max(existente.diasAtraso, diasAtraso);
      } else {
        alunosComPendencias.set(m.aluno_id, {
          id: m.aluno_id,
          nome: m.aluno.nome,
          turma: m.aluno.matriculas?.[0]?.turma?.nome || 'N/A',
          telefone: m.aluno.telefone_responsavel || m.aluno.telefone || '',
          email: m.aluno.email || '',
          responsavel: m.aluno.responsavel_nome || '',
          mensalidadesAtrasadas: 1,
          valorTotal: m.valor,
          diasAtraso: diasAtraso,
          ultimaCobranca: undefined, // Will come from a 'cobrancas_log' table
          statusCobranca: 'pendente',
        });
      }
    }

    const alunos = Array.from(alunosComPendencias.values());

    return NextResponse.json({ ok: true, alunos });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
