import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createRouteClient } from '@/lib/supabase/route-client'
import { resolveEscolaIdForUser } from '@/lib/tenant/resolveEscolaIdForUser'
import { authorizeTeacherManage } from '@/lib/escola/disciplinas'
import { callAuthAdminJob } from '@/lib/auth-admin-job'
import { recordAuditServer } from '@/lib/audit'

const UUID = z.string().uuid()
const BodySchema = z.object({
  email: z.string().trim().email().max(254).optional(),
  email_atual: z.string().trim().email().max(254).optional(),
  nome_completo: z.string().trim().min(3, 'Informe o nome completo').max(160),
  genero: z.enum(['M', 'F']),
  data_nascimento: z.string().trim().nullable().optional(),
  numero_bi: z.preprocess((value) => value === "" ? null : value, z.string().trim()
    .regex(/^[A-Za-z0-9]{14}$/, 'BI deve ter 14 caracteres alfanuméricos').nullable().optional()),
  telefone_principal: z.string().trim().max(40).nullable().optional(),
  habilitacoes: z.enum(['Ensino Médio', 'Bacharelato', 'Licenciatura', 'Mestrado', 'Doutoramento']),
  area_formacao: z.string().trim().max(200).nullable().optional(),
  vinculo_contratual: z.enum(['Efetivo', 'Colaborador', 'Eventual']),
  carga_horaria_maxima: z.number().int().positive().max(100),
  turnos_disponiveis: z.array(z.enum(['Manhã', 'Tarde', 'Noite'])).max(3).default([]),
  disciplinas_habilitadas: z.array(UUID).max(200).default([]),
  is_diretor_turma: z.boolean().default(false),
}).strict()

export async function POST(req: NextRequest, context: { params: Promise<{ id: string; profileId: string }> }) {
  const { id: escolaId, profileId } = await context.params
  if (!UUID.safeParse(escolaId).success || !UUID.safeParse(profileId).success) {
    return NextResponse.json({ ok: false, error: 'Identificador inválido' }, { status: 400 })
  }

  const parse = BodySchema.safeParse(await req.json().catch(() => null))
  if (!parse.success) {
    return NextResponse.json({ ok: false, error: parse.error.issues[0]?.message || 'Dados inválidos' }, { status: 400 })
  }
  const body = parse.data
  const uniqueSkills = [...new Set(body.disciplinas_habilitadas)]
  try {
    const supabase = await createRouteClient()
    const { data: auth } = await supabase.auth.getUser()
    const actorId = auth?.user?.id
    if (!actorId) return NextResponse.json({ ok: false, error: 'Não autenticado' }, { status: 401 })

    const resolved = await resolveEscolaIdForUser(supabase as any, actorId, escolaId)
    if (resolved !== escolaId) {
      return NextResponse.json({ ok: false, error: 'Sem acesso a esta escola' }, { status: 403 })
    }
    const permission = await authorizeTeacherManage(supabase as any, escolaId, actorId)
    if (!permission.allowed) return NextResponse.json({ ok: false, error: 'Sem permissão para editar professores' }, { status: 403 })

    // Reject missing targets and invalid school skills before the non-transactional
    // Auth email step. The final RPC revalidates all relations under its DB lock.
    const { data: target, error: targetError } = await supabase.from('teachers')
      .select('id').eq('escola_id', escolaId).eq('profile_id', profileId).maybeSingle()
    if (targetError) return NextResponse.json({ ok: false, error: 'Não foi possível validar o professor' }, { status: 500 })
    if (!target) return NextResponse.json({ ok: false, error: 'Professor não encontrado nesta escola' }, { status: 404 })
    if (uniqueSkills.length) {
      const { data: validSkills, error: skillsError } = await supabase.from('disciplinas_catalogo')
        .select('id').eq('escola_id', escolaId).in('id', uniqueSkills)
      if (skillsError) return NextResponse.json({ ok: false, error: 'Não foi possível validar as disciplinas' }, { status: 500 })
      if (validSkills?.length !== uniqueSkills.length) {
        return NextResponse.json({ ok: false, error: 'Uma das disciplinas selecionadas não pertence à escola.' }, { status: 409 })
      }
    }

    // E-mail de acesso pertence ao Auth, não à tabela operacional.
    // Atualizar Auth + espelho do perfil antes da RPC, com compensação em caso de falha.
    const newEmail = body.email?.toLowerCase()
    const previousEmail = body.email_atual?.toLowerCase()
    const needsEmailChange = Boolean(newEmail && newEmail !== previousEmail)
    if (needsEmailChange && !previousEmail) {
      return NextResponse.json({ ok: false, error: 'Recarregue o professor antes de alterar o e-mail.' }, { status: 409 })
    }
    if (needsEmailChange) {
      try {
        await callAuthAdminJob(req, 'updateTeacherEmail', {
          actorId, escolaId, userId: profileId, email: newEmail, expectedEmail: previousEmail,
        })
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Falha ao alterar e-mail'
        const friendly = message.includes('EMAIL_SHARED_IDENTITY')
          ? 'Este professor pertence a mais de uma escola. O e-mail de acesso não pode ser alterado por uma escola isolada.'
          : message.includes('EMAIL_STALE') ? 'O e-mail foi alterado. Atualize a lista e tente novamente.'
          : message.includes('EMAIL_IN_USE') ? 'Este e-mail já pertence a outro utilizador.' : message
        return NextResponse.json({ ok: false, error: friendly, code: message.includes('EMAIL_RECONCILIATION_REQUIRED') ? 'EMAIL_RECONCILIATION_REQUIRED' : undefined }, { status: message.includes('EMAIL_RECONCILIATION_REQUIRED') ? 500 : 409 })
      }
    }

    // A RPC atualiza dados pessoais e competências numa única transação.
    const { error } = await (supabase as any).rpc('update_teacher_details_atomic', {
      p_escola_id: escolaId,
      p_profile_id: profileId,
      p_details: {
        ...body,
        email: undefined,
        email_atual: undefined,
        data_nascimento: body.data_nascimento || null,
        numero_bi: body.numero_bi || null,
        disciplinas_habilitadas: undefined,
      },
      p_skill_ids: uniqueSkills,
    })

    if (error) {
      if (needsEmailChange) {
        try {
          await callAuthAdminJob(req, 'updateTeacherEmail', {
            actorId, escolaId, userId: profileId, email: previousEmail, expectedEmail: newEmail,
          })
        } catch {
          return NextResponse.json({ ok: false, error: 'O e-mail foi alterado, mas os restantes dados não foram guardados. É necessária reconciliação administrativa.', code: 'EMAIL_RECONCILIATION_REQUIRED' }, { status: 500 })
        }
      }
      const msg = String(error.message || '')
      const status = msg.includes('FORBIDDEN') ? 403
        : msg.includes('NOT_FOUND') ? 404
        : error.code === '23505' || msg.includes('INVALID_SKILLS') ? 409 : 400
      return NextResponse.json({
        ok: false,
        error: msg.includes('INVALID_SKILLS')
          ? 'Uma das disciplinas selecionadas já não pertence à escola.'
          : msg,
      }, { status })
    }

    await recordAuditServer({
      escolaId, portal: 'admin_escola', acao: 'PROFESSOR_ATUALIZADO',
      entity: 'teachers', entityId: profileId,
      details: { email_alterado: needsEmailChange, actor_id: actorId },
    })
    return NextResponse.json({ ok: true })
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : 'Erro ao atualizar professor' }, { status: 500 })
  }
}
