import { NextRequest, NextResponse } from "next/server"
import { createClient as createAdminClient } from "@supabase/supabase-js"
import { supabaseServer } from "@/lib/supabaseServer"
import type { Database } from "~types/supabase"
import { hasPermission } from "@/lib/permissions"

// Server-side draft persistence for onboarding (per user + escola)
// Expects a table `onboarding_drafts` with columns:
// - id: uuid (default gen_random_uuid())
// - escola_id: text (or uuid) - matches escolas.id type
// - user_id: uuid
// - data: jsonb
// - step: int2/int4
// - updated_at: timestamptz default now()
// Unique index recommended on (escola_id, user_id)

export async function GET(
  _req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id: escolaId } = await context.params
    const sserver = await supabaseServer()
    const { data: userRes } = await sserver.auth.getUser()
    const user = userRes?.user
    if (!user) return NextResponse.json({ ok: false, error: "Não autenticado" }, { status: 401 })

    // Authorization: user must be linked with configurar_escola permission
    let authorized = false
    try {
      const { data: vinc } = await sserver
        .from("escola_usuarios")
        .select("papel")
        .eq("escola_id", escolaId)
        .eq("user_id", user.id)
        .limit(1)
      if (vinc && vinc.length > 0) {
        const papel = (vinc[0] as any).papel as any
        authorized = hasPermission(papel, 'configurar_escola')
      }
    } catch (_) {}

    if (!authorized) {
      try {
        const { data: adminLink } = await sserver
          .from("escola_administradores")
          .select("user_id")
          .eq("escola_id", escolaId)
          .eq("user_id", user.id)
          .limit(1)
        authorized = Boolean(adminLink && adminLink.length > 0)
      } catch (_) {}
    }

    if (!authorized) return NextResponse.json({ ok: false, error: "Sem permissão" }, { status: 403 })

    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
      return NextResponse.json({ ok: false, error: "Configuração Supabase ausente" }, { status: 500 })
    }

    const admin: any = createAdminClient<Database>(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    )

    const { data, error } = await admin
      .from("onboarding_drafts")
      .select("data, step, updated_at")
      .eq("escola_id", escolaId)
      .eq("user_id", user.id)
      .order("updated_at", { ascending: false })
      .limit(1)
      .single()

    if (error && error.code !== 'PGRST116') { // ignore no rows
      return NextResponse.json({ ok: false, error: error.message }, { status: 400 })
    }

    return NextResponse.json({ ok: true, draft: data ?? null })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ ok: false, error: message }, { status: 500 })
  }
}

export async function PUT(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id: escolaId } = await context.params
    const payload = await req.json().catch(() => ({}))
    const { step, data } = payload || {}

    const sserver = await supabaseServer()
    const { data: userRes } = await sserver.auth.getUser()
    const user = userRes?.user
    if (!user) return NextResponse.json({ ok: false, error: "Não autenticado" }, { status: 401 })

    // Lightweight auth: ensure user is linked to escola with configurar_escola (same as GET)
    let authorized = false
    try {
      const { data: vinc } = await sserver
        .from("escola_usuarios")
        .select("papel")
        .eq("escola_id", escolaId)
        .eq("user_id", user.id)
        .limit(1)
      if (vinc && vinc.length > 0) {
        const papel = (vinc[0] as any).papel as any
        authorized = hasPermission(papel, 'configurar_escola')
      }
    } catch (_) {}
    if (!authorized) {
      try {
        const { data: adminLink } = await sserver
          .from("escola_administradores")
          .select("user_id")
          .eq("escola_id", escolaId)
          .eq("user_id", user.id)
          .limit(1)
        authorized = Boolean(adminLink && adminLink.length > 0)
      } catch (_) {}
    }

    if (!authorized) return NextResponse.json({ ok: false, error: "Sem permissão" }, { status: 403 })

    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
      return NextResponse.json({ ok: false, error: "Configuração Supabase ausente" }, { status: 500 })
    }

    const admin: any = createAdminClient<Database>(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    )

    const baseRow: any = {
      escola_id: escolaId,
      user_id: user.id,
      data: data ?? {},
      updated_at: new Date().toISOString(),
    }
    const row = Number.isFinite(step) ? { ...baseRow, step } : baseRow

    // Upsert on composite key (escola_id, user_id)
    const { error } = await admin
      .from("onboarding_drafts")
      .upsert(row, { onConflict: "escola_id,user_id" })

    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 400 })

    return NextResponse.json({ ok: true })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ ok: false, error: message }, { status: 500 })
  }
}

export async function DELETE(
  _req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id: escolaId } = await context.params
    const sserver = await supabaseServer()
    const { data: userRes } = await sserver.auth.getUser()
    const user = userRes?.user
    if (!user) return NextResponse.json({ ok: false, error: "Não autenticado" }, { status: 401 })

    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
      return NextResponse.json({ ok: false, error: "Configuração Supabase ausente" }, { status: 500 })
    }

    const admin: any = createAdminClient<Database>(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    )

    const { error } = await admin
      .from("onboarding_drafts")
      .delete()
      .eq("escola_id", escolaId)
      .eq("user_id", user.id)

    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 400 })

    return NextResponse.json({ ok: true })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ ok: false, error: message }, { status: 500 })
  }
}
