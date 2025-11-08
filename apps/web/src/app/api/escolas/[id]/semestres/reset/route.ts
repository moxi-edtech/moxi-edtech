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
      periodo_tipo: z.enum(['semestre', 'trimestre'])
    })
    const parse = schema.safeParse(await req.json())
    if (!parse.success) {
      const msg = parse.error.errors[0]?.message || 'Dados inválidos'
      console.error('[semestres.reset.POST] invalid payload', {
        reason: msg,
        issues: parse.error.errors?.map(e => ({ path: e.path, code: e.code, message: e.message }))
      })
      return NextResponse.json({ ok: false, error: msg }, { status: 400 })
    }
    const { sessao_id, periodo_tipo } = parse.data

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
        .from('escola_usuarios')
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

    // Coleta ids de semestres atuais
    const { data: sems } = await (admin as any)
      .from('semestres')
      .select('id')
      .eq('session_id', sessao_id)
    const semIds = (sems || []).map((r: any) => r.id)

    // Verifica dependências básicas (cursos_oferta)
    if (semIds.length > 0) {
      const { data: deps, error: depErr } = await (admin as any)
        .from('cursos_oferta')
        .select('id')
        .in('semestre_id', semIds)
        .limit(1)
      if (depErr) {
        // Se tabela não existir, ignoramos essa verificação
        const code = (depErr as any)?.code as string | undefined
        const msg = (depErr as any)?.message as string | undefined
        const isMissing = code === '42P01' || (msg && /does not exist|relation .* does not exist/i.test(msg))
        if (!isMissing) {
          console.error('[semestres.reset.POST] dependency check error', { message: depErr.message, code })
          return NextResponse.json({ ok: false, error: depErr.message }, { status: 400 })
        }
      }
      if (deps && (deps as any[]).length > 0) {
        console.error('[semestres.reset.POST] abort: existing course offerings tied to semestres')
        return NextResponse.json({ ok: false, error: 'Não é possível regerar períodos: existem ofertas de curso vinculadas a semestres atuais.' }, { status: 409 })
      }
    }

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
    const qtd = periodo_tipo === 'semestre' ? 2 : 3
    const label = periodo_tipo === 'semestre' ? 'Semestre' : 'Trimestre'
    const parts = splitRange(sessionStart, sessionEnd, qtd)
    const toInsert = parts.map((p, i) => ({
      session_id: sessao_id,
      nome: `${i + 1}º ${label}`,
      data_inicio: p.inicio,
      data_fim: p.fim,
      // Mantém consistência com o seed: 'section'
      attendance_type: 'section',
      permitir_submissao_final: false,
    }))
    const { error: insErr } = await (admin as any)
      .from('semestres')
      .insert(toInsert as any)
    if (insErr) {
      console.error('[semestres.reset.POST] insert error', { message: insErr.message, code: (insErr as any)?.code, details: (insErr as any)?.details })
      return NextResponse.json({ ok: false, error: insErr.message }, { status: 400 })
    }

    return NextResponse.json({ ok: true, created: qtd })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Erro inesperado'
    return NextResponse.json({ ok: false, error: msg }, { status: 500 })
  }
}
