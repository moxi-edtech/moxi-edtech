import { NextResponse } from 'next/server'
import { z } from 'zod'
import { supabaseServerTyped } from '@/lib/supabaseServer'
import type { Database } from '~types/supabase'
import { recordAuditServer } from '@/lib/audit'
import { resolveEscolaIdForUser } from '@/lib/tenant/resolveEscolaIdForUser'
import { applyKf2ListInvariants } from '@/lib/kf2'

const UpdateSchema = z.object({
  nome: z.string().trim().min(1, 'Informe o nome').optional(),
  email: z.string().email('Email inválido').nullable().or(z.string().length(0)).optional(),
  telefone: z.string().trim().nullable().optional(),
  data_nascimento: z.string().nullable().optional(),
  sexo: z.enum(['M','F','O','N']).nullable().optional(),
  bi_numero: z.string().trim().nullable().optional(),
  tipo_documento: z.string().trim().nullable().optional(),
  numero_documento: z.string().trim().nullable().optional(),
  naturalidade: z.string().trim().nullable().optional(),
  provincia: z.string().trim().nullable().optional(),
  pai_nome: z.string().trim().nullable().optional(),
  mae_nome: z.string().trim().nullable().optional(),
  nif: z.string().trim().nullable().optional(),
  endereco: z.string().trim().nullable().optional(),
  encarregado_relacao: z.string().trim().nullable().optional(),
  encarregado_email: z.string().trim().email().nullable().or(z.string().length(0)).optional(),
  responsavel: z.string().trim().nullable().optional(),
  telefone_responsavel: z.string().trim().nullable().optional(),
  responsavel_financeiro_nome: z.string().trim().nullable().optional(),
  responsavel_financeiro_nif: z.string().trim().nullable().optional(),
  mesmo_que_encarregado: z.boolean().nullable().optional(),
  status: z.enum(['ativo', 'inativo', 'suspenso', 'pendente', 'trancado', 'concluido', 'transferido', 'desistente']).optional(),
  documentos: z.record(z.unknown()).nullable().optional(),
  campos_extras: z.record(z.unknown()).nullable().optional(),
})

