import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import type { Database, TablesInsert } from '~types/supabase'
import { supabaseServer } from '@/lib/supabaseServer'
import { hasPermission, mapPapelToGlobalRole } from '@/lib/permissions'

const BodySchema = z.object({
  email: z.string().email(),
  nome: z.string().trim().min(1),
  // Número do usuário (opcional). Se não informado, o servidor poderá gerar.
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
    // Em caso de erro na verificação, não bloqueia a operação
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
  // Busca últimos perfis da escola e encontra o maior número de 7 dígitos usado em profiles.telefone
  try {
    const { data } = await (admin as any)
      .from('profiles')
      .select('telefone, created_at')
      .eq('escola_id', escolaId)
      .order('created_at', { ascending: false })
      .limit(2000)
    let max = 0 // começa do 1
    for (const row of (data || []) as Array<{ telefone: string | null }>) {
      const n = onlyDigitsUpTo7(row.telefone ?? '')
      if (n != null && n > max) max = n
    }
    let next = Math.max(1, max + 1)
    // Garante unicidade tentando avançar em caso de choque raro
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
    // fallback previsível
    return '1'
  }
}

export async function POST(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  const { id: escolaId } = await context.params
  try {
    const parse = BodySchema.safeParse(await req.json())
    if (!parse.success) {
      return NextResponse.json({ ok: false, error: parse.error.errors[0]?.message || 'Dados inválidos' }, { status: 400 })
    }
    const { email, nome } = parse.data
    // Sempre gerar número aleatório; ignoramos a entrada manual
    let numero: string | undefined

    // Autorização: permitir para quem pode criar matrícula (ex.: secretaria)
    const s = await supabaseServer()
    const { data: me } = await s.auth.getUser()
    const userId = me?.user?.id
    if (!userId) return NextResponse.json({ ok: false, error: 'Não autenticado' }, { status: 401 })
    const { data: vinc } = await s.from('escola_usuarios').select('papel').eq('user_id', userId).eq('escola_id', escolaId).limit(1)
    const papel = vinc?.[0]?.papel as any
    if (!hasPermission(papel, 'criar_matricula')) {
      return NextResponse.json({ ok: false, error: 'Sem permissão' }, { status: 403 })
    }

    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
      return NextResponse.json({ ok: false, error: 'Falta SUPABASE_SERVICE_ROLE_KEY para convidar.' }, { status: 500 })
    }
    const admin = createAdminClient<Database>(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)

    // Bloqueia convites se escola estiver suspensa/excluída
    const { data: esc } = await (admin as any).from('escolas').select('status').eq('id', escolaId).limit(1)
    const status = (esc?.[0] as any)?.status as string | undefined
    if (status === 'excluida') return NextResponse.json({ ok: false, error: 'Escola excluída não permite convites.' }, { status: 400 })
    if (status === 'suspensa') return NextResponse.json({ ok: false, error: 'Escola suspensa por pagamento. Regularize para convidar usuários.' }, { status: 400 })

    const lower = email.trim().toLowerCase()
    const roleEnum = mapPapelToGlobalRole('aluno')

    // Número incremental por escola
    numero = await getNextNumero(admin, escolaId)

    // Verifica se já existe profile por e-mail
    const { data: prof } = await (admin as any).from('profiles').select('user_id').eq('email', lower).limit(1)
    const existingUserId = prof?.[0]?.user_id as string | undefined

    let userIdNew = existingUserId
    if (!userIdNew) {
      // Cria usuário por convite, com metadata contendo numero_usuario
      const { data: inviteRes, error: inviteErr } = await (admin as any).auth.admin.inviteUserByEmail(lower, {
        data: { nome, role: roleEnum, must_change_password: true, numero_usuario: numero },
      })
      if (inviteErr) return NextResponse.json({ ok: false, error: inviteErr.message }, { status: 400 })
      userIdNew = inviteRes?.user?.id
      if (!userIdNew) return NextResponse.json({ ok: false, error: 'Falha ao convidar usuário' }, { status: 400 })
      try {
        await (admin as any).from('profiles').insert([{
          user_id: userIdNew,
          email: lower,
          nome,
          telefone: numero ?? null, // usamos telefone como campo para armazenar o número do usuário
          role: roleEnum as any,
          escola_id: escolaId,
        } as TablesInsert<'profiles'>]).select('*').single()
      } catch {}
      try {
        await (admin as any).auth.admin.updateUserById(userIdNew, { app_metadata: { role: roleEnum, escola_id: escolaId, numero_usuario: numero } as any })
      } catch {}
    } else {
      // Garante que profile e app_metadata estejam atualizados e número salvo
      try { await (admin as any).from('profiles').update({ role: roleEnum as any, escola_id: escolaId, telefone: numero ?? null }).eq('user_id', existingUserId) } catch {}
      try { await (admin as any).auth.admin.updateUserById(existingUserId, { app_metadata: { role: roleEnum, escola_id: escolaId, numero_usuario: numero } as any }) } catch {}
    }

    // Vincula na escola_usuarios como aluno (idempotente)
    try {
      await (admin as any).from('escola_usuarios').insert([{ escola_id: escolaId, user_id: userIdNew!, papel: 'aluno' } as TablesInsert<'escola_usuarios'>]).select('user_id').single()
    } catch {
      await (admin as any).from('escola_usuarios').update({ papel: 'aluno' }).eq('escola_id', escolaId).eq('user_id', userIdNew!)
    }

    return NextResponse.json({ ok: true, userId: userIdNew, numero })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ ok: false, error: message }, { status: 500 })
  }
}
