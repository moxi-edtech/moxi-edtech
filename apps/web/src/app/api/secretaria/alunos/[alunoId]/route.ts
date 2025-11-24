import { NextResponse } from 'next/server'
import { z } from 'zod'
import { supabaseServerTyped } from '@/lib/supabaseServer'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import type { Database } from '~types/supabase'
import { recordAuditServer } from '@/lib/audit'

const UpdateSchema = z.object({
  nome: z.string().trim().min(1, 'Informe o nome').optional(),
  email: z.string().email('Email inválido').optional(),
  telefone: z.string().trim().optional(),
  data_nascimento: z.string().nullable().optional(),
  sexo: z.enum(['M','F','O','N']).nullable().optional(),
  bi_numero: z.string().trim().nullable().optional(),
  naturalidade: z.string().trim().nullable().optional(),
  provincia: z.string().trim().nullable().optional(),
  encarregado_relacao: z.string().trim().nullable().optional(),
  responsavel: z.string().trim().nullable().optional(),
  telefone_responsavel: z.string().trim().nullable().optional(),
})

// GET aluno details (alunos + profiles)
export async function GET(_req: Request, { params }: { params: Promise<{ alunoId: string }> }) {
  try {
    const { alunoId } = await params
    const s = await supabaseServerTyped<any>()
    const { data: userRes } = await s.auth.getUser()
    const user = userRes?.user
    if (!user) return NextResponse.json({ ok: false, error: 'Não autenticado' }, { status: 401 })

    // perfil do requester para escopo da escola
    const { data: prof } = await s
      .from('profiles')
      .select('role, escola_id, current_escola_id')
      .eq('user_id', user.id)
      .maybeSingle()

    const role = (prof as any)?.role as string | undefined
    const escolaFromProfile = (prof as any)?.current_escola_id || (prof as any)?.escola_id || null
    const allowedRoles = ['super_admin','global_admin','admin','secretaria','financeiro']
    if (!role || !allowedRoles.includes(role)) return NextResponse.json({ ok: false, error: 'Sem permissão' }, { status: 403 })
    if (!escolaFromProfile) return NextResponse.json({ ok: false, error: 'Perfil não está vinculado a uma escola' }, { status: 403 })

    const { data: aluno, error } = await s
      .from('alunos')
      .select('id, nome, responsavel, telefone_responsavel, status, created_at, profile_id, escola_id, profiles!alunos_profile_id_fkey(user_id, email, nome, telefone, data_nascimento, sexo, bi_numero, naturalidade, provincia, encarregado_relacao, numero_login)')
      .eq('id', alunoId)
      .maybeSingle()

    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 400 })
    if (!aluno) return NextResponse.json({ ok: false, error: 'Aluno não encontrado' }, { status: 404 })

    if (String((aluno as any).escola_id) !== String(escolaFromProfile)) {
      return NextResponse.json({ ok: false, error: 'Aluno não pertence à escola ativa do usuário' }, { status: 403 })
    }

    const profObj = Array.isArray((aluno as any).profiles) ? (aluno as any).profiles[0] : (aluno as any).profiles
    return NextResponse.json({
      ok: true,
      item: {
        id: (aluno as any).id,
        nome: (aluno as any).nome,
        responsavel: (aluno as any).responsavel,
        telefone_responsavel: (aluno as any).telefone_responsavel,
        status: (aluno as any).status,
        profile_id: (aluno as any).profile_id,
        escola_id: (aluno as any).escola_id,
        email: profObj?.email ?? null,
        numero_login: profObj?.numero_login ?? null,
        telefone: profObj?.telefone ?? null,
        data_nascimento: profObj?.data_nascimento ?? null,
        sexo: profObj?.sexo ?? null,
        bi_numero: profObj?.bi_numero ?? null,
        naturalidade: profObj?.naturalidade ?? null,
        provincia: profObj?.provincia ?? null,
        encarregado_relacao: profObj?.encarregado_relacao ?? null,
      }
    })
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ ok: false, error: message }, { status: 500 })
  }
}

