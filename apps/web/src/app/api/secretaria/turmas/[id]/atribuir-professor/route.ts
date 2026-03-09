import { NextResponse } from 'next/server'
import { z } from 'zod'
import { supabaseServerTyped } from '@/lib/supabaseServer'
import { authorizeTurmasManage } from '@/lib/escola/disciplinas'
import { resolveEscolaIdForUser } from '@/lib/tenant/resolveEscolaIdForUser'
import { tryCanonicalFetch } from '@/lib/api/proxyCanonical'
import { requireFeature } from '@/lib/plan/requireFeature'
import { HttpError } from '@/lib/errors'
import { dispatchProfessorNotificacao } from '@/lib/notificacoes/dispatchProfessorNotificacao'

const Body = z.object({
  disciplina_id: z.string().uuid(), // agora espera curso_matriz_id
  // aceita professor_id (tabela professores.id) ou professor_user_id (profiles.user_id)
  professor_id: z.string().uuid().optional(),
  professor_user_id: z.string().uuid().optional(),
  horarios: z.any().optional(),
  planejamento: z.any().optional(),
}).refine((d) => !!(d.professor_id || d.professor_user_id), {
  message: 'Informe professor_id ou professor_user_id',
})

// POST /api/secretaria/turmas/:id/atribuir-professor
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
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

    const escolaId = await resolveEscolaIdForUser(supabase as any, user.id)
    if (!escolaId) return NextResponse.json({ ok: false, error: 'Escola não encontrada' }, { status: 400 })

    const authz = await authorizeTurmasManage(supabase as any, escolaId, user.id)
    if (!authz.allowed) return NextResponse.json({ ok: false, error: authz.reason || 'Sem permissão' }, { status: 403 })

    try {
      await requireFeature('doc_qr_code')
    } catch (err) {
      if (err instanceof HttpError) {
        return NextResponse.json({ ok: false, error: err.message, code: err.code }, { status: err.status })
      }
      throw err
    }

    headers.set('Deprecation', 'true')
    headers.set('Link', `</api/escolas/${escolaId}/turmas>; rel="successor-version"`)

    const forwarded = await tryCanonicalFetch(req, `/api/escolas/${escolaId}/turmas/${turmaId}/atribuir-professor`)
    if (forwarded) return forwarded

    // Upsert unique by (turma_id, curso_matriz_id)
    // Ensure curso_matriz entry and professor exist and belong to escola
    const { data: actorProfile } = await supabase
      .from('profiles')
      .select('role')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()
    const actorRole = (actorProfile as { role?: string | null } | null)?.role ?? null

    const [matrizQ, profByIdQ, profByUserQ, turmaQ] = await Promise.all([
      supabase
        .from('curso_matriz')
        .select('id, escola_id, disciplina_id')
        .eq('id', body.disciplina_id)
        .eq('escola_id', escolaId)
        .order('id', { ascending: false })
        .limit(1)
        .maybeSingle(),
      body.professor_id
        ? supabase.from('professores').select('id, profile_id').eq('id', body.professor_id).eq('escola_id', escolaId).maybeSingle()
        : Promise.resolve({ data: null } as any),
      body.professor_user_id
        ? supabase.from('professores').select('id, profile_id').eq('profile_id', body.professor_user_id).eq('escola_id', escolaId).maybeSingle()
        : Promise.resolve({ data: null } as any),
      supabase.from('turmas').select('id, nome').eq('id', turmaId).eq('escola_id', escolaId).maybeSingle(),
    ])
    if (!matrizQ.data) return NextResponse.json({ ok: false, error: 'Disciplina/Matriz não encontrada' }, { status: 404, headers })
    const profResolved = (profByIdQ.data || profByUserQ.data) as any | null
    if (!profResolved) return NextResponse.json({ ok: false, error: 'Professor não encontrado' }, { status: 404, headers })
    if (!turmaQ.data) return NextResponse.json({ ok: false, error: 'Turma não encontrada' }, { status: 404, headers })
    const disciplinaCatalogoId = (matrizQ.data as { disciplina_id?: string | null }).disciplina_id
    if (!disciplinaCatalogoId) {
      return NextResponse.json({ ok: false, error: 'Disciplina sem catálogo associado' }, { status: 409, headers })
    }

    // If exists, update; else insert (unique escola+turma+curso_matriz_id)
    const { data: existing } = await supabase
      .from('turma_disciplinas')
      .select('id')
      .eq('escola_id', escolaId)
      .eq('turma_id', turmaId)
      .eq('curso_matriz_id', body.disciplina_id)
      .maybeSingle()

    const professorProfileId = profResolved.profile_id as string | null | undefined

    if (!existing?.id) {
      const { error: insErr } = await supabase
        .from('turma_disciplinas')
        .insert({
          escola_id: escolaId,
          turma_id: turmaId,
          curso_matriz_id: body.disciplina_id,
        } as any)
      if (insErr) return NextResponse.json({ ok: false, error: insErr.message }, { status: 400, headers })
    }

    const { error: tdpErr } = await supabase
      .from('turma_disciplinas_professores')
      .upsert(
        {
          escola_id: escolaId,
          turma_id: turmaId,
          disciplina_id: disciplinaCatalogoId,
          professor_id: profResolved.id,
        },
        { onConflict: 'escola_id,turma_id,disciplina_id' }
      )
    if (tdpErr) return NextResponse.json({ ok: false, error: tdpErr.message }, { status: 400, headers })
    if (professorProfileId) {
      await dispatchProfessorNotificacao({
        escolaId,
        key: 'TURMA_ATRIBUIDA',
        params: {
          turmaNome: (turmaQ.data as { nome?: string | null } | null)?.nome ?? null,
          actionUrl: `/professor/turmas/${turmaId}`,
        },
        recipientIds: [professorProfileId],
        actorId: user.id,
        actorRole: actorRole ?? 'secretaria',
        agrupamentoTTLHoras: 12,
      })
    }
    return NextResponse.json({ ok: true, mode: existing?.id ? 'updated' : 'created' }, { headers })
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ ok: false, error: message }, { status: 500 })
  }
}
