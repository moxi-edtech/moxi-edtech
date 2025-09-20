import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import type { Database } from '~types/supabase'
import { supabaseServer } from '@/lib/supabaseServer'
import { recordAuditServer } from '@/lib/audit'
import { mapPapelToGlobalRole } from '@/lib/permissions'
import { hasPermission } from '@/lib/permissions'

const BodySchema = z.object({
  email: z.string().email(),
  papel: z.enum(['admin','staff_admin','secretaria','financeiro','professor','aluno']).optional(),
  roleEnum: z.enum(['super_admin','admin','professor','aluno','secretaria','financeiro','global_admin','guest']).optional(),
})

export async function PATCH(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  const { id: escolaId } = await context.params
  try {
    const json = await req.json()
    const parse = BodySchema.safeParse(json)
    if (!parse.success) return NextResponse.json({ ok: false, error: parse.error.errors[0]?.message || 'Dados inválidos' }, { status: 400 })
    const { email, papel, roleEnum } = parse.data

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
    // Bloqueia atualizações quando escola suspensa/excluída
    const { data: esc } = await admin.from('escolas').select('status').eq('id', escolaId).limit(1)
    const status = (esc?.[0] as any)?.status as string | undefined
    if (status === 'excluida') return NextResponse.json({ ok: false, error: 'Escola excluída não permite alterações.' }, { status: 400 })
    if (status === 'suspensa') return NextResponse.json({ ok: false, error: 'Escola suspensa por pagamento. Regularize para alterar usuários.' }, { status: 400 })
    const lower = email.toLowerCase()
    const { data: prof } = await admin.from('profiles').select('user_id').eq('email', lower).limit(1)
    const userId = prof?.[0]?.user_id as string | undefined
    if (!userId) return NextResponse.json({ ok: false, error: 'Usuário não encontrado' }, { status: 404 })

    // Fetch current values before update
    const { data: linkBefore } = await admin
      .from('escola_usuarios')
      .select('papel')
      .eq('escola_id', escolaId)
      .eq('user_id', userId)
      .limit(1)
    const papelBefore = linkBefore?.[0]?.papel as string | undefined
    const { data: profBefore } = await admin
      .from('profiles')
      .select('role')
      .eq('user_id', userId)
      .limit(1)
    const roleBefore = (profBefore?.[0] as any)?.role as string | undefined

    if (papel) {
      await admin.from('escola_usuarios').update({ papel }).eq('escola_id', escolaId).eq('user_id', userId)
      // Force global role to match papel mapping when papel changes
      const mapped = mapPapelToGlobalRole(papel as any)
      await admin.from('profiles').update({ role: mapped as any }).eq('user_id', userId)
      await admin.auth.admin.updateUserById(userId, { app_metadata: { role: mapped } as any }).catch(() => null)
    } else if (roleEnum) {
      // Only update role when explicitly provided and papel not being changed
      await admin.from('profiles').update({ role: roleEnum as any }).eq('user_id', userId)
      await admin.auth.admin.updateUserById(userId, { app_metadata: { role: roleEnum } as any }).catch(() => null)
    }

    const papelAfter = papel ?? papelBefore
    const roleAfter = roleEnum ?? roleBefore
    recordAuditServer({ escolaId, portal: 'admin_escola', action: 'USUARIO_ATUALIZADO', entity: 'usuario', entityId: userId, details: { email: lower, papel_before: papelBefore, papel_after: papelAfter, role_before: roleBefore, role_after: roleAfter } }).catch(() => null)
    return NextResponse.json({ ok: true })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ ok: false, error: message }, { status: 500 })
  }
}
