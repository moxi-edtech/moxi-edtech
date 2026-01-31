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

    const isMissingColumn = (err: any) => {
      const msg = err?.message as string | undefined
      const code = err?.code as string | undefined
      return code === '42703' || (msg && /column .* does not exist|does not exist/i.test(msg))
    }
    const isMissingTable = (err: any) => {
      const msg = err?.message as string | undefined
      const code = err?.code as string | undefined
      return code === '42P01' || (msg && /relation .* does not exist|does not exist/i.test(msg))
    }

    // 1) Carrega perfis básicos via RPC segura
    const { data: profiles, error: profilesError } = await admin.rpc('admin_list_profiles', {
      p_roles: Array.from(allowedRoles),
      p_limit: 5000,
    })

    if (profilesError) {
      return NextResponse.json({ ok: false, error: profilesError.message }, { status: 400 })
    }

    const pRows = ((profiles || []) as any[]).filter((p) =>
      allowedRoles.has(String((p as any)?.role ?? ''))
    )
    const userIds = pRows.map((p: any) => String(p.user_id))

    // 2) Vínculos escola_users
    let vRows: any[] = []
    let papelField: 'papel' | 'role' = 'papel'
    if (userIds.length > 0) {
      const fetchVinculos = (table: string, field: 'papel' | 'role', withOrder: boolean) => {
        let query = admin
          .from(table as any)
          .select(`user_id, escola_id, ${field}`)
          .in('user_id', userIds as any)
          .limit(200000)
        if (withOrder) {
          query = query.order('created_at', { ascending: false })
        }
        return query
      }

      const attempts = [
        { table: 'escola_users', field: 'papel' as const, order: true },
        { table: 'escola_users', field: 'papel' as const, order: false },
        { table: 'escola_users', field: 'role' as const, order: true },
        { table: 'escola_users', field: 'role' as const, order: false },
        { table: 'escola_usuarios', field: 'papel' as const, order: true },
        { table: 'escola_usuarios', field: 'papel' as const, order: false },
        { table: 'escola_usuarios', field: 'role' as const, order: true },
        { table: 'escola_usuarios', field: 'role' as const, order: false },
      ]

      for (const attempt of attempts) {
        const { data: v, error: vErr } = await fetchVinculos(
          attempt.table,
          attempt.field,
          attempt.order
        )
        if (vErr) {
          if (isMissingColumn(vErr) || isMissingTable(vErr)) {
            continue
          }
          return NextResponse.json({ ok: false, error: vErr.message }, { status: 400 })
        }
        papelField = attempt.field
        vRows = (v || []) as any[]
        break
      }
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
