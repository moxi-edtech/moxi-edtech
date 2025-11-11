import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { supabaseServer } from "@/lib/supabaseServer"
import { hasPermission } from "@/lib/permissions"
import { createClient as createAdminClient } from "@supabase/supabase-js"
import type { Database } from "~types/supabase"

// PATCH /api/escolas/[id]/onboarding/preferences
// Saves onboarding Step 2 preferences into onboarding_drafts (per escola+user).
export async function PATCH(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { id: escolaId } = await context.params

  try {
    const base = z.object({
      estrutura: z.enum(["classes", "secoes", "cursos"]).optional(),
      tipo_presenca: z.enum(["secao", "curso"]).optional(),
      periodo_tipo: z.enum(["semestre", "trimestre"]).optional(),
      autogerar_periodos: z.boolean().optional(),
    })
    const parse = base.safeParse(await req.json())
    if (!parse.success) {
      const msg = parse.error.issues?.[0]?.message || "Dados inválidos"
      return NextResponse.json({ ok: false, error: msg }, { status: 400 })
    }
    const { estrutura, tipo_presenca, periodo_tipo, autogerar_periodos } = parse.data
    if (estrutura === undefined && tipo_presenca === undefined && periodo_tipo === undefined && autogerar_periodos === undefined) {
      return NextResponse.json({ ok: false, error: 'Nenhuma preferência fornecida.' }, { status: 400 })
    }

    const s = await supabaseServer()
    const { data: auth } = await s.auth.getUser()
    const user = auth?.user
    if (!user) return NextResponse.json({ ok: false, error: "Não autenticado" }, { status: 401 })

    // Authorization: allow ONLY escola admins or users with configurar_escola vínculo
    // Keep behavior consistent with Step 1 (/onboarding/session): also allow profiles-based admin link for this escola
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
      // Fallback consistent with step 1: profiles role linked to this escola
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

    // Upsert into configuracoes_escola (unique per escola)
    const update: any = {
      escola_id: escolaId,
      updated_at: new Date().toISOString(),
    }
    if (estrutura !== undefined) update.estrutura = estrutura
    if (tipo_presenca !== undefined) update.tipo_presenca = tipo_presenca
    if (periodo_tipo !== undefined) update.periodo_tipo = periodo_tipo
    if (autogerar_periodos !== undefined) update.autogerar_periodos = autogerar_periodos

    const { error } = await (admin as any)
      .from('configuracoes_escola')
      .upsert(update as any, { onConflict: 'escola_id' } as any)

    if (error) {
      const code = (error as any)?.code as string | undefined
      const msg = (error as any)?.message as string | undefined
      const isMissingTable = (
        code === '42P01' ||
        (msg && /does not exist|relation .* does not exist|schema cache|Could not find .* in the schema cache/i.test(msg))
      )
      const isMissingColumn = code === '42703' || (msg && /column .*periodo_tipo.* does not exist/i.test(msg))
      if (isMissingTable) {
        const hint = [
          "Tabela 'public.configuracoes_escola' ausente no banco.",
          "Execute o SQL em docs/db/2025-09-27-configuracoes_escola.sql (na raiz do repositório) no seu projeto Supabase e recarregue o cache do PostgREST (ou reinicie).",
        ].join(' ')
        return NextResponse.json({ ok: false, error: hint }, { status: 424 })
      }
      if (isMissingColumn) {
        const hint = [
          "Alguma coluna de preferências ausente em 'public.configuracoes_escola'.",
          "Adicione as colunas necessárias, por exemplo:",
          "ALTER TABLE public.configuracoes_escola ADD COLUMN IF NOT EXISTS periodo_tipo text CHECK (periodo_tipo IN ('semestre','trimestre')) NULL;",
          "ALTER TABLE public.configuracoes_escola ADD COLUMN IF NOT EXISTS autogerar_periodos boolean DEFAULT false;"
        ].join(' ')
        return NextResponse.json({ ok: false, error: hint }, { status: 424 })
      }
      return NextResponse.json({ ok: false, error: error.message }, { status: 400 })
    }

    return NextResponse.json({ ok: true })
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Erro inesperado"
    return NextResponse.json({ ok: false, error: msg }, { status: 500 })
  }
}

// GET /api/escolas/[id]/onboarding/preferences
// Returns current saved preferences for Step 2 (if any)
export async function GET(
  _req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { id: escolaId } = await context.params

  try {
    const s = await supabaseServer()
    const { data: auth } = await s.auth.getUser()
    const user = auth?.user
    if (!user) return NextResponse.json({ ok: false, error: "Não autenticado" }, { status: 401 })

    // Authorization: allow super_admin, escola admins, or users with configurar_escola vínculo
    // Keep behavior consistent with Step 1 (/onboarding/session): also allow profiles-based admin link for this escola
    let allowed = false
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
    if (!allowed) {
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
    }
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
      // Fallback consistent with step 1: profiles role linked to this escola
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

    const { data, error } = await (admin as any)
      .from('configuracoes_escola')
      .select('estrutura, tipo_presenca, periodo_tipo, autogerar_periodos, updated_at')
      .eq('escola_id', escolaId)
      .maybeSingle()

    if (error) {
      const code = (error as any)?.code as string | undefined
      const msg = (error as any)?.message as string | undefined
      const isMissingTable = (
        code === '42P01' ||
        (msg && /does not exist|relation .* does not exist|schema cache|Could not find .* in the schema cache/i.test(msg))
      )
      const isMissingColumn = code === '42703' || (msg && /column .*periodo_tipo.* does not exist/i.test(msg))
      if (isMissingTable) {
        const hint = [
          "Tabela 'public.configuracoes_escola' ausente no banco.",
          "Execute o SQL em docs/db/2025-09-27-configuracoes_escola.sql (na raiz do repositório) e recarregue o cache do PostgREST (ou reinicie).",
        ].join(' ')
        return NextResponse.json({ ok: false, error: hint }, { status: 424 })
      }
      if (isMissingColumn) {
        const hint = [
          "Alguma coluna de preferências ausente em 'public.configuracoes_escola'.",
          "Adicione as colunas necessárias, por exemplo:",
          "ALTER TABLE public.configuracoes_escola ADD COLUMN IF NOT EXISTS periodo_tipo text CHECK (periodo_tipo IN ('semestre','trimestre')) NULL;",
          "ALTER TABLE public.configuracoes_escola ADD COLUMN IF NOT EXISTS autogerar_periodos boolean DEFAULT false;"
        ].join(' ')
        return NextResponse.json({ ok: false, error: hint }, { status: 424 })
      }
      return NextResponse.json({ ok: false, error: error.message }, { status: 400 })
    }

    return NextResponse.json({ ok: true, data: data ?? null })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Erro inesperado'
    return NextResponse.json({ ok: false, error: msg }, { status: 500 })
  }
}
