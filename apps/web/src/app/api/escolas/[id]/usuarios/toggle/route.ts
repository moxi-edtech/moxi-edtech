import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import type { Database, TablesInsert } from '~types/supabase'
import { supabaseServer } from '@/lib/supabaseServer'
import { recordAuditServer } from '@/lib/audit'
import { mapPapelToGlobalRole } from '@/lib/permissions'
import { hasPermission } from '@/lib/permissions'

const BodySchema = z.object({
  email: z.string().email(),
  ativo: z.boolean(),
  papel: z.enum(['admin','staff_admin','secretaria','financeiro','professor','aluno']).optional(),
})

export async function POST(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  const { id: escolaId } = await context.params
  try {
    const json = await req.json()
    const parse = BodySchema.safeParse(json)
    if (!parse.success) return NextResponse.json({ ok: false, error: parse.error.errors[0]?.message || 'Dados inválidos' }, { status: 400 })
    const { email, ativo, papel } = parse.data

    // permission check via papel -> permission mapping
    const s = await supabaseServer()
    const { data: userRes } = await s.auth.getUser()
    const requesterId = userRes?.user?.id
    if (!requesterId) return NextResponse.json({ ok: false, error: 'Não autenticado' }, { status: 401 })
    const { data: vinc } = await s.from('escola_usuarios').select('papel').eq('user_id', requesterId).eq('escola_id', escolaId).limit(1)
    const papelReq = vinc?.[0]?.papel as any
    if (!hasPermission(papelReq, 'editar_usuario')) return NextResponse.json({ ok: false, error: 'Sem permissão' }, { status: 403 })

    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
      return NextResponse.json({ ok: false, error: 'Falta SUPABASE_SERVICE_ROLE_KEY.' }, { status: 500 })
    }
    const admin = createAdminClient<Database>(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)

    // Bloqueia alteração de vínculos quando escola suspensa/excluída
    const { data: esc } = await admin.from('escolas').select('status').eq('id', escolaId).limit(1)
    const status = (esc?.[0] as any)?.status as string | undefined
    if (status === 'excluida') return NextResponse.json({ ok: false, error: 'Escola excluída não permite alterações de usuários.' }, { status: 400 })
    if (status === 'suspensa') return NextResponse.json({ ok: false, error: 'Escola suspensa por pagamento. Regularize para alterar usuários.' }, { status: 400 })

    const { data: prof } = await admin.from('profiles').select('user_id, escola_id, role').eq('email', email.toLowerCase()).limit(1)
    const userId = prof?.[0]?.user_id as string | undefined
    if (!userId) return NextResponse.json({ ok: false, error: 'Usuário não encontrado' }, { status: 404 })

    const roleBefore = (prof?.[0] as any)?.role as string | undefined
    const { data: linkBefore } = await admin
      .from('escola_usuarios')
      .select('user_id')
      .eq('escola_id', escolaId)
      .eq('user_id', userId)
      .limit(1)
    const ativoBefore = Boolean(linkBefore && linkBefore.length > 0)

    if (ativo) {
      // ensure link exists
    try {
      await admin.from('escola_usuarios').insert([{ escola_id: escolaId, user_id: userId, papel: papel || 'secretaria' } as TablesInsert<'escola_usuarios'>]).select('user_id').single()
    } catch {
      if (papel) await admin.from('escola_usuarios').update({ papel }).eq('escola_id', escolaId).eq('user_id', userId)
    }
      // set profile.escola_id to this if empty
      if (!prof?.[0]?.escola_id) await admin.from('profiles').update({ escola_id: escolaId }).eq('user_id', userId)
      // ensure app_metadata.escola_id set
      await admin.auth.admin.updateUserById(userId, { app_metadata: { escola_id: escolaId } as any }).catch(() => null)
      // align global role with papel
      const mapped = mapPapelToGlobalRole(((papel || 'secretaria') as any))
      try { await admin.from('profiles').update({ role: mapped as any }).eq('user_id', userId) } catch {}
      try { await admin.auth.admin.updateUserById(userId, { app_metadata: { role: mapped } as any }) } catch {}
      recordAuditServer({ escolaId, portal: 'admin_escola', action: 'USUARIO_ATIVADO', entity: 'usuario', entityId: userId, details: { email, papel: papel || 'secretaria', ativo_before: ativoBefore, ativo_after: true, role_before: roleBefore } }).catch(() => null)
    } else {
      // remove link
      await admin.from('escola_usuarios').delete().eq('escola_id', escolaId).eq('user_id', userId)
      // if profile.escola_id equals this, null it
      if (prof?.[0]?.escola_id === escolaId) await admin.from('profiles').update({ escola_id: null }).eq('user_id', userId)
      // if user has no more school links, downgrade role to 'guest'
      let roleAfter = roleBefore
      const { data: remaining } = await admin
        .from('escola_usuarios')
        .select('user_id')
        .eq('user_id', userId)
        .limit(1)
      if (!remaining || remaining.length === 0) {
        await admin.from('profiles').update({ role: 'guest' as any }).eq('user_id', userId)
        await admin.auth.admin.updateUserById(userId, { app_metadata: { role: 'guest', escola_id: null } as any }).catch(() => null)
        roleAfter = 'guest'
      }
      recordAuditServer({ escolaId, portal: 'admin_escola', action: 'USUARIO_DESATIVADO', entity: 'usuario', entityId: userId, details: { email, ativo_before: ativoBefore, ativo_after: false, role_before: roleBefore, role_after: roleAfter } }).catch(() => null)
    }

    return NextResponse.json({ ok: true })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ ok: false, error: message }, { status: 500 })
  }
}
