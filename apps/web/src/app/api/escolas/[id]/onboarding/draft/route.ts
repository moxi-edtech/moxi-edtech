import { NextRequest, NextResponse } from "next/server"
import { supabaseServer } from "@/lib/supabaseServer"
import { assertEscolaAccessAndPermissions } from "@/lib/api/assertEscolaAccessAndPermissions"
import { recordAuditServer } from "@/lib/audit"
import { applyKf2ListInvariants } from "@/lib/kf2"

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

    const access = await assertEscolaAccessAndPermissions({
      client: sserver as any,
      userId: user.id,
      requestedEscolaId: escolaId,
      requiredPermissions: ['configurar_escola'],
    })
    if (!access.ok) {
      return NextResponse.json({ ok: false, error: access.error, code: access.code }, { status: access.status })
    }

    let draftQuery = (sserver as any)
      .from("onboarding_drafts")
      .select("data, step, updated_at")
      .eq("escola_id", access.escolaId)
      .eq("user_id", user.id)

    draftQuery = applyKf2ListInvariants(draftQuery, { defaultLimit: 1, order: [{ column: "updated_at", ascending: false }] })

    const { data, error } = await draftQuery.single()

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

    const access = await assertEscolaAccessAndPermissions({
      client: sserver as any,
      userId: user.id,
      requestedEscolaId: escolaId,
      requiredPermissions: ['configurar_escola'],
    })
    if (!access.ok) {
      return NextResponse.json({ ok: false, error: access.error, code: access.code }, { status: access.status })
    }

    const baseRow: any = {
      escola_id: access.escolaId,
      user_id: user.id,
      data: data ?? {},
      updated_at: new Date().toISOString(),
    }
    const row = Number.isFinite(step) ? { ...baseRow, step } : baseRow

    // Upsert on composite key (escola_id, user_id)
    const { error } = await (sserver as any)
      .from("onboarding_drafts")
      .upsert(row, { onConflict: "escola_id,user_id" })

    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 400 })

    recordAuditServer({
      escolaId: access.escolaId,
      portal: "admin_escola",
      acao: "ONBOARDING_DRAFT_SAVED",
      entity: "onboarding_drafts",
      details: { step: row.step ?? null },
    }).catch(() => null)

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

    const access = await assertEscolaAccessAndPermissions({
      client: sserver as any,
      userId: user.id,
      requestedEscolaId: escolaId,
      requiredPermissions: ['configurar_escola'],
    })
    if (!access.ok) {
      return NextResponse.json({ ok: false, error: access.error, code: access.code }, { status: access.status })
    }

    const { error } = await (sserver as any)
      .from("onboarding_drafts")
      .delete()
      .eq("escola_id", access.escolaId)
      .eq("user_id", user.id)

    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 400 })

    recordAuditServer({
      escolaId: access.escolaId,
      portal: "admin_escola",
      acao: "ONBOARDING_DRAFT_DELETED",
      entity: "onboarding_drafts",
    }).catch(() => null)

    return NextResponse.json({ ok: true })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ ok: false, error: message }, { status: 500 })
  }
}
