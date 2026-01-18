// apps/web/src/app/api/secretaria/admissoes/lead/route.ts
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { z } from 'zod'
import { requireRoleInSchool } from '@/lib/authz'

const searchParamsSchema = z.object({
  id: z.string().uuid(),
})

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const validation = searchParamsSchema.safeParse(Object.fromEntries(searchParams))

  if (!validation.success) {
    return NextResponse.json({ error: validation.error.format() }, { status: 400 })
  }

  const { id } = validation.data
  const supabase = await createClient()

  // 1. Fetch head of the document to get escola_id
  const { data: head, error: headErr } = await supabase
    .from('candidaturas')
    .select('id, escola_id')
    .eq('id', id)
    .single()

  if (headErr || !head) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  // 2. Authorize
  const { error: authError } = await requireRoleInSchool({ 
      supabase, 
      escolaId: head.escola_id, 
      roles: ['secretaria', 'admin', 'admin_escola', 'staff_admin'] 
  });
  if (authError) return authError;

  // 3. Fetch full document
  const { data: candidatura, error: candError } = await supabase
    .from('candidaturas')
    .select('*, cursos(nome), classes(nome)')
    .eq('id', id)
    .eq('escola_id', head.escola_id) // Extra check
    .single();

  if (candError || !candidatura) {
    // This should not happen if head was found, but as a safeguard:
    return NextResponse.json({ error: 'Candidatura not found after authorization' }, { status: 404 });
  }
  
  return NextResponse.json({ ok: true, item: candidatura })
}
