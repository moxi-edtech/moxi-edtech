import { NextResponse } from 'next/server'
import { z } from 'zod'
import { supabaseServerTyped } from '@/lib/supabaseServer'
import { resolveEscolaIdForUser } from '@/lib/tenant/resolveEscolaIdForUser'
import { applyKf2ListInvariants } from '@/lib/kf2'
import { recordAuditServer } from '@/lib/audit'
import type { Database } from '~types/supabase'

export const dynamic = 'force-dynamic'
export const revalidate = 0

// Only personal contact fields are self-service. Employment, identity and
// academic assignments are owned by school management and remain read-only.
const UpdateSchema = z.object({
  telefone_principal: z.string().trim().max(40).nullable(),
  bio: z.string().trim().max(1000).nullable(),
  naturalidade: z.string().trim().max(120).nullable(),
  provincia: z.string().trim().max(120).nullable(),
}).strict()

export async function GET(req: Request) {
  try {
    const supabase = await supabaseServerTyped<Database>()
    const { data: userRes } = await supabase.auth.getUser()
    const user = userRes?.user
    if (!user) return NextResponse.json({ ok: false, error: 'Não autenticado' }, { status: 401 })

    const requestedEscolaId = new URL(req.url).searchParams.get('escola_id')
    const escolaId = await resolveEscolaIdForUser(supabase, user.id, requestedEscolaId)
    if (!escolaId) return NextResponse.json({ ok: false, error: 'Escola não encontrada' }, { status: 403 })

    const { data: personalRow, error: personalError } = await supabase
      .from('profiles')
      .select('bio, naturalidade, provincia, email')
      .eq('user_id', user.id)
      .is('deleted_at', null)
      .maybeSingle()
    if (personalError || !personalRow) {
      return NextResponse.json({ ok: false, error: 'Perfil pessoal indisponível' }, { status: 500 })
    }

    const { data: teacherRow, error: teacherError } = await supabase
      .from('teachers')
      .select('id, nome_completo, genero, data_nascimento, numero_bi, telefone_principal, carga_horaria_maxima, turnos_disponiveis, habilitacoes, area_formacao, vinculo_contratual, is_diretor_turma')
      .eq('escola_id', escolaId)
      .eq('profile_id', user.id)
      .maybeSingle()

    if (teacherError) {
      return NextResponse.json({ ok: false, error: 'Falha ao carregar professor' }, { status: 500 })
    }
    if (!teacherRow?.id) {
      return NextResponse.json({ ok: false, error: 'Professor não encontrado' }, { status: 404 })
    }

    const { data: skillsRows } = await supabase
      .from('teacher_skills')
      .select('disciplina_id')
      .eq('escola_id', escolaId)
      .eq('teacher_id', teacherRow.id)

    let disciplinasCatalogoQuery = supabase
      .from('disciplinas_catalogo')
      .select('id, nome')
      .eq('escola_id', escolaId)

    disciplinasCatalogoQuery = applyKf2ListInvariants(disciplinasCatalogoQuery, {
      defaultLimit: 50,
      order: [{ column: 'nome', ascending: true }],
    })

    const { data: disciplinasCatalogo } = await disciplinasCatalogoQuery

    return NextResponse.json({
      ok: true,
      profile: {
        ...teacherRow,
        email: user.email ?? personalRow.email ?? null,
        bio: personalRow.bio ?? null,
        naturalidade: personalRow.naturalidade ?? null,
        provincia: personalRow.provincia ?? null,
        disciplinas_habilitadas: (skillsRows || []).map((row: { disciplina_id: string }) => row.disciplina_id),
      },
      disciplinas: disciplinasCatalogo || [],
    })
  } catch (err) {
    return NextResponse.json({ ok: false, error: err instanceof Error ? err.message : String(err) }, { status: 500 })
  }
}

export async function POST(req: Request) {
  try {
    const supabase = await supabaseServerTyped<Database>()
    const { data: userRes } = await supabase.auth.getUser()
    const user = userRes?.user
    if (!user) return NextResponse.json({ ok: false, error: 'Não autenticado' }, { status: 401 })

    const requestedEscolaId = new URL(req.url).searchParams.get('escola_id')
    const escolaId = await resolveEscolaIdForUser(supabase, user.id, requestedEscolaId)
    if (!escolaId) return NextResponse.json({ ok: false, error: 'Escola não encontrada' }, { status: 403 })

    const parsed = UpdateSchema.safeParse(await req.json().catch(() => null))
    if (!parsed.success) {
      return NextResponse.json({ ok: false, error: parsed.error.issues[0]?.message || 'Dados inválidos' }, { status: 400 })
    }

    // SECURITY DEFINER RPC independently verifies auth.uid(), teacher and school.
    // Both profiles and teachers are updated atomically; arbitrary JSON keys are rejected.
    const { error: updateError } = await (supabase as any).rpc('update_teacher_self_contact_atomic', {
      p_escola_id: escolaId,
      p_contact: parsed.data,
    })
    if (updateError) {
      const message = String(updateError.message || '')
      const forbidden = message.includes('TEACHER_SELF_FORBIDDEN')
      return NextResponse.json({
        ok: false,
        error: forbidden ? 'Sem permissão para alterar este perfil' : 'Não foi possível guardar os dados pessoais',
      }, { status: forbidden ? 403 : 400 })
    }

    // Read back the persisted values, never announce success from a fire-and-forget write.
    const [{ data: teacher, error: teacherError }, { data: personal, error: personalError }] = await Promise.all([
      supabase.from('teachers').select('telefone_principal').eq('escola_id', escolaId).eq('profile_id', user.id).maybeSingle(),
      supabase.from('profiles').select('bio, naturalidade, provincia').eq('user_id', user.id).maybeSingle(),
    ])
    if (teacherError || personalError || !teacher || !personal) {
      return NextResponse.json({ ok: false, error: 'Dados guardados, mas a confirmação de leitura falhou', code: 'READBACK_FAILED' }, { status: 503 })
    }
    await recordAuditServer({
      escolaId, portal: 'professor', acao: 'PROFESSOR_CONTACTO_ATUALIZADO',
      entity: 'teachers', entityId: user.id,
      details: { campos: ['telefone_principal', 'bio', 'naturalidade', 'provincia'] },
    })
    return NextResponse.json({ ok: true, profile: { ...teacher, ...personal } })
  } catch {
    return NextResponse.json({ ok: false, error: 'Falha ao atualizar perfil' }, { status: 500 })
  }
}