// GET aluno details (alunos + profiles)
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const alunoId = id
    const s = await supabaseServerTyped<any>()
    const { data: userRes } = await s.auth.getUser()
    const user = userRes?.user
    if (!user) return NextResponse.json({ ok: false, error: 'Não autenticado' }, { status: 401 })

    // perfil do requester para escopo da escola
    const { data: prof } = await s
      .from('profiles')
      .select('role, escola_id, current_escola_id')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    const role = (prof as any)?.role as string | undefined
    let escolaFromProfile = (prof as any)?.current_escola_id || (prof as any)?.escola_id || null
    if (!escolaFromProfile) {
      escolaFromProfile = await resolveEscolaIdForUser(s as any, user.id)
    }
    const allowedRoles = ['super_admin','global_admin','admin','secretaria','financeiro','secretaria_financeiro','admin_financeiro']
    if (!role || !allowedRoles.includes(role)) return NextResponse.json({ ok: false, error: 'Sem permissão' }, { status: 403 })
    if (!escolaFromProfile) return NextResponse.json({ ok: false, error: 'Perfil não está vinculado a uma escola' }, { status: 403 })

    let alunoQuery = s
      .from('alunos')
      .select('id, nome, email, telefone, data_nascimento, sexo, bi_numero, tipo_documento, numero_documento, naturalidade, provincia, pai_nome, mae_nome, nif, endereco, responsavel, responsavel_nome, responsavel_contato, encarregado_nome, encarregado_telefone, encarregado_email, encarregado_relacao, telefone_responsavel, responsavel_financeiro_nome, responsavel_financeiro_nif, mesmo_que_encarregado, documentos, campos_extras, status, created_at, profile_id, escola_id, profiles:profiles!alunos_profile_id_fkey(user_id, email_real, email_auth, nome, telefone, data_nascimento, sexo, bi_numero, naturalidade, provincia, nif, encarregado_relacao, numero_processo_login)')
      .eq('id', alunoId)
      .order('created_at', { ascending: false })
      .limit(1)

    alunoQuery = applyKf2ListInvariants(alunoQuery, { defaultLimit: 1 })

    const { data: aluno, error } = await alunoQuery.maybeSingle()

    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 400 })
    if (!aluno) return NextResponse.json({ ok: false, error: 'Aluno não encontrado' }, { status: 404 })

    let alunoEscolaId = (aluno as any).escola_id
    if (String(alunoEscolaId) !== String(escolaFromProfile)) {
      const { data: vincMatricula, error: vincErr } = await s
        .from('matriculas')
      .select('id')
      .eq('aluno_id', alunoId)
      .eq('escola_id', escolaFromProfile)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

      if (vincErr) return NextResponse.json({ ok: false, error: vincErr.message }, { status: 400 })
      if (!vincMatricula) {
        return NextResponse.json({ ok: false, error: 'Aluno não pertence à escola ativa do usuário' }, { status: 403 })
      }
      alunoEscolaId = escolaFromProfile
    }

    const profObj = Array.isArray((aluno as any).profiles) ? (aluno as any).profiles[0] : (aluno as any).profiles
    const { data: matricula } = await s
      .from('matriculas')
      .select('id, turma_id, created_at, status, turmas ( nome, cursos ( nome ) )')
      .eq('aluno_id', alunoId)
      .eq('escola_id', alunoEscolaId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    const { data: candidatura } = await s
      .from('candidaturas')
      .select('nome_candidato, dados_candidato, created_at')
      .eq('aluno_id', alunoId)
      .eq('escola_id', alunoEscolaId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    const turma = Array.isArray((matricula as any)?.turmas) ? (matricula as any)?.turmas?.[0] : (matricula as any)?.turmas
    const curso = Array.isArray((turma as any)?.cursos) ? (turma as any)?.cursos?.[0] : (turma as any)?.cursos
    const dadosCandidato = (candidatura as any)?.dados_candidato ?? {}
    const profileEmail = profObj?.email ?? profObj?.email_real ?? profObj?.email_auth ?? null
    const responsavelNome =
      (aluno as any).responsavel || (aluno as any).responsavel_nome || (aluno as any).encarregado_nome || null
    const responsavelTelefone =
      (aluno as any).telefone_responsavel ||
      (aluno as any).responsavel_contato ||
      (aluno as any).encarregado_telefone ||
      null

    return NextResponse.json({
      ok: true,
      item: {
        id: (aluno as any).id,
        nome: (aluno as any).nome ?? profObj?.nome ?? (candidatura as any)?.nome_candidato ?? null,
        responsavel: responsavelNome ?? dadosCandidato?.responsavel_nome ?? null,
        telefone_responsavel: responsavelTelefone ?? dadosCandidato?.responsavel_contato ?? null,
        status: (aluno as any).status,
        profile_id: (aluno as any).profile_id,
        escola_id: alunoEscolaId,
        email: (aluno as any).email ?? profileEmail ?? dadosCandidato?.email ?? null,
        numero_processo_login: profObj?.numero_processo_login ?? null,
        telefone: (aluno as any).telefone ?? profObj?.telefone ?? dadosCandidato?.telefone ?? null,
        data_nascimento: (aluno as any).data_nascimento ?? profObj?.data_nascimento ?? dadosCandidato?.data_nascimento ?? null,
        sexo: (aluno as any).sexo ?? profObj?.sexo ?? dadosCandidato?.sexo ?? null,
        bi_numero: (aluno as any).bi_numero ?? profObj?.bi_numero ?? dadosCandidato?.bi_numero ?? null,
        tipo_documento: (aluno as any).tipo_documento ?? dadosCandidato?.tipo_documento ?? null,
        numero_documento: (aluno as any).numero_documento ?? dadosCandidato?.numero_documento ?? dadosCandidato?.bi_numero ?? (aluno as any).bi_numero ?? null,
        naturalidade: (aluno as any).naturalidade ?? profObj?.naturalidade ?? dadosCandidato?.naturalidade ?? null,
        provincia: (aluno as any).provincia ?? profObj?.provincia ?? dadosCandidato?.provincia ?? null,
        pai_nome: (aluno as any).pai_nome ?? dadosCandidato?.pai_nome ?? null,
        mae_nome: (aluno as any).mae_nome ?? dadosCandidato?.mae_nome ?? null,
        nif: (aluno as any).nif ?? profObj?.nif ?? dadosCandidato?.nif ?? null,
        endereco: (aluno as any).endereco ?? dadosCandidato?.endereco ?? null,
        encarregado_email: (aluno as any).encarregado_email ?? dadosCandidato?.encarregado_email ?? null,
        encarregado_relacao: (aluno as any).encarregado_relacao ?? profObj?.encarregado_relacao ?? dadosCandidato?.encarregado_relacao ?? null,
        responsavel_financeiro_nome: (aluno as any).responsavel_financeiro_nome ?? dadosCandidato?.responsavel_financeiro_nome ?? null,
        responsavel_financeiro_nif: (aluno as any).responsavel_financeiro_nif ?? dadosCandidato?.responsavel_financeiro_nif ?? null,
        mesmo_que_encarregado: (aluno as any).mesmo_que_encarregado ?? dadosCandidato?.mesmo_que_encarregado ?? null,
        documentos: (aluno as any).documentos ?? dadosCandidato?.documentos ?? {},
        campos_extras: (aluno as any).campos_extras ?? dadosCandidato?.campos_extras ?? {},
        turma_id: (matricula as any)?.turma_id ?? null,
        turma_nome: (turma as any)?.nome ?? null,
        turma_curso: (curso as any)?.nome ?? null,
      }
    })
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ ok: false, error: message }, { status: 500 })
  }
}

