// apps/web/src/app/api/secretaria/admissoes/vagas/route.ts
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { z } from 'zod'

import { requireRoleInSchool } from '@/lib/authz';

const searchParamsSchema = z.object({
  escolaId: z.string().uuid(),
  cursoId: z.string().uuid(),
  classeId: z.string().uuid(),
})

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const validation = searchParamsSchema.safeParse(Object.fromEntries(searchParams))

  if (!validation.success) {
    return NextResponse.json({ error: validation.error.format() }, { status: 400 })
  }

  const { escolaId, cursoId, classeId } = validation.data
  const supabase = await createClient()

  const { error: authError } = await requireRoleInSchool({ 
    supabase, 
    escolaId, 
    roles: ['secretaria', 'admin', 'admin_escola', 'staff_admin'] 
  });
  if (authError) return authError;

  try {
    const { data: turmas, error } = await supabase
      .from('vw_turmas_para_matricula')
      .select('id, turma_nome, turno, capacidade_maxima, ocupacao_atual')
      .eq('escola_id', escolaId)
      .eq('curso_id', cursoId)
      .eq('classe_id', classeId)

    if (error) {
      throw error
    }

    const turmasComVagas = (turmas || []).map((turma) => {
      const capacidade = turma.capacidade_maxima ?? 0;
      const ocupacao = turma.ocupacao_atual ?? 0;
      const vagas_disponiveis = Math.max(0, capacidade - ocupacao);

      return {
        id: turma.id,
        nome: turma.turma_nome,
        turno: turma.turno,
        vagas_disponiveis,
        ocupacao_atual: ocupacao,
        capacidade_maxima: capacidade,
      }
    })

    return NextResponse.json(turmasComVagas)
  } catch (error) {
    console.error('Error fetching vagas data:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
