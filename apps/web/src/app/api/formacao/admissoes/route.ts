import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { resolveEscolaIdForUser } from '@/lib/tenant/resolveEscolaIdForUser'

export const dynamic = 'force-dynamic'

const viaABodySchema = z.object({
  via: z.literal('balcao'),
  nome: z.string().min(3),
  bi_numero: z.string().min(5),
  email: z.string().email(),
  telefone: z.string().min(6),
  curso_id: z.string().uuid().optional(),
  turma_id: z.string().uuid().optional(),
  ano_letivo: z.number().int().min(2000).max(2200).optional(),
  enforce_capacidade: z.boolean().optional().default(true),
})

const viaBFormandoSchema = z.object({
  nome: z.string().min(3),
  bi_numero: z.string().min(5),
  email: z.string().email(),
  telefone: z.string().min(6),
})

const viaBBodySchema = z.object({
  via: z.literal('b2b_upload'),
  empresa_nome: z.string().min(2),
  empresa_nif: z.string().min(5).optional(),
  curso_id: z.string().uuid().optional(),
  turma_id: z.string().uuid().optional(),
  ano_letivo: z.number().int().min(2000).max(2200).optional(),
  formandos: z.array(viaBFormandoSchema).min(1).max(200),
})

const viaCBodySchema = z.object({
  via: z.literal('self_service'),
  nome: z.string().min(3),
  bi_numero: z.string().min(5),
  email: z.string().email(),
  telefone: z.string().min(6),
  curso_id: z.string().uuid().optional(),
  turma_id: z.string().uuid().optional(),
  landing_slug: z.string().min(3),
})

const bodySchema = z.discriminatedUnion('via', [viaABodySchema, viaBBodySchema, viaCBodySchema])

function normalizeBI(value: string) {
  return value.replace(/[^a-zA-Z0-9]/g, '').toUpperCase()
}

async function checkExistingAlunoByBi(
  supabase: Awaited<ReturnType<typeof createClient>>,
  escolaId: string,
  biNumero: string,
) {
  const bi = normalizeBI(biNumero)

  const { data, error } = await supabase
    .from('alunos')
    .select('id, nome, bi_numero')
    .eq('escola_id', escolaId)
    .eq('bi_numero', bi)
    .limit(1)
    .maybeSingle()

  if (error) throw error

  return data
}

async function checkCapacidadeTurma(
  supabase: Awaited<ReturnType<typeof createClient>>,
  escolaId: string,
  turmaId: string,
) {
  const { data: turma, error: turmaError } = await supabase
    .from('turmas')
    .select('id, nome, capacidade_maxima')
    .eq('escola_id', escolaId)
    .eq('id', turmaId)
    .limit(1)
    .maybeSingle()

  if (turmaError) throw turmaError
  if (!turma) return { ok: false as const, reason: 'TURMA_NOT_FOUND' as const }

  const capacidade = Number(turma.capacidade_maxima ?? 0)
  if (capacidade <= 0) {
    return { ok: true as const, turmaNome: turma.nome, capacidadeMaxima: capacidade, ocupacaoAtual: null }
  }

  const { count, error: countError } = await supabase
    .from('matriculas')
    .select('id', { count: 'exact', head: true })
    .eq('escola_id', escolaId)
    .eq('turma_id', turmaId)

  if (countError) throw countError

  const ocupacaoAtual = Number(count ?? 0)
  if (ocupacaoAtual >= capacidade) {
    return {
      ok: false as const,
      reason: 'TURMA_ESGOTADA' as const,
      turmaNome: turma.nome,
      capacidadeMaxima: capacidade,
      ocupacaoAtual,
    }
  }

  return { ok: true as const, turmaNome: turma.nome, capacidadeMaxima: capacidade, ocupacaoAtual }
}

