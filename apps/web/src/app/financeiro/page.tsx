
import PortalLayout from "@/components/layout/PortalLayout";
import AuditPageView from "@/components/audit/AuditPageView";
import { supabaseServer } from "@/lib/supabaseServer";
import Link from "next/link";

export default async function Page() {
  const s = await supabaseServer()
  const { data: prof } = await s.from('profiles').select('escola_id').order('created_at', { ascending: false }).limit(1)
  const escolaId = prof?.[0]?.escola_id as string | null

  if (!escolaId) {
    return (
      <PortalLayout>
        <AuditPageView portal="financeiro" action="PAGE_VIEW" entity="home" />
        <div className="p-4 bg-amber-50 border border-amber-200 rounded text-amber-800 text-sm">
          Vincule seu perfil a uma escola para ver dados financeiros.
        </div>
      </PortalLayout>
    )
  }

  const [ paid, pending, all, escola ] = await Promise.all([
    s.from('pagamentos').select('valor', { head: false }).eq('escola_id', escolaId).eq('status', 'pago'),
    s.from('pagamentos').select('valor', { head: false }).eq('escola_id', escolaId).eq('status', 'pendente'),
    s.from('pagamentos').select('id', { count: 'exact', head: true }).eq('escola_id', escolaId),
    s.from('escolas').select('plano').eq('id', escolaId).maybeSingle(),
  ])

  const sum = (rows: any[] | null | undefined) => (rows || []).reduce((acc, r) => acc + Number(r.valor || 0), 0)
  const totalPago = sum(paid.data)
  const totalPendente = sum(pending.data)
  const total = totalPago + totalPendente
  const percentPago = total ? Math.round((totalPago / total) * 100) : 0
  const totalPagamentos = all.count ?? 0

  const plan = ((escola as any)?.data?.plano || 'basico') as 'basico'|'standard'|'premium'

  const isStandard = plan === 'standard' || plan === 'premium'
  const isPremium = plan === 'premium'

  return (
    <PortalLayout>
      <AuditPageView portal="financeiro" action="PAGE_VIEW" entity="home" />
      <div className="mb-4 text-sm text-gray-600">Plano atual: <b className="uppercase">{plan}</b></div>
      <div className="grid md:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-xl shadow border">
          <h2 className="text-gray-600 text-sm font-medium">Valor Pago</h2>
          <p className="text-3xl font-bold text-green-600 mt-2">R$ {totalPago.toFixed(2)}</p>
          <p className="text-gray-400 text-sm">{percentPago}% do total</p>
        </div>
        <div className="bg-white p-6 rounded-xl shadow border">
          <h2 className="text-gray-600 text-sm font-medium">Valor Pendente</h2>
          <p className="text-3xl font-bold text-amber-600 mt-2">R$ {totalPendente.toFixed(2)}</p>
          <p className="text-gray-400 text-sm">A receber</p>
        </div>
        <div className="bg-white p-6 rounded-xl shadow border">
          <h2 className="text-gray-600 text-sm font-medium">Ações rápidas</h2>
          <div className="mt-2 flex flex-wrap gap-2">
            <Link href="/financeiro/pagamentos" className="px-3 py-1.5 text-xs bg-gray-100 border rounded">Pagamentos</Link>
            <Link href="/financeiro/relatorios" className="px-3 py-1.5 text-xs bg-gray-100 border rounded">Relatórios</Link>
            {isStandard ? (
              <Link href="/financeiro/boletos" className="px-3 py-1.5 text-xs bg-blue-50 text-blue-700 border border-blue-200 rounded">Gerar Boleto/Link</Link>
            ) : (
              <span className="px-3 py-1.5 text-xs bg-gray-50 text-gray-400 border rounded cursor-not-allowed" title="Requer plano Standard">Gerar Boleto/Link</span>
            )}
            {isStandard ? (
              <Link href="/financeiro/relatorios/detalhados" className="px-3 py-1.5 text-xs bg-blue-50 text-blue-700 border border-blue-200 rounded">Relatórios Detalhados</Link>
            ) : (
              <span className="px-3 py-1.5 text-xs bg-gray-50 text-gray-400 border rounded cursor-not-allowed" title="Requer plano Standard">Relatórios Detalhados</span>
            )}
            {isStandard ? (
              <Link href="/financeiro/alertas" className="px-3 py-1.5 text-xs bg-blue-50 text-blue-700 border border-blue-200 rounded">Alertas</Link>
            ) : (
              <span className="px-3 py-1.5 text-xs bg-gray-50 text-gray-400 border rounded cursor-not-allowed" title="Requer plano Standard">Alertas</span>
            )}
            {isStandard ? (
              <Link href="/financeiro/exportacoes" className="px-3 py-1.5 text-xs bg-blue-50 text-blue-700 border border-blue-200 rounded">Exportar Excel/PDF</Link>
            ) : (
              <span className="px-3 py-1.5 text-xs bg-gray-50 text-gray-400 border rounded cursor-not-allowed" title="Requer plano Standard">Exportar Excel/PDF</span>
            )}
            {isPremium ? (
              <Link href="/financeiro/fiscal" className="px-3 py-1.5 text-xs bg-purple-50 text-purple-700 border border-purple-200 rounded">Módulo Fiscal</Link>
            ) : (
              <span className="px-3 py-1.5 text-xs bg-gray-50 text-gray-400 border rounded cursor-not-allowed" title="Requer plano Premium">Módulo Fiscal</span>
            )}
            {isPremium ? (
              <Link href="/financeiro/contabilidade" className="px-3 py-1.5 text-xs bg-purple-50 text-purple-700 border border-purple-200 rounded">Integração Contábil</Link>
            ) : (
              <span className="px-3 py-1.5 text-xs bg-gray-50 text-gray-400 border rounded cursor-not-allowed" title="Requer plano Premium">Integração Contábil</span>
            )}
            {isPremium ? (
              <Link href="/financeiro/dashboards" className="px-3 py-1.5 text-xs bg-purple-50 text-purple-700 border border-purple-200 rounded">Dashboards Avançados</Link>
            ) : (
              <span className="px-3 py-1.5 text-xs bg-gray-50 text-gray-400 border rounded cursor-not-allowed" title="Requer plano Premium">Dashboards Avançados</span>
            )}
          </div>
          <p className="text-xs text-gray-400 mt-2">Total de pagamentos: {totalPagamentos}</p>
        </div>
      </div>
      {(plan === 'basico' || plan === 'standard') && (
        <div className="mt-6 p-4 bg-amber-50 border border-amber-200 rounded text-amber-800 text-sm">
          {plan === 'basico' ? (
            <>
              <div className="font-medium">Desbloqueie recursos do plano Standard:</div>
              <ul className="list-disc ml-5 mt-1">
                <li>Geração de boletos/links de pagamento</li>
                <li>Relatórios financeiros detalhados</li>
                <li>Alertas automáticos para inadimplentes</li>
                <li>Exportação Excel/PDF</li>
              </ul>
              <div className="mt-2">Fale com o administrador da escola para atualizar o plano.</div>
            </>
          ) : (
            <>
              <div className="font-medium">Desbloqueie recursos do plano Premium:</div>
              <ul className="list-disc ml-5 mt-1">
                <li>Módulo Fiscal (NF-e, AGT)</li>
                <li>Integração com contabilidade</li>
                <li>Dashboards financeiros avançados</li>
              </ul>
              <div className="mt-2">Fale com o administrador da escola para atualizar o plano.</div>
            </>
          )}
        </div>
      )}
    </PortalLayout>
  )
}
