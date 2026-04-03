import { NextRequest, NextResponse } from 'next/server'
import { createRouteClient } from '@/lib/supabase/route-client'
import { resolveEscolaIdForUser } from '@/lib/tenant/resolveEscolaIdForUser'
import { emitirEvento } from '@/lib/eventos/emitirEvento'

export const dynamic = 'force-dynamic'
export const revalidate = 0

type ConsistencyRow = {
  check_key: string
  severity: 'high' | 'medium' | 'low' | string
  total: number
  sample: unknown
}

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const startedAt = Date.now()
  const { id: escolaId } = await context.params

  try {
    const supabase = await createRouteClient()
    const { data: auth } = await supabase.auth.getUser()
    const user = auth?.user
    if (!user) return NextResponse.json({ ok: false, error: 'Não autenticado' }, { status: 401 })

    const userEscolaId = await resolveEscolaIdForUser(supabase, user.id, escolaId)
    if (!userEscolaId || userEscolaId !== escolaId) {
      return NextResponse.json({ ok: false, error: 'Sem permissão' }, { status: 403 })
    }

    const { data: hasRole, error: roleError } = await supabase.rpc('user_has_role_in_school', {
      p_escola_id: userEscolaId,
      p_roles: ['admin_escola', 'secretaria', 'admin'],
    })

    if (roleError) {
      return NextResponse.json({ ok: false, error: 'Erro ao verificar permissões' }, { status: 500 })
    }
    if (!hasRole) {
      return NextResponse.json({ ok: false, error: 'Sem permissão' }, { status: 403 })
    }

    const limitRaw = req.nextUrl.searchParams.get('limit')
    const parsedLimit = Number(limitRaw)
    const limit = Number.isFinite(parsedLimit)
      ? Math.min(200, Math.max(1, Math.trunc(parsedLimit)))
      : 20

    const { data, error } = await (supabase as any).rpc('check_professor_operational_consistency', {
      p_escola_id: userEscolaId,
      p_limit: limit,
    })

    if (error) {
      await emitirEvento(supabase as any, {
        escola_id: userEscolaId,
        tipo: 'academico.consistencia_professores_checked',
        payload: {
          status: 'error',
          http_status: 500,
          duration_ms: Date.now() - startedAt,
          error_code: 'CONSISTENCY_RPC_ERROR',
          error_message: error.message,
        },
        actor_id: user.id,
        actor_role: 'admin',
        entidade_tipo: 'professores',
        entidade_id: null,
      }).catch(() => null)

      return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
    }

    const rows = ((data || []) as ConsistencyRow[]).map((row) => ({
      ...row,
      total: Number(row.total || 0),
    }))
    const totalIssues = rows.reduce((acc, row) => acc + row.total, 0)
    const highIssues = rows
      .filter((row) => row.severity === 'high')
      .reduce((acc, row) => acc + row.total, 0)
    const mediumIssues = rows
      .filter((row) => row.severity === 'medium')
      .reduce((acc, row) => acc + row.total, 0)

    const healthy = totalIssues === 0

    await emitirEvento(supabase as any, {
      escola_id: userEscolaId,
      tipo: 'academico.consistencia_professores_checked',
      payload: {
        status: 'success',
        http_status: 200,
        duration_ms: Date.now() - startedAt,
        total_issues: totalIssues,
        high_issues: highIssues,
        medium_issues: mediumIssues,
        healthy,
      },
      actor_id: user.id,
      actor_role: 'admin',
      entidade_tipo: 'professores',
      entidade_id: null,
    }).catch(() => null)

    return NextResponse.json({
      ok: true,
      healthy,
      summary: {
        total_issues: totalIssues,
        high_issues: highIssues,
        medium_issues: mediumIssues,
      },
      checks: rows,
    })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Erro inesperado'
    return NextResponse.json({ ok: false, error: msg }, { status: 500 })
  }
}
