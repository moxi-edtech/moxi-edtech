import { NextRequest, NextResponse } from 'next/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import type { Database, TablesInsert } from '~types/supabase'
import { mapPapelToGlobalRole } from '@/lib/permissions'

type Papel = 'admin'|'staff_admin'|'secretaria'|'financeiro'|'professor'|'aluno'

export async function POST(req: NextRequest) {
  try {
    const hdr = req.headers.get('x-test-seed-key') || ''
    if (!process.env.TEST_SEED_KEY || hdr !== process.env.TEST_SEED_KEY) {
      return NextResponse.json({ ok: false, error: 'Not found' }, { status: 404 })
    }
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
      return NextResponse.json({ ok: false, error: 'SUPABASE keys missing' }, { status: 500 })
    }
    const admin = createAdminClient<Database>(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)

    const now = Date.now()
    const escolaNome = `E2E Escola ${now}`
    // Create school (minimal fields)
    const { data: escolaIns, error: escolaErr } = await (admin as any)
      .from('escolas')
      .insert({ nome: escolaNome, plano: 'basico', aluno_portal_enabled: true })
      .select('id, nome')
      .single()
    if (escolaErr || !escolaIns) return NextResponse.json({ ok: false, error: escolaErr?.message || 'Falha ao criar escola' }, { status: 400 })
    const escolaId = (escolaIns as any).id as string

    const seedPw = process.env.TEST_SEED_PASSWORD || 'Passw0rd!'
    const papeis: Papel[] = ['admin','staff_admin','secretaria','financeiro','professor','aluno']
    const users: Record<string, { email: string; password: string; papel: string }> = {}

    for (const papel of papeis) {
      const email = `e2e+${papel}.${now}@example.com`
      const roleEnum = mapPapelToGlobalRole(papel as any)
      const { data: cu, error: cuErr } = await (admin as any).auth.admin.createUser({
        email,
        password: seedPw,
        email_confirm: true,
        user_metadata: { nome: papel },
        app_metadata: { role: roleEnum, escola_id: escolaId },
      })
      if (cuErr) return NextResponse.json({ ok: false, error: cuErr.message }, { status: 400 })
      const userId = cu?.user?.id as string
      // Profile
      try {
        await (admin as any).from('profiles').upsert({
          user_id: userId,
          email,
          nome: papel,
          role: roleEnum as any,
          escola_id: escolaId,
        } as TablesInsert<'profiles'>)
      } catch {}
      // Link papel
      try {
        await (admin as any).from('escola_usuarios').upsert({ escola_id: escolaId, user_id: userId, papel } as TablesInsert<'escola_usuarios'>, { onConflict: 'escola_id,user_id' })
      } catch {}
      users[papel] = { email, password: seedPw, papel }
    }

    return NextResponse.json({ ok: true, escolaId, users })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ ok: false, error: message }, { status: 500 })
  }
}

