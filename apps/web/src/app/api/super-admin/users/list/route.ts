import { NextResponse } from 'next/server'
import { supabaseServer } from '@/lib/supabaseServer'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import type { Database } from '~types/supabase'

type UsuarioItem = {
  id: string
  numero_login: string | null
  nome: string | null
  email: string
  telefone: string | null
  role: string
  escola_nome: string | null
  papel_escola: string | null
}

export async function GET() {
  try {
    // AuthZ: somente super_admin
    const s = await supabaseServer()
    const { data: sess } = await s.auth.getUser()
    const user = sess?.user
    if (!user) return NextResponse.json({ ok: false, error: 'Não autenticado' }, { status: 401 })
    const { data: rows } = await s
      .from('profiles')
      .select('role')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(1)
    const role = (rows?.[0] as any)?.role as string | undefined
    if (role !== 'super_admin') return NextResponse.json({ ok: false, error: 'Somente Super Admin' }, { status: 403 })

    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
      return NextResponse.json({ ok: false, error: 'Configuração do Supabase ausente' }, { status: 500 })
    }

    const admin = createAdminClient<Database>(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    ) as any

    // 1) Carrega perfis básicos
    let profiles: any[] | null = null
    {
      const { data, error: pErr } = await admin
        .from('profiles' as any)
        .select('user_id, nome, email, telefone, role, numero_login')
        .order('nome', { ascending: true })
        .limit(5000)
      if (pErr) {
        const msg = (pErr as any)?.message as string | undefined
        const code = (pErr as any)?.code as string | undefined
        const maybeMissingColumn = code === '42703' || (msg && /column .* does not exist|does not exist/i.test(msg))
        if (maybeMissingColumn) {
          // Fallback sem numero_login para ambientes sem a coluna
          const { data: data2, error: pErr2 } = await admin
            .from('profiles' as any)
            .select('user_id, nome, email, telefone, role')
            .order('nome', { ascending: true })
            .limit(5000)
          if (pErr2) {
            return NextResponse.json({ ok: false, error: pErr2.message }, { status: 400 })
          }
          profiles = data2 as any[]
        } else {
          return NextResponse.json({ ok: false, error: pErr.message }, { status: 400 })
        }
      } else {
        profiles = data as any[]
      }
    }

    const pRows = (profiles || []) as any[]
    const userIds = pRows.map((p: any) => String(p.user_id))

    // 2) Vínculos escola_usuarios
    let vRows: any[] = []
    if (userIds.length > 0) {
      const { data: v, error: vErr } = await admin
        .from('escola_usuarios' as any)
        .select('user_id, escola_id, papel')
        .in('user_id', userIds as any)
        .limit(200000)
      if (vErr) {
        return NextResponse.json({ ok: false, error: vErr.message }, { status: 400 })
      }
      vRows = (v || []) as any[]
    }

    // 3) Nomes de escolas
    const escolaIds = Array.from(new Set(vRows.map((v) => String(v.escola_id))))
    let escolasMap = new Map<string, string | null>()
    if (escolaIds.length > 0) {
      const { data: escolas, error: eErr } = await admin
        .from('escolas' as any)
        .select('id, nome')
        .in('id', escolaIds as any)
        .limit(200000)
      if (eErr) {
        return NextResponse.json({ ok: false, error: eErr.message }, { status: 400 })
      }
      escolasMap = new Map((escolas || []).map((e: any) => [String(e.id), e.nome ?? null]))
    }

    const items: UsuarioItem[] = pRows.map((u: any) => {
      const vinc = vRows.find((v) => String(v.user_id) === String(u.user_id))
      const escolaNome = vinc ? (escolasMap.get(String(vinc.escola_id)) ?? null) : null
      const papelEscola = vinc?.papel ?? null
      return {
        id: String(u.user_id),
        numero_login: u.numero_login ?? null,
        nome: u.nome ?? null,
        email: String(u.email ?? ''),
        telefone: u.telefone ?? null,
        role: String(u.role ?? ''),
        escola_nome: escolaNome,
        papel_escola: papelEscola,
      }
    })

    return NextResponse.json({ ok: true, items })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ ok: false, error: message }, { status: 500 })
  }
}
