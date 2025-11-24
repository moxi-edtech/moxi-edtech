import { NextResponse } from 'next/server'
import { z } from 'zod'
import { supabaseServer } from '@/lib/supabaseServer'
import { createClient } from '@supabase/supabase-js'
import type { Database } from '~types/supabase'
import { recordAuditServer } from '@/lib/audit'
import { buildCredentialsEmail, sendMail } from '@/lib/mailer' // vamos desligar o uso aqui

const BodySchema = z.object({
  nome: z.string().trim().min(1, 'Informe o nome'),
  email: z.string().email('Email inválido'),
  data_nascimento: z.string().optional().nullable(),
  sexo: z.enum(['M', 'F', 'O', 'N']).optional().nullable(),
  bi_numero: z.string().optional().nullable(),
  naturalidade: z.string().optional().nullable(),
  provincia: z.string().optional().nullable(),
  responsavel_nome: z.string().optional().nullable(),
  responsavel_contato: z.string().optional().nullable(),
  encarregado_relacao: z.string().optional().nullable(),
})

export async function POST(req: Request) {
  try {
    const bodyRaw = await req.json()
    const parsed = BodySchema.safeParse(bodyRaw)
    if (!parsed.success) {
      return NextResponse.json(
        { ok: false, error: parsed.error.issues[0]?.message || 'Dados inválidos' },
        { status: 400 },
      )
    }
    const body = parsed.data

    // 1) escola_id do usuário logado (secretaria/admin/...)
    const s = await supabaseServer()
    const { data: userRes } = await s.auth.getUser()
    const user = userRes?.user
    if (!user) {
      return NextResponse.json({ ok: false, error: 'Não autenticado' }, { status: 401 })
    }

    const { data: prof } = await s
      .from('profiles' as any)
      .select('escola_id')
      .eq('user_id', user.id)
      .maybeSingle()

    const escolaId = (prof as any)?.escola_id as string | undefined
    if (!escolaId) {
      return NextResponse.json(
        { ok: false, error: 'Escola não vinculada ao perfil' },
        { status: 403 },
      )
    }

    // 2) Admin client (service_role) pra ignorar RLS onde precisar
    const admin = createClient<Database>(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
    )

    // 3) Cria usuário no Auth com senha temporária (ainda não mandamos as credenciais)
    const generateStrongPassword = (len = 12) => {
      const upper = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'
      const lower = 'abcdefghijklmnopqrstuvwxyz'
      const nums = '0123456789'
      const special = '!@#$%^&*()-_=+[]{};:,.?'
      const all = upper + lower + nums + special
      const pick = (set: string) => set[Math.floor(Math.random() * set.length)]
      let pwd = pick(upper) + pick(lower) + pick(nums) + pick(special)
      for (let i = pwd.length; i < len; i++) pwd += pick(all)
      return pwd.split('').sort(() => Math.random() - 0.5).join('')
    }
    const tempPassword = generateStrongPassword(12)

    const { data: createdUser, error: userErr } = await (admin as any).auth.admin.createUser({
      email: body.email,
      password: tempPassword,
      email_confirm: true,
      user_metadata: { nome: body.nome, role: 'aluno', must_change_password: true },
      app_metadata: { role: 'aluno' },
    })

    if (userErr) {
      return NextResponse.json(
        { ok: false, error: userErr.message || 'Falha ao criar usuário do aluno' },
        { status: 400 },
      )
    }

    const newUserId = createdUser?.user?.id as string | undefined
    if (!newUserId) {
      return NextResponse.json(
        { ok: false, error: 'Falha ao criar usuário do aluno' },
        { status: 400 },
      )
    }

    // 4) Criar/atualizar PROFILE (sem numero_login)
    const { data: profExists, error: profExistsErr } = await (admin as any)
      .from('profiles')
      .select('user_id')
      .eq('user_id', newUserId)
      .maybeSingle()

    if (profExistsErr) {
      return NextResponse.json(
        { ok: false, error: profExistsErr.message || 'Falha ao verificar perfil do aluno' },
        { status: 500 },
      )
    }

    const profileData: Database['public']['Tables']['profiles']['Insert'] = {
      user_id: newUserId,
      email: body.email,
      nome: body.nome,
      role: 'aluno',
      escola_id: escolaId,
      data_nascimento: body.data_nascimento ?? null,
      sexo: body.sexo ?? null,
      bi_numero: body.bi_numero ?? null,
      naturalidade: body.naturalidade ?? null,
      provincia: body.provincia ?? null,
      encarregado_relacao: body.encarregado_relacao ?? null,
      // numero_login fica NULL aqui – só vai ser preenchido na matrícula
    }

    let upsertProfileErr: any = null
    if (profExists) {
      const { error } = await (admin as any)
        .from('profiles')
        .update(profileData)
        .eq('user_id', newUserId)
      upsertProfileErr = error
    } else {
      const { error } = await (admin as any)
        .from('profiles')
        .insert(profileData as any)
      upsertProfileErr = error
    }

    if (upsertProfileErr) {
      return NextResponse.json(
        {
          ok: false,
          error:
            upsertProfileErr.message ||
            'Falha ao salvar perfil do aluno (profiles). Cadastro abortado.',
        },
        { status: 400 },
      )
    }

    // 4.1) sanity check
    const { data: profCheck, error: profCheckErr } = await (admin as any)
      .from('profiles')
      .select('user_id')
      .eq('user_id', newUserId)
      .maybeSingle()

    if (profCheckErr || !profCheck) {
      return NextResponse.json(
        {
          ok: false,
          error:
            'Perfil do aluno não encontrado após criação. Cadastro abortado para evitar dados órfãos.',
        },
        { status: 500 },
      )
    }

    // 5) Vínculos "best effort": escola_usuarios, app_metadata
    try {
      await (admin as any)
        .from('escola_usuarios')
        .upsert(
          { escola_id: escolaId, user_id: newUserId, papel: 'aluno' } as any,
          { onConflict: 'escola_id,user_id' },
        )

      // aqui não colocamos numero_usuario ainda
      await (admin as any).auth.admin.updateUserById(newUserId, {
        app_metadata: { role: 'aluno', escola_id: escolaId },
        user_metadata: { must_change_password: true },
      })
    } catch {
      // ignora – não impede cadastro
    }

    // 6) Inserir ALUNO (apenas vínculo + responsável)
    const insert: Database['public']['Tables']['alunos']['Insert'] = {
      profile_id: newUserId,
      nome: body.nome,
      escola_id: escolaId,
      responsavel: body.responsavel_nome ?? null,
      telefone_responsavel: body.responsavel_contato ?? null,
    }

    const { data: alunoIns, error: alunoErr } = await (admin as any)
      .from('alunos')
      .insert([insert] as any)
      .select('id')
      .single()

    if (alunoErr) {
      return NextResponse.json(
        { ok: false, error: alunoErr.message || 'Falha ao criar aluno' },
        { status: 400 },
      )
    }

    // 7) Auditoria — sem numero_login ainda
    recordAuditServer({
      escolaId,
      portal: 'secretaria',
      acao: 'ALUNO_CRIADO',
      entity: 'aluno',
      entityId: String(alunoIns.id),
      details: { email: body.email },
    }).catch(() => null)

    // 8) Não enviar e-mail de credenciais aqui.
    // Esse envio vai ser responsabilidade da rota de MATRÍCULA.

    return NextResponse.json(
      {
        ok: true,
        id: alunoIns.id,
        // numero_login: null,
        // senha_temp: tempPassword, // se quiser até esconder isso desse fluxo
      },
      { status: 201 },
    )
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ ok: false, error: message }, { status: 500 })
  }
}