// PATCH aluno (alunos + profiles)
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const alunoId = id
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
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    const role = (prof as any)?.role as string | undefined
    const escolaFromProfile = (prof as any)?.current_escola_id || (prof as any)?.escola_id || null
    const allowedRoles = ['super_admin','global_admin','admin','secretaria','financeiro','secretaria_financeiro','admin_financeiro']
    if (!role || !allowedRoles.includes(role)) return NextResponse.json({ ok: false, error: 'Sem permissão' }, { status: 403 })
    if (!escolaFromProfile) return NextResponse.json({ ok: false, error: 'Perfil não está vinculado a uma escola' }, { status: 403 })

    // fetch aluno to get profile_id/escola_id
    let alunoQuery = s
      .from('alunos')
      .select('id, escola_id, profile_id, nome')
      .eq('id', alunoId)
      .order('created_at', { ascending: false })
      .limit(1)

    alunoQuery = applyKf2ListInvariants(alunoQuery, { defaultLimit: 1 })

    const { data: aluno, error: alunoErr } = await alunoQuery.maybeSingle()

    if (alunoErr) return NextResponse.json({ ok: false, error: alunoErr.message }, { status: 400 })
    if (!aluno) return NextResponse.json({ ok: false, error: 'Aluno não encontrado' }, { status: 404 })
    if (String((aluno as any).escola_id) !== String(escolaFromProfile)) {
      return NextResponse.json({ ok: false, error: 'Aluno não pertence à escola ativa do usuário' }, { status: 403 })
    }

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
      if (body.nif !== undefined) (toUpdateProfile as any).nif = body.nif
      if (body.encarregado_relacao !== undefined) toUpdateProfile.encarregado_relacao = body.encarregado_relacao

      if (Object.keys(toUpdateProfile).length > 0) {
        const { error: pErr } = await s.from('profiles').update(toUpdateProfile).eq('user_id', profileId)
        if (pErr) return NextResponse.json({ ok: false, error: pErr.message }, { status: 400 })
      }
    }

    // Update alunos
    const toUpdateAluno: Record<string, unknown> = {}
    if (body.nome !== undefined) toUpdateAluno.nome = body.nome
    if (body.email !== undefined) toUpdateAluno.email = body.email
    if (body.telefone !== undefined) toUpdateAluno.telefone = body.telefone
    if (body.data_nascimento !== undefined) toUpdateAluno.data_nascimento = body.data_nascimento
    if (body.sexo !== undefined) toUpdateAluno.sexo = body.sexo
    if (body.bi_numero !== undefined) toUpdateAluno.bi_numero = body.bi_numero
    if (body.tipo_documento !== undefined) toUpdateAluno.tipo_documento = body.tipo_documento
    if (body.numero_documento !== undefined) toUpdateAluno.numero_documento = body.numero_documento
    if (body.naturalidade !== undefined) toUpdateAluno.naturalidade = body.naturalidade
    if (body.provincia !== undefined) toUpdateAluno.provincia = body.provincia
    if (body.pai_nome !== undefined) toUpdateAluno.pai_nome = body.pai_nome
    if (body.mae_nome !== undefined) toUpdateAluno.mae_nome = body.mae_nome
    if (body.nif !== undefined) toUpdateAluno.nif = body.nif
    if (body.endereco !== undefined) toUpdateAluno.endereco = body.endereco
    if (body.encarregado_email !== undefined) toUpdateAluno.encarregado_email = body.encarregado_email
    if (body.encarregado_relacao !== undefined) toUpdateAluno.encarregado_relacao = body.encarregado_relacao
    if (body.responsavel !== undefined) toUpdateAluno.responsavel = body.responsavel
    if (body.responsavel !== undefined) toUpdateAluno.responsavel_nome = body.responsavel
    if (body.responsavel !== undefined) toUpdateAluno.encarregado_nome = body.responsavel
    if (body.telefone_responsavel !== undefined) toUpdateAluno.telefone_responsavel = body.telefone_responsavel
    if (body.telefone_responsavel !== undefined) toUpdateAluno.responsavel_contato = body.telefone_responsavel
    if (body.telefone_responsavel !== undefined) toUpdateAluno.encarregado_telefone = body.telefone_responsavel
    if (body.responsavel_financeiro_nome !== undefined) toUpdateAluno.responsavel_financeiro_nome = body.responsavel_financeiro_nome
    if (body.responsavel_financeiro_nif !== undefined) toUpdateAluno.responsavel_financeiro_nif = body.responsavel_financeiro_nif
    if (body.mesmo_que_encarregado !== undefined) toUpdateAluno.mesmo_que_encarregado = body.mesmo_que_encarregado
    if (body.status !== undefined) toUpdateAluno.status = body.status
    if (body.documentos !== undefined) toUpdateAluno.documentos = body.documentos ?? {}
    if (body.campos_extras !== undefined) toUpdateAluno.campos_extras = body.campos_extras ?? {}

    if (Object.keys(toUpdateAluno).length > 0) {
      const { error: aErr } = await s.from('alunos').update(toUpdateAluno).eq('id', alunoId)
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
