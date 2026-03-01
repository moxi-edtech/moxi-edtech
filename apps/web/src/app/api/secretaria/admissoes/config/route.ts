// apps/web/src/app/api/secretaria/admissoes/config/route.ts
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { z } from 'zod'

import { requireRoleInSchool } from '@/lib/authz';
import { applyKf2ListInvariants } from '@/lib/kf2';

const searchParamsSchema = z.object({
  escolaId: z.string().uuid(),
})

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const validation = searchParamsSchema.safeParse(Object.fromEntries(searchParams))

  if (!validation.success) {
    return NextResponse.json({ error: validation.error.format() }, { status: 400 })
  }

  const { escolaId } = validation.data
  const supabase = await createClient()

  const { error: authError } = await requireRoleInSchool({ 
    supabase, 
    escolaId, 
    roles: ['secretaria', 'admin', 'admin_escola', 'staff_admin'] 
  });
  if (authError) return authError;

  try {
    const cursosQuery = applyKf2ListInvariants(
      supabase.from('cursos').select('id, nome').eq('escola_id', escolaId),
      { defaultLimit: 50, order: [{ column: 'nome', ascending: true }] }
    )
    const classesQuery = applyKf2ListInvariants(
      supabase.from('classes').select('id, nome, curso_id').eq('escola_id', escolaId),
      { defaultLimit: 50, order: [{ column: 'nome', ascending: true }] }
    )

    const [cursos, classes] = await Promise.all([cursosQuery, classesQuery])

    return NextResponse.json({
      cursos: cursos.data,
      classes: classes.data,
    })
  } catch (error) {
    console.error('Error fetching admission config:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
