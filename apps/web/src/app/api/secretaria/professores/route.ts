import { NextResponse } from 'next/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import type { Database } from '~types/supabase'
import { supabaseServerTyped } from '@/lib/supabaseServer'
import { resolveEscolaIdForUser } from '@/lib/tenant/resolveEscolaIdForUser'

export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
  try {
    const s = await supabaseServerTyped<any>()
    const url = new URL(req.url)

    const q = (url.searchParams.get('q') || '').trim()
    const days = (url.searchParams.get('days') || '30').trim()
    const cargo = (url.searchParams.get('cargo') || '').trim()
    const page = Math.max(1, parseInt(url.searchParams.get('page') || '1', 10) || 1)
    const pageSize = Math.min(50, Math.max(1, parseInt(url.searchParams.get('pageSize') || '20', 10) || 20))

    // Resolve usuário e escola alvo (igual outros endpoints da Secretaria)
    const { data: sess } = await s.auth.getUser()
    const user = sess?.user
    if (!user) return NextResponse.json({ ok: false, error: 'Não autenticado' }, { status: 401 })

    const metaEscolaId = (user.app_metadata as { escola_id?: string | null } | null)?.escola_id ?? undefined
    const escolaId = await resolveEscolaIdForUser(
      s as any,
      user.id,
      null,
      metaEscolaId ? String(metaEscolaId) : null
    )

    if (!escolaId) return NextResponse.json({ ok: true, items: [], total: 0 })

    const since = (() => {
      const d = parseInt(days || '30', 10)
      if (!Number.isFinite(d) || d <= 0) return '1970-01-01'
      const dt = new Date()
      dt.setDate(dt.getDate() - d)
      return dt.toISOString()
    })()

    const adminUrl = (process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL ?? '').trim()
    const serviceKey = (process.env.SUPABASE_SERVICE_ROLE_KEY ?? '').trim()
    const admin = adminUrl && serviceKey ? createAdminClient<Database>(adminUrl, serviceKey) : null
    const queryClient = (admin ?? s) as any
    const rlsClient = s as any
    const assignmentClient = (admin ?? rlsClient) as any

    // Mapear cargo (UI) -> papéis do portal
    const cargoToPapels: Record<string, string[]> = {
      '': ['professor', 'admin_escola', 'admin', 'staff_admin', 'secretaria'],
      professor: ['professor'],
      diretor: ['admin_escola', 'admin', 'staff_admin', 'professor'],
      coordenador: ['staff_admin', 'professor'],
      assistente: ['secretaria'],
    }
    const papels = cargoToPapels[cargo as keyof typeof cargoToPapels] ?? ['professor']

    const { data: vinc, error: vincErr } = await queryClient
      .from('escola_users')
      .select('id, user_id, created_at, papel')
      .eq('escola_id', escolaId)
      .in('papel', papels)
      .gte('created_at', since)
    if (vincErr) return NextResponse.json({ ok: false, error: vincErr.message }, { status: 500 })

    const vincList = (vinc || []) as Array<{ id: string; user_id: string; created_at: string; papel: string }>
    const user_ids = vincList.map(v => v.user_id)
    if (user_ids.length === 0) return NextResponse.json({ ok: true, items: [], total: 0 })

    const { data: rows, error: rowsErr } = await queryClient
      .rpc('tenant_profiles_by_ids', { p_user_ids: user_ids })

    if (rowsErr) return NextResponse.json({ ok: false, error: rowsErr.message }, { status: 500 })

    const list = (rows || []) as Array<{
      user_id: string
      nome: string | null
      email: string | null
      telefone: string | null
      numero_login: string | null
      created_at: string | null
      last_login: string | null
    }>

    const profileIds = user_ids
    const teacherByProfile = new Map<string, string>()
    const legacyProfessorByProfile = new Map<string, string>()
    const teacherMetaByProfile = new Map<string, any>()
    const disciplinasByTeacher = new Map<string, { ids: string[]; nomes: string[] }>()
    const atribuicoesByProfile = new Map<
      string,
      Array<{
        turma_id: string
        turma_nome: string | null
        disciplina_nome: string | null
        carga_horaria_semanal: number | null
      }>
    >()
    const cargaRealByProfile = new Map<string, number>()

    if (profileIds.length > 0) {
      const { data: teachersRows } = await rlsClient
        .from('teachers')
        .select('id, profile_id, nome_completo, genero, data_nascimento, numero_bi, carga_horaria_maxima, turnos_disponiveis, telefone_principal, habilitacoes, area_formacao, vinculo_contratual, is_diretor_turma')
        .eq('escola_id', escolaId)
        .in('profile_id', profileIds)

      for (const row of teachersRows || []) {
        if (row?.profile_id && row?.id) {
          teacherByProfile.set(row.profile_id, row.id)
          teacherMetaByProfile.set(row.profile_id, row)
        }
      }

      const { data: legacyRows } = await rlsClient
        .from('professores')
        .select('id, profile_id')
        .eq('escola_id', escolaId)
        .in('profile_id', profileIds)

      for (const row of legacyRows || []) {
        if (row?.profile_id && row?.id) {
          legacyProfessorByProfile.set(row.profile_id, row.id)
        }
      }

      const teacherIds = Array.from(new Set(Array.from(teacherByProfile.values())))
      const assignmentTeacherIds = Array.from(
        new Set([...Array.from(teacherByProfile.values()), ...Array.from(legacyProfessorByProfile.values())])
      ).filter(Boolean) as string[]
      const profileByTeacherId = new Map<string, string>()
      for (const [profileId, teacherId] of teacherByProfile.entries()) {
        if (teacherId) profileByTeacherId.set(teacherId, profileId)
      }
      for (const [profileId, teacherId] of legacyProfessorByProfile.entries()) {
        if (teacherId && !profileByTeacherId.has(teacherId)) profileByTeacherId.set(teacherId, profileId)
      }
      if (teacherIds.length > 0) {
        const { data: skillsRows } = await rlsClient
          .from('teacher_skills')
          .select('teacher_id, disciplina:disciplinas_catalogo(id, nome)')
          .eq('escola_id', escolaId)
          .in('teacher_id', teacherIds)

        for (const row of (skillsRows || []) as any[]) {
          const teacherId = row.teacher_id as string
          const disciplina = (row as any)?.disciplina as { id?: string; nome?: string } | undefined
          if (!teacherId || !disciplina?.id) continue
          const entry = disciplinasByTeacher.get(teacherId) || { ids: [], nomes: [] }
          entry.ids.push(disciplina.id)
          if (disciplina.nome) entry.nomes.push(disciplina.nome)
          disciplinasByTeacher.set(teacherId, entry)
        }
      }

      let atribuicoesRows: Array<{
        profile_id: string
        turma_id: string
        turma_nome: string | null
        disciplina_nome: string | null
        carga_horaria_semanal: number | null
      }> = []

      if (profileIds.length) {
        const { data: assignments, error: assignmentsError } = await rlsClient
          .rpc('get_teacher_assignments_by_profiles', {
            p_escola_id: escolaId,
            p_profile_ids: profileIds,
          })

        if (!assignmentsError && Array.isArray(assignments)) {
          atribuicoesRows = assignments as typeof atribuicoesRows
        }
      }

      for (const row of atribuicoesRows) {
        if (!row?.profile_id) continue
        const profileId = row.profile_id
        const cargaHoraria = row.carga_horaria_semanal ?? null

        const entry = atribuicoesByProfile.get(profileId) || []
        entry.push({
          turma_id: row.turma_id,
          turma_nome: row.turma_nome ?? null,
          disciplina_nome: row.disciplina_nome ?? null,
          carga_horaria_semanal: cargaHoraria,
        })
        atribuicoesByProfile.set(profileId, entry)

        if (typeof cargaHoraria === 'number') {
          const current = cargaRealByProfile.get(profileId) ?? 0
          cargaRealByProfile.set(profileId, current + cargaHoraria)
        }
      }
    }

    const complianceByProfileId = new Map<string, string>()
    const teacherIdsForCompliance = Array.from(
      new Set([...Array.from(teacherByProfile.values()), ...Array.from(legacyProfessorByProfile.values())])
    ).filter(Boolean) as string[]
    let activeTrimestre: number | null = null
    let periodoId: string | null = null
    if (teacherIdsForCompliance.length > 0 || profileIds.length > 0) {
      const { data: anoLetivo } = await queryClient
        .from('anos_letivos')
        .select('id')
        .eq('escola_id', escolaId)
        .eq('ativo', true)
        .maybeSingle()

      const hoje = new Date().toISOString().slice(0, 10)
      const periodosQuery = anoLetivo?.id
        ? await queryClient
            .from('periodos_letivos')
            .select('id, numero, data_inicio, data_fim')
            .eq('escola_id', escolaId)
            .eq('ano_letivo_id', anoLetivo.id)
            .eq('tipo', 'TRIMESTRE')
            .order('numero', { ascending: true })
        : { data: [] as any[] }

      const periodos = (periodosQuery as any).data || []
      const periodoAtivo = periodos.find((p: any) => p.data_inicio <= hoje && p.data_fim >= hoje)
      const periodoFallback = periodos.length ? periodos[periodos.length - 1] : null
      periodoId = periodoAtivo?.id ?? periodoFallback?.id ?? null
      activeTrimestre = periodoAtivo?.numero ?? periodoFallback?.numero ?? null
    }

    if (teacherIdsForCompliance.length > 0 && periodoId) {
      const { data: complianceRows } = await queryClient
        .rpc('get_teacher_compliance_status', {
          p_teacher_ids: teacherIdsForCompliance,
          p_trimestre_id: periodoId,
        })

      const rank: Record<string, number> = { OK: 0, PENDING_MAC: 1, CRITICAL: 2 }
      for (const row of (complianceRows || []) as any[]) {
        if (!row?.teacher_id || !row?.status) continue
        const profileId = profileByTeacherId.get(row.teacher_id)
        if (!profileId) continue
        const current = complianceByProfileId.get(profileId) ?? 'OK'
        const next = row.status as string
        if (rank[next] > rank[current]) complianceByProfileId.set(profileId, next)
      }
    }

    const pendenciasByProfileId = new Map<string, number>()
    if (profileIds.length > 0) {
      const { data: pendenciasRows, error: pendenciasErr } = await rlsClient
        .from('vw_professor_pendencias')
        .select('profile_id, turma_disciplina_id, trimestre, avaliacao_id, total_alunos, pendentes')
        .eq('escola_id', escolaId)
        .in('profile_id', profileIds)

      if (!pendenciasErr && Array.isArray(pendenciasRows)) {
        const groupMap = new Map<
          string,
          {
            profile_id: string
            turma_disciplina_id: string
            trimestre: number | null
            pendenciasCount: number
          }
        >()

        for (const row of pendenciasRows as any[]) {
          const profileId = row.profile_id as string | null
          const turmaDisciplinaId = row.turma_disciplina_id as string | null
          if (!profileId || !turmaDisciplinaId) continue

          const totalAlunos = row.total_alunos ?? 0
          const pendentes = row.pendentes ?? 0
          const hasPending = totalAlunos > 0 && (!row.avaliacao_id || pendentes > 0)

          const trimestre = typeof row.trimestre === 'number' ? row.trimestre : null
          const key = `${profileId}:${turmaDisciplinaId}:${trimestre ?? '-'}`
          const current = groupMap.get(key) ?? {
            profile_id: profileId,
            turma_disciplina_id: turmaDisciplinaId,
            trimestre,
            pendenciasCount: 0,
          }

          if (hasPending) current.pendenciasCount += 1
          groupMap.set(key, current)
        }

        const bestByTurma = new Map<
          string,
          { profile_id: string; turma_disciplina_id: string; pendenciasCount: number; trimestre: number | null }
        >()

        for (const group of groupMap.values()) {
          const key = `${group.profile_id}:${group.turma_disciplina_id}`
          const current = bestByTurma.get(key)
          const isActive = activeTrimestre !== null && group.trimestre === activeTrimestre
          const currentIsActive = activeTrimestre !== null && current?.trimestre === activeTrimestre

          if (!current) {
            bestByTurma.set(key, group)
            continue
          }

          if (isActive && !currentIsActive) {
            bestByTurma.set(key, group)
            continue
          }

          if (isActive && currentIsActive) {
            if (group.pendenciasCount > current.pendenciasCount) {
              bestByTurma.set(key, group)
            }
            continue
          }

          if (!currentIsActive && !isActive) {
            if (group.pendenciasCount > current.pendenciasCount
              || (group.pendenciasCount === current.pendenciasCount
                && (group.trimestre ?? 0) > (current.trimestre ?? 0))
            ) {
              bestByTurma.set(key, group)
            }
          }
        }

        for (const group of bestByTurma.values()) {
          if (group.pendenciasCount <= 0) continue
          const current = pendenciasByProfileId.get(group.profile_id) ?? 0
          pendenciasByProfileId.set(group.profile_id, current + group.pendenciasCount)
        }
      }
    }

    const filtered = q
      ? list.filter((row) => {
          const term = q.toLowerCase()
          return [row.nome, row.email, row.telefone]
            .filter(Boolean)
            .some((value) => String(value).toLowerCase().includes(term))
        })
      : list

    filtered.sort((a, b) => {
      const aDate = a.created_at ? Date.parse(a.created_at) : 0
      const bDate = b.created_at ? Date.parse(b.created_at) : 0
      if (aDate !== bDate) return bDate - aDate
      return String(b.user_id).localeCompare(String(a.user_id))
    })

    const from = (page - 1) * pageSize
    const paged = filtered.slice(from, from + pageSize)

    const vincMap = new Map(vincList.map(v => [v.user_id, v]))
    const mapPapelToCargo = (p: string | undefined): string => {
      switch (p) {
        case 'professor': return 'professor'
        case 'secretaria': return 'assistente'
        case 'staff_admin': return 'coordenador'
        case 'admin':
        case 'admin_escola':
          return 'diretor'
        default:
          return 'professor'
      }
    }
    const items = paged.map((p: any) => {
      const vincData = vincMap.get(p.user_id)
      const teacherId = teacherByProfile.get(p.user_id)
      const disciplinasEntry = teacherId ? disciplinasByTeacher.get(teacherId) : undefined
      const meta = teacherMetaByProfile.get(p.user_id)
      const atribuicoes = atribuicoesByProfile.get(p.user_id) || []
      const complianceStatus = complianceByProfileId.get(p.user_id) ?? 'OK'
      const pendenciasTotal = pendenciasByProfileId.get(p.user_id) ?? 0
      return {
        id: vincData?.id,
        user_id: p.user_id,
        nome: p.nome,
        email: p.email,
        telefone: p.telefone,
        cargo: mapPapelToCargo(vincData?.papel),
        created_at: vincData?.created_at || new Date().toISOString(),
        last_login: p.last_login ?? null,
        disciplinas: disciplinasEntry?.nomes || [],
        disciplinas_ids: disciplinasEntry?.ids || [],
        teacher_id: meta?.id ?? null,
        nome_completo: meta?.nome_completo ?? null,
        genero: meta?.genero ?? null,
        data_nascimento: meta?.data_nascimento ?? null,
        numero_bi: meta?.numero_bi ?? null,
        carga_horaria_maxima: meta?.carga_horaria_maxima ?? null,
        turnos_disponiveis: meta?.turnos_disponiveis ?? [],
        telefone_principal: meta?.telefone_principal ?? null,
        habilitacoes: meta?.habilitacoes ?? null,
        area_formacao: meta?.area_formacao ?? null,
        vinculo_contratual: meta?.vinculo_contratual ?? null,
        is_diretor_turma: meta?.is_diretor_turma ?? false,
        atribuicoes,
        carga_horaria_real: cargaRealByProfile.get(p.user_id) ?? null,
        compliance_status: complianceStatus,
        pendencias_total: pendenciasTotal,
        profiles: { numero_login: p.numero_login }
      }
    })
    const total = filtered.length
    return NextResponse.json({ ok: true, items, total })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ ok: false, error: msg }, { status: 500 })
  }
}
