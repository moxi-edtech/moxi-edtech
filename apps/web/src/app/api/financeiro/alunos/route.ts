// apps/web/src/app/api/financeiro/alunos/route.ts
import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { resolveEscolaIdForUser } from '@/lib/tenant/resolveEscolaIdForUser';
import { applyKf2ListInvariants } from '@/lib/kf2';

export const dynamic = 'force-dynamic';

const ACTIVE_MATRICULA_STATUSES = new Set(['ativa', 'ativo']);
const MENSALIDADES_BATCH_SIZE = 100;

const chunk = <T,>(items: T[], size: number): T[][] => {
  if (size <= 0) return [items];
  const batches: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    batches.push(items.slice(i, i + size));
  }
  return batches;
};

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

    const { searchParams } = new URL(request.url);
    const requestedEscolaId =
      searchParams.get('escola_id') ||
      searchParams.get('escolaId') ||
      null;

    const escolaId = await resolveEscolaIdForUser(supabase, user.id, requestedEscolaId);
    if (!escolaId) {
      return NextResponse.json({ error: 'Escola não identificada' }, { status: 403 });
    }
    const turmaId = searchParams.get('turmaId');

    let query = supabase
      .from('alunos')
      .select(`
        id,
        nome,
        bi_numero,
        telefone_responsavel,
        matriculas(
          status,
          turma_id,
          turma:turmas(nome)
        )
      `)
      .eq('escola_id', escolaId)
      .eq('status', 'ativo');

    query = applyKf2ListInvariants(query, {
      defaultLimit: 1000,
      maxLimit: 2000,
      order: [{ column: 'nome', ascending: true }],
      tieBreakerColumn: 'id',
    });

    const { data: alunos, error } = await query;

    if (error) {
      console.error('Erro ao buscar alunos para financeiro:', error);
      throw error;
    }

    const alunosComTurma = (alunos ?? [])
      .map((aluno: any) => {
        const matriculas = Array.isArray(aluno.matriculas) ? aluno.matriculas : [];
        const matriculaAtiva =
          matriculas.find((matricula: any) => ACTIVE_MATRICULA_STATUSES.has(String(matricula?.status ?? '').toLowerCase())) ??
          matriculas[0];

        return {
          id: aluno.id,
          nome: aluno.nome,
          numeroEstudante: aluno.id.substring(0, 8),
          bi: aluno.bi_numero,
          telefone: aluno.telefone_responsavel,
          turmaId: matriculaAtiva?.turma_id ?? null,
          turmaNome: matriculaAtiva?.turma?.nome ?? null,
        };
      })
      .filter((aluno: any) => aluno.turmaId)
      .filter((aluno: any) => !turmaId || turmaId === 'todas' || aluno.turmaId === turmaId);

    const alunoIds = alunosComTurma.map((aluno: any) => aluno.id);
    const resumoFinanceiro = new Map<string, {
      totalEmDivida: number;
      diasAtraso: number;
      qtdMensalidadesAtrasadas: number;
      possuiMensalidades: boolean;
      possuiMensalidadePaga: boolean;
      possuiMensalidadeAberta: boolean;
    }>();

    if (alunoIds.length > 0) {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      for (const alunoIdsBatch of chunk(alunoIds, MENSALIDADES_BATCH_SIZE)) {
        let mensalidadesQuery = supabase
          .from('mensalidades')
          .select('id, aluno_id, valor, status, data_vencimento')
          .eq('escola_id', escolaId)
          .in('aluno_id', alunoIdsBatch);

        mensalidadesQuery = applyKf2ListInvariants(mensalidadesQuery, {
          defaultLimit: 5000,
          maxLimit: 10000,
          order: [{ column: 'data_vencimento', ascending: false }],
          tieBreakerColumn: 'id',
        });

        const { data: mensalidades, error: mensalidadesError } = await mensalidadesQuery;
        if (mensalidadesError) {
          console.error('Erro ao resumir mensalidades por aluno:', mensalidadesError);
          throw mensalidadesError;
        }

        for (const mensalidade of mensalidades ?? []) {
          const key = String((mensalidade as any).aluno_id ?? '');
          if (!key) continue;

          const current = resumoFinanceiro.get(key) ?? {
            totalEmDivida: 0,
            diasAtraso: 0,
            qtdMensalidadesAtrasadas: 0,
            possuiMensalidades: false,
            possuiMensalidadePaga: false,
            possuiMensalidadeAberta: false,
          };

          current.possuiMensalidades = true;

          const status = normalizeStatus((mensalidade as any).status);
          const dataVencimento = (mensalidade as any).data_vencimento ? new Date((mensalidade as any).data_vencimento) : null;
          if (dataVencimento) dataVencimento.setHours(0, 0, 0, 0);

          if (status === 'paga') {
            current.possuiMensalidadePaga = true;
          }

          const aberta = status !== 'paga' && status !== 'cancelada';
          if (aberta) {
            current.possuiMensalidadeAberta = true;
          }

          const vencida = aberta && !!dataVencimento && dataVencimento.getTime() < today.getTime();
          if (vencida) {
            const valor = Number((mensalidade as any).valor ?? 0);
            const diasAtraso = Math.max(0, Math.floor((today.getTime() - dataVencimento.getTime()) / (1000 * 3600 * 24)));
            current.totalEmDivida += valor;
            current.qtdMensalidadesAtrasadas += 1;
            current.diasAtraso = Math.max(current.diasAtraso, diasAtraso);
          }

          resumoFinanceiro.set(key, current);
        }
      }
    }

    const formattedData = alunosComTurma.map((aluno: any) => {
      const financeiro = resumoFinanceiro.get(aluno.id);
      const possuiMensalidades = financeiro?.possuiMensalidades ?? false;
      const totalEmDivida = Number(financeiro?.totalEmDivida ?? 0);

      let statusFinanceiro: 'paga' | 'pendente' | 'atrasada' | 'cancelada' = 'cancelada';
      if (totalEmDivida > 0) {
        statusFinanceiro = 'atrasada';
      } else if (financeiro?.possuiMensalidadeAberta) {
        statusFinanceiro = 'pendente';
      } else if (financeiro?.possuiMensalidadePaga) {
        statusFinanceiro = 'paga';
      }

      return {
        ...aluno,
        statusFinanceiro,
        possuiMensalidades,
        valorEmDivida: totalEmDivida,
        diasAtraso: Number(financeiro?.diasAtraso ?? 0),
        qtdMensalidadesAtrasadas: Number(financeiro?.qtdMensalidadesAtrasadas ?? 0),
      };
    });

    return NextResponse.json(formattedData);
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
