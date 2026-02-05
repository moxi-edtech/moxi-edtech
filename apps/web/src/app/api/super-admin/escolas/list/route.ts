import { NextResponse } from 'next/server'
import { supabaseServer } from '@/lib/supabaseServer'
import { parsePlanTier, type PlanTier } from '@/config/plans'
import { applyKf2ListInvariants } from '@/lib/kf2'

type EscolaItem = {
  id: string
  nome: string | null
  status: string | null
  plano: PlanTier | null
  last_access: string | null
  total_alunos: number
  total_professores: number
  cidade: string | null
  estado: string | null
}

export async function GET() {
  try {
    console.log('[super-admin/escolas/list] API route hit');
    // Auth: only super_admin
    const s = await supabaseServer()
    const { data: sess } = await s.auth.getUser()
    const user = sess?.user
    if (!user) {
      console.log('[super-admin/escolas/list] Not authenticated');
      return NextResponse.json({ ok: false, error: 'Não autenticado' }, { status: 401 })
    }
    console.log(`[super-admin/escolas/list] User authenticated: ${user.id}`);
    const { data: rows } = await s.from('profiles').select('role').eq('user_id', user.id).order('created_at', { ascending: false }).limit(1)
    const role = (rows?.[0] as any)?.role as string | undefined
    const allowed = ['super_admin', 'global_admin']
    console.log(`[super-admin/escolas/list] User role: ${role}`);
    if (!allowed.includes(role || '')) {
      console.log(`[super-admin/escolas/list] User role not allowed: ${role}`);
      return NextResponse.json({ ok: false, error: 'Somente Super Admin' }, { status: 403 })
    }

    // Função auxiliar para montar resposta a partir de uma consulta
    const orderByNome = [
      { column: 'nome', ascending: true },
      { column: 'id', ascending: false },
    ]

    async function queryWith(client: any) {
      // Tenta via view consolidada
      console.log('[super-admin/escolas/list] queryWith: Attempting to use escolas_view');
      let query = client
        .from('escolas_view' as any)
        .select('id, nome, status, plano_atual, plano, last_access, total_alunos, total_professores, cidade, estado')
        .neq('status', 'excluida' as any)

      query = applyKf2ListInvariants(query, { defaultLimit: 1000, order: orderByNome });

      const { data, error } = await query

      if (!error) {
        const items: EscolaItem[] = (data || []).map((e: any) => ({
          id: String(e.id),
          nome: e.nome ?? null,
          status: e.status ?? null,
          plano: e.plano_atual ? parsePlanTier(e.plano_atual) : e.plano ? parsePlanTier(e.plano) : null,
          last_access: e.last_access ?? null,
          total_alunos: Number(e.total_alunos ?? 0),
          total_professores: Number(e.total_professores ?? 0),
          cidade: e.cidade ?? null,
          estado: e.estado ?? null,
        }))
        console.log(`[super-admin/escolas/list] queryWith: Success with escolas_view. Items found: ${items.length}`);
        return { ok: true as const, items }
      }

      console.error(`[super-admin/escolas/list] queryWith: Error with escolas_view: ${error.message}`);
      const code = (error as any)?.code as string | undefined
      const msg = (error as any)?.message as string | undefined
      const isMissingView = (
        code === '42P01' ||
        (msg && /does not exist|relation .* does not exist|schema cache|Could not find .* in the schema cache/i.test(msg))
      )
      if (!isMissingView) {
        console.error(`[super-admin/escolas/list] queryWith: Error is not a missing view. Code: ${code}, Msg: ${msg}`);
        return { ok: false as const, error }
      }

      // Fallback: usa tabela 'escolas' com subset de colunas
      console.log('[super-admin/escolas/list] queryWith: Fallback to escolas table');
      let fallbackQuery = client
        .from('escolas' as any)
        .select('id, nome, status, plano_atual, endereco')
        .neq('status', 'excluida' as any)
      
      fallbackQuery = applyKf2ListInvariants(fallbackQuery, { defaultLimit: 1000, order: orderByNome });
      
      const { data: raw, error: e2 } = await fallbackQuery;
      if (e2) {
        console.error(`[super-admin/escolas/list] queryWith: Error with fallback escolas table: ${e2.message}`);
        return { ok: false as const, error: e2 }
      }

      const items: EscolaItem[] = (raw || []).map((e: any) => ({
        id: String(e.id),
        nome: e.nome ?? null,
        status: e.status ?? null,
        plano: e.plano_atual ? parsePlanTier(e.plano_atual) : e.plano ? parsePlanTier(e.plano) : null,
        last_access: null,
        total_alunos: 0,
        total_professores: 0,
        cidade: e.endereco ?? null,
        estado: null,
      }))
      if (process.env.NODE_ENV !== 'production') {
        const reason = msg || code || 'unknown'
        console.warn(`[super-admin/escolas/list] Fallback ativo: usando tabela 'escolas'. reason=${reason}; items=${items.length}`)
      }
      console.log(`[super-admin/escolas/list] queryWith: Success with fallback. Items found: ${items.length}`);
      return { ok: true as const, items }
    }

    console.log('[super-admin/escolas/list] Using authenticated client');
    const r2 = await queryWith(s as any)
    if (r2.ok) {
      console.log('[super-admin/escolas/list] Authenticated client succeeded');
      return NextResponse.json({ ok: true, items: r2.items })
    }
    console.error(`[super-admin/escolas/list] Authenticated client failed: ${(r2 as any).error?.message}`);
    return NextResponse.json({ ok: false, error: (r2 as any).error?.message || 'Erro ao listar escolas' }, { status: 400 })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error(`[super-admin/escolas/list] Unhandled error: ${message}`);
    return NextResponse.json({ ok: false, error: message }, { status: 500 })
  }
}
