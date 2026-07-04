import { NextResponse } from 'next/server'
import { z } from 'zod'
import { requireRoleInSchool } from '@/lib/authz'
import { supabaseServer } from '@/lib/supabaseServer'
import { recordAuditServer } from '@/lib/audit'
import { buildPlanLimitError, checkAlunoPlanLimit } from '@/lib/plan/limits'
import { resolveEscolaIdForUser } from '@/lib/tenant/resolveEscolaIdForUser'
import type { Json } from '~types/supabase'

const BodySchema = z.object({
  nome: z.string().trim().min(1, 'Informe o nome'),
  primeiro_nome: z.string().trim().optional().nullable().transform(v => v === "" ? null : v),
  sobrenome: z.string().trim().optional().nullable().transform(v => v === "" ? null : v),
  email: z.string().trim().email('Email inválido').optional().nullable().or(z.literal("")).transform(v => v === "" ? null : v),
  telefone: z.string().trim().optional().nullable().transform(v => v === "" ? null : v),
  endereco: z.string().trim().optional().nullable().transform(v => v === "" ? null : v),
  data_nascimento: z.string().optional().nullable().transform(v => v === "" ? null : v),
  sexo: z.enum(['M', 'F', 'O', 'N']).optional().nullable().or(z.literal("")).transform(v => v === "" ? null : v),
  bi_numero: z.string().optional().nullable().transform(v => v === "" ? null : v),
  nif: z.string().optional().nullable().transform(v => v === "" ? null : v),
  naturalidade: z.string().optional().nullable().transform(v => v === "" ? null : v),
  provincia: z.string().optional().nullable().transform(v => v === "" ? null : v),
  responsavel_nome: z.string().optional().nullable().transform(v => v === "" ? null : v),
  responsavel_contato: z.string().trim().optional().nullable().transform(v => v === "" ? null : v),
  encarregado_relacao: z.string().optional().nullable().transform(v => v === "" ? null : v),
  encarregado_email: z.string().trim().email('Email do encarregado inválido').optional().nullable().or(z.literal("")).transform(v => v === "" ? null : v),
  curso_id: z.string().uuid({ message: 'Curso obrigatório' }),
  classe_id: z.string().uuid().optional().nullable().transform(v => v === "" ? null : v),
  ano_letivo: z.coerce.number().int().optional(),
  turno: z.string().trim().optional().nullable().transform(v => v === "" ? null : v),
  turma_preferencial_id: z.string().uuid().optional().nullable().transform(v => v === "" ? null : v),
  pagamento_metodo: z.string().trim().optional().nullable().transform(v => v === "" ? null : v),
  pagamento_referencia: z.string().trim().optional().nullable().transform(v => v === "" ? null : v),
  pagamento_comprovativo_url: z.string().trim().url('URL do comprovativo inválida').optional().nullable().or(z.literal("")).transform(v => v === "" ? null : v),
})

