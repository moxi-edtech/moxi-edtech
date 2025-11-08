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
    const schema = z.object({
      nome: z.string().trim().min(1),
      startYear: z.string().regex(/^\d{4}$/),
      endYear: z.string().regex(/^\d{4}$/),
    })
    const parse = schema.safeParse(await req.json())
    if (!parse.success) {
      const msg = parse.error.errors[0]?.message || "Dados inválidos"
      return NextResponse.json({ ok: false, error: msg }, { status: 400 })
    }
    const { nome, startYear, endYear } = parse.data
    if (Number(startYear) >= Number(endYear)) {
      return NextResponse.json({ ok: false, error: 'Ano final deve ser maior que ano inicial' }, { status: 400 })
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
          data_inicio: `${startYear}-01-01`,
          data_fim: `${endYear}-12-31`,
        } as any)
        .eq('id', existing.id)
      if (updErr) return NextResponse.json({ ok: false, error: updErr.message }, { status: 400 })
    } else {
      const { error: insErr } = await admin
        .from('school_sessions')
        .insert({
          escola_id: escolaId,
          nome,
          data_inicio: `${startYear}-01-01`,
          data_fim: `${endYear}-12-31`,
          status: 'ativa',
        } as any)
      if (insErr) return NextResponse.json({ ok: false, error: insErr.message }, { status: 400 })
    }

    // Reset onboarding progress: clear drafts and mark as not finished
    try {
      await (admin as any)
        .from('onboarding_drafts')
        .delete()
        .eq('escola_id', escolaId)
    } catch (_) {}
    try {
      await (admin as any)
        .from('escolas')
        .update({ onboarding_finalizado: false } as any)
        .eq('id', escolaId)
    } catch (_) {}

    return NextResponse.json({ ok: true })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Erro inesperado'
    return NextResponse.json({ ok: false, error: msg }, { status: 500 })
  }
}
