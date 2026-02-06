import { NextResponse } from 'next/server'
import { supabaseServer } from '@/lib/supabaseServer'
import { type SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '~types/supabase'
import { applyKf2ListInvariants } from '@/lib/kf2'
import { resolveEscolaIdForUser } from '@/lib/tenant/resolveEscolaIdForUser'

// Lista e cria/atualiza regras de mensalidade por escola/curso/classe usando
// a tabela padrão `financeiro_tabelas` (valor_mensalidade).

type FinanceiroTabelaRow = Database['public']['Tables']['financeiro_tabelas']['Row']
type FinanceiroTabelaInsert = Database['public']['Tables']['financeiro_tabelas']['Insert']

async function possuiVinculo(client: SupabaseClient<Database>, userId: string, escolaId: string) {
  try {
    const { data } = await client
      .from('escola_users')
      .select('id')
      .eq('user_id', userId)
      .eq('escola_id', escolaId)
      .limit(1)
    if (data && data.length > 0) return true
  } catch {}

  return false
}

const parseValor = (raw: unknown) => {
  if (typeof raw === 'number') return Number.isFinite(raw) ? raw : null;
  if (typeof raw !== 'string') return null;
  const str = raw.trim();
  if (!str) return null;
  if (str.includes(',')) {
    const normalized = str.replace(/\./g, '').replace(/,/g, '.');
    const num = Number(normalized);
    return Number.isFinite(num) ? num : null;
  }
  const num = Number(str);
  return Number.isFinite(num) ? num : null;
}

function parseAnoLetivo(raw?: string | null) {
  if (!raw) return null
  const num = Number(raw)
  return Number.isFinite(num) ? Math.trunc(num) : null
}

export async function GET(req: Request) {
  try {
    const s = await supabaseServer()
    const { data: userRes } = await s.auth.getUser()
    const user = userRes?.user
    if (!user) return NextResponse.json({ ok: false, error: 'Não autenticado' }, { status: 401 })

    const escolaId = await resolveEscolaIdForUser(s, user.id)
    if (!escolaId) return NextResponse.json({ ok: true, items: [] })

    const url = new URL(req.url)
    const anoParam = parseAnoLetivo(url.searchParams.get('ano_letivo') || url.searchParams.get('ano'))
    const anoLetivo = anoParam ?? new Date().getFullYear()

    const vinculado = await possuiVinculo(s, user.id, escolaId)
    if (!vinculado) return NextResponse.json({ ok: false, error: 'Sem vínculo com a escola' }, { status: 403 })

    let query = s
      .from('financeiro_tabelas')
      .select('id, curso_id, classe_id, valor_mensalidade, dia_vencimento, ano_letivo, created_at, updated_at')
      .eq('escola_id', escolaId)
      .eq('ano_letivo', anoLetivo)

    query = applyKf2ListInvariants(query);

    const { data, error } = await query;

    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 400 })

    const items = (data || []).map((row) => ({
      id: row.id,
      curso_id: row.curso_id,
      classe_id: row.classe_id,
      valor: row.valor_mensalidade,
      dia_vencimento: row.dia_vencimento,
      ativo: true,
      created_at: row.created_at,
      updated_at: row.updated_at,
      ano_letivo: row.ano_letivo,
    }))

    return NextResponse.json({ ok: true, items })
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ ok: false, error: message }, { status: 500 })
  }
}
export async function POST(req: Request) {
  try {
    const s = await supabaseServer()
    const { data: userRes } = await s.auth.getUser()
    const user = userRes?.user
    if (!user) return NextResponse.json({ ok: false, error: 'Não autenticado' }, { status: 401 })

    const body = await req.json().catch(() => ({}))
    const { curso_id, classe_id, valor, dia_vencimento, ano_letivo } = body || {}
    const parsedValor = parseValor(valor)
    if (parsedValor === null || parsedValor <= 0) return NextResponse.json({ ok: false, error: 'Valor inválido' }, { status: 400 })
    const parsedDiaRaw = Number(dia_vencimento)
    const parsedDia = Number.isFinite(parsedDiaRaw) ? parsedDiaRaw : null

    const anoLetivo = parseAnoLetivo(ano_letivo) ?? new Date().getFullYear()

    const escolaId = await resolveEscolaIdForUser(s, user.id)
    if (!escolaId) return NextResponse.json({ ok: false, error: 'Escola não encontrada' }, { status: 400 })

    const vinculado = await possuiVinculo(s, user.id, escolaId)
    if (!vinculado) return NextResponse.json({ ok: false, error: 'Sem vínculo com a escola' }, { status: 403 })

    // Upsert por (escola, ano, curso, classe) na tabela oficial
    const cursoId = curso_id || null
    const classeId = classe_id || null
    const valorMatricula = 0

    const payload: FinanceiroTabelaInsert = {
      escola_id: escolaId,
      ano_letivo: anoLetivo,
      curso_id: cursoId,
      classe_id: classeId,
      valor_matricula: valorMatricula,
      valor_mensalidade: Number(parsedValor.toFixed(2)),
      dia_vencimento: parsedDia ? Math.max(1, Math.min(31, parsedDia)) : null,
      updated_at: new Date().toISOString(),
    }

    if (body?.id) {
      const { data: existing, error: findErr } = await s
        .from('financeiro_tabelas')
        .select('id, escola_id, valor_matricula')
        .eq('id', body.id)
        .eq('escola_id', escolaId)
        .maybeSingle()
      if (findErr) return NextResponse.json({ ok: false, error: findErr.message }, { status: 400 })
      if (!existing) return NextResponse.json({ ok: false, error: 'Registro não encontrado' }, { status: 404 })

      payload.valor_matricula = existing?.valor_matricula ?? 0

      const { data, error } = await s
        .from('financeiro_tabelas')
        .update(payload)
        .eq('id', body.id)
        .select()
        .single()

      if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 400 })
      return NextResponse.json({ ok: true, item: data })
    }

    try {
      const { data: existing } = await s
        .from('financeiro_tabelas')
        .select('valor_matricula')
        .eq('escola_id', escolaId)
        .eq('ano_letivo', anoLetivo)
        .eq('curso_id', cursoId)
        .eq('classe_id', classeId)
        .maybeSingle()
      if (existing && typeof existing.valor_matricula === 'number') {
        payload.valor_matricula = existing.valor_matricula
      }
    } catch {}

    const { data, error } = await s
      .from('financeiro_tabelas')
      .upsert(payload, { onConflict: 'escola_id, ano_letivo, curso_id, classe_id' })
      .select()
      .single()

    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 400 })
    return NextResponse.json({ ok: true, item: data })
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ ok: false, error: message }, { status: 500 })
  }
}