// Removi o segundo argumento 'context' pois a rota não tem [id]
export async function POST(req: Request) {
  let escolaId: string | null = null

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
    escolaId = await resolveEscolaIdForUser(s as any, user.id)

    if (!escolaId) {
      return NextResponse.json({ ok: false, error: 'Usuário não vinculado a nenhuma escola.' }, { status: 403 })
    }
    const authz = await requireRoleInSchool({
      supabase: s as any,
      escolaId,
      roles: ['secretaria', 'secretaria_financeiro', 'admin_financeiro', 'admin', 'admin_escola', 'staff_admin'],
    })
    if (authz.error) return authz.error

    const limitCheck = await checkAlunoPlanLimit(s, escolaId, 1)
    if (!limitCheck.ok) {
      await s.from('notifications').insert({
        escola_id: escolaId,
        target_role: 'super_admin',
        tipo: 'plan_limit_alunos',
        titulo: 'Limite de alunos atingido',
        mensagem: `A escola atingiu o limite de alunos (${limitCheck.current}/${limitCheck.max}).`,
        link_acao: `/super-admin/escolas/${escolaId}`,
      })

      recordAuditServer({
        escolaId,
        portal: 'secretaria',
        acao: 'PLAN_LIMIT_ALUNOS',
        entity: 'alunos',
        details: limitCheck,
      }).catch(() => null)

      const { data: escolaInfo } = await s
        .from('escolas')
        .select('slug')
        .eq('id', escolaId)
        .maybeSingle()
      const escolaParam = escolaInfo?.slug ? String(escolaInfo.slug) : escolaId
      return NextResponse.json(buildPlanLimitError(escolaParam, limitCheck), { status: 403 })
    }
    
    let turmaRow: { ano_letivo: number | string | null; curso_id: string | null; classe_id: string | null } | null = null
    if (body.turma_preferencial_id) {
      const { data: turmaData, error: turmaErr } = await s
        .from('turmas')
        .select('ano_letivo, curso_id, classe_id')
        .eq('id', body.turma_preferencial_id)
        .eq('escola_id', escolaId)
        .maybeSingle()

      if (turmaErr) throw turmaErr
      if (!turmaData) {
        return NextResponse.json({ ok: false, error: 'Turma preferencial inválida para esta escola.' }, { status: 400 })
      }
      if (turmaData.curso_id && turmaData.curso_id !== body.curso_id) {
        return NextResponse.json({ ok: false, error: 'Turma preferencial pertence a outro curso.' }, { status: 400 })
      }
      if (body.classe_id && turmaData.classe_id && turmaData.classe_id !== body.classe_id) {
        return NextResponse.json({ ok: false, error: 'Turma preferencial pertence a outra classe.' }, { status: 400 })
      }
      turmaRow = turmaData
    }

    const { data: activeAno } = await s
      .from('anos_letivos')
      .select('ano')
      .eq('escola_id', escolaId)
      .eq('ativo', true)
      .maybeSingle()

    const turmaAnoLetivo = Number(turmaRow?.ano_letivo)
    const activeAnoLetivo = Number(activeAno?.ano)
    const nomeCompleto = `${body.primeiro_nome || ''} ${body.sobrenome || ''}`.replace(/\s+/g, ' ').trim() || body.nome.trim()
    const anoLetivo = Number.isFinite(turmaAnoLetivo)
      ? turmaAnoLetivo
      : Number.isFinite(activeAnoLetivo)
      ? activeAnoLetivo
      : body.ano_letivo ?? new Date().getFullYear()
    const classeId = body.classe_id ?? turmaRow?.classe_id ?? null

    const userMetadata = user.user_metadata as Record<string, unknown>
    const registradoPorEmail =
      user.email ?? (typeof userMetadata.email === 'string' ? userMetadata.email : null)
    const registradoPorNome =
      (typeof userMetadata.nome === 'string' ? userMetadata.nome : null) ?? user.email ?? null

    const dadosCandidato: Record<string, Json> = {
      nome: nomeCompleto,
      nome_completo: nomeCompleto,
      primeiro_nome: body.primeiro_nome ?? null,
      sobrenome: body.sobrenome ?? null,
      email: body.email ?? null,
      telefone: body.telefone ?? null,
      endereco: body.endereco ?? null,
      data_nascimento: body.data_nascimento ?? null,
      sexo: body.sexo ?? null,
      bi_numero: body.bi_numero ?? null,
      nif: body.nif ?? body.bi_numero ?? null,
      responsavel_nome: body.responsavel_nome ?? null,
      responsavel_contato: body.responsavel_contato ?? null,
      encarregado_email: body.encarregado_email ?? null,
      curso_id: body.curso_id,
      classe_id: classeId,
      ano_letivo: anoLetivo,
      turno: body.turno ?? null,
      turma_preferencial_id: body.turma_preferencial_id ?? null,
      origem_portal: 'secretaria',
      registrado_por_user_id: user.id,
      registrado_por_email: registradoPorEmail,
      registrado_por_nome: registradoPorNome,
      pagamento: {
        metodo: body.pagamento_metodo ?? null,
        referencia: body.pagamento_referencia ?? null,
        comprovativo_url: body.pagamento_comprovativo_url ?? null,
      },
    }

    const { data: candidatura, error: candErr } = await s
      .from('candidaturas')
      .insert({
        escola_id: escolaId,
        aluno_id: null,
        curso_id: body.curso_id,
        ano_letivo: anoLetivo,
        status: 'pendente',
        turma_preferencial_id: body.turma_preferencial_id ?? null,
        dados_candidato: dadosCandidato,
        nome_candidato: nomeCompleto,
        classe_id: classeId,
        turno: body.turno ?? null,
        protocolo_publico: `SEC-${crypto.randomUUID().replace(/-/g, '').slice(0, 12).toUpperCase()}`,
      })
      .select('id')
      .single()

    if (candErr) {
      throw new Error(`Erro ao salvar candidatura: ${candErr.message}`)
    }

    recordAuditServer({
      escolaId,
      portal: 'secretaria',
      acao: 'CANDIDATURA_CRIADA',
      entity: 'candidaturas',
      entityId: String(candidatura?.id),
      details: { email: body.email, nome: nomeCompleto, registrado_por: user.id, portal: 'secretaria' },
    }).catch(() => null)

    return NextResponse.json({ ok: true, candidatura_id: candidatura?.id }, { status: 200 })

  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ ok: false, error: message }, { status: 500 })
  }
}
