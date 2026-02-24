import { NextResponse } from 'next/server'
import { z } from 'zod'
import { supabaseServer } from '@/lib/supabaseServer'
import { hasPermission } from '@/lib/permissions'
import { recordAuditServer } from '@/lib/audit'
import { callAuthAdminJob } from '@/lib/auth-admin-job'

const BodySchema = z.object({
  nome: z.string().trim().min(1, 'Informe o nome'),
  email: z.string().email().optional().nullable(),
  // Campos extras
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
      return NextResponse.json({ ok: false, error: 'Não autenticado' }, { status: 401 })
    }

    // 1. Verificação de Permissões
    const { data: vinc } = await s
      .from('escola_users')
      .select('papel')
      .eq('user_id', user.id)
      .eq('escola_id', escolaId)
      .limit(1)
    const papel = (vinc?.[0] as any)?.papel || null

    if (!hasPermission(papel as any, 'criar_matricula')) {
      return NextResponse.json({ ok: false, error: 'Sem permissão' }, { status: 403 })
    }

    const { data: profCheck } = await s
      .from('profiles' as any)
      .select('escola_id')
      .eq('user_id', user.id)
      .maybeSingle()

    if (!profCheck || (profCheck as any).escola_id !== escolaId) {
      return NextResponse.json({ ok: false, error: 'Perfil não vinculado à escola' }, { status: 403 })
    }

    const admin = await supabaseServer()

    // 2. Preparação do Payload
    const insertPayload: any = {
      escola_id: escolaId,
      nome: body.nome,
      deleted_at: null, // GARANTE REATIVAÇÃO se for soft-deleted
    }

    // 3. Lógica de Auth Idempotente
    let targetUserId: string | undefined

    if (body.email) {
      insertPayload.email = body.email

      // Tenta criar usuário
      let createdUser: any = null
      try {
        createdUser = await callAuthAdminJob(req, 'createUser', {
          email: body.email,
          email_confirm: true,
          user_metadata: { nome: body.nome },
          app_metadata: { role: 'aluno', escola_id: escolaId },
        })
      } catch {
        createdUser = null
      }

      if (!(createdUser as any)?.user?.id) {
        // SE o erro for "usuário já existe", nós recuperamos ele em vez de falhar
        // Isso permite recadastrar alunos antigos
        const existing = await callAuthAdminJob(req, 'findUserByEmail', { email: body.email })
        const existingId = (existing as any)?.user?.id as string | undefined
        if (existingId) {
          targetUserId = existingId
        } else {
          return NextResponse.json({ ok: false, error: 'Email já registrado mas usuário não encontrado.' }, { status: 400 })
        }
      } else {
        targetUserId = (createdUser as any)?.user?.id
      }

      // Se temos um User ID (novo ou existente), vinculamos
      if (targetUserId) {
        insertPayload.profile_id = targetUserId

        // Upsert Profile (Garante que dados estão atuais)
        const profilePayload: any = {
          user_id: targetUserId,
          email: body.email,
          nome: body.nome,
          role: 'aluno',
          escola_id: escolaId,
          current_escola_id: escolaId,
        }
        await admin.from('profiles' as any).upsert(profilePayload, { onConflict: 'user_id' })

        // Upsert Vínculo Escola
        await admin
          .from('escola_users' as any)
          .upsert(
            { escola_id: escolaId, user_id: targetUserId, papel: 'aluno' } as any,
            { onConflict: 'escola_id,user_id' }
          )
      }
    } else {
      return NextResponse.json({ ok: false, error: 'E-mail obrigatório.' }, { status: 400 })
    }

    // Preencher campos opcionais
    for (const key of ['data_nascimento','sexo','bi_numero','naturalidade','provincia','responsavel_nome','responsavel_contato','encarregado_relacao'] as const) {
      if (body[key] != null) insertPayload[key] = body[key]
    }

    // 4. A CORREÇÃO PRINCIPAL: UPSERT NO ALUNO
    // Substituímos .insert() por .upsert()
    const { data: alunoData, error: alunoErr } = await (admin as any)
      .from('alunos')
      .upsert(insertPayload, { 
        onConflict: 'profile_id, escola_id', // A constraint que estava falhando
        ignoreDuplicates: false // False = Faz UPDATE se existir
      })
      .select('id')
      .single()

    if (alunoErr) {
      return NextResponse.json(
        { ok: false, error: alunoErr.message || 'Falha ao criar/atualizar aluno' },
        { status: 400 },
      )
    }

    const created = alunoData

    // 5. Auditoria
    recordAuditServer({
      escolaId,
      portal: 'secretaria',
      acao: 'ALUNO_CRIADO_OU_ATUALIZADO',
      entity: 'aluno',
      entityId: String(created.id),
      details: { nome: body.nome, email: body.email },
    }).catch(() => null)

    return NextResponse.json({
      ok: true,
      id: created.id,
      numero_login: null, // Será gerado na matrícula
    })

  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ ok: false, error: message }, { status: 500 })
  }
}
