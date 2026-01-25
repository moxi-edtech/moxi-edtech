import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createRouteClient } from '@/lib/supabase/route-client'
import { recordAuditServer } from '@/lib/audit'
import { mapPapelToGlobalRole } from '@/lib/permissions'
import { hasPermission } from '@/lib/permissions'
import { resolveEscolaIdForUser } from '@/lib/tenant/resolveEscolaIdForUser'
import { callAuthAdminJob } from '@/lib/auth-admin-job'

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
    if (!parse.success) return NextResponse.json({ ok: false, error: parse.error.issues?.[0]?.message || 'Dados inválidos' }, { status: 400 })
    const { email, papel, roleEnum } = parse.data

    // permission check via papel -> permission mapping
    const supabase = await createRouteClient()
    const { data: userRes } = await supabase.auth.getUser()
    const requesterId = userRes?.user?.id
    if (!requesterId) return NextResponse.json({ ok: false, error: 'Não autenticado' }, { status: 401 })

    const userEscolaId = await resolveEscolaIdForUser(supabase as any, requesterId, escolaId)
    if (!userEscolaId || userEscolaId !== escolaId) {
      return NextResponse.json({ ok: false, error: 'Sem permissão' }, { status: 403 })
    }

    const { data: vinc } = await supabase.from('escola_users').select('papel').eq('user_id', requesterId).eq('escola_id', escolaId).limit(1)
    const papelReq = vinc?.[0]?.papel as any
    if (!hasPermission(papelReq, 'editar_usuario')) return NextResponse.json({ ok: false, error: 'Sem permissão' }, { status: 403 })
    const { data: profCheck } = await supabase.from('profiles' as any).select('escola_id').eq('user_id', requesterId).maybeSingle()
    if (!profCheck || (profCheck as any).escola_id !== escolaId) return NextResponse.json({ ok: false, error: 'Perfil não vinculado à escola' }, { status: 403 })
    // Bloqueia atualizações quando escola suspensa/excluída
    const { data: esc } = await supabase.from('escolas').select('status').eq('id', escolaId).limit(1)
    const status = (esc?.[0] as any)?.status as string | undefined
    if (status === 'excluida') return NextResponse.json({ ok: false, error: 'Escola excluída não permite alterações.' }, { status: 400 })
    if (status === 'suspensa') return NextResponse.json({ ok: false, error: 'Escola suspensa por pagamento. Regularize para alterar usuários.' }, { status: 400 })
    const lower = email.toLowerCase()
    const { data: prof } = await supabase.from('profiles').select('user_id').eq('email', lower).limit(1)
    const userId = prof?.[0]?.user_id as string | undefined
    if (!userId) return NextResponse.json({ ok: false, error: 'Usuário não encontrado' }, { status: 404 })

    // Fetch current values before update
    const { data: linkBefore } = await supabase
      .from('escola_users')
      .select('papel')
      .eq('escola_id', escolaId)
      .eq('user_id', userId)
      .limit(1)
    const papelBefore = linkBefore?.[0]?.papel as string | undefined
    const { data: profBefore } = await supabase
      .from('profiles')
      .select('role')
      .eq('user_id', userId)
      .limit(1)
    const roleBefore = (profBefore?.[0] as any)?.role as string | undefined

    if (papel) {
      await supabase.from('escola_users').update({ papel }).eq('escola_id', escolaId).eq('user_id', userId)
      // Force global role to match papel mapping when papel changes
      const mapped = mapPapelToGlobalRole(papel as any)
      await supabase.from('profiles').update({ role: mapped as any }).eq('user_id', userId)
      await callAuthAdminJob(req, 'updateUserById', {
        userId,
        attributes: { app_metadata: { role: mapped } as any },
      }).catch(() => null)
    } else if (roleEnum) {
      // Only update role when explicitly provided and papel not being changed
      await supabase.from('profiles').update({ role: roleEnum as any }).eq('user_id', userId)
      await callAuthAdminJob(req, 'updateUserById', {
        userId,
        attributes: { app_metadata: { role: roleEnum } as any },
      }).catch(() => null)
    }

    const papelAfter = papel ?? papelBefore
    const roleAfter = roleEnum ?? roleBefore
    recordAuditServer({ escolaId, portal: 'admin_escola', acao: 'USUARIO_ATUALIZADO', entity: 'usuario', entityId: userId, details: { email: lower, papel_before: papelBefore, papel_after: papelAfter, role_before: roleBefore, role_after: roleAfter } }).catch(() => null)
    return NextResponse.json({ ok: true })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ ok: false, error: message }, { status: 500 })
  }
}
