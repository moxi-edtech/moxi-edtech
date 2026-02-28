import { NextResponse } from 'next/server'
import { supabaseServer } from '@/lib/supabaseServer'
import { isSuperAdminRole } from '@/lib/auth/requireSuperAdminAccess'

export async function GET() {
  try {
    // AuthZ: somente super_admin
    const s = await supabaseServer()
    const { data: sess } = await s.auth.getUser()
    const user = sess?.user
    if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
    const { data: rows } = await s
      .from('profiles')
      .select('role')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(1)
    const role = (rows?.[0] as any)?.role as string | undefined
    if (!isSuperAdminRole(role)) {
      return NextResponse.json({ error: 'Somente Super Admin' }, { status: 403 })
    }

    const { data: escolas, error } = await s
      .from('escolas' as any)
      .select('id, nome')
      .order('nome')

    if (error) throw error

    return NextResponse.json({ escolas })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Erro interno' },
      { status: 500 }
    )
  }
}
