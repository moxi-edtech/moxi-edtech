import { NextResponse } from 'next/server'
import { z } from 'zod'
import { supabaseServer } from '@/lib/supabaseServer'
import { authorizeMatriculasManage } from '@/lib/escola/disciplinas'

const BodySchema = z.object({
  numero_matricula: z.union([
    z.number().int().positive(),
    z.string().trim().regex(/^\d+$/, 'Número de matrícula deve ser numérico')
  ]).nullable().optional(),
  data_matricula: z.string().trim().nullable().optional(), // YYYY-MM-DD
  numero_chamada: z.number().int().positive().nullable().optional(),
})

export async function PATCH(
  req: Request,
  context: { params: Promise<{ matriculaId: string }> },
) {
  const { matriculaId } = await context.params

  try {
    const headers = new Headers()
    const bodyRaw = await req.json()
    const parsed = BodySchema.safeParse(bodyRaw)
    if (!parsed.success) {
      return NextResponse.json({ ok: false, error: parsed.error.issues[0]?.message || 'Dados inválidos' }, { status: 400 })
    }
    const body = parsed.data

    const s = await supabaseServer()
    const { data: userRes } = await s.auth.getUser()
    const user = userRes?.user
    if (!user) return NextResponse.json({ ok: false, error: 'Não autenticado' }, { status: 401 })

    // Carregar matrícula para validar tenant
    const { data: mat, error: matErr } = await s
      .from('matriculas' as any)
      .select('id, escola_id')
      .eq('id', matriculaId)
      .maybeSingle()
    if (matErr) return NextResponse.json({ ok: false, error: matErr.message }, { status: 400 })
    if (!mat) return NextResponse.json({ ok: false, error: 'Matrícula não encontrada' }, { status: 404 })

    const escolaId = (mat as any).escola_id as string
    const authz = await authorizeMatriculasManage(s as any, escolaId, user.id)
    if (!authz.allowed) return NextResponse.json({ ok: false, error: authz.reason || 'Sem permissão' }, { status: 403 })

    headers.set('Deprecation', 'true')
    headers.set('Link', `</api/escolas/${escolaId}/matriculas>; rel="successor-version"`)

    // Regra de unicidade amigável por escola (se número fornecido)
    const numeroMatriculaParsed = body.numero_matricula === null || body.numero_matricula === undefined
      ? undefined
      : Number(body.numero_matricula);

    if (numeroMatriculaParsed !== undefined) {
      const { data: conflict } = await s
        .from('matriculas' as any)
        .select('id')
        .eq('escola_id', (mat as any).escola_id)
        .eq('numero_matricula', numeroMatriculaParsed)
        .neq('id', matriculaId)
        .limit(1)
        .maybeSingle()
      if (conflict) {
        return NextResponse.json({ ok: false, error: 'Número de matrícula já utilizado nesta escola.' }, { status: 409, headers })
      }
    }

    const payload: any = {}
    if (numeroMatriculaParsed !== undefined) payload.numero_matricula = numeroMatriculaParsed
    if (body.data_matricula !== undefined) payload.data_matricula = body.data_matricula
    if (body.numero_chamada !== undefined) payload.numero_chamada = body.numero_chamada

    if (Object.keys(payload).length === 0) {
      return NextResponse.json({ ok: false, error: 'Nada para atualizar' }, { status: 400, headers })
    }

    const { data: updated, error: upErr } = await s
      .from('matriculas' as any)
      .update(payload)
    .eq('id', matriculaId)
      .select()
      .maybeSingle()

    if (upErr) return NextResponse.json({ ok: false, error: upErr.message }, { status: 400, headers })

    return NextResponse.json({ ok: true, data: updated }, { headers })
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ ok: false, error: message }, { status: 500 })
  }
}