export async function DELETE(req: Request) {
  try {
    const s = await supabaseServer()
    const { data: userRes } = await s.auth.getUser()
    const user = userRes?.user
    if (!user) return NextResponse.json({ ok: false, error: 'Não autenticado' }, { status: 401 })

    const url = new URL(req.url)
    const id = url.searchParams.get('id') || null
    if (!id) return NextResponse.json({ ok: false, error: 'id é obrigatório' }, { status: 400 })

    const escolaId = await resolveEscolaIdForUser(s, user.id)
    if (!escolaId) return NextResponse.json({ ok: false, error: 'Escola não encontrada' }, { status: 400 })

    const vinculado = await possuiVinculo(s, user.id, escolaId)
    if (!vinculado) return NextResponse.json({ ok: false, error: 'Sem vínculo com a escola' }, { status: 403 })

    const { data: reg, error: findErr } = await s
      .from('financeiro_tabelas')
      .select('id, escola_id')
      .eq('id', id)
      .eq('escola_id', escolaId)
      .maybeSingle()
    if (findErr) return NextResponse.json({ ok: false, error: findErr.message }, { status: 400 })
    if (!reg) return NextResponse.json({ ok: false, error: 'Registro não encontrado' }, { status: 404 })

    const { error } = await s.from('financeiro_tabelas').delete().eq('id', id)
    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 400 })
    return NextResponse.json({ ok: true })
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ ok: false, error: message }, { status: 500 })
  }
}
