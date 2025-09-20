import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { supabaseServer } from '@/lib/supabaseServer'
import { recordAuditServer } from '@/lib/audit'
import { hasPermission } from '@/lib/permissions'

const BodySchema = z.object({
  aluno_id: z.string().uuid('aluno_id inválido'),
  turma_id: z.string().uuid('turma_id inválido'),
  status: z.string().trim().default('ativa'),
})

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { id: escolaId } = await context.params
  try {
    const s = (await supabaseServer()) as any
    // AuthN
    const { data: userRes } = await s.auth.getUser()
    const userId = userRes?.user?.id
    if (!userId) return NextResponse.json({ ok: false, error: 'Não autenticado' }, { status: 401 })

    const json = await req.json()
    const parse = BodySchema.safeParse(json)
    if (!parse.success) {
      const msg = parse.error.errors[0]?.message || 'Dados inválidos'
      return NextResponse.json({ ok: false, error: msg }, { status: 400 })
    }
    const body = parse.data
    
    // AuthZ via papel -> permission mapping
    const { data: vinc } = await s.from('escola_usuarios').select('papel').eq('user_id', userId).eq('escola_id', escolaId).limit(1)
    const papel = vinc?.[0]?.papel as any
    if (!hasPermission(papel, 'criar_matricula')) return NextResponse.json({ ok: false, error: 'Sem permissão' }, { status: 403 })
    // Bloqueia criação de matrícula para escola suspensa/excluída
    try {
      const { data: esc } = await s.from('escolas').select('status').eq('id', escolaId).limit(1)
      const status = (esc?.[0] as any)?.status as string | undefined
      if (status === 'excluida') return NextResponse.json({ ok: false, error: 'Escola excluída não permite criar matrículas.' }, { status: 400 })
      if (status === 'suspensa') return NextResponse.json({ ok: false, error: 'Escola suspensa por pagamento. Regularize para criar matrículas.' }, { status: 400 })
    } catch {}
    const { data, error } = await s
      .from('matriculas')
      .insert({
        escola_id: escolaId,
        aluno_id: body.aluno_id,
        turma_id: body.turma_id,
        status: body.status,
      })
      .select('id, escola_id, aluno_id, turma_id, status, created_at')
      .single()

    if (error || !data) {
      return NextResponse.json({ ok: false, error: error?.message || 'Falha ao criar matrícula' }, { status: 400 })
    }

    recordAuditServer({
      escolaId,
      portal: 'secretaria',
      action: 'MATRICULA_CRIADA',
      entity: 'matricula',
      entityId: String(data.id),
      details: { aluno_id: data.aluno_id, turma_id: data.turma_id, status: data.status },
    }).catch(() => null)

    return NextResponse.json({ ok: true, matricula: data })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ ok: false, error: message }, { status: 500 })
  }
}
