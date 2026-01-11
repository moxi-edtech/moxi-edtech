import { NextResponse } from 'next/server'
import { supabaseServer } from '@/lib/supabaseServer'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import type { Database } from '~types/supabase'
import { applyKf2ListInvariants } from '@/lib/kf2'

type UsuarioItem = {
  id: string
  numero_login: string | null
  nome: string | null
  email: string
  telefone: string | null
  role: string
  escola_id: string | null
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
    const allowed = ['super_admin', 'global_admin']
    if (!allowed.includes(role || '')) {
      return NextResponse.json({ ok: false, error: 'Somente Super Admin' }, { status: 403 })
    }

    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
      return NextResponse.json({ ok: false, error: 'Configuração do Supabase ausente' }, { status: 500 })
    }

    const admin = createAdminClient<Database>(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    ) as any

    // Papéis globais que podem aparecer na lista (sem alunos/professores)
    const allowedRoles = new Set(['super_admin', 'global_admin', 'admin', 'financeiro', 'secretaria'])

    // 1) Carrega perfis básicos
    let profiles: any[] | null = null
    {
      let profilesQuery = admin
        .from('profiles' as any)
        .select('user_id, nome, email, telefone, role, numero_login, escola_id, current_escola_id')
        .is('deleted_at', null)
        .in('role', Array.from(allowedRoles) as any)
        .order('nome', { ascending: true })

      profilesQuery = applyKf2ListInvariants(profilesQuery, { defaultLimit: 5000 })

      const { data, error: pErr } = await profilesQuery
      if (pErr) {
        const msg = (pErr as any)?.message as string | undefined
        const code = (pErr as any)?.code as string | undefined
        const maybeMissingColumn = code === '42703' || (msg && /column .* does not exist|does not exist/i.test(msg))
        if (maybeMissingColumn) {
          // Fallback sem numero_login para ambientes sem a coluna
          let fallbackQuery = admin
            .from('profiles' as any)
            .select('user_id, nome, email, telefone, role, escola_id, current_escola_id')
            .is('deleted_at', null)
            .in('role', Array.from(allowedRoles) as any)
            .order('nome', { ascending: true })

          fallbackQuery = applyKf2ListInvariants(fallbackQuery, { defaultLimit: 5000 })

          const { data: data2, error: pErr2 } = await fallbackQuery
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

    const pRows = ((profiles || []) as any[]).filter((p) =>
      allowedRoles.has(String((p as any)?.role ?? ''))
    )
    const userIds = pRows.map((p: any) => String(p.user_id))

    // 2) Vínculos escola_users
    let vRows: any[] = []
    let papelField: 'papel' | 'role' = 'papel'
    if (userIds.length > 0) {
      const fetchVinculos = (field: 'papel' | 'role') =>
        admin
          .from('escola_users' as any)
          .select(`user_id, escola_id, ${field}`)
          .in('user_id', userIds as any)
          .order('created_at', { ascending: false })
          .limit(200000)

      let { data: v, error: vErr } = await fetchVinculos('papel')
      if (vErr) {
        const msg = (vErr as any)?.message as string | undefined
        const code = (vErr as any)?.code as string | undefined
        const missingColumn = code === '42703' || (msg && /column .* does not exist|does not exist/i.test(msg))
        if (!missingColumn) {
          return NextResponse.json({ ok: false, error: vErr.message }, { status: 400 })
        }

        // Fallback para esquemas que usam 'role' em vez de 'papel'
        const fallback = await fetchVinculos('role')
        if (fallback.error) {
          return NextResponse.json({ ok: false, error: fallback.error.message }, { status: 400 })
        }
        papelField = 'role'
        v = fallback.data
      }
      vRows = (v || []) as any[]
    }

    // 3) Nomes de escolas
    const vinculosByUser = new Map<string, { escola_id: string | null; papel: string | null }>()
    for (const v of vRows) {
      const uid = String(v.user_id)
      if (vinculosByUser.has(uid)) continue
      const papel = (papelField === 'role' ? (v as any).role : (v as any).papel) ?? null
      if (papel === 'aluno') continue
      vinculosByUser.set(uid, {
        escola_id: v.escola_id ? String(v.escola_id) : null,
        papel,
      })
    }

    const escolaIds = Array.from(
      new Set(
        [
          ...Array.from(vinculosByUser.values())
            .map((v) => v.escola_id)
            .filter((id): id is string => !!id),
          ...pRows
            .map((p) => (p as any)?.current_escola_id ?? (p as any)?.escola_id ?? null)
            .filter((id): id is string => !!id)
            .map((id) => String(id)),
        ]
      )
    )
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

    const items: UsuarioItem[] = []
    for (const u of pRows) {
      const vinc = vinculosByUser.get(String(u.user_id))
      const escolaIdFromProfile = (u as any)?.current_escola_id ?? (u as any)?.escola_id ?? null
      const papelEscola = vinc?.papel ?? null
      if (papelEscola === 'aluno' || String(u.role ?? '') === 'aluno') continue

      const escolaId = vinc?.escola_id ?? (escolaIdFromProfile ? String(escolaIdFromProfile) : null)
      const escolaNome = escolaId ? escolasMap.get(escolaId) ?? null : null

      items.push({
        id: String(u.user_id),
        numero_login: u.numero_login ?? null,
        nome: u.nome ?? null,
        email: String(u.email ?? ''),
        telefone: u.telefone ?? null,
        role: String(u.role ?? ''),
        escola_id: escolaId,
        escola_nome: escolaNome,
        papel_escola: papelEscola,
      })
    }

    return NextResponse.json({ ok: true, items })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ ok: false, error: message }, { status: 500 })
  }
}
