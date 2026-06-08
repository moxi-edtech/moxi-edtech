// apps/web/src/app/api/secretaria/admissoes/config/route.ts
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { z } from 'zod'

import { requireRoleInSchool } from '@/lib/authz';
import { applyKf2ListInvariants } from '@/lib/kf2';
import { resolveEscolaIdForUser } from '@/lib/tenant/resolveEscolaIdForUser'
import {
  DEFAULT_DOCUMENTOS_ADMISSAO,
  getAnoLetivoAdmissoesFromConfig,
  getDocumentosAdmissaoCatalogoFromConfig,
  getPendenciaSlaHorasFromConfig,
  getReservaExpiracaoHorasFromConfig,
  normalizeAnoLetivoAdmissoes,
  normalizePendenciaSlaHoras,
  normalizeReservaExpiracaoHoras,
} from '@/lib/admissoes/reserva'
import { formatAnoLetivoDisplay } from '@/utils/formatters'
import type { Json } from '~types/supabase'

const searchParamsSchema = z.object({
  escolaId: z.string().uuid(),
})

const patchPayloadSchema = z.object({
  escolaId: z.string().uuid(),
  reserva_expiracao_horas: z.number().int().min(1).max(168).optional(),
  pendencia_sla_horas: z.number().int().min(1).max(720).optional(),
  ano_letivo_admissoes: z.number().int().min(2000).max(2100).nullable().optional(),
  documentos_admissao_catalogo: z.array(z.object({
    id: z.string().trim().min(1).max(120).regex(/^[a-z0-9_-]+$/),
    label: z.string().trim().min(2).max(120),
  })).min(1).max(30).optional(),
})

type JsonObject = { [key: string]: Json | undefined }

