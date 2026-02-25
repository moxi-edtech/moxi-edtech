// apps/web/src/app/api/secretaria/admissoes/vagas/route.ts
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { z } from 'zod'

import { requireRoleInSchool } from '@/lib/authz';

const searchParamsSchema = z.object({
  escolaId: z.string().uuid(),
  cursoId: z.string().uuid().optional(),
  classeId: z.string().uuid().optional(),
  ano: z.coerce.number().optional(),
})

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const validation = searchParamsSchema.safeParse(Object.fromEntries(searchParams))

  if (!validation.success) {
    return NextResponse.json({ error: validation.error.format() }, { status: 400 })
  }

  const { escolaId, cursoId, classeId, ano } = validation.data
  const supabase = await createClient()

  const { error: authError } = await requireRoleInSchool({ 
    supabase, 
    escolaId, 
    roles: ['secretaria', 'admin', 'admin_escola', 'staff_admin'] 
  });
  if (authError) return authError;

  try {
    let query = supabase
      .from('vw_turmas_para_matricula')
      .select('id, turma_nome, turma_codigo, turno, capacidade_maxima, ocupacao_atual, curso_id, classe_id, curso_nome, classe_nome, ano_letivo')
      .eq('escola_id', escolaId)

    if (cursoId) query = query.eq('curso_id', cursoId)
    if (classeId) query = query.eq('classe_id', classeId)
    if (ano) query = query.eq('ano_letivo', ano)

    query = query.order('turma_nome', { ascending: true }).order('id', { ascending: true }).limit(50)

    const { data: turmas, error } = await query

    if (error) {
      throw error
    }

    const turmaRows = turmas || [];

    const cursoIds = Array.from(new Set(turmaRows.map((row) => row.curso_id).filter(Boolean))) as string[];
    const classeIds = Array.from(new Set(turmaRows.map((row) => row.classe_id).filter(Boolean))) as string[];

    const { data: tabelas } = cursoIds.length
      ? await supabase
          .from('financeiro_tabelas')
          .select('curso_id, classe_id, valor_matricula, ano_letivo')
          .eq('escola_id', escolaId)
          .in('curso_id', cursoIds)
          .order('ano_letivo', { ascending: false })
      : { data: [] };

    const tabelaRows = (tabelas || []) as Array<{
      curso_id: string | null;
      classe_id: string | null;
      valor_matricula: number | null;
      ano_letivo: number | null;
    }>;

    const findTabela = (cursoIdValue: string | null, classeIdValue: string | null) => {
      if (!cursoIdValue) return null;
      const exact = tabelaRows.find(
        (row) => row.curso_id === cursoIdValue && row.classe_id === classeIdValue
      );
      if (exact) return exact;
      return tabelaRows.find(
        (row) => row.curso_id === cursoIdValue && row.classe_id === null
      );
    };

    const turmasComVagas = turmaRows
      .filter((turma) => {
        const tabela = findTabela(turma.curso_id, turma.classe_id);
        const valor = Number(tabela?.valor_matricula ?? 0);
        return Number.isFinite(valor) && valor > 0;
      })
      .map((turma) => {
        const capacidade = turma.capacidade_maxima ?? 0;
        const ocupacao = turma.ocupacao_atual ?? 0;
        const vagas_disponiveis = Math.max(0, capacidade - ocupacao);

        return {
          id: turma.id,
          nome: turma.turma_nome,
          turma_codigo: turma.turma_codigo,
          turno: turma.turno,
          vagas_disponiveis,
          ocupacao_atual: ocupacao,
          capacidade_maxima: capacidade,
          curso_id: turma.curso_id,
          classe_id: turma.classe_id,
          curso_nome: turma.curso_nome,
          classe_nome: turma.classe_nome,
          ano_letivo: turma.ano_letivo,
        };
      });

    const classesComPreco = Array.from(
      new Set(
        turmaRows
          .filter((turma) => {
            const tabela = findTabela(turma.curso_id, turma.classe_id);
            const valor = Number(tabela?.valor_matricula ?? 0);
            return Number.isFinite(valor) && valor > 0;
          })
          .map((turma) => turma.classe_id)
          .filter(Boolean)
      )
    ) as string[];

    return NextResponse.json({
      ok: true,
      items: turmasComVagas,
      meta: {
        classesComPreco,
      },
    })
  } catch (error) {
    console.error('Error fetching vagas data:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
