import AuditPageView from "@/components/audit/AuditPageView";
import { supabaseServer } from "@/lib/supabaseServer";
import Link from "next/link";
import { getPapelForEscola } from "@/lib/auth";
import { hasPermission } from "@/lib/permissions";
import SecretariaDashboardLoader from "@/components/secretaria/DashboardLoader";

export default async function Page() {
  const s = await supabaseServer()
  const { data: prof } = await s
    .from('profiles')
    .select('escola_id')
    .order('created_at', { ascending: false })
    .limit(1)

  const escolaId = prof?.[0]?.escola_id as string | null
  if (!escolaId) {
    return (
      <>
<AuditPageView portal="secretaria" acao="PAGE_VIEW" entity="home" />
        <div className="p-4 bg-amber-50 border border-amber-200 rounded text-amber-800 text-sm">
          Vincule seu perfil a uma escola para ver o painel.
        </div>
      </>
    )
  }

  const { data: esc } = await s.from('escolas').select('plano').eq('id', escolaId).maybeSingle()
  const plan = ((esc as any)?.plano || 'basico') as 'basico'|'standard'|'premium'

  // Papel & permissions for UI gating
  const papel = await getPapelForEscola(escolaId)
  const canCriarMatricula = hasPermission(papel as any, 'criar_matricula')

  return (
    <>
      <AuditPageView portal="secretaria" acao="PAGE_VIEW" entity="home" />
      <div className="mb-4 text-sm text-gray-600">Plano atual: <b className="uppercase">{plan}</b></div>
      <SecretariaDashboardLoader />
      <div className="grid md:grid-cols-1 gap-6 mt-6">
        <div className="bg-white p-6 rounded-xl shadow border">
          <h2 className="text-gray-600 text-sm font-medium mb-2">Ações rápidas</h2>
          <div className="mt-2 flex flex-wrap gap-2">
            <Link href="/secretaria/alunos" className="px-3 py-1.5 text-xs bg-gray-100 border rounded">Ver alunos</Link>
            <Link href="/secretaria/matriculas" className="px-3 py-1.5 text-xs bg-gray-100 border rounded">Ver matrículas</Link>
            <Link href="/secretaria/fluxo-academico" className="px-3 py-1.5 text-xs bg-green-50 text-green-700 border border-green-200 rounded">Fluxo Acadêmico</Link>
            {canCriarMatricula ? (
              <Link href="/secretaria/alunos/novo" className="px-3 py-1.5 text-xs bg-blue-50 text-blue-700 border border-blue-200 rounded">Novo aluno</Link>
            ) : (
              <span className="px-3 py-1.5 text-xs bg-gray-50 text-gray-400 border rounded cursor-not-allowed" title="Sem permissão (requer: criar_matricula)">Novo aluno</span>
            )}
            <Link href="/secretaria/relatorios" className="px-3 py-1.5 text-xs bg-gray-100 border rounded">Relatórios</Link>
            <Link href="/secretaria/alertas" className="px-3 py-1.5 text-xs bg-gray-100 border rounded">Alertas</Link>
            <Link href="/secretaria/exportacoes" className="px-3 py-1.5 text-xs bg-gray-100 border rounded">Exportações</Link>
          </div>
          <div className="mt-3 text-xs text-gray-500">
            {plan === 'basico' && (
              <>
                <div>Recursos avançados disponíveis nos planos superiores:</div>
                <ul className="list-disc ml-5 mt-1 space-y-0.5">
                  <li>Alertas automáticos para responsáveis (Standard)</li>
                  <li>Exportações detalhadas (Standard)</li>
                  <li>Integrações e automações avançadas (Premium)</li>
                </ul>
              </>
            )}
          </div>
        </div>
      </div>
      {plan === 'basico' && (
        <div className="mt-6 p-4 bg-amber-50 border border-amber-200 rounded text-amber-800 text-sm">
          <div className="font-medium">Desbloqueie recursos do plano Standard:</div>
          <ul className="list-disc ml-5 mt-1">
            <li>Alertas automáticos para responsáveis</li>
            <li>Exportações detalhadas (Excel/PDF)</li>
          </ul>
          <div className="mt-2">Fale com o Super Admin para atualizar o plano.</div>
        </div>
      )}
    </>
  )
}
