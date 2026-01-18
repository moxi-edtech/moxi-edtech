import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { supabaseServer } from "@/lib/supabaseServer";
import { hasPermission } from "@/lib/permissions";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import type { Database } from "~types/supabase";

const dateToISO = (d: Date) => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const da = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${da}`;
}

const parseISO = (s: string) => {
  const [y, m, d] = s.split('-').map(Number)
  return new Date(y, (m || 1) - 1, d || 1)
}

const splitRange = (startISO: string, endISO: string, parts: number): Array<{ inicio: string; fim: string }> => {
  const start = parseISO(startISO)
  const end = parseISO(endISO)
  const totalMs = end.getTime() - start.getTime()
  if (parts <= 0 || totalMs <= 0) return []
  const segments: Array<{ inicio: string; fim: string }> = []
  for (let i = 0; i < parts; i++) {
    const segStartMs = start.getTime() + Math.floor((totalMs * i) / parts)
    const segEndMs = i === parts - 1
      ? end.getTime()
      : start.getTime() + Math.floor((totalMs * (i + 1)) / parts) - 24 * 60 * 60 * 1000
    segments.push({ inicio: dateToISO(new Date(segStartMs)), fim: dateToISO(new Date(segEndMs)) })
  }
  return segments
}

const addMonths = (d: Date, months: number) => {
  const nd = new Date(d)
  nd.setMonth(nd.getMonth() + months)
  return nd
}

// POST /api/escolas/[id]/semestres/reset
// Substitui todos os semestres da sessão por novos conforme periodo_tipo (2 ou 3)
export async function POST(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { id: escolaId } = await context.params

  try {
    const schema = z.object({
      sessao_id: z.string().uuid(),
      periodo_tipo: z.enum(['semestre', 'trimestre']).optional()
    })
    const parse = schema.safeParse(await req.json())
    if (!parse.success) {
      const msg = parse.error.issues?.[0]?.message || 'Dados inválidos'
      console.error('[semestres.reset.POST] invalid payload', {
        reason: msg,
        issues: parse.error.issues?.map(e => ({ path: e.path, code: e.code, message: e.message }))
      })
      return NextResponse.json({ ok: false, error: msg }, { status: 400 })
    }
    const { sessao_id } = parse.data

    const s = await supabaseServer()
    const { data: auth } = await s.auth.getUser()
    const user = auth?.user
    if (!user) {
      console.error('[semestres.reset.POST] not authenticated')
      return NextResponse.json({ ok: false, error: 'Não autenticado' }, { status: 401 })
    }

    // Autorização
    let allowed = false
    // Allow super_admin globally
    try {
      const { data: prof } = await s
        .from('profiles')
        .select('role')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(1)
      const role = (prof?.[0] as any)?.role as string | undefined
      if (role === 'super_admin') allowed = true
    } catch {}
    try {
      const { data: vinc } = await s
        .from('escola_users')
        .select('papel')
        .eq('escola_id', escolaId)
        .eq('user_id', user.id)
        .maybeSingle()
      const papel = (vinc as any)?.papel as string | undefined
      allowed = !!papel && hasPermission(papel as any, 'configurar_escola')
    } catch {}
    if (!allowed) {
      // Fallback: vínculo direto como administrador da escola
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
      // Fallback: perfil global admin vinculado à escola
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
    if (!allowed) {
      console.error('[semestres.reset.POST] forbidden: user lacks configurar_escola')
      return NextResponse.json({ ok: false, error: 'Sem permissão' }, { status: 403 })
    }

    // Hard check: perfil deve pertencer à escola
    const { data: profCheck } = await s.from('profiles' as any).select('escola_id').eq('user_id', user.id).maybeSingle()
    if (!profCheck || (profCheck as any).escola_id !== escolaId) {
      return NextResponse.json({ ok: false, error: 'Perfil não vinculado à escola' }, { status: 403 })
    }

    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
      return NextResponse.json({ ok: false, error: 'Configuração Supabase ausente.' }, { status: 500 })
    }
    const admin = createAdminClient<Database>(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    )

    // Confere se a sessão pertence à escola e obtem datas
    const { data: sess, error: sErr } = await (admin as any)
      .from('school_sessions')
      .select('id, escola_id, data_inicio, data_fim')
      .eq('id', sessao_id)
      .maybeSingle()
    if (sErr) {
      console.error('[semestres.reset.POST] session fetch error', { message: sErr.message, code: (sErr as any)?.code })
      return NextResponse.json({ ok: false, error: sErr.message }, { status: 400 })
    }
    if (!sess || (sess as any).escola_id !== escolaId) {
      console.error('[semestres.reset.POST] session not found or mismatched school', { escolaId, sessao_id })
      return NextResponse.json({ ok: false, error: 'Sessão inválida para esta escola' }, { status: 404 })
    }

    const sessionStart = String((sess as any).data_inicio)
    const sessionEnd = String((sess as any).data_fim)

    // Descobre tipo de período efetivo: preferência salva ou fallback 'trimestre'
    let periodo_tipo: 'semestre' | 'trimestre' = 'trimestre'
    if (parse.data.periodo_tipo) {
      periodo_tipo = parse.data.periodo_tipo
    } else {
      try {
        const { data: cfg } = await (admin as any)
          .from('configuracoes_escola')
          .select('periodo_tipo')
          .eq('escola_id', escolaId)
          .maybeSingle()
        const p = (cfg as any)?.periodo_tipo as string | undefined
        if (p === 'semestre' || p === 'trimestre') periodo_tipo = p
      } catch {}
    }

    // Coleta ids de semestres atuais
    const { data: sems } = await (admin as any)
      .from('semestres')
      .select('id')
      .eq('session_id', sessao_id)
    const semIds = (sems || []).map((r: any) => r.id)

    // Verificação de dependências removida: cursos_oferta não existe neste schema.

    // Apaga semestres atuais
    if (semIds.length > 0) {
      const { error: delErr } = await (admin as any)
        .from('semestres')
        .delete()
        .eq('session_id', sessao_id)
      if (delErr) {
        console.error('[semestres.reset.POST] delete error', { message: delErr.message, code: (delErr as any)?.code })
        return NextResponse.json({ ok: false, error: delErr.message }, { status: 400 })
      }
    }

    // Insere novos períodos
    let toInsert: any[] = []
    if (periodo_tipo === 'semestre') {
      const qtd = 2
      const label = 'Semestre'
      const parts = splitRange(sessionStart, sessionEnd, qtd)
      toInsert = parts.map((p, i) => ({
        session_id: sessao_id,
        escola_id: escolaId,
        nome: `${i + 1}º ${label}`,
        data_inicio: p.inicio,
        data_fim: p.fim,
        attendance_type: 'section',
        permitir_submissao_final: false,
        tipo: 'SEMESTRE',
      }))
    } else {
      // Trimestre: garantir que cada período tenha no máximo 3 meses
      const label = 'Trimestre'
      const start = parseISO(sessionStart)
      const endSession = parseISO(sessionEnd)
      let currentStart = new Date(start)
      for (let i = 0; i < 3; i++) {
        const maxEnd = addMonths(currentStart, 3) // limite de 3 meses
        const periodEnd = new Date(Math.min(maxEnd.getTime(), endSession.getTime()))
        const inicioISO = dateToISO(currentStart)
        const fimISO = dateToISO(periodEnd)
        toInsert.push({
          session_id: sessao_id,
          escola_id: escolaId,
          nome: `${i + 1}º ${label}`,
          data_inicio: inicioISO,
          data_fim: fimISO,
          attendance_type: 'section',
          permitir_submissao_final: false,
          tipo: 'TRIMESTRE',
        })
        // Próximo período começa no dia seguinte
        const nextStart = new Date(periodEnd)
        nextStart.setDate(nextStart.getDate() + 1)
        currentStart = nextStart
        if (currentStart > endSession) break
      }
    }
    // Tenta inserir incluindo 'tipo'; se a coluna não existir, tenta novamente sem ela
    let insErr: any = null
    {
      const { error } = await (admin as any)
        .from('semestres')
        .insert(toInsert as any)
      insErr = error
    }
    if (insErr && String(insErr.message || '').toLowerCase().includes('column') && String(insErr.message || '').includes('tipo')) {
      const sanitized = toInsert.map((r) => {
        const { tipo, ...rest } = r as any
        return rest
      })
      const { error: retryErr } = await (admin as any)
        .from('semestres')
        .insert(sanitized as any)
      insErr = retryErr
    }
    if (insErr) {
      console.error('[semestres.reset.POST] insert error', { message: insErr.message, code: (insErr as any)?.code, details: (insErr as any)?.details })
      return NextResponse.json({ ok: false, error: insErr.message }, { status: 400 })
    }

    return NextResponse.json({ ok: true, created: toInsert.length })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Erro inesperado'
    return NextResponse.json({ ok: false, error: msg }, { status: 500 })
  }
}