export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ ok: false, error: 'Não autenticado.' }, { status: 401 })
    }

    const escolaId = await resolveEscolaIdForUser(supabase, user.id)
    if (!escolaId) {
      return NextResponse.json({ ok: false, error: 'Escola não identificada.' }, { status: 403 })
    }

    const json = await request.json()
    const parsed = bodySchema.safeParse(json)
    if (!parsed.success) {
      return NextResponse.json({ ok: false, error: 'Payload inválido.', issues: parsed.error.flatten() }, { status: 400 })
    }

    const payload = parsed.data

    if (payload.via === 'balcao') {
      const existing = await checkExistingAlunoByBi(supabase, escolaId, payload.bi_numero)
      if (existing) {
        return NextResponse.json(
          {
            ok: false,
            code: 'ALUNO_BI_DUPLICADO',
            error: 'Este formando já existe. Deseja apenas adicionar a uma nova turma?',
            existing,
          },
          { status: 409 },
        )
      }

      if (payload.turma_id && payload.enforce_capacidade) {
        const cap = await checkCapacidadeTurma(supabase, escolaId, payload.turma_id)
        if (!cap.ok && cap.reason === 'TURMA_ESGOTADA') {
          return NextResponse.json(
            {
              ok: false,
              code: 'TURMA_ESGOTADA',
              error: `Turma esgotada (${cap.ocupacaoAtual}/${cap.capacidadeMaxima}).`,
              turma: cap,
            },
            { status: 409 },
          )
        }
      }

      const { data: candidatura, error: insertError } = await supabase
        .from('candidaturas')
        .insert({
          escola_id: escolaId,
          nome_candidato: payload.nome,
          curso_id: payload.curso_id ?? null,
          turma_preferencial_id: payload.turma_id ?? null,
          ano_letivo: payload.ano_letivo ?? new Date().getFullYear(),
          source: 'formacao_balcao',
          status: 'submetida',
          dados_candidato: {
            nome: payload.nome,
            bi_numero: normalizeBI(payload.bi_numero),
            email: payload.email,
            telefone: payload.telefone,
          },
        })
        .select('id, status, source, turma_preferencial_id')
        .single()

      if (insertError) throw insertError

      return NextResponse.json({ ok: true, via: payload.via, candidatura })
    }

    if (payload.via === 'b2b_upload') {
      const bis = payload.formandos.map((f) => normalizeBI(f.bi_numero))
      const { data: existentes, error: existingError } = await supabase
        .from('alunos')
        .select('id, nome, bi_numero')
        .eq('escola_id', escolaId)
        .in('bi_numero', bis)

      if (existingError) throw existingError

      const existingSet = new Set((existentes ?? []).map((a) => normalizeBI(String(a.bi_numero ?? ''))))
      const novatos = payload.formandos.filter((f) => !existingSet.has(normalizeBI(f.bi_numero)))

      if (novatos.length === 0) {
        return NextResponse.json(
          {
            ok: false,
            code: 'LOTE_SEM_NOVOS',
            error: 'Todos os BI do lote já existem. Reavalie ou use fluxo de adicionar em nova turma.',
          },
          { status: 409 },
        )
      }

      const rows = novatos.map((f) => ({
        escola_id: escolaId,
        nome_candidato: f.nome,
        curso_id: payload.curso_id ?? null,
        turma_preferencial_id: payload.turma_id ?? null,
        ano_letivo: payload.ano_letivo ?? new Date().getFullYear(),
        source: 'formacao_b2b_upload',
        status: 'submetida',
        dados_candidato: {
          nome: f.nome,
          bi_numero: normalizeBI(f.bi_numero),
          email: f.email,
          telefone: f.telefone,
          empresa_nome: payload.empresa_nome,
          empresa_nif: payload.empresa_nif ?? null,
        },
      }))

      const { data: inserts, error: insertError } = await supabase
        .from('candidaturas')
        .insert(rows)
        .select('id, status, source')

      if (insertError) throw insertError

      return NextResponse.json({
        ok: true,
        via: payload.via,
        total_recebidos: payload.formandos.length,
        total_inseridos: inserts?.length ?? 0,
        total_duplicados: payload.formandos.length - novatos.length,
      })
    }

    const existing = await checkExistingAlunoByBi(supabase, escolaId, payload.bi_numero)
    if (existing) {
      return NextResponse.json(
        {
          ok: false,
          code: 'ALUNO_BI_DUPLICADO',
          error: 'Este formando já existe. Faça login ou solicite acesso à turma.',
          existing,
        },
        { status: 409 },
      )
    }

    const { data: candidatura, error: insertError } = await supabase
      .from('candidaturas')
      .insert({
        escola_id: escolaId,
        nome_candidato: payload.nome,
        curso_id: payload.curso_id ?? null,
        turma_preferencial_id: payload.turma_id ?? null,
        ano_letivo: new Date().getFullYear(),
        source: 'formacao_self_service',
        status: 'submetida',
        dados_candidato: {
          nome: payload.nome,
          bi_numero: normalizeBI(payload.bi_numero),
          email: payload.email,
          telefone: payload.telefone,
          landing_slug: payload.landing_slug,
        },
      })
      .select('id, status, source')
      .single()

    if (insertError) throw insertError

    return NextResponse.json({ ok: true, via: payload.via, candidatura })
  } catch (error) {
    console.error('[api/formacao/admissoes] error', error)
    const message = error instanceof Error ? error.message : 'Erro interno ao registrar admissão.'
    return NextResponse.json({ ok: false, error: message }, { status: 500 })
  }
}
