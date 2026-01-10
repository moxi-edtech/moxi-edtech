import PortalLayout from "@/components/layout/PortalLayout";
import AuditPageView from "@/components/audit/AuditPageView";
import { supabaseServer } from "@/lib/supabaseServer";
import Link from "next/link";
import { parsePlanTier, PLAN_NAMES, type PlanTier } from "@/config/plans";
import { getAbsoluteUrl } from "@/lib/utils";

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const awaitedParams = await params;
  const escolaId = awaitedParams.id
  const s = await supabaseServer()

  const [ paid, pending, all, detalhes, dashboardResumo ] = await Promise.all([
    s.from('pagamentos').select('valor', { head: false }).eq('escola_id', escolaId).eq('status', 'pago'),
    s.from('pagamentos').select('valor', { head: false }).eq('escola_id', escolaId).eq('status', 'pendente'),
    s.from('pagamentos').select('id', { count: 'exact', head: true }).eq('escola_id', escolaId),
    fetch(getAbsoluteUrl(`/api/escolas/${escolaId}/nome`), { cache: 'force-cache' }).then(r => r.json()).catch(() => null),
    fetch(getAbsoluteUrl(`/api/financeiro?escolaId=${escolaId}`), { cache: 'force-cache' }).then(r => r.json()).catch(() => null),
  ])

  const sum = (rows: any[] | null | undefined) => (rows || []).reduce((acc, r) => acc + Number(r.valor || 0), 0)
  const totalPago = sum(paid.data)
  const totalPendente = sum(pending.data)
  const total = totalPago + totalPendente
  const percentPago = total ? Math.round((totalPago / total) * 100) : 0
  const totalPagamentos = all.count ?? 0

  const cursosPendentesPorEscola = (dashboardResumo as any)?.cursosPendentes?.totalPorEscola || {}
  const cursosPendentes = Number(cursosPendentesPorEscola[escolaId] || 0)

  const plan: PlanTier = parsePlanTier((detalhes as any)?.plano);

  const isStandard = plan === 'profissional' || plan === 'premium';
  const isPremium = plan === 'premium';

  return (
    <PortalLayout>
      <AuditPageView portal="financeiro" acao="PAGE_VIEW" entity="home" />
      <div className="mb-4 text-sm text-moxinexa-gray">Plano atual: <b className="uppercase">{PLAN_NAMES[plan]}</b></div>
      {cursosPendentes > 0 && (
        <div className="mb-4 rounded-xl border-2 border-amber-500 bg-amber-50 p-4 text-amber-900 shadow-sm">
          <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
            <div>
              <div className="text-base font-semibold">Cursos sem tabela de preços configurada</div>
              <p className="text-sm">{cursosPendentes} curso(s) desta escola precisam de uma tabela de preços para gerar propinas corretamente.</p>
            </div>
            <Link
              href="configuracoes/precos"
              className="inline-flex items-center justify-center rounded-lg bg-amber-600 px-4 py-2 text-sm font-semibold text-white shadow hover:bg-amber-700"
            >
              Configurar preços agora
            </Link>
          </div>
        </div>
      )}
      <div className="grid md:grid-cols-3 gap-6">
        {/* Cards principais - corrigindo bordas */}
        <div className="bg-white p-6 rounded-xl shadow border border-gray-200">
          <h2 className="text-moxinexa-gray text-sm font-medium">Valor Pago</h2>
          <p className="text-3xl font-bold text-moxinexa-teal mt-2">AOA {totalPago.toFixed(2)}</p>
          <p className="text-moxinexa-gray text-sm">{percentPago}% do total</p>
        </div>
        <div className="bg-white p-6 rounded-xl shadow border border-gray-200">
          <h2 className="text-moxinexa-gray text-sm font-medium">Valor Pendente</h2>
          <p className="text-3xl font-bold text-amber-600 mt-2">AOA {totalPendente.toFixed(2)}</p>
          <p className="text-moxinexa-gray text-sm">A receber</p>
        </div>
        <div className="bg-white p-6 rounded-xl shadow border border-gray-200">
          <h2 className="text-moxinexa-gray text-sm font-medium">Ações rápidas</h2>
          <div className="mt-2 flex flex-wrap gap-2">
            {/* Links ativos */}
            <Link href="pagamentos" className="px-3 py-1.5 text-xs bg-moxinexa-light border border-gray-300 rounded font-sans hover:border-moxinexa-teal transition-colors">Pagamentos</Link>
            <Link href="relatorios" className="px-3 py-1.5 text-xs bg-moxinexa-light border border-gray-300 rounded font-sans hover:border-moxinexa-teal transition-colors">Relatórios</Link>
            
            {/* Links condicionais */}
            {isStandard ? (
              <Link href="boletos" className="px-3 py-1.5 text-xs bg-blue-50 text-blue-700 border border-blue-300 rounded font-sans hover:border-blue-500 transition-colors">Gerar Boleto/Link</Link>
            ) : (
              <span className="px-3 py-1.5 text-xs bg-gray-50 text-gray-400 border border-gray-300 rounded cursor-not-allowed font-sans">Gerar Boleto/Link</span>
            )}
            {isStandard ? (
              <Link href="relatorios/detalhados" className="px-3 py-1.5 text-xs bg-blue-50 text-blue-700 border border-blue-300 rounded font-sans hover:border-blue-500 transition-colors">Relatórios Detalhados</Link>
            ) : (
              <span className="px-3 py-1.5 text-xs bg-gray-50 text-gray-400 border border-gray-300 rounded cursor-not-allowed font-sans">Relatórios Detalhados</span>
            )}
            {isStandard ? (
              <Link href="alertas" className="px-3 py-1.5 text-xs bg-blue-50 text-blue-700 border border-blue-300 rounded font-sans hover:border-blue-500 transition-colors">Alertas</Link>
            ) : (
              <span className="px-3 py-1.5 text-xs bg-gray-50 text-gray-400 border border-gray-300 rounded cursor-not-allowed font-sans">Alertas</span>
            )}
            {isStandard ? (
              <Link href="exportacoes" className="px-3 py-1.5 text-xs bg-blue-50 text-blue-700 border border-blue-300 rounded font-sans hover:border-blue-500 transition-colors">Exportar Excel/PDF</Link>
            ) : (
              <span className="px-3 py-1.5 text-xs bg-gray-50 text-gray-400 border border-gray-300 rounded cursor-not-allowed font-sans">Exportar Excel/PDF</span>
            )}
            {isPremium ? (
              <Link href="fiscal" className="px-3 py-1.5 text-xs bg-purple-50 text-purple-700 border border-purple-300 rounded font-sans hover:border-purple-500 transition-colors">Módulo Fiscal</Link>
            ) : (
              <span className="px-3 py-1.5 text-xs bg-gray-50 text-gray-400 border border-gray-300 rounded cursor-not-allowed font-sans">Módulo Fiscal</span>
            )}
            {isPremium ? (
              <Link href="contabilidade" className="px-3 py-1.5 text-xs bg-purple-50 text-purple-700 border border-purple-300 rounded font-sans hover:border-purple-500 transition-colors">Integração Contábil</Link>
            ) : (
              <span className="px-3 py-1.5 text-xs bg-gray-50 text-gray-400 border border-gray-300 rounded cursor-not-allowed font-sans">Integração Contábil</span>
            )}
            {isPremium ? (
              <Link href="dashboards" className="px-3 py-1.5 text-xs bg-purple-50 text-purple-700 border border-purple-300 rounded font-sans hover:border-purple-500 transition-colors">Dashboards Avançados</Link>
            ) : (
              <span className="px-3 py-1.5 text-xs bg-gray-50 text-gray-400 border border-gray-300 rounded cursor-not-allowed font-sans">Dashboards Avançados</span>
            )}
          </div>
          <p className="text-xs text-moxinexa-gray mt-2 font-sans">Total de pagamentos: {totalPagamentos}</p>
        </div>
      </div>
      
      {/* Banner de upgrade */}
      {(plan === 'essencial' || plan === 'profissional') && (
        <div className="mt-6 p-4 bg-amber-50 border border-amber-300 rounded text-amber-800 text-sm font-sans">
          {plan === 'essencial' ? (
            <>
              <div className="font-medium">Desbloqueie recursos do plano Profissional:</div>
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