// PATCH aluno (alunos + profiles)
export async function PATCH(req: Request, { params }: { params: Promise<{ alunoId: string }> }) {
  try {
    const { alunoId } = await params
    const json = await req.json().catch(() => ({}))
    const parsed = UpdateSchema.safeParse(json)
    if (!parsed.success) {
      return NextResponse.json({ ok: false, error: parsed.error.issues?.[0]?.message || 'Dados inválidos' }, { status: 400 })
    }
    const body = parsed.data

    // requester + escopo
    const s = await supabaseServerTyped<any>()
    const { data: userRes } = await s.auth.getUser()
    const user = userRes?.user
    if (!user) return NextResponse.json({ ok: false, error: 'Não autenticado' }, { status: 401 })
    const { data: prof } = await s
      .from('profiles')
      .select('role, escola_id, current_escola_id')
      .eq('user_id', user.id)
      .maybeSingle()

    const role = (prof as any)?.role as string | undefined
    const escolaFromProfile = (prof as any)?.current_escola_id || (prof as any)?.escola_id || null
    const allowedRoles = ['super_admin','global_admin','admin','secretaria','financeiro']
    if (!role || !allowedRoles.includes(role)) return NextResponse.json({ ok: false, error: 'Sem permissão' }, { status: 403 })
    if (!escolaFromProfile) return NextResponse.json({ ok: false, error: 'Perfil não está vinculado a uma escola' }, { status: 403 })

    // fetch aluno to get profile_id/escola_id
    const { data: aluno, error: alunoErr } = await s
      .from('alunos')
      .select('id, escola_id, profile_id, nome')
      .eq('id', alunoId)
      .maybeSingle()

    if (alunoErr) return NextResponse.json({ ok: false, error: alunoErr.message }, { status: 400 })
    if (!aluno) return NextResponse.json({ ok: false, error: 'Aluno não encontrado' }, { status: 404 })
    if (String((aluno as any).escola_id) !== String(escolaFromProfile)) {
      return NextResponse.json({ ok: false, error: 'Aluno não pertence à escola ativa do usuário' }, { status: 403 })
    }

    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
      return NextResponse.json({ ok: false, error: 'Server misconfigured: falta SUPABASE_SERVICE_ROLE_KEY' }, { status: 500 })
    }

    const admin = createAdminClient<Database>(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)

    const profileId = (aluno as any).profile_id as string | null
    // Update profiles
    if (profileId) {
      const toUpdateProfile: Database['public']['Tables']['profiles']['Update'] = {}
      if (body.nome !== undefined) toUpdateProfile.nome = body.nome
      if (body.email !== undefined) toUpdateProfile.email = body.email
      if (body.telefone !== undefined) toUpdateProfile.telefone = body.telefone
      if (body.data_nascimento !== undefined) toUpdateProfile.data_nascimento = body.data_nascimento
      if (body.sexo !== undefined) toUpdateProfile.sexo = body.sexo as any
      if (body.bi_numero !== undefined) toUpdateProfile.bi_numero = body.bi_numero
      if (body.naturalidade !== undefined) toUpdateProfile.naturalidade = body.naturalidade
      if (body.provincia !== undefined) toUpdateProfile.provincia = body.provincia
      if (body.encarregado_relacao !== undefined) toUpdateProfile.encarregado_relacao = body.encarregado_relacao

      if (Object.keys(toUpdateProfile).length > 0) {
        const { error: pErr } = await admin.from('profiles').update(toUpdateProfile).eq('user_id', profileId)
        if (pErr) return NextResponse.json({ ok: false, error: pErr.message }, { status: 400 })
      }
    }

    // Update alunos
    const toUpdateAluno: Database['public']['Tables']['alunos']['Update'] = {}
    if (body.nome !== undefined) toUpdateAluno.nome = body.nome
    if (body.responsavel !== undefined) toUpdateAluno.responsavel = body.responsavel
    if (body.telefone_responsavel !== undefined) toUpdateAluno.telefone_responsavel = body.telefone_responsavel

    if (Object.keys(toUpdateAluno).length > 0) {
      const { error: aErr } = await admin.from('alunos').update(toUpdateAluno).eq('id', alunoId)
      if (aErr) return NextResponse.json({ ok: false, error: aErr.message }, { status: 400 })
    }

    // Auditoria
    try {
      await recordAuditServer({
        escolaId: (aluno as any).escola_id,
        portal: 'secretaria',
        acao: 'ALUNO_ATUALIZADO',
        entity: 'aluno',
        entityId: String(alunoId),
        details: { performed_by: user.id, role }
      })
    } catch {}

    return NextResponse.json({ ok: true })
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ ok: false, error: message }, { status: 500 })
  }
}
