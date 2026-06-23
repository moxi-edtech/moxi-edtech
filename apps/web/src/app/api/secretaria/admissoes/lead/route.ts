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
      roles: ['secretaria', 'secretaria_financeiro', 'admin_financeiro', 'admin', 'admin_escola', 'staff_admin'] 
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

  const { data: rawStatusLog, error: logError } = await supabase
    .from('candidaturas_status_log')
    .select('id, created_at, from_status, to_status, motivo, metadata, actor_user_id')
    .eq('candidatura_id', id)
    .eq('escola_id', head.escola_id)
    .order('created_at', { ascending: false })
    .limit(50)

  if (logError) {
    console.error('Error fetching admission status log:', logError)
  }

  const statusLog = (rawStatusLog ?? []).filter((item) => {
    const metadata = item.metadata && typeof item.metadata === 'object' && !Array.isArray(item.metadata)
      ? item.metadata as Record<string, unknown>
      : {}
    const tipo = typeof metadata.tipo === 'string' ? metadata.tipo : null
    return (
      item.to_status === 'pendente' ||
      item.to_status === 'documentos_reenviados' ||
      tipo === 'DOCUMENTOS_PENDENTES' ||
      tipo === 'DOCUMENTO_REENVIADO' ||
      tipo === 'DOCUMENTOS_REENVIADOS_ACEITES'
    )
  }).slice(0, 20)

  const actorIds = Array.from(new Set(statusLog.map((item) => item.actor_user_id).filter(Boolean))) as string[]
  let actorsById = new Map<string, { user_id: string; nome: string | null; email: string | null; email_real: string | null; email_auth: string | null }>()

  if (actorIds.length > 0) {
    const { data: actors, error: actorsError } = await supabase
      .from('profiles')
      .select('user_id, nome, email, email_real, email_auth')
      .in('user_id', actorIds)

    if (actorsError) {
      console.error('Error fetching admission log actors:', actorsError)
    } else {
      actorsById = new Map((actors ?? []).map((actor) => [actor.user_id, actor]))
    }
  }

  const enrichedStatusLog = statusLog.map((item) => {
    const actor = item.actor_user_id ? actorsById.get(item.actor_user_id) : null
    return {
      ...item,
      actor: actor
        ? {
            user_id: actor.user_id,
            nome: actor.nome,
            email: actor.email_real || actor.email || actor.email_auth,
          }
        : null,
    }
  })
  
  return NextResponse.json({
    ok: true,
    item: {
      ...candidatura,
      pendencias_historico: enrichedStatusLog,
    },
  })
}
