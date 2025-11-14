import { NextResponse } from 'next/server'
import { z } from 'zod'
import { supabaseServer } from '@/lib/supabaseServer'
import { hasPermission } from '@/lib/permissions'
import { recordAuditServer } from '@/lib/audit'
import { createClient } from '@supabase/supabase-js'
import type { Database } from '~types/supabase'

const BodySchema = z.object({
  nome: z.string().trim().min(1, 'Informe o nome'),
  email: z.string().email().optional().nullable(),
  // Campos extras opcionais (best-effort; ignorados se não existirem no schema)
  data_nascimento: z.string().optional().nullable(),
  sexo: z.enum(['M', 'F', 'O', 'N']).optional().nullable(),
  bi_numero: z.string().optional().nullable(),
  responsavel_nome: z.string().optional().nullable(),
  responsavel_contato: z.string().optional().nullable(),
})

export async function POST(
  req: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id: escolaId } = await context.params

  try {
    const bodyRaw = await req.json()
    const parse = BodySchema.safeParse(bodyRaw)

    if (!parse.success) {
      return NextResponse.json(
        { ok: false, error: parse.error.issues[0]?.message || 'Dados inválidos' },
        { status: 400 },
      )
    }

    const body = parse.data

    const s = await supabaseServer()
    const { data: userRes } = await s.auth.getUser()
    const user = userRes?.user

    if (!user) {
      return NextResponse.json(
        { ok: false, error: 'Não autenticado' },
        { status: 401 },
      )
    }

    const { data: vinc } = await s
      .from('escola_usuarios')
      .select('papel')
      .eq('user_id', user.id)
      .eq('escola_id', escolaId)
      .limit(1)

    const papel = (vinc?.[0] as any)?.papel || null

    if (!hasPermission(papel as any, 'criar_matricula')) {
      return NextResponse.json(
        { ok: false, error: 'Sem permissão' },
        { status: 403 },
      )
    }

    // Hard check: user profile must be linked to this escola
    const { data: profCheck } = await s
      .from('profiles' as any)
      .select('escola_id')
      .eq('user_id', user.id)
      .maybeSingle()

    if (!profCheck || (profCheck as any).escola_id !== escolaId) {
      return NextResponse.json(
        { ok: false, error: 'Perfil não vinculado à escola' },
        { status: 403 },
      )
    }

    // Payload mínimo + extras best-effort
    const insert: any = {
      escola_id: escolaId,
      nome: body.nome,
    }

    if (body.email) {
      insert.email = body.email
    }

    for (const key of [
      'data_nascimento',
      'sexo',
      'bi_numero',
      'responsavel_nome',
      'responsavel_contato',
    ] as const) {
      if (body[key] != null) {
        insert[key] = body[key] as any
      }
    }

    let created

    try {
      if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
        return NextResponse.json(
          { ok: false, error: 'Falta SUPABASE_SERVICE_ROLE_KEY para criar alunos.' },
          { status: 500 },
        )
      }

      const admin = createClient<Database>(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)

      const { data, error } = await (admin as any)
        .from('alunos')
        .insert([insert] as any)
        .select('id')
        .single()

      if (error) throw error
      created = data
    } catch (e: any) {
      // Fallback ultra-minimalista se alguma coluna opcional não existir
      const admin = createClient<Database>(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
      const { data, error } = await (admin as any)
        .from('alunos')
        .insert([
          {
            escola_id: escolaId,
            nome: body.nome,
          },
        ] as any)
        .select('id')
        .single()

      if (error) {
        return NextResponse.json(
          { ok: false, error: error.message || 'Falha ao criar aluno' },
          { status: 400 },
        )
      }

      created = data
    }

    recordAuditServer({
      escolaId,
      portal: 'secretaria',
      acao: 'ALUNO_CRIADO',
      entity: 'aluno',
      entityId: String(created.id),
      details: {
        nome: body.nome,
        email: body.email ?? null,
      },
    }).catch(() => null)

    return NextResponse.json({ ok: true, id: created.id })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return NextResponse.json(
      { ok: false, error: message },
      { status: 500 },
    )
  }
}
