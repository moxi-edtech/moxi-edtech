import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { supabaseServer } from "@/lib/supabaseServer"
import { hasPermission } from "@/lib/permissions"
import { createClient as createAdminClient } from "@supabase/supabase-js"
import type { Database } from "~types/supabase"

// POST /api/escolas/[id]/onboarding/session
// Creates or updates the active school session (school_sessions) for the escola.
export async function POST(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { id: escolaId } = await context.params

  try {
    const body = await req.json()
    // Aceita dois modos: por ano (compat) ou por datas exatas
    const byYearSchema = z.object({
      nome: z.string().trim().min(1),
      startYear: z.string().regex(/^\d{4}$/),
      endYear: z.string().regex(/^\d{4}$/),
    })
    const byDateSchema = z.object({
      nome: z.string().trim().min(1),
      startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    })

    let nome: string
    let data_inicio: string
    let data_fim: string
    
    const tryYear = byYearSchema.safeParse(body)
    const tryDate = byDateSchema.safeParse(body)
    if (tryDate.success) {
      nome = tryDate.data.nome
      data_inicio = tryDate.data.startDate
      data_fim = tryDate.data.endDate
      // Valida duração: exatamente 1 ano - 1 dia
      const sd = new Date(data_inicio)
      const ed = new Date(data_fim)
      if (!(sd instanceof Date) || isNaN(sd.getTime()) || !(ed instanceof Date) || isNaN(ed.getTime())) {
        return NextResponse.json({ ok: false, error: 'Datas inválidas' }, { status: 400 })
      }
      if (ed <= sd) {
        return NextResponse.json({ ok: false, error: 'A data final deve ser posterior à data inicial' }, { status: 400 })
      }
      const expected = new Date(sd)
      expected.setFullYear(expected.getFullYear() + 1)
      expected.setDate(expected.getDate() - 1)
      const toISO = (d: Date) => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`
      if (toISO(expected) !== toISO(ed)) {
        return NextResponse.json({ ok: false, error: 'A sessão deve durar 1 ano (fim = início + 1 ano - 1 dia)' }, { status: 400 })
      }
    } else if (tryYear.success) {
      nome = tryYear.data.nome
      const { startYear, endYear } = tryYear.data
      if (Number(startYear) >= Number(endYear)) {
        return NextResponse.json({ ok: false, error: 'Ano final deve ser maior que ano inicial' }, { status: 400 })
      }
      if (Number(endYear) - Number(startYear) !== 1) {
        return NextResponse.json({ ok: false, error: 'A sessão deve ter exatamente 1 ano de duração' }, { status: 400 })
      }
      data_inicio = `${startYear}-01-01`
      // Para manter consistência com regra de 1 ano - 1 dia, definimos fim como 31/12 do ano final
      data_fim = `${endYear}-12-31`
    } else {
      return NextResponse.json({ ok: false, error: 'Payload inválido' }, { status: 400 })
    }

    const s = await supabaseServer()
    const { data: auth } = await s.auth.getUser()
    const user = auth?.user
    if (!user) return NextResponse.json({ ok: false, error: 'Não autenticado' }, { status: 401 })

    // Authorization: allow ONLY escola admins or users with configurar_escola vínculo (super_admin visualiza, mas não altera)
    let allowed = false
    try {
      const { data: vinc } = await s
        .from('escola_usuarios')
        .select('papel')
        .eq('escola_id', escolaId)
        .eq('user_id', user.id)
        .maybeSingle()
      const papel = (vinc as any)?.papel as string | undefined
      if (!allowed) allowed = !!papel && hasPermission(papel as any, 'configurar_escola')
    } catch {}
    if (!allowed) {
      try {
        const { data: adminLink } = await s
          .from('escola_administradores')
          .select('user_id')
          .eq('escola_id', escolaId)
          .eq('user_id', user.id)
          .limit(1)
        allowed = Boolean(adminLink && (adminLink as any[]).length > 0)
      } catch {}
    }
    if (!allowed) {
      // Fallback similar to /onboarding route: check profiles role linked to this escola
      try {
        const { data: prof } = await s
          .from('profiles')
          .select('role, escola_id')
          .eq('user_id', user.id)
          .eq('escola_id', escolaId)
          .limit(1)
        allowed = Boolean(prof && prof.length > 0 && (prof[0] as any).role === 'admin')
      } catch {}
    }
    if (!allowed) return NextResponse.json({ ok: false, error: 'Sem permissão' }, { status: 403 })

    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
      return NextResponse.json({ ok: false, error: 'Configuração Supabase ausente.' }, { status: 500 })
    }
    const admin = createAdminClient<Database>(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    )

    // Upsert active session: update if existing active session, else insert
    const { data: existing } = await admin
      .from('school_sessions')
      .select('id')
      .eq('escola_id', escolaId)
      .eq('status', 'ativa')
      .maybeSingle()

    if (existing?.id) {
      const { error: updErr } = await admin
        .from('school_sessions')
        .update({
          nome,
          data_inicio,
          data_fim,
        } as any)
        .eq('id', existing.id)
      if (updErr) return NextResponse.json({ ok: false, error: updErr.message }, { status: 400 })
    } else {
      const { error: insErr } = await admin
        .from('school_sessions')
        .insert({
          escola_id: escolaId,
          nome,
          data_inicio,
          data_fim,
          status: 'ativa',
        } as any)
      if (insErr) return NextResponse.json({ ok: false, error: insErr.message }, { status: 400 })
    }

    // Reset onboarding drafts; NÃO desmarca conclusão do onboarding.
    try {
      await (admin as any)
        .from('onboarding_drafts')
        .delete()
        .eq('escola_id', escolaId)
    } catch (_) {}

    // Retorna sessão ativa atualizada/criada e lista resumida para o cliente atualizar o estado
    let active: any = null
    let all: any[] = []
    try {
      const { data: sessList } = await (admin as any)
        .from('school_sessions')
        .select('id, nome, data_inicio, data_fim, status')
        .eq('escola_id', escolaId)
        .order('data_inicio', { ascending: false })
      all = sessList || []
      active = (all || []).find((s: any) => s.status === 'ativa') || null
    } catch {}

    return NextResponse.json({ ok: true, data: active, sessoes: all })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Erro inesperado'
    return NextResponse.json({ ok: false, error: msg }, { status: 500 })
  }
}
