import AuditPageView from "@/components/audit/AuditPageView"
import PrecosClient from "@/app/escola/[id]/financeiro/configuracoes/precos/PrecosClient"
import { supabaseServer } from "@/lib/supabaseServer"
import { GerarMensalidadesModal } from "@/components/financeiro/GerarMensalidadesModal"
import { RegistrarPagamentoButton } from "@/components/financeiro/RegistrarPagamentoButton"
import Link from "next/link"

export const dynamic = "force-dynamic"

export default async function Page() {
  const s = await supabaseServer()
  const { data: userRes } = await s.auth.getUser()
  const user = userRes?.user

  let escolaId: string | null = null
  if (user) {
    escolaId =
      (user.app_metadata as any)?.escola_id ||
      (user.user_metadata as any)?.escola_id ||
      null

    if (!escolaId) {
      const { data: prof } = await s
        .from('profiles')
        .select('current_escola_id, escola_id')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(1)
      escolaId = (prof?.[0] as any)?.current_escola_id || (prof?.[0] as any)?.escola_id || null
    }
  }

  const { data: pendencias } = await s
    .from('mensalidades')
    .select('id, valor_previsto, data_vencimento, status')
    .eq('escola_id', escolaId || '')
    .neq('status', 'pago')
    .order('data_vencimento', { ascending: true })
    .limit(5)

  if (!escolaId) {
    return (
      <>
        <AuditPageView portal="financeiro" acao="PAGE_VIEW" entity="financeiro_precos" />
        <div className="p-4 bg-amber-50 border border-amber-200 rounded text-amber-800 text-sm">
          Vincule seu perfil a uma escola para configurar tabelas de preço.
        </div>
      </>
    )
  }

  return (
    <>
      <AuditPageView portal="financeiro" acao="PAGE_VIEW" entity="financeiro_precos" />

      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mb-4">
        <div>
          <h1 className="text-2xl font-bold text-moxinexa-navy">Tabelas de Preço</h1>
          <p className="text-sm text-slate-600">Configure valores e gere cobranças a partir desta escola.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <GerarMensalidadesModal escolaId={escolaId} />
          <Link href="/financeiro" className="text-sm px-3 py-1.5 rounded border border-gray-300 hover:bg-gray-50">Ver painel financeiro</Link>
        </div>
      </div>

      {Array.isArray(pendencias) && pendencias.length > 0 && (
        <div className="mb-6 bg-white border border-gray-200 rounded-xl p-4 shadow-sm space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="font-semibold text-gray-800">Pagamentos rápidos</h2>
              <p className="text-sm text-gray-500">Mensalidades pendentes recentes para registro manual.</p>
            </div>
            <span className="text-xs text-gray-500">Máx. 5 registros</span>
          </div>
          <div className="space-y-2">
            {pendencias.map((p) => (
              <div key={p.id} className="flex items-center justify-between gap-3 border border-gray-100 rounded-lg px-3 py-2">
                <div>
                  <div className="text-sm font-medium text-gray-800">{p.data_vencimento ? new Date(p.data_vencimento).toLocaleDateString('pt-PT') : 'Sem vencimento'}</div>
                  <div className="text-xs text-gray-500">Valor: {(p.valor_previsto ?? 0).toLocaleString('pt-AO')} Kz</div>
                </div>
                <RegistrarPagamentoButton mensalidadeId={p.id} valor={p.valor_previsto ?? 0} />
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="bg-white border border-slate-200 shadow-sm rounded-2xl p-4 md:p-6">
        <PrecosClient escolaId={escolaId} />
      </div>
    </>
  )
}
