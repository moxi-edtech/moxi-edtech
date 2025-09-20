import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { supabaseServer } from '@/lib/supabaseServer'
import { recordAuditServer } from '@/lib/audit'
import { hasPermission } from '@/lib/permissions'

const BodySchema = z.object({
  nome: z.string().trim().min(1, 'Informe o nome'),
  email: z.string().email().optional().nullable(),
  // Campos adicionais (todos opcionais)
  data_nascimento: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/u, 'Data inválida (YYYY-MM-DD)')
    .optional()
    .nullable(),
  sexo: z.enum(['M', 'F', 'O', 'N']).optional().nullable(),
  bi_numero: z.string().trim().min(3).max(120).optional().nullable(),
  responsavel_nome: z.string().trim().min(1).optional().nullable(),
  responsavel_contato: z.string().trim().min(5).max(160).optional().nullable(),
})

export async function POST(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  const { id: escolaId } = await context.params
  try {
    const json = await req.json()
    const parse = BodySchema.safeParse(json)
    if (!parse.success) return NextResponse.json({ ok: false, error: parse.error.errors[0]?.message || 'Dados inválidos' }, { status: 400 })
    const { nome, email, data_nascimento, sexo, bi_numero, responsavel_nome, responsavel_contato } = parse.data

    const s = (await supabaseServer()) as any
    const { data: userRes } = await s.auth.getUser()
    const userId = userRes?.user?.id
    if (!userId) return NextResponse.json({ ok: false, error: 'Não autenticado' }, { status: 401 })

    // Authorization via papel -> permission mapping
    const { data: vinc } = await s.from('escola_usuarios').select('papel').eq('user_id', userId).eq('escola_id', escolaId).limit(1)
    const papel = vinc?.[0]?.papel as any
    if (!hasPermission(papel, 'criar_matricula')) return NextResponse.json({ ok: false, error: 'Sem permissão' }, { status: 403 })

    const { data, error } = await s
      .from('alunos')
      .insert({
        escola_id: escolaId,
        nome,
        email: email ?? null,
        data_nascimento: data_nascimento ?? null,
        sexo: sexo ?? null,
        bi_numero: bi_numero ?? null,
        responsavel_nome: responsavel_nome ?? null,
        responsavel_contato: responsavel_contato ?? null,
      } as any)
      .select('id, nome, email, escola_id, created_at, data_nascimento, sexo, bi_numero, responsavel_nome, responsavel_contato')
      .single()
    if (error || !data) return NextResponse.json({ ok: false, error: error?.message || 'Falha ao criar aluno' }, { status: 400 })

    recordAuditServer({ escolaId, portal: 'secretaria', action: 'ALUNO_CRIADO', entity: 'aluno', entityId: String(data.id), details: { nome: data.nome, email: data.email } }).catch(() => null)
    return NextResponse.json({ ok: true, aluno: data })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ ok: false, error: message }, { status: 500 })
  }
}
