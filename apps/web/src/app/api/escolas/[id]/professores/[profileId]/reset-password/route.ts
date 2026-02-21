import { NextRequest, NextResponse } from 'next/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import type { Database } from '~types/supabase'
import { createRouteClient } from '@/lib/supabase/route-client'
import { resolveEscolaIdForUser } from '@/lib/tenant/resolveEscolaIdForUser'
import { hasPermission, normalizePapel } from '@/lib/permissions'

const generateStrongPassword = (len = 12) => {
  const upper = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'
  const lower = 'abcdefghijklmnopqrstuvwxyz'
  const nums = '0123456789'
  const special = '!@#$%^&*()-_=+[]{};:,.?'
  const all = upper + lower + nums + special
  const pick = (s: string) => s[Math.floor(Math.random() * s.length)]
  let pwd = pick(upper) + pick(lower) + pick(nums) + pick(special)
  for (let i = pwd.length; i < len; i++) pwd += pick(all)
  return pwd.split('').sort(() => Math.random() - 0.5).join('')
}

export async function POST(req: NextRequest, context: { params: Promise<{ id: string; profileId: string }> }) {
  const { id: escolaId, profileId } = await context.params

  try {
    const supabase = await createRouteClient()
    const { data: userRes } = await supabase.auth.getUser()
    const requesterId = userRes?.user?.id
    if (!requesterId) return NextResponse.json({ ok: false, error: 'Não autenticado' }, { status: 401 })

    const userEscolaId = await resolveEscolaIdForUser(supabase as any, requesterId, escolaId)
    if (!userEscolaId || userEscolaId !== escolaId) {
      return NextResponse.json({ ok: false, error: 'Sem permissão' }, { status: 403 })
    }

    const { data: vinc } = await supabase
      .from('escola_users')
      .select('papel, role')
      .eq('user_id', requesterId)
      .eq('escola_id', escolaId)
      .limit(1)

    const papelReq = normalizePapel(vinc?.[0]?.papel ?? (vinc?.[0] as any)?.role)
    if (!hasPermission(papelReq, 'editar_usuario')) {
      return NextResponse.json({ ok: false, error: 'Sem permissão' }, { status: 403 })
    }

    const adminUrl = (process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL ?? '').trim()
    const serviceKey = (process.env.SUPABASE_SERVICE_ROLE_KEY ?? '').trim()
    if (!adminUrl || !serviceKey) {
      return NextResponse.json({ ok: false, error: 'SUPABASE_SERVICE_ROLE_KEY ausente' }, { status: 500 })
    }

    const admin = createAdminClient<Database>(adminUrl, serviceKey)
    const tempPassword = generateStrongPassword(12)

    const { error } = await admin.auth.admin.updateUserById(profileId, {
      password: tempPassword,
      user_metadata: { must_change_password: true },
    })

    if (error) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 400 })
    }

    return NextResponse.json({ ok: true, senha_temp: tempPassword })
  } catch (err) {
    return NextResponse.json({ ok: false, error: err instanceof Error ? err.message : String(err) }, { status: 500 })
  }
}
