import { NextResponse } from 'next/server'
import { supabaseServer } from '@/lib/supabaseServer'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import type { Database } from '~types/supabase'

const isStrongPassword = (pwd: string) => {
  return (
    typeof pwd === 'string' &&
    pwd.length >= 8 &&
    /[A-Z]/.test(pwd) &&
    /[a-z]/.test(pwd) &&
    /\d/.test(pwd) &&
    /[^A-Za-z0-9]/.test(pwd)
  )
}

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}))
    const userId = String(body?.userId || '')
    const password = String(body?.password || '')
    const mustChange = body?.mustChange !== false

    if (!userId) return NextResponse.json({ ok: false, error: 'userId ausente' }, { status: 400 })
    if (!password) return NextResponse.json({ ok: false, error: 'Senha ausente' }, { status: 400 })
    if (!isStrongPassword(password)) {
      return NextResponse.json(
        {
          ok: false,
          error:
            'Senha inválida: mínimo 8 caracteres, com maiúscula, minúscula, número e caractere especial.',
        },
        { status: 400 }
      )
    }

    const s = await supabaseServer()
    const { data: sess } = await s.auth.getUser()
    const current = sess?.user
    if (!current) return NextResponse.json({ ok: false, error: 'Não autenticado' }, { status: 401 })

    const { data: rows } = await s
      .from('profiles')
      .select('role')
      .eq('user_id', current.id)
      .order('created_at', { ascending: false })
      .limit(1)
    const role = (rows?.[0] as any)?.role as string | undefined
    if (role !== 'super_admin') {
      return NextResponse.json({ ok: false, error: 'Somente Super Admin' }, { status: 403 })
    }

    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
      return NextResponse.json({ ok: false, error: 'Configuração do Supabase ausente' }, { status: 500 })
    }

    const admin = createAdminClient<Database>(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    ) as any

    const { error } = await admin.auth.admin.updateUserById(userId, {
      password,
      user_metadata: mustChange ? { must_change_password: true } : undefined,
    })

    if (error) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 400 })
    }

    return NextResponse.json({ ok: true })
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : 'Erro ao redefinir senha' },
      { status: 500 }
    )
  }
}
