import { NextResponse } from 'next/server'
import { z } from 'zod'
import { supabaseServer } from '@/lib/supabaseServer'
import { createClient } from '@supabase/supabase-js'
import type { Database } from '~types/supabase'
import { recordAuditServer } from '@/lib/audit'

const BodySchema = z.object({
  nome: z.string().trim().min(1, 'Informe o nome'),
  email: z.string().email('Email inválido'),
  telefone: z.string().trim().optional().nullable(),
  data_nascimento: z.string().optional().nullable(),
  sexo: z.enum(['M', 'F', 'O', 'N']).optional().nullable(),
  bi_numero: z.string().optional().nullable(),
  naturalidade: z.string().optional().nullable(),
  provincia: z.string().optional().nullable(),
  responsavel_nome: z.string().optional().nullable(),
  responsavel_contato: z.string().optional().nullable(),
  encarregado_relacao: z.string().optional().nullable(),
})

// Removi o segundo argumento 'context' pois a rota não tem [id]
export async function POST(req: Request) {
  // Variável para rastrear se criamos um usuário novo (para rollback)
  let userCreatedNow = false
  let targetUserId: string | null = null
  let escolaId: string | null = null
  
  // Cliente Admin (Service Role)
  const admin = createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  try {
    const bodyRaw = await req.json()
    const parsed = BodySchema.safeParse(bodyRaw)
    if (!parsed.success) {
      return NextResponse.json({ ok: false, error: parsed.error.issues[0]?.message || 'Dados inválidos' }, { status: 400 })
    }
    const body = parsed.data

    // 1. Validar Sessão e Descobrir Escola
    const s = await supabaseServer()
    const { data: userRes } = await s.auth.getUser()
    const user = userRes?.user
    
    if (!user) return NextResponse.json({ ok: false, error: 'Não autenticado' }, { status: 401 })
    
    // --- CORREÇÃO: Buscar escolaId do perfil do usuário logado ---
    const { data: prof } = await s
      .from('profiles' as any)
      .select('escola_id, current_escola_id')
      .eq('user_id', user.id)
      .maybeSingle()

    // Tenta pegar current_escola_id (se tiver troca de contexto) ou escola_id fixo
    escolaId = (prof as any)?.current_escola_id || (prof as any)?.escola_id

    // Fallback: Checar tabela de vínculos
    if (!escolaId) {
       const { data: vinc } = await s
         .from('escola_users')
         .select('escola_id')
         .eq('user_id', user.id)
         .limit(1)
         .maybeSingle()
       escolaId = vinc?.escola_id || null
    }

    if (!escolaId) {
      return NextResponse.json({ ok: false, error: 'Usuário não vinculado a nenhuma escola.' }, { status: 403 })
    }
    
    // 2. Lógica de Auth IDEMPOTENTE
    const tempPassword = Math.random().toString(36).slice(-12) + "A1!"
    
    const { data: createdUser, error: authErr } = await admin.auth.admin.createUser({
      email: body.email,
      password: tempPassword,
      email_confirm: true,
      user_metadata: { nome: body.nome, role: 'aluno' },
      app_metadata: { role: 'aluno', escola_id: escolaId }
    })

    if (authErr) {
      // Se o email já existe, recuperamos o usuário.
      if (authErr.message?.includes('registered') || authErr.status === 422) {
        const { data: list } = await admin.auth.admin.listUsers()
        const existing = list.users.find(u => u.email?.toLowerCase() === body.email.toLowerCase())
        
        if (!existing) {
           return NextResponse.json({ ok: false, error: 'Email já registrado, mas usuário não encontrado.' }, { status: 409 })
        }
        targetUserId = existing.id
        userCreatedNow = false 
      } else {
        return NextResponse.json({ ok: false, error: authErr.message }, { status: 400 })
      }
    } else {
      targetUserId = createdUser.user.id
      userCreatedNow = true
    }

    if (!targetUserId) throw new Error("Falha ao definir ID do usuário")

    // 3. Atualizar Profile e Vínculos (UPSERT)
    const profileData = {
      user_id: targetUserId,
      email: body.email,
      telefone: body.telefone ?? null,
      nome: body.nome,
      role: 'aluno',
      escola_id: escolaId,
      data_nascimento: body.data_nascimento ?? null,
      sexo: body.sexo ?? null,
      bi_numero: body.bi_numero ?? null,
      naturalidade: body.naturalidade ?? null,
      provincia: body.provincia ?? null,
      encarregado_relacao: body.encarregado_relacao ?? null,
    }

    const { error: profErr } = await admin.from('profiles').upsert(profileData as any, { onConflict: 'user_id' })
    if (profErr) throw new Error(`Erro no perfil: ${profErr.message}`)

    const { error: linkErr } = await admin.from('escola_users').upsert(
      { escola_id: escolaId, user_id: targetUserId, papel: 'aluno' } as any,
      { onConflict: 'escola_id,user_id' }
    )
    if (linkErr) throw new Error(`Erro no vínculo: ${linkErr.message}`)

    // 4. TABELA ALUNOS (UPSERT + REATIVAÇÃO)
    const alunoInsert = {
      profile_id: targetUserId,
      escola_id: escolaId,
      nome: body.nome,
      email: body.email,
      telefone: body.telefone ?? null,
      bi_numero: body.bi_numero ?? null,
      responsavel: body.responsavel_nome ?? null,
      responsavel_contato: body.responsavel_contato ?? null,
      telefone_responsavel: body.responsavel_contato ?? null,
      status: 'pendente', // Definir status inicial como 'pendente'
      deleted_at: null, // Reativa soft-deleted
    }

    const { data: aluno, error: alunoErr } = await admin
      .from('alunos')
      .upsert(alunoInsert as any, { 
        onConflict: 'profile_id, escola_id', 
        ignoreDuplicates: false 
      })
      .select('id')
      .single()

    if (alunoErr) {
      throw new Error(`Erro ao salvar aluno: ${alunoErr.message}`)
    }

    // 5. Auditoria
    recordAuditServer({
      escolaId,
      portal: 'secretaria',
      acao: userCreatedNow ? 'ALUNO_CRIADO' : 'ALUNO_REATIVADO',
      entity: 'aluno',
      entityId: String(aluno.id),
      details: { email: body.email },
    }).catch(() => null)

    return NextResponse.json({ ok: true, id: aluno.id }, { status: 200 })

  } catch (err) {
    // Rollback apenas se criamos o usuário agora
    if (userCreatedNow && targetUserId) {
      await admin.auth.admin.deleteUser(targetUserId).catch(() => null)
    }

    const message = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ ok: false, error: message }, { status: 500 })
  }
}
