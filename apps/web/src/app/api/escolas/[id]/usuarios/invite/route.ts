import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import type { Database, TablesInsert } from '~types/supabase'
import { supabaseServer } from '@/lib/supabaseServer'
import { recordAuditServer } from '@/lib/audit'
import { hasPermission, mapPapelToGlobalRole } from '@/lib/permissions'

const BodySchema = z.object({
  email: z.string().email(),
  nome: z.string().trim().min(1),
  telefone: z.string().trim().nullable().optional(),
  papel: z.enum(['admin','staff_admin','secretaria','financeiro','professor','aluno']).default('secretaria'),
  roleEnum: z.enum(['super_admin','admin','professor','aluno','secretaria','financeiro','global_admin']).optional(),
  numero: z.string().trim().regex(/^\d{4,12}$/).optional().nullable(),
})

async function ensureUniqueNumero(admin: ReturnType<typeof createAdminClient<Database>>, escolaId: string, numero: string): Promise<boolean> {
  try {
    const { data } = await (admin as any)
      .from('profiles')
      .select('user_id')
      .eq('escola_id', escolaId)
      .eq('telefone', numero)
      .limit(1)
    return !Boolean(data?.[0])
  } catch {
    return true
  }
}

function onlyDigitsUpTo7(v: unknown): number | null {
  if (typeof v !== 'string') return null
  const m = v.match(/^\d{1,7}$/)
  if (!m) return null
  const n = Number(v)
  return Number.isFinite(n) ? n : null
}

async function getNextNumero(admin: ReturnType<typeof createAdminClient<Database>>, escolaId: string): Promise<string> {
  try {
    const { data } = await (admin as any)
      .from('profiles')
      .select('telefone, created_at')
      .eq('escola_id', escolaId)
      .order('created_at', { ascending: false })
      .limit(2000)
    let max = 0
    for (const row of (data || []) as Array<{ telefone: string | null }>) {
      const n = onlyDigitsUpTo7(row.telefone ?? '')
      if (n != null && n > max) max = n
    }
    let next = Math.max(1, max + 1)
    for (let i = 0; i < 10; i++) {
      const cand = String(next)
      const { data: exists } = await (admin as any)
        .from('profiles')
        .select('user_id')
        .eq('escola_id', escolaId)
        .eq('telefone', cand)
        .limit(1)
      if (!exists?.[0]) return cand
      next++
    }
    return String(next)
  } catch {
    return '1'
  }
}

export async function POST(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  const { id: escolaId } = await context.params
  try {
    const json = await req.json()
    const parse = BodySchema.safeParse(json)
    if (!parse.success) return NextResponse.json({ ok: false, error: parse.error.errors[0]?.message || 'Dados inválidos' }, { status: 400 })
    const body = parse.data

    // 1) Permission check via papel -> permission mapping
    const s = await supabaseServer()
    const { data: userRes } = await s.auth.getUser()
    const requesterId = userRes?.user?.id
    if (!requesterId) return NextResponse.json({ ok: false, error: 'Não autenticado' }, { status: 401 })
    const { data: vinc } = await s.from('escola_usuarios').select('papel').eq('user_id', requesterId).eq('escola_id', escolaId).limit(1)
    const papelReq = vinc?.[0]?.papel as any
    if (!hasPermission(papelReq, 'criar_usuario')) {
      return NextResponse.json({ ok: false, error: 'Sem permissão' }, { status: 403 })
    }

    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
      return NextResponse.json({ ok: false, error: 'Falta SUPABASE_SERVICE_ROLE_KEY para convidar.' }, { status: 500 })
    }

    const admin = createAdminClient<Database>(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    )

    // Verifica status da escola (bloqueia convites se suspensa/excluida)
    const { data: esc } = await admin.from('escolas').select('status').eq('id', escolaId).limit(1)
    const status = (esc?.[0] as any)?.status as string | undefined
    if (status === 'excluida') return NextResponse.json({ ok: false, error: 'Escola excluída não permite convites.' }, { status: 400 })
    if (status === 'suspensa') return NextResponse.json({ ok: false, error: 'Escola suspensa por pagamento. Regularize para convidar usuários.' }, { status: 400 })

    const email = body.email.trim().toLowerCase()
    const nome = body.nome.trim()
    const roleEnum = mapPapelToGlobalRole(body.papel as any)
    const papelBody = body.papel as 'admin'|'staff_admin'|'secretaria'|'financeiro'|'professor'|'aluno'
    const needsNumero = papelBody === 'aluno' || papelBody === 'secretaria'
    let numero: string | null = null
    if (needsNumero) {
      // Para alunos e secretaria, sempre gerar número incremental por escola
      const adminTmp = createAdminClient<Database>(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
      numero = await getNextNumero(adminTmp, escolaId)
    } else {
      // Outros papéis não recebem número automaticamente; mantém telefone se enviado
      numero = (body.numero || null) as any
    }

    // 2) Check if user exists
    const { data: prof } = await admin.from('profiles').select('user_id').eq('email', email).limit(1)
    const existingUserId = prof?.[0]?.user_id as string | undefined

    let userId = existingUserId
    if (!userId) {
      // Invite new user by email
      const { data: inviteRes, error: inviteErr } = await admin.auth.admin.inviteUserByEmail(email, {
        data: { nome, role: roleEnum, must_change_password: true, numero_usuario: numero || undefined },
      })
      if (inviteErr) return NextResponse.json({ ok: false, error: inviteErr.message }, { status: 400 })

      userId = inviteRes?.user?.id
      if (!userId) return NextResponse.json({ ok: false, error: 'Falha ao convidar usuário' }, { status: 400 })

      // Create profile
      try {
        await admin.from('profiles').insert([{
          user_id: userId,
          email,
          nome,
          telefone: (body.telefone ?? null) || (numero ?? null),
          role: roleEnum,
          escola_id: escolaId,
        } as TablesInsert<'profiles'>]).select('*').single()
      } catch {}
      try {
        await admin.auth.admin.updateUserById(userId, { app_metadata: { role: roleEnum, escola_id: escolaId, numero_usuario: numero || undefined } as any })
      } catch {}
    } else {
      // Ensure profile role/escola updated
      try { await admin.from('profiles').update({ role: roleEnum, escola_id: escolaId, telefone: (body.telefone ?? null) || (numero ?? null) }).eq('user_id', userId) } catch {}
      // Ensure app_metadata role/escola_id updated
      try { await admin.auth.admin.updateUserById(userId, { app_metadata: { role: roleEnum, escola_id: escolaId, numero_usuario: numero || undefined } as any }) } catch {}
    }

    // 3) Link to escola_usuarios (idempotent)
    try {
      await admin.from('escola_usuarios').insert([{
        escola_id: escolaId,
        user_id: userId!,
        papel: body.papel,
      } as TablesInsert<'escola_usuarios'>]).select('user_id').single()
    } catch {
      await admin.from('escola_usuarios').update({ papel: body.papel }).eq('escola_id', escolaId).eq('user_id', userId!)
    }

    recordAuditServer({ escolaId, portal: 'admin_escola', action: 'USUARIO_CONVIDADO', entity: 'usuario', entityId: userId!, details: { email, papel: body.papel, role: roleEnum, existed_before: Boolean(existingUserId) } }).catch(() => null)

    return NextResponse.json({ ok: true, userId, numero })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ ok: false, error: message }, { status: 500 })
  }
}
