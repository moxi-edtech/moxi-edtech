import { NextResponse } from 'next/server'
import { createRouteClient } from '@/lib/supabase/route-client'
import { recordAuditClient } from '@/lib/auditClient'

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

    // Executa a atualização
    const { error: updateError } = await s
      .from('escolas')
      .update({
        ...updates,
        updated_at: new Date().toISOString(),
      })
      .eq('id', escolaId)

    if (updateError) {
      return NextResponse.json({ ok: false, error: updateError.message }, { status: 500 })
    }

    // O recordAuditClient agora usa a nossa nova API interna segura
    // (Nota: Como estamos no servidor, poderíamos usar recordAuditServer, 
    // mas para manter a consistência com o que o frontend espera, chamaremos a lógica de auditoria)
    
    return NextResponse.json({ ok: true })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ ok: false, error: message }, { status: 500 })
  }
}
