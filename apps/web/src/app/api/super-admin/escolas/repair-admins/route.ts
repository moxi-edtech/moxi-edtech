import { NextRequest, NextResponse } from 'next/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import type { Database, TablesInsert } from '~types/supabase'
import { supabaseServer } from '@/lib/supabaseServer'
// ❌ REMOVIDO: import { generateNumeroLogin } from '@/lib/generateNumeroLogin'

type RepairResult = {
  escolaId: string
  escolaNome?: string | null
  status: 'ok' | 'skipped' | 'failed'
  reason?: string
  actions?: string[]
}

export async function POST(req: NextRequest) {
  try {
    // AuthZ: somente super_admin
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
    if (role !== 'super_admin') return NextResponse.json({ ok: false, error: 'Somente Super Admin' }, { status: 403 })

    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
      return NextResponse.json({ ok: false, error: 'Configuração Supabase ausente' }, { status: 500 })
    }

    const admin = createAdminClient<Database>(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    ) as any

    let targetEscolaId: string | null = null
    let dryRun = false
    try {
      const body = await req.json().catch(() => ({})) as any
      if (body && typeof body.escolaId === 'string' && body.escolaId.trim()) targetEscolaId = body.escolaId.trim()
      if (body && typeof body.dryRun === 'boolean') dryRun = body.dryRun
    } catch {}

    // 1) Carrega escolas alvo
    const { data: escolas, error: eErr } = await admin
      .from('escolas' as any)
      .select('id, nome, status')
      .order('created_at', { ascending: true })
    if (eErr) return NextResponse.json({ ok: false, error: eErr.message }, { status: 400 })
    const lista = (escolas || [])
      .filter((e: any) => !targetEscolaId || String(e.id) === targetEscolaId)

    const results: RepairResult[] = []

    for (const escola of lista) {
      const escolaId = String(escola.id)
      const escolaNome = (escola.nome as string | null) ?? null
      const actions: string[] = []

      // pular escolas excluídas
      if (escola.status === 'excluida') {
        results.push({ escolaId, escolaNome, status: 'skipped', reason: 'excluida' })
        continue
      }

      // 2) Verifica se já há admin vinculado
      const { data: vinc, error: vErr } = await admin
        .from('escola_users' as any)
        .select('user_id, papel')
        .eq('escola_id', escolaId)
        .in('papel', ['admin','staff_admin'] as any)
        .limit(1)
      if (vErr) {
        results.push({ escolaId, escolaNome, status: 'failed', reason: `erro ao ler vínculos: ${vErr.message}` })
        continue
      }
      if (vinc && vinc.length > 0) {
        results.push({ escolaId, escolaNome, status: 'skipped', reason: 'admin já vinculado' })
        continue
      }

      // 3) Tenta resolver admin por fontes alternativas
      let userId: string | undefined
      let email: string | undefined

      // 3.1) Tentativa via tabela antiga escola_administradores (se existir)
      try {
        const { data: old } = await admin
          .from('escola_administradores' as any)
          .select('user_id, email')
          .eq('escola_id', escolaId)
          .limit(1)
        if (old && old.length > 0) {
          userId = (old[0] as any).user_id as string | undefined
          email = (old[0] as any).email as string | undefined
          if (userId) actions.push('origem: escola_administradores')
        }
      } catch {}

      // 3.2) Tentativa via profiles com role admin+escola_id
      if (!userId) {
        try {
          const { data: prof } = await admin
            .from('profiles' as any)
            .select('user_id, email')
            .eq('escola_id', escolaId)
            .in('role', ['admin','global_admin'] as any)
            .limit(1)
          if (prof && prof.length > 0) {
            userId = (prof[0] as any).user_id as string | undefined
            email = (prof[0] as any).email as string | undefined
            if (userId) actions.push('origem: profiles admin+escola_id')
          }
        } catch {}
      }

      // 3.3) Sem userId: não há como criar sem email
      if (!userId && !email) {
        results.push({ escolaId, escolaNome, status: 'failed', reason: 'não foi possível determinar email/admin para esta escola' })
        continue
      }

      // 4) Se só temos email, criar usuário
      if (!userId && email) {
        try {
          if (!dryRun) {
            const { data: created, error: cErr } = await admin.auth.admin.createUser({
              email: email,
              email_confirm: false,
              user_metadata: { role: 'admin', must_change_password: true },
            })
            if (cErr) throw cErr
            userId = created?.user?.id as string | undefined
            actions.push('usuario criado via service role')
          } else {
            actions.push('DRY-RUN: criaria usuario via service role')
          }
        } catch (e: any) {
          results.push({ escolaId, escolaNome, status: 'failed', reason: `falha ao criar usuário: ${e?.message || 'erro'}` })
          continue
        }
      }

      if (!userId) {
        results.push({ escolaId, escolaNome, status: 'failed', reason: 'userId não resolvido' })
        continue
      }

      // 5) Upsert profile e vínculo
      try {
        if (!dryRun) {
          await admin.from('profiles' as any).upsert([
            {
              user_id: userId,
              email: email ?? null,
              role: 'admin' as any,
              escola_id: escolaId,
              current_escola_id: escolaId,
            } as TablesInsert<'profiles'> as any,
          ])
          actions.push('profiles upsert (role=admin, escola_id set)')
        } else {
          actions.push('DRY-RUN: profiles upsert')
        }
      } catch (e: any) {
        results.push({ escolaId, escolaNome, status: 'failed', reason: `falha upsert profiles: ${e?.message || 'erro'}` })
        continue
      }

      try {
        if (!dryRun) {
          await admin.from('escola_users' as any).upsert([
            { escola_id: escolaId, user_id: userId, papel: 'admin' } as any,
          ], { onConflict: 'escola_id,user_id' })
          actions.push('escola_users upsert (papel=admin)')
        } else {
          actions.push('DRY-RUN: escola_users upsert')
        }
      } catch (e: any) {
        results.push({ escolaId, escolaNome, status: 'failed', reason: `falha upsert escola_users: ${e?.message || 'erro'}` })
        continue
      }

      // 6) Antes: gerava numero_login para admin.
      // Agora, no modelo novo, numero_login é exclusivo do fluxo de matrícula (alunos).
      // Mantemos apenas o log/ação, sem gerar nada.
      if (!dryRun) {
        actions.push('numero_login não gerado para admin (modelo novo)')
      } else {
        actions.push('DRY-RUN: verificaria numero_login (sem gerar para admin)')
      }

      results.push({ escolaId, escolaNome, status: 'ok', actions })
    }

    return NextResponse.json({ ok: true, count: results.length, results })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ ok: false, error: message }, { status: 500 })
  }
}
