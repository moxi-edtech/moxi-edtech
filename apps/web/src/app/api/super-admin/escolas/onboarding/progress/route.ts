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
    let escolas: any[] | null = null
    {
      const sel = 'id, nome, onboarding_finalizado, needs_academic_setup'
      let escolasQuery = (s as any)
        .from('escolas')
        .select(sel)
        .order('nome', { ascending: true })

      escolasQuery = applyKf2ListInvariants(escolasQuery, { defaultLimit: 1000 })

      const { data, error } = await escolasQuery
      if (error) {
        const msg = String(error.message || '')
        if (msg.includes('needs_academic_setup') || msg.toLowerCase().includes('schema cache')) {
          let fallbackQuery = (s as any)
            .from('escolas')
            .select('id, nome, onboarding_finalizado')
            .order('nome', { ascending: true })

          fallbackQuery = applyKf2ListInvariants(fallbackQuery, { defaultLimit: 1000 })

          const { data: data2, error: err2 } = await fallbackQuery
          if (err2) {
            return NextResponse.json({ ok: false, error: err2.message }, { status: 400 })
          }
          escolas = data2 as any[]
        } else {
          return NextResponse.json({ ok: false, error: error.message }, { status: 400 })
        }
      } else {
        escolas = data as any[]
      }
    }

    // Fetch all drafts (limited) ordered by updated_at desc to pick the latest per escola
    let draftsQuery = (s as any)
      .from('onboarding_drafts')
      .select('escola_id, step, updated_at')
      .order('updated_at', { ascending: false })

    draftsQuery = applyKf2ListInvariants(draftsQuery, { defaultLimit: 1000 })

    const { data: drafts } = await draftsQuery

    const latestByEscola = new Map<string, { step: number | null, updated_at: string | null }>()
    for (const d of (drafts || []) as any[]) {
      const eid = String((d as any).escola_id)
      if (!latestByEscola.has(eid)) {
        latestByEscola.set(eid, { step: (d as any).step ?? null, updated_at: (d as any).updated_at ?? null })
      }
    }

    const result = (escolas || []).map((e: any) => {
      const id = String(e.id)
      const latest = latestByEscola.get(id) || { step: null, updated_at: null }
      const done = Boolean(e.onboarding_finalizado)
      return {
        escola_id: id,
        nome: e.nome as string | null,
        onboarding_finalizado: done,
        last_step: latest.step,
        last_updated_at: latest.updated_at,
        needs_academic_setup: Boolean((e as any).needs_academic_setup),
      }
    })

    return NextResponse.json({ ok: true, items: result })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ ok: false, error: message }, { status: 500 })
  }
}
