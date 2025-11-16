import { NextResponse } from 'next/server'
import { z } from 'zod'
import { supabaseServer } from '@/lib/supabaseServer'
import { hasPermission } from '@/lib/permissions'
import { recordAuditServer } from '@/lib/audit'
import { createClient } from '@supabase/supabase-js'
import type { Database } from '~types/supabase'
import { generateNumeroLogin } from '@/lib/generateNumeroLogin'

const BodySchema = z.object({
  nome: z.string().trim().min(1, 'Informe o nome'),
  email: z.string().email().optional().nullable(),
  // Campos extras opcionais (best-effort; ignorados se não existirem no schema)
  data_nascimento: z.string().optional().nullable(),
  sexo: z.enum(['M', 'F', 'O', 'N']).optional().nullable(),
  bi_numero: z.string().optional().nullable(),
  naturalidade: z.string().optional().nullable(),
  provincia: z.string().optional().nullable(),
  responsavel_nome: z.string().optional().nullable(),
  responsavel_contato: z.string().optional().nullable(),
  encarregado_relacao: z.string().optional().nullable(),
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

    const admin = createClient<Database>(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

    // Payload mínimo + extras best-effort
    const insert: any = {
      escola_id: escolaId,
      nome: body.nome,
    }
    // numero_login retornado (se gerado) para envio ao cliente
    let numeroLoginResp: string | null = null

    if (body.email) {
      insert.email = body.email

      // Create auth user first
      const { data: createdUser, error: userErr } = await admin.auth.admin.createUser({
        email: body.email,
        email_confirm: true,
        user_metadata: { nome: body.nome },
      })

      if (userErr) {
        return NextResponse.json(
          { ok: false, error: userErr.message || 'Falha ao criar usuário para o aluno' },
          { status: 400 },
        )
      }

      const newUserId = createdUser?.user?.id
      if (newUserId) {
        insert.profile_id = newUserId

        // Try to generate and persist numero_login for this aluno
        try {
          const numeroLogin = await generateNumeroLogin(escolaId, 'aluno' as any, admin as any)
          numeroLoginResp = numeroLogin

          // Ensure a profile row exists and is updated
          try {
            // Try update first
            const { data: profExists } = await admin
              .from('profiles' as any)
              .select('user_id')
              .eq('user_id', newUserId)
              .maybeSingle()

            if (profExists) {
              await admin
                .from('profiles' as any)
                .update({
                  numero_login: numeroLogin,
                  role: 'aluno' as any,
                  escola_id: escolaId,
                  email: body.email,
                  nome: body.nome,
                } as any)
                .eq('user_id', newUserId)
            } else {
              await admin
                .from('profiles' as any)
                .insert({
                  user_id: newUserId,
                  email: body.email,
                  nome: body.nome,
                  numero_login: numeroLogin,
                  role: 'aluno' as any,
                  escola_id: escolaId,
                } as any)
            }
          } catch {}

          // Also reflect numero_usuario + role/escola in auth app_metadata (best-effort)
          try { await (admin as any).auth.admin.updateUserById(newUserId, { app_metadata: { role: 'aluno', escola_id: escolaId, numero_usuario: numeroLogin } }) } catch {}

          // Link user to escola_usuarios with papel aluno (best-effort)
          try { await admin.from('escola_usuarios' as any).upsert({ escola_id: escolaId, user_id: newUserId, papel: 'aluno' } as any, { onConflict: 'escola_id,user_id' }) } catch {}
        } catch {}
      }
    } else {
      // If no email is provided, we can't create a user, so we can't create a student.
      // This is a temporary workaround until the database schema is updated to allow nullable profile_id.
      return NextResponse.json(
        { ok: false, error: 'O e-mail é obrigatório para criar um novo aluno.' },
        { status: 400 },
      )
    }


    for (const key of [
      'data_nascimento',
      'sexo',
      'bi_numero',
      'naturalidade',
      'provincia',
      'responsavel_nome',
      'responsavel_contato',
      'encarregado_relacao',
    ] as const) {
      if (body[key] != null) {
        insert[key] = body[key] as any
      }
    }

    const { data, error } = await (admin as any)
      .from('alunos')
      .insert([insert] as any)
      .select('id')
      .single()

    if (error) {
      return NextResponse.json(
        { ok: false, error: error.message || 'Falha ao criar aluno' },
        { status: 400 },
      )
    }

    const created = data

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

    return NextResponse.json({ ok: true, id: created.id, numero_login: numeroLoginResp })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return NextResponse.json(
      { ok: false, error: message },
      { status: 500 },
    )
  }
}