function isJsonObject(value: Json | null | undefined): value is JsonObject {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const validation = searchParamsSchema.safeParse(Object.fromEntries(searchParams))

  if (!validation.success) {
    return NextResponse.json({ error: validation.error.format() }, { status: 400 })
  }

  const { escolaId } = validation.data
  const supabase = await createClient()

  const { data: userRes } = await supabase.auth.getUser()
  const user = userRes?.user
  if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const resolvedEscolaId = await resolveEscolaIdForUser(supabase, user.id, escolaId)
  if (!resolvedEscolaId || resolvedEscolaId !== escolaId) {
    return NextResponse.json({ error: 'Sem vínculo com a escola' }, { status: 403 })
  }

  const { error: authError } = await requireRoleInSchool({ 
    supabase, 
    escolaId, 
    roles: ['secretaria', 'diretor', 'admin', 'admin_escola', 'staff_admin'] 
  });
  if (authError) return authError;

  try {
    const cursosQuery = applyKf2ListInvariants(
      supabase.from('cursos').select('id, nome').eq('escola_id', escolaId),
      { defaultLimit: 50, order: [{ column: 'nome', ascending: true }] }
    )
    const classesQuery = applyKf2ListInvariants(
      supabase.from('classes').select('id, nome, curso_id').eq('escola_id', escolaId),
      { defaultLimit: 50, order: [{ column: 'nome', ascending: true }] }
    )
    const escolaQuery = supabase
      .from('escolas')
      .select('config_portal_admissao')
      .eq('id', escolaId)
      .maybeSingle()
    const anosLetivosQuery = supabase
      .from('anos_letivos')
      .select('id, ano, ativo, data_inicio, data_fim')
      .eq('escola_id', escolaId)
      .order('ano', { ascending: false })

    const [cursos, classes, escola, anosLetivos] = await Promise.all([cursosQuery, classesQuery, escolaQuery, anosLetivosQuery])
    const anos = (Array.isArray(anosLetivos.data) ? anosLetivos.data : []).map((ano) => ({
      ...ano,
      label: formatAnoLetivoDisplay(ano),
    }))
    const latestAno = typeof anos[0]?.ano === 'number' ? anos[0].ano : null
    const anoLetivoAdmissoes = getAnoLetivoAdmissoesFromConfig(escola.data?.config_portal_admissao, latestAno)

    return NextResponse.json({
      cursos: cursos.data,
      classes: classes.data,
      anos_letivos: anos,
      admissoes: {
        ano_letivo_admissoes: anoLetivoAdmissoes,
        ano_letivo_admissoes_label: formatAnoLetivoDisplay(anoLetivoAdmissoes),
        reserva_expiracao_horas: getReservaExpiracaoHorasFromConfig(escola.data?.config_portal_admissao),
        pendencia_sla_horas: getPendenciaSlaHorasFromConfig(escola.data?.config_portal_admissao),
        documentos_admissao_catalogo: getDocumentosAdmissaoCatalogoFromConfig(escola.data?.config_portal_admissao),
      },
    })
  } catch (error) {
    console.error('Error fetching admission config:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}

export async function PATCH(request: Request) {
  const supabase = await createClient()
  const body = await request.json().catch(() => null)
  const validation = patchPayloadSchema.safeParse(body)

  if (!validation.success) {
    return NextResponse.json({ error: validation.error.format() }, { status: 400 })
  }

  const { escolaId, reserva_expiracao_horas, pendencia_sla_horas, ano_letivo_admissoes, documentos_admissao_catalogo } = validation.data

  const { data: userRes } = await supabase.auth.getUser()
  const user = userRes?.user
  if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const resolvedEscolaId = await resolveEscolaIdForUser(supabase, user.id, escolaId)
  if (!resolvedEscolaId || resolvedEscolaId !== escolaId) {
    return NextResponse.json({ error: 'Sem vínculo com a escola' }, { status: 403 })
  }

  const { error: authError } = await requireRoleInSchool({
    supabase,
    escolaId,
    roles: ['diretor', 'admin', 'admin_escola', 'staff_admin'],
  })
  if (authError) return authError

  try {
    const { data: escola, error: fetchError } = await supabase
      .from('escolas')
      .select('config_portal_admissao')
      .eq('id', escolaId)
      .maybeSingle()

    if (fetchError) throw fetchError
    if (!escola) return NextResponse.json({ error: 'Escola não encontrada' }, { status: 404 })

    const currentConfig = isJsonObject(escola.config_portal_admissao) ? escola.config_portal_admissao : {}
    const nextConfig: JsonObject = {
      ...currentConfig,
      ...(reserva_expiracao_horas !== undefined
        ? { reserva_expiracao_horas: normalizeReservaExpiracaoHoras(reserva_expiracao_horas) }
        : {}),
      ...(pendencia_sla_horas !== undefined
        ? { pendencia_sla_horas: normalizePendenciaSlaHoras(pendencia_sla_horas) }
        : {}),
      ...(ano_letivo_admissoes !== undefined
        ? { ano_letivo_admissoes: normalizeAnoLetivoAdmissoes(ano_letivo_admissoes) as unknown as Json }
        : {}),
      ...(documentos_admissao_catalogo !== undefined
        ? { documentos_admissao_catalogo }
        : {}),
    }

    if (nextConfig.documentos_admissao_catalogo === undefined) {
      nextConfig.documentos_admissao_catalogo = [...DEFAULT_DOCUMENTOS_ADMISSAO] as unknown as Json
    }

    const { error: updateError } = await supabase
      .from('escolas')
      .update({ config_portal_admissao: nextConfig })
      .eq('id', escolaId)

    if (updateError) throw updateError

    return NextResponse.json({
      ok: true,
      admissoes: {
        ano_letivo_admissoes: getAnoLetivoAdmissoesFromConfig(nextConfig),
        ano_letivo_admissoes_label: formatAnoLetivoDisplay(getAnoLetivoAdmissoesFromConfig(nextConfig)),
        reserva_expiracao_horas: getReservaExpiracaoHorasFromConfig(nextConfig),
        pendencia_sla_horas: getPendenciaSlaHorasFromConfig(nextConfig),
        documentos_admissao_catalogo: getDocumentosAdmissaoCatalogoFromConfig(nextConfig),
      },
    })
  } catch (error) {
    console.error('Error updating admission config:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
