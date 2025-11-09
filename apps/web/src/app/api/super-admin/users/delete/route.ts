import { NextResponse } from 'next/server'
import { supabaseServer } from '@/lib/supabaseServer'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import type { Database } from '~types/supabase'

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const userId = String(body?.userId || '')
    if (!userId) return NextResponse.json({ ok: false, error: 'userId ausente' }, { status: 400 })

    // AuthZ: somente super_admin
    const s = await supabaseServer()
    const { data: sess } = await s.auth.getUser()
    const current = sess?.user
    if (!current) return NextResponse.json({ ok: false, error: 'Não autenticado' }, { status: 401 })
    const { data: rows } = await s.from('profiles').select('role').eq('user_id', current.id).order('created_at', { ascending: false }).limit(1)
    const role = (rows?.[0] as any)?.role as string | undefined
    if (role !== 'super_admin') return NextResponse.json({ ok: false, error: 'Somente Super Admin' }, { status: 403 })

    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
      return NextResponse.json({ ok: false, error: 'Configuração do Supabase ausente' }, { status: 500 })
    }
    const admin = createAdminClient<Database>(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!) as any

    // Remove vínculos e perfil; também tenta remover do Auth
    await admin.from('escola_usuarios' as any).delete().eq('user_id', userId)
    await admin.from('profiles' as any).delete().eq('user_id', userId)
    try {
      await admin.auth.admin.deleteUser(userId)
    } catch (_) {
      // Se não conseguir remover do Auth, ainda assim consideramos a operação de limpeza do app ok
    }

    return NextResponse.json({ ok: true })
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : 'Erro ao excluir usuário' },
      { status: 500 }
    )
  }
}

