import { NextResponse } from "next/server"
import { supabaseServer } from "@/lib/supabaseServer"
import { applyKf2ListInvariants } from "@/lib/kf2"
import { isSuperAdminRole } from "@/lib/auth/requireSuperAdminAccess"

// Returns onboarding progress per school for Super Admin view
// Shape: [{ escola_id, nome, onboarding_finalizado, last_step, last_updated_at }]
export async function GET() {
  try {
    const s = await supabaseServer()
    const { data: sess } = await s.auth.getUser()
    const user = sess?.user
    if (!user) return NextResponse.json({ ok: false, error: 'Não autenticado' }, { status: 401 })
    const { data: rows } = await s
      .from('profiles')
      .select('role')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(1)
    const role = (rows?.[0] as any)?.role as string | undefined
    if (!isSuperAdminRole(role)) {
      return NextResponse.json({ ok: false, error: 'Somente Super Admin' }, { status: 403 })
    }

    // Fetch basic schools
    let escolas: { id: string; nome: string; onboarding_finalizado: boolean; needs_academic_setup: boolean }[] | null = null
    {
      const sel = 'id, nome, onboarding_finalizado, needs_academic_setup'
      let escolasQuery = s
        .from('escolas')
        .select(sel)
        .order('nome', { ascending: true })

      escolasQuery = applyKf2ListInvariants(escolasQuery, { defaultLimit: 1000 })

      const { data, error } = await escolasQuery
      if (error) {
        return NextResponse.json({ ok: false, error: error.message }, { status: 400 })
      }
      escolas = (data || []).map(e => ({
        id: e.id,
        nome: e.nome,
        onboarding_finalizado: Boolean(e.onboarding_finalizado),
        needs_academic_setup: Boolean(e.needs_academic_setup),
      }))
    }

    // Fetch all drafts (limited) ordered by updated_at desc to pick the latest per escola
    let draftsQuery = s
      .from('onboarding_drafts')
      .select('escola_id, step, updated_at')
      .order('updated_at', { ascending: false })

    draftsQuery = applyKf2ListInvariants(draftsQuery, { defaultLimit: 1000 })

    const { data: drafts } = await draftsQuery

    const latestByEscola = new Map<string, { step: number | null, updated_at: string | null }>()
    for (const d of drafts || []) {
      const eid = String(d.escola_id)
      if (!latestByEscola.has(eid)) {
        latestByEscola.set(eid, { step: d.step ?? null, updated_at: d.updated_at ?? null })
      }
    }

    const result = (escolas || []).map((e) => {
      const id = String(e.id)
      const latest = latestByEscola.get(id) || { step: null, updated_at: null }
      const done = Boolean(e.onboarding_finalizado)
      return {
        escola_id: id,
        nome: e.nome,
        onboarding_finalizado: done,
        last_step: latest.step,
        last_updated_at: latest.updated_at,
        needs_academic_setup: Boolean(e.needs_academic_setup),
      }
    })

    return NextResponse.json({ ok: true, items: result })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ ok: false, error: message }, { status: 500 })
  }
}
