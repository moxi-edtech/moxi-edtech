import { NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import type { Database } from "~types/supabase"

// Returns onboarding progress per school for Super Admin view
// Shape: [{ escola_id, nome, onboarding_finalizado, last_step, last_updated_at }]
export async function GET() {
  try {
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
      return NextResponse.json({ ok: false, error: "Configuração do Supabase ausente" }, { status: 500 })
    }

    const admin: any = createClient<Database>(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    )

    // Fetch basic schools
    let escolas: any[] | null = null
    {
      const sel = 'id, nome, onboarding_finalizado, onboarding_completed_at, needs_academic_setup'
      const { data, error } = await admin
        .from('escolas')
        .select(sel)
        .order('nome', { ascending: true })
        .limit(500)
      if (error) {
        const msg = String(error.message || '')
        if (msg.includes('needs_academic_setup') || msg.toLowerCase().includes('schema cache')) {
          const { data: data2, error: err2 } = await admin
            .from('escolas')
            .select('id, nome, onboarding_finalizado, onboarding_completed_at')
            .order('nome', { ascending: true })
            .limit(500)
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
    const { data: drafts } = await admin
      .from('onboarding_drafts')
      .select('escola_id, step, updated_at')
      .order('updated_at', { ascending: false })
      .limit(2000)

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
      const done = Boolean(e.onboarding_finalizado) || Boolean((e as any).onboarding_completed_at)
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
