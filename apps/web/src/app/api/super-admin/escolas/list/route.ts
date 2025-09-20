import { NextResponse } from 'next/server'
import { supabaseServer } from '@/lib/supabaseServer'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import type { Database } from '~types/supabase'

type EscolaItem = {
  id: string
  nome: string | null
  status: string | null
  plano: string | null
  last_access: string | null
  total_alunos: number
  total_professores: number
  cidade: string | null
  estado: string | null
}

export async function GET() {
  try {
    // Auth: only super_admin
    const s = await supabaseServer()
    const { data: sess } = await s.auth.getUser()
    const user = sess?.user
    if (!user) return NextResponse.json({ ok: false, error: 'Não autenticado' }, { status: 401 })
    const { data: rows } = await s.from('profiles').select('role').eq('user_id', user.id).order('created_at', { ascending: false }).limit(1)
    const role = (rows?.[0] as any)?.role as string | undefined
    if (role !== 'super_admin') return NextResponse.json({ ok: false, error: 'Somente Super Admin' }, { status: 403 })

    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
      return NextResponse.json({ ok: false, error: 'Configuração do Supabase ausente' }, { status: 500 })
    }

    const admin = createAdminClient<Database>(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!) as any

    // Prefer consolidated view to avoid column mismatches across environments.
    // The view exists in migrations and falls back gracefully when optional columns are absent.
    const { data, error } = await admin
      .from('escolas_view' as any)
      .select('id, nome, status, plano, last_access, total_alunos, total_professores, cidade, estado')
      .neq('status', 'excluida' as any)
      .order('nome', { ascending: true })
      .limit(1000)

    if (error) {
      // Fallback quando a view não existir no ambiente (ex.: dev sem migrações aplicadas)
      const code = (error as any)?.code as string | undefined
      const msg = (error as any)?.message as string | undefined
      const isMissingView = (
        code === '42P01' ||
        // PostgREST/Supabase sometimes reports missing relations via schema cache messages
        (msg && /does not exist|relation .* does not exist|schema cache|Could not find .* in the schema cache/i.test(msg))
      )

      if (isMissingView) {
        const { data: raw, error: e2 } = await admin
          .from('escolas' as any)
          .select('id, nome, status, plano, endereco')
          .neq('status', 'excluida' as any)
          .order('nome', { ascending: true })
          .limit(1000)
        if (e2) {
          return NextResponse.json({ ok: false, error: e2.message }, { status: 400 })
        }
        const ids = (raw || []).map((e: any) => String(e.id))

        // Tenta obter contagens reais em dev mesmo sem a view
        let alunosByEscola = new Map<string, number>()
        let profsByEscola = new Map<string, number>()
        try {
          if (ids.length > 0) {
            const { data: alunos } = await admin
              .from('alunos' as any)
              .select('escola_id')
              .in('escola_id', ids as any)
              .limit(200000)
            for (const a of (alunos || []) as any[]) {
              const k = String((a as any).escola_id)
              alunosByEscola.set(k, (alunosByEscola.get(k) ?? 0) + 1)
            }

            const { data: profs } = await admin
              .from('profiles' as any)
              .select('escola_id')
              .eq('role', 'professor' as any)
              .in('escola_id', ids as any)
              .limit(200000)
            for (const p of (profs || []) as any[]) {
              const k = String((p as any).escola_id)
              profsByEscola.set(k, (profsByEscola.get(k) ?? 0) + 1)
            }
          }
        } catch (_) {
          // Ignora falhas de contagem; permanecerá 0
        }

        const items: EscolaItem[] = (raw || []).map((e: any) => {
          const id = String(e.id)
          return {
            id,
            nome: e.nome ?? null,
            status: e.status ?? null,
            plano: e.plano ?? null,
            last_access: null,
            total_alunos: Number(alunosByEscola.get(id) ?? 0),
            total_professores: Number(profsByEscola.get(id) ?? 0),
            cidade: e.endereco ?? null,
            estado: null,
          }
        })
        if (process.env.NODE_ENV !== 'production') {
          const reason = msg || code || 'unknown'
          console.warn(`[super-admin/escolas/list] Fallback ativo (dev): usando tabela 'escolas'. reason=${reason}; items=${items.length}`)
        }
        return NextResponse.json({ ok: true, items, fallback: 'escolas' })
      }

      return NextResponse.json({ ok: false, error: error.message }, { status: 400 })
    }

    const items: EscolaItem[] = (data || []).map((e: any) => ({
      id: String(e.id),
      nome: e.nome ?? null,
      status: e.status ?? null,
      plano: e.plano ?? null,
      last_access: e.last_access ?? null,
      total_alunos: Number(e.total_alunos ?? 0),
      total_professores: Number(e.total_professores ?? 0),
      cidade: e.cidade ?? null,
      estado: e.estado ?? null,
    }))

    return NextResponse.json({ ok: true, items })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ ok: false, error: message }, { status: 500 })
  }
}
