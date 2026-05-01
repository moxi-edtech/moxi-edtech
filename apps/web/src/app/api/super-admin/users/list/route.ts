import { NextResponse } from 'next/server'
import { createRouteClient } from '@/lib/supabase/route-client'
import type { Database } from '~types/supabase'
import { isSuperAdminRole } from '@/lib/auth/requireSuperAdminAccess'
import { callAuthAdminJob } from '@/lib/auth-admin-job'

export const dynamic = 'force-dynamic'
export const revalidate = 0

type UsuarioItem = {
  id: string
  nome: string | null
  email: string
  telefone: string | null
  role: string
  escola_id: string | null
  escola_nome: string | null
  papel_escola: string | null
  last_access: string | null
  last_access_ip: string | null
  last_access_location: string | null
}

type AuthListResponse = {
  users?: Array<{
    id?: string | null
    last_sign_in_at?: string | null
  }>
}

function buildLocationLabel(row: any) {
  const location = row?.details?.location ?? row?.meta?.geo ?? null
  if (!location || typeof location !== 'object') return null
  const parts = [location.city, location.region, location.country]
    .map((part) => (part ? String(part).trim() : ''))
    .filter(Boolean)
  return parts.length > 0 ? Array.from(new Set(parts)).join(', ') : null
}

export async function GET(request: Request) {
  try {
    // AuthZ: somente super_admin via RPC segura (respeitando SERVICE_ROLE_INVENTORY.md)
    const s = await createRouteClient()
    const { data: sess } = await s.auth.getUser()
    const user = sess?.user
    
    if (!user) {
      return NextResponse.json({ ok: false, error: 'Não autenticado' }, { status: 401 })
    }

    // Chama a RPC SECURITY DEFINER para validar o papel sem precisar de service_role no TS
    const { data: isSuperAdmin, error: authError } = await s.rpc('check_super_admin_role')

    if (authError || !isSuperAdmin) {
      return NextResponse.json({ ok: false, error: 'Somente Super Admin' }, { status: 403 })
    }

    // Papéis globais que podem aparecer na lista (sem alunos/formandos)
    const allowedRoles = new Set([
      'super_admin',
      'global_admin',
      'admin',
      'financeiro',
      'secretaria',
      'secretaria_financeiro',
      'admin_financeiro',
      'formacao_admin',
      'formacao_secretaria',
      'formacao_financeiro',
      'formador',
    ])

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
    const { data: profiles, error: profilesError } = await (s as any).rpc('admin_list_profiles', {
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

    const authLastAccessByUser = new Map<string, string | null>()
    try {
      let page = 1
      let keepGoing = true
      while (keepGoing && page <= 5) {
        const authList = (await callAuthAdminJob(request, 'listUsers', {
          page,
          perPage: 1000,
        })) as AuthListResponse
        const users = authList.users ?? []
        for (const authUser of users) {
          if (authUser.id) {
            authLastAccessByUser.set(String(authUser.id), authUser.last_sign_in_at ?? null)
          }
        }
        keepGoing = users.length === 1000
        page += 1
      }
    } catch {
      // A lista continua útil mesmo que o Auth Admin esteja indisponível.
    }

    const auditAccessByUser = new Map<
      string,
      { created_at: string | null; ip: string | null; location: string | null }
    >()
    if (userIds.length > 0) {
      const { data: accessRows } = await (s as any)
        .from('audit_logs' as any)
        .select('user_id, created_at, ip, details, meta')
        .in('user_id', userIds as any)
        .or('action.eq.login,acao.eq.LOGIN')
        .order('created_at', { ascending: false })
        .limit(5000)
      for (const row of accessRows ?? []) {
        const uid = row?.user_id ? String(row.user_id) : null
        if (!uid || auditAccessByUser.has(uid)) continue
        auditAccessByUser.set(uid, {
          created_at: row.created_at ?? null,
          ip: row.ip ?? row.details?.ip ?? null,
          location: buildLocationLabel(row),
        })
      }
    }

    // 2) Vínculos escola_users
    let vRows: any[] = []
    let papelField: 'papel' | 'role' = 'papel'
    if (userIds.length > 0) {
      const fetchVinculos = (table: string, field: 'papel' | 'role', withOrder: boolean) => {
        let query = (s as any)
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
      const { data: escolas, error: eErr } = await (s as any)
        .from('escolas' as any)
        .select('id, nome')
        .in('id', escolaIds as any)
        .limit(200000)
      if (eErr) {
        return NextResponse.json({ ok: false, error: eErr.message }, { status: 400 })
      }
      escolasMap = new Map((escolas || []).map((e: any) => [String(e.id), e.nome ?? null]))

      const { data: centros, error: centrosErr } = await (s as any)
        .from('centros_formacao' as any)
        .select('escola_id, nome')
        .in('escola_id', escolaIds as any)
        .limit(200000)
      if (centrosErr) {
        return NextResponse.json({ ok: false, error: centrosErr.message }, { status: 400 })
      }
      for (const centro of centros || []) {
        if (centro?.escola_id) {
          escolasMap.set(String(centro.escola_id), centro.nome ?? escolasMap.get(String(centro.escola_id)) ?? null)
        }
      }
    }

    const items: UsuarioItem[] = []
    for (const u of pRows) {
      const vinc = vinculosByUser.get(String(u.user_id))
      const escolaIdFromProfile = (u as any)?.current_escola_id ?? (u as any)?.escola_id ?? null
      const papelEscola = vinc?.papel ?? null
      if (papelEscola === 'aluno' || papelEscola === 'formando' || String(u.role ?? '') === 'aluno' || String(u.role ?? '') === 'formando') continue

      const escolaId = vinc?.escola_id ?? (escolaIdFromProfile ? String(escolaIdFromProfile) : null)
      const escolaNome = escolaId ? escolasMap.get(escolaId) ?? null : null
      const authLastAccess = authLastAccessByUser.get(String(u.user_id)) ?? null
      const auditAccess = auditAccessByUser.get(String(u.user_id)) ?? null

      items.push({
        id: String(u.user_id),
        nome: u.nome ?? null,
        email: String(u.email ?? ''),
        telefone: u.telefone ?? null,
        role: String(papelEscola ?? u.role ?? ''),
        escola_id: escolaId,
        escola_nome: escolaNome,
        papel_escola: papelEscola,
        last_access: authLastAccess ?? auditAccess?.created_at ?? null,
        last_access_ip: auditAccess?.ip ?? null,
        last_access_location: auditAccess?.location ?? null,
      })
    }

    return NextResponse.json({ ok: true, items })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ ok: false, error: message }, { status: 500 })
  }
}
