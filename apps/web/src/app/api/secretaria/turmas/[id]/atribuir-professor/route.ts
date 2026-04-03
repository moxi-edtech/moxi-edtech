import { NextResponse } from 'next/server'
import { z } from 'zod'
import { supabaseServerTyped } from '@/lib/supabaseServer'
import { authorizeTurmasManage } from '@/lib/escola/disciplinas'
import { resolveEscolaIdForUser } from '@/lib/tenant/resolveEscolaIdForUser'
import { tryCanonicalFetch } from '@/lib/api/proxyCanonical'
import { dispatchProfessorNotificacao } from '@/lib/notificacoes/dispatchProfessorNotificacao'
import { emitirEvento } from '@/lib/eventos/emitirEvento'

const Body = z.object({
  // compat: disciplina_id (legado) agora mapeia para curso_matriz_id
  disciplina_id: z.string().uuid().optional(),
  curso_matriz_id: z.string().uuid().optional(),
  // aceita professor_id (tabela professores.id) ou professor_user_id (profiles.user_id)
  professor_id: z.string().uuid().optional(),
  professor_user_id: z.string().uuid().optional(),
  horarios: z.any().optional(),
  planejamento: z.any().optional(),
}).refine((d) => !!(d.professor_id || d.professor_user_id), {
  message: 'Informe professor_id ou professor_user_id',
}).refine((d) => !!(d.curso_matriz_id || d.disciplina_id), {
  message: 'Informe curso_matriz_id',
})

// POST /api/secretaria/turmas/:id/atribuir-professor
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const startedAt = Date.now()
    const supabase = await supabaseServerTyped<any>()
    const headers = new Headers()
    const { data: userRes } = await supabase.auth.getUser()
    const user = userRes?.user
    if (!user) return NextResponse.json({ ok: false, error: 'Não autenticado' }, { status: 401 })

    const { id: turmaId } = await ctx.params
    const json = await req.json().catch(() => ({}))
    const parsed = Body.safeParse(json)
    if (!parsed.success) return NextResponse.json({ ok: false, error: parsed.error.issues?.[0]?.message || 'Dados inválidos' }, { status: 400 })
    const body = parsed.data as z.infer<typeof Body>
    const cursoMatrizId = body.curso_matriz_id ?? body.disciplina_id ?? null

    const escolaId = await resolveEscolaIdForUser(supabase as any, user.id)
    if (!escolaId) return NextResponse.json({ ok: false, error: 'Escola não encontrada' }, { status: 400 })

    const emitObs = (status: 'success' | 'error', httpStatus: number, details: Record<string, unknown> = {}) =>
      emitirEvento(supabase as any, {
        escola_id: escolaId,
        tipo: 'academico.atribuir_professor_turma',
        payload: {
          status,
          http_status: httpStatus,
          duration_ms: Date.now() - startedAt,
          turma_id: turmaId,
          curso_matriz_id: cursoMatrizId,
          ...details,
        },
        actor_id: user.id,
        actor_role: 'secretaria',
        entidade_tipo: 'turma_disciplinas',
        entidade_id: turmaId,
      }).catch(() => null)

    const authz = await authorizeTurmasManage(supabase as any, escolaId, user.id)
    if (!authz.allowed) return NextResponse.json({ ok: false, error: authz.reason || 'Sem permissão' }, { status: 403 })

    headers.set('Deprecation', 'true')
    headers.set('Link', `</api/escolas/${escolaId}/turmas>; rel="successor-version"`)

    const forwarded = await tryCanonicalFetch(req, `/api/escolas/${escolaId}/turmas/${turmaId}/atribuir-professor`)
    if (forwarded) return forwarded

    const { data: actorProfile } = await supabase
      .from('profiles')
      .select('role')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()
    const actorRole = (actorProfile as { role?: string | null } | null)?.role ?? null

    const profResolved = body.professor_id
      ? await supabase
          .from('professores')
          .select('id')
          .eq('id', body.professor_id)
          .eq('escola_id', escolaId)
          .maybeSingle()
      : body.professor_user_id
        ? await supabase
            .from('professores')
            .select('id')
            .eq('profile_id', body.professor_user_id)
            .eq('escola_id', escolaId)
            .maybeSingle()
        : ({ data: null } as any)

    const professorId = (profResolved as { data?: { id?: string | null } | null })?.data?.id ?? null
    if (!professorId) {
      emitObs('error', 404, { error_code: 'PROFESSOR_NOT_FOUND' })
      return NextResponse.json({ ok: false, error: 'Professor não encontrado' }, { status: 404, headers })
    }

    const { data: turmaQ } = await supabase
      .from('turmas')
      .select('id, nome')
      .eq('id', turmaId)
      .eq('escola_id', escolaId)
      .maybeSingle()
    if (!turmaQ?.id) {
      emitObs('error', 404, { error_code: 'TURMA_NOT_FOUND', professor_id: professorId })
      return NextResponse.json({ ok: false, error: 'Turma não encontrada' }, { status: 404, headers })
    }

    const { data: rpcRows, error: rpcErr } = await (supabase as any).rpc(
      'assign_professor_turma_disciplina_atomic',
      {
        p_escola_id: escolaId,
        p_turma_id: turmaId,
        p_curso_matriz_id: cursoMatrizId,
        p_professor_id: professorId,
        p_horarios: body.horarios ?? null,
        p_planejamento: body.planejamento ?? null,
      }
    )

    if (rpcErr) {
      const msg = rpcErr.message || 'Falha ao atribuir professor'
      const status =
        msg.includes('NOT_FOUND')
          ? 404
          : msg.includes('SKILL_MISMATCH') || msg.includes('TURNO_MISMATCH') || msg.includes('CARGA_EXCEEDED')
            ? 409
            : msg.includes('INVALID_INPUT')
            ? 400
            : 400
      emitObs('error', status, {
        error_code: 'ASSIGN_RPC_ERROR',
        rpc_error: msg,
        professor_id: professorId,
      })
      return NextResponse.json({ ok: false, error: msg }, { status, headers })
    }

    const rpcRow = (Array.isArray(rpcRows) ? rpcRows[0] : rpcRows) as
      | { mode?: string; professor_profile_id?: string | null; carga_atual?: number | null; carga_maxima?: number | null }
      | null
    const professorProfileId = rpcRow?.professor_profile_id ?? null
    if (professorProfileId) {
      await dispatchProfessorNotificacao({
        escolaId,
        key: 'TURMA_ATRIBUIDA',
        params: {
          turmaNome: (turmaQ as { nome?: string | null } | null)?.nome ?? null,
          actionUrl: `/professor/turmas/${turmaId}`,
        },
        recipientIds: [professorProfileId],
        actorId: user.id,
        actorRole: actorRole ?? 'secretaria',
        agrupamentoTTLHoras: 12,
      })
    }
    emitObs('success', 200, {
      mode: rpcRow?.mode ?? 'updated',
      professor_id: professorId,
      professor_profile_id: professorProfileId,
    })
    return NextResponse.json({
      ok: true,
      mode: rpcRow?.mode ?? 'updated',
      carga_atual: rpcRow?.carga_atual ?? null,
      carga_maxima: rpcRow?.carga_maxima ?? null,
    }, { headers })
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ ok: false, error: message }, { status: 500 })
  }
}
