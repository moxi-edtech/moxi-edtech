import { NextResponse } from 'next/server'
import { z } from 'zod'
import { supabaseServer } from '@/lib/supabaseServer'
import { hasPermission } from '@/lib/permissions'

const BodySchema = z.object({
  numero_matricula: z.string().trim().min(1).nullable().optional(),
  data_matricula: z.string().trim().nullable().optional(), // YYYY-MM-DD
})

export async function PATCH(
  req: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params

  try {
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
      .eq('id', id)
      .maybeSingle()
    if (matErr) return NextResponse.json({ ok: false, error: matErr.message }, { status: 400 })
    if (!mat) return NextResponse.json({ ok: false, error: 'Matrícula não encontrada' }, { status: 404 })

    // Verificar permissão do usuário na escola da matrícula
    const { data: vinc } = await s
      .from('escola_usuarios' as any)
      .select('papel')
      .eq('user_id', user.id)
      .eq('escola_id', (mat as any).escola_id)
      .limit(1)

    const papel = (vinc?.[0] as any)?.papel || null
    if (!hasPermission(papel as any, 'editar_matricula') && !hasPermission(papel as any, 'criar_matricula')) {
      return NextResponse.json({ ok: false, error: 'Sem permissão' }, { status: 403 })
    }

    // Regra de unicidade amigável por escola (se número fornecido)
    if (body.numero_matricula && body.numero_matricula.trim() !== '') {
      const { data: conflict } = await s
        .from('matriculas' as any)
        .select('id')
        .eq('escola_id', (mat as any).escola_id)
        .eq('numero_matricula', body.numero_matricula)
        .neq('id', id)
        .limit(1)
        .maybeSingle()
      if (conflict) {
        return NextResponse.json({ ok: false, error: 'Número de matrícula já utilizado nesta escola.' }, { status: 409 })
      }
    }

    const payload: any = {}
    if (body.numero_matricula !== undefined) payload.numero_matricula = body.numero_matricula
    if (body.data_matricula !== undefined) payload.data_matricula = body.data_matricula

    if (Object.keys(payload).length === 0) {
      return NextResponse.json({ ok: false, error: 'Nada para atualizar' }, { status: 400 })
    }

    const { data: updated, error: upErr } = await s
      .from('matriculas' as any)
      .update(payload)
      .eq('id', id)
      .select()
      .maybeSingle()

    if (upErr) return NextResponse.json({ ok: false, error: upErr.message }, { status: 400 })

    return NextResponse.json({ ok: true, data: updated })
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ ok: false, error: message }, { status: 500 })
  }
}
