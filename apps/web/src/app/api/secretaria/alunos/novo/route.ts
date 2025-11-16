import { NextResponse } from 'next/server'
import { z } from 'zod'
import { supabaseServer } from '@/lib/supabaseServer'
import { createClient } from '@supabase/supabase-js'
import type { Database } from '~types/supabase'
import { generateNumeroLogin } from '@/lib/generateNumeroLogin'
import { recordAuditServer } from '@/lib/audit'
import { buildCredentialsEmail, sendMail } from '@/lib/mailer'

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

    // Resolve escola_id do usuário logado (contexto da Secretaria)
    const s = await supabaseServer()
    const { data: userRes } = await s.auth.getUser()
    const user = userRes?.user
    if (!user) return NextResponse.json({ ok: false, error: 'Não autenticado' }, { status: 401 })

    const { data: prof } = await s
      .from('profiles' as any)
      .select('escola_id')
      .eq('user_id', user.id)
      .maybeSingle()
    const escolaId = (prof as any)?.escola_id as string | undefined
    if (!escolaId) return NextResponse.json({ ok: false, error: 'Escola não vinculada ao perfil' }, { status: 403 })

    // Admin client para criar usuário e ignorar RLS quando necessário
    const admin = createClient<Database>(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
    )

    // Gera senha temporária forte
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

    // 1) Criar usuário no Auth com senha temporária
    const { data: createdUser, error: userErr } = await (admin as any).auth.admin.createUser({
      email: body.email,
      password: tempPassword,
      email_confirm: true,
      user_metadata: { nome: body.nome, role: 'aluno', must_change_password: true },
      app_metadata: { role: 'aluno' },
    })
    if (userErr) {
      return NextResponse.json({ ok: false, error: userErr.message || 'Falha ao criar usuário do aluno' }, { status: 400 })
    }
    const newUserId = createdUser?.user?.id as string | undefined
    if (!newUserId) return NextResponse.json({ ok: false, error: 'Falha ao criar usuário do aluno' }, { status: 400 })

    // 2) Gerar numero_login e persistir no profile
    let numeroLogin: string | null = null
    try {
      numeroLogin = await generateNumeroLogin(escolaId, 'aluno' as any, admin as any)
      // Garante profile e atualiza campos
      const { data: profExists } = await (admin as any)
        .from('profiles')
        .select('user_id')
        .eq('user_id', newUserId)
        .maybeSingle()
      if (profExists) {
        await (admin as any)
          .from('profiles')
          .update({ numero_login: numeroLogin, escola_id: escolaId, email: body.email, nome: body.nome, role: 'aluno' })
          .eq('user_id', newUserId)
      } else {
        await (admin as any)
          .from('profiles')
          .insert({ user_id: newUserId, email: body.email, nome: body.nome, numero_login: numeroLogin, role: 'aluno', escola_id: escolaId } as any)
      }
      // Vincula na escola_usuarios como aluno (best-effort)
      try { await (admin as any).from('escola_usuarios').upsert({ escola_id: escolaId, user_id: newUserId, papel: 'aluno' } as any, { onConflict: 'escola_id,user_id' }) } catch {}
      // Reflete em app_metadata (best-effort)
      try { await (admin as any).auth.admin.updateUserById(newUserId, { app_metadata: { role: 'aluno', escola_id: escolaId, numero_usuario: numeroLogin }, user_metadata: { must_change_password: true } }) } catch {}
    } catch (_) {
      // não-fatal
    }

    // 3) Inserir aluno
    const insert: any = { escola_id: escolaId, profile_id: newUserId, nome: body.nome, email: body.email }
    for (const k of ['data_nascimento','sexo','bi_numero','naturalidade','provincia','responsavel_nome','responsavel_contato','encarregado_relacao'] as const) {
      if (body[k] != null) insert[k] = body[k] as any
    }

    const { data: alunoIns, error: alunoErr } = await (admin as any)
      .from('alunos')
      .insert([insert] as any)
      .select('id')
      .single()
    if (alunoErr) return NextResponse.json({ ok: false, error: alunoErr.message || 'Falha ao criar aluno' }, { status: 400 })

    // Auditoria
    recordAuditServer({ escolaId, portal: 'secretaria', acao: 'ALUNO_CRIADO', entity: 'aluno', entityId: String(alunoIns.id), details: { email: body.email, numero_login: numeroLogin } }).catch(() => null)

    // Envia e-mail de credenciais ao aluno (best-effort)
    try {
      const { data: esc } = await (admin as any).from('escolas').select('nome').eq('id', escolaId).maybeSingle();
      const escolaNome = (esc as any)?.nome ?? null;
      const loginUrl = process.env.NEXT_PUBLIC_BASE_URL ? `${process.env.NEXT_PUBLIC_BASE_URL}/login` : null;
      const mail = buildCredentialsEmail({ nome: body.nome, email: body.email, numero_login: numeroLogin ?? undefined, senha_temp: tempPassword ?? undefined, escolaNome, loginUrl });
      await sendMail({ to: body.email, subject: mail.subject, html: mail.html, text: mail.text });
    } catch (_) {
      // ignora erro de e-mail
    }

    return NextResponse.json({ ok: true, id: alunoIns.id, numero_login: numeroLogin, senha_temp: tempPassword })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ ok: false, error: message }, { status: 500 })
  }
}
