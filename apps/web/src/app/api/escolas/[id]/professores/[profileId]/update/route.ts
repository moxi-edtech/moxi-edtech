import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createRouteClient } from '@/lib/supabase/route-client'
import { resolveEscolaIdForUser } from '@/lib/tenant/resolveEscolaIdForUser'
import { authorizePedagogicalManage } from '@/lib/escola/disciplinas'

const UUID = z.string().uuid()
const BodySchema = z.object({
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
    const permission = await authorizePedagogicalManage(supabase as any, escolaId, actorId)
    if (!permission.allowed) return NextResponse.json({ ok: false, error: 'Sem permissão para editar professores' }, { status: 403 })

    // A RPC atualiza dados pessoais, perfil e competências na mesma transação.
    // Nunca remover competências antes de confirmar as novas.
    const { error } = await (supabase as any).rpc('update_teacher_details_atomic', {
      p_escola_id: escolaId,
      p_profile_id: profileId,
      p_details: {
        ...body,
        data_nascimento: body.data_nascimento || null,
        numero_bi: body.numero_bi || null,
        disciplinas_habilitadas: undefined,
      },
      p_skill_ids: uniqueSkills,
    })

    if (error) {
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

    return NextResponse.json({ ok: true })
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : 'Erro ao atualizar professor' }, { status: 500 })
  }
}
