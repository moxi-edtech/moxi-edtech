import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { supabaseServer } from "@/lib/supabaseServer"
import { hasPermission } from "@/lib/permissions"
import { resolveEscolaIdForUser } from "@/lib/tenant/resolveEscolaIdForUser"
import { recordAuditServer } from "@/lib/audit"
import { dispatchProfessorNotificacao } from "@/lib/notificacoes/dispatchProfessorNotificacao"

// POST /api/escolas/[id]/onboarding/session/rotate
// Archives current active session (if any) and creates a new active session.
export async function POST(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { id: escolaId } = await context.params

  try {
    const body = await req.json()
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
      // valida 1 ano - 1 dia
      const sd = new Date(data_inicio)
      const ed = new Date(data_fim)
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
      data_fim = `${endYear}-12-31`
    } else {
      return NextResponse.json({ ok: false, error: 'Payload inválido' }, { status: 400 })
    }

    const s = await supabaseServer()
    const { data: auth } = await s.auth.getUser()
    const user = auth?.user
    if (!user) return NextResponse.json({ ok: false, error: 'Não autenticado' }, { status: 401 })

    const resolvedEscolaId = await resolveEscolaIdForUser(s as any, user.id, escolaId)
    if (!resolvedEscolaId) {
      return NextResponse.json({ ok: false, error: 'Sem permissão' }, { status: 403 })
    }

    // Authorization: allow ONLY escola admins or users with configurar_escola vínculo (super_admin visualiza, mas não altera)
    let allowed = false
    try {
      const { data: vinc } = await s
        .from('escola_users')
        .select('papel')
        .eq('escola_id', resolvedEscolaId)
        .eq('user_id', user.id)
        .maybeSingle()
      const papel = vinc?.papel
      if (!allowed) allowed = !!papel && hasPermission(papel as any, 'configurar_escola')
    } catch {}
    if (!allowed) {
      try {
        const { data: adminLink } = await s
          .from('escola_administradores')
          .select('user_id')
          .eq('escola_id', resolvedEscolaId)
          .eq('user_id', user.id)
          .limit(1)
        allowed = Boolean(adminLink && adminLink.length > 0)
      } catch {}
    }
    if (!allowed) {
      // Fallback similar to /onboarding route: check profiles role linked to this escola
      try {
        const { data: prof } = await s
          .from('profiles')
          .select('role, escola_id')
          .eq('user_id', user.id)
          .eq('escola_id', resolvedEscolaId)
          .limit(1)
        allowed = Boolean(prof && prof.length > 0 && prof[0].role === 'admin')
      } catch {}
    }
    if (!allowed) return NextResponse.json({ ok: false, error: 'Sem permissão' }, { status: 403 })

    // 1) Desativar anos letivos atuais
    await s
      .from('anos_letivos')
      .update({ ativo: false })
      .eq('escola_id', resolvedEscolaId)

    const anoLetivoNumero = Number(String(data_inicio).slice(0, 4))

    // 2) Upsert do novo ano letivo ativo
    const { data: anoLetivoRow, error: anoErr } = await s
      .from('anos_letivos')
      .upsert({
        escola_id: resolvedEscolaId,
        ano: anoLetivoNumero,
        data_inicio,
        data_fim,
        ativo: true,
      }, { onConflict: 'escola_id,ano' })
      .select('id')
      .single()
    if (anoErr) return NextResponse.json({ ok: false, error: anoErr.message }, { status: 400 })

    const anoLetivoId = anoLetivoRow?.id as string | null

    // 3) Gerar periodos_letivos conforme preferências
    const { data: cfg } = await s
      .from('configuracoes_escola')
      .select('periodo_tipo')
      .eq('escola_id', resolvedEscolaId)
      .maybeSingle()

    const periodoTipo = ((cfg as any)?.periodo_tipo as string | undefined)?.toLowerCase() || 'trimestre'
    const tipoUpper = periodoTipo === 'semestre' ? 'SEMESTRE' : periodoTipo === 'bimestre' ? 'BIMESTRE' : 'TRIMESTRE'
    const parts = tipoUpper === 'SEMESTRE' ? 2 : tipoUpper === 'BIMESTRE' ? 4 : 3

    const splitRanges = (startISO: string, endISO: string, parts: number): Array<{ start: string; end: string }> => {
      const toDate = (s: string) => new Date(`${s}T00:00:00Z`)
      const toISO = (d: Date) => `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`
      const start = toDate(String(startISO).slice(0, 10))
      const end = toDate(String(endISO).slice(0, 10))
      const totalDays = Math.floor((end.getTime() - start.getTime()) / (24 * 3600 * 1000)) + 1
      const chunk = Math.floor(totalDays / parts)
      const remainder = totalDays % parts
      const ranges: Array<{ start: string; end: string }> = []
      const cursor = new Date(start)
      for (let i = 0; i < parts; i++) {
        const len = chunk + (i < remainder ? 1 : 0)
        const segStart = new Date(cursor)
        const segEnd = new Date(cursor)
        segEnd.setUTCDate(segEnd.getUTCDate() + (len - 1))
        ranges.push({ start: toISO(segStart), end: toISO(segEnd) })
        cursor.setUTCDate(cursor.getUTCDate() + len)
      }
      return ranges
    }

    if (anoLetivoId) {
      try {
        await s.from('periodos_letivos').delete().eq('ano_letivo_id', anoLetivoId)
        const ranges = splitRanges(data_inicio, data_fim, parts)
        const rows = ranges.map((r, idx) => ({
          escola_id: resolvedEscolaId,
          ano_letivo_id: anoLetivoId,
          tipo: tipoUpper as any,
          numero: idx + 1,
          data_inicio: r.start,
          data_fim: r.end,
        }))
        await s.from('periodos_letivos').insert(rows as any)
      } catch (_) {}
    }

    // Reset onboarding drafts; NÃO desmarca conclusão do onboarding.
    try {
      await s
        .from('onboarding_drafts')
        .delete()
        .eq('escola_id', resolvedEscolaId)
    } catch (_) {}

    // Sinaliza que ajustes acadêmicos são necessários após rotacionar sessão
    const { error: flagErr } = await s
      .from('escolas')
      .update({ needs_academic_setup: true })
      .eq('id', resolvedEscolaId)

    if (flagErr) {
      console.warn("Falha ao sinalizar needs_academic_setup:", flagErr.message)
    }


    // Carrega anos letivos após rotação para retornar nova sessão ativa e histórico
    let active: any = null
    let all: any[] = []
    try {
      const { data: sessList } = await s
        .from('anos_letivos')
        .select('id, ano, data_inicio, data_fim, ativo')
        .eq('escola_id', resolvedEscolaId)
        .order('ano', { ascending: false })
      all = (sessList || []).map((row) => ({
        id: row.id,
        nome: `${row.ano}/${row.ano + 1}`,
        data_inicio: row.data_inicio,
        data_fim: row.data_fim,
        status: row.ativo ? 'ativa' : 'arquivada',
        ano_letivo: String(row.ano),
      }))
      active = (all || []).find((s) => s.status === 'ativa') || null
    } catch {}

    recordAuditServer({
      escolaId,
      portal: 'admin_escola',
      acao: 'ANO_LETIVO_ROTACIONADO',
      entity: 'anos_letivos',
      entityId: anoLetivoId ?? null,
      details: { nome, data_inicio, data_fim, tipo: tipoUpper },
    }).catch(() => null)

    await dispatchProfessorNotificacao({
      escolaId,
      key: 'ANO_LETIVO_ACTIVADO',
      actorId: user.id,
      actorRole: 'admin',
      agrupamentoTTLHoras: 24,
    })

    return NextResponse.json({ ok: true, data: { novaSessao: active, todasSessoes: all } })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Erro inesperado'
    return NextResponse.json({ ok: false, error: msg }, { status: 500 })
  }
}
