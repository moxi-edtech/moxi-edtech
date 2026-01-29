// apps/web/src/app/api/financeiro/conciliacao/matching/route.ts
import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { resolveEscolaIdForUser } from '@/lib/tenant/resolveEscolaIdForUser';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } = {} } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });
    }

    const escolaId = await resolveEscolaIdForUser(supabase, user.id);
    if (!escolaId) {
      return NextResponse.json({ error: 'Escola não identificada' }, { status: 403 });
    }

    // Fetch all pending imported transactions for this school
    const { data: transacoesImportadas, error: fetchError } = await supabase
      .from('financeiro_transacoes_importadas')
      .select('*')
      .eq('escola_id', escolaId)
      .eq('status', 'pendente');

    if (fetchError) {
      console.error('Erro ao buscar transações importadas pendentes:', fetchError);
      throw fetchError;
    }

    let matchedCount = 0;
    const updates = [];

    for (const transacao of transacoesImportadas) {
      let alunoMatch = null;
      let matchConfianca = 0;
      let mensalidadesPendentes = [];

      // Try matching by referencia with BI_numero or telefone_responsavel
      if (transacao.referencia) {
        const { data: alunoByRef, error: alunoByRefError } = await supabase
          .from('alunos')
          .select('id, nome, bi_numero, telefone_responsavel, matriculas(turma:turmas(nome))')
          .eq('escola_id', escolaId)
          .or(`bi_numero.eq.${transacao.referencia},telefone_responsavel.eq.${transacao.referencia}`)
          .maybeSingle();

        if (alunoByRef && !alunoByRefError) {
          // Found a student by reference
          matchConfianca = 90; // High confidence for direct reference match
          
          // Fetch pending mensalidades for this student
          const { data: pendingMensalidades, error: mensalidadesError } = await supabase
            .from('mensalidades')
            .select('id, mes_referencia, ano_referencia, valor, data_vencimento, status')
            .eq('aluno_id', alunoByRef.id)
            .eq('escola_id', escolaId)
            .eq('status', 'pendente')
            .order('data_vencimento', { ascending: true });

          if (!mensalidadesError && pendingMensalidades) {
            mensalidadesPendentes = pendingMensalidades.map(m => ({
              id: m.id,
              mes: m.mes_referencia,
              ano: m.ano_referencia,
              valor: m.valor,
            }));
          }

          alunoMatch = {
            id: alunoByRef.id,
            nome: alunoByRef.nome,
            turma: alunoByRef.matriculas?.[0]?.turma?.nome || 'N/A', // Assuming first matricula
            mensalidadesPendentes: mensalidadesPendentes,
          };

          // If exact value match with a pending mensalidade, even higher confidence
          if (mensalidadesPendentes.some(m => m.valor === transacao.valor)) {
            matchConfianca = 95;
          }
          matchedCount++;
        }
      }

      // If a match was found, prepare update
      if (alunoMatch) {
        updates.push({
          id: transacao.id,
          aluno_match_details: { alunoMatch, mensalidadesPendentes },
          match_confianca: matchConfianca,
        });
      }
    }

    if (updates.length > 0) {
      const { error: updateError } = await supabase
        .from('financeiro_transacoes_importadas')
        .upsert(updates); // Use upsert to update existing rows

      if (updateError) {
        console.error('Erro ao atualizar transações com correspondências:', updateError);
        throw updateError;
      }
    }

    return NextResponse.json({ ok: true, matchedCount, totalProcessed: transacoesImportadas.length });
  } catch (e: any) {
    console.error('Erro na API de matching:', e);
    return NextResponse.json({ error: e.message || 'Erro interno do servidor.' }, { status: 500 });
  }
}
