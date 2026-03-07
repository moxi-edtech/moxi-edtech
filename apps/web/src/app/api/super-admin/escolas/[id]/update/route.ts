import { NextResponse } from 'next/server'
import { createRouteClient } from '@/lib/supabase/route-client'
import { recordAuditClient } from '@/lib/auditClient'
import { parsePlanTier } from '@/config/plans'
import { invalidateEscolaSlugCache } from '@/lib/tenant/resolveEscolaParam'

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: escolaId } = await params
    const body = await req.json()
    const { updates } = body

    if (!escolaId || !updates) {
      return NextResponse.json({ ok: false, error: 'Dados insuficientes' }, { status: 400 })
    }

    const s = await createRouteClient()
    
    // AuthZ: Garantir que é Super Admin
    const { data: isSuperAdmin, error: authError } = await s.rpc('check_super_admin_role')
    if (authError || !isSuperAdmin) {
      return NextResponse.json({ ok: false, error: 'Somente Super Admin' }, { status: 403 })
    }

    const nextUpdates = { ...updates }
    const rawPlano = (nextUpdates as { plano?: string | null; plano_atual?: string | null }).plano
      ?? (nextUpdates as { plano?: string | null; plano_atual?: string | null }).plano_atual
      ?? null

    if (rawPlano) {
      const plano = parsePlanTier(rawPlano)
      const { data: assinaturaAtiva, error: assinaturaError } = await s
        .from('assinaturas')
        .select('id, status')
        .eq('escola_id', escolaId)
        .eq('status', 'activa')
        .order('updated_at', { ascending: false })
        .limit(1)
        .maybeSingle()

      if (assinaturaError) {
        return NextResponse.json({ ok: false, error: assinaturaError.message }, { status: 500 })
      }

      if (!assinaturaAtiva?.id) {
        return NextResponse.json(
          { ok: false, error: 'Assinatura activa não encontrada. Atualize via billing.' },
          { status: 400 }
        )
      }

      const { error: assinaturaUpdateError } = await s
        .from('assinaturas')
        .update({ plano })
        .eq('id', assinaturaAtiva.id)

      if (assinaturaUpdateError) {
        return NextResponse.json({ ok: false, error: assinaturaUpdateError.message }, { status: 500 })
      }

      delete (nextUpdates as { plano?: string | null }).plano
      delete (nextUpdates as { plano_atual?: string | null }).plano_atual
    }

    const { data: escolaBefore } = await s
      .from('escolas')
      .select('slug')
      .eq('id', escolaId)
      .maybeSingle()
    const oldSlug = escolaBefore?.slug ?? null

    // Executa a atualização
    const { error: updateError } = await s
      .from('escolas')
      .update({
        ...nextUpdates,
        updated_at: new Date().toISOString(),
      })
      .eq('id', escolaId)

    if (updateError) {
      return NextResponse.json({ ok: false, error: updateError.message }, { status: 500 })
    }

    const { data: escolaAfter } = await s
      .from('escolas')
      .select('slug')
      .eq('id', escolaId)
      .maybeSingle()
    const newSlug = escolaAfter?.slug ?? null

    invalidateEscolaSlugCache(oldSlug)
    invalidateEscolaSlugCache(newSlug)

    // O recordAuditClient agora usa a nossa nova API interna segura
    // (Nota: Como estamos no servidor, poderíamos usar recordAuditServer, 
    // mas para manter a consistência com o que o frontend espera, chamaremos a lógica de auditoria)
    
    return NextResponse.json({ ok: true })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ ok: false, error: message }, { status: 500 })
  }
}
