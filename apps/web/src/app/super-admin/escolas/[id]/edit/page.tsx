import ChartsStaticSectionForEscola from "@/components/super-admin/ChartsStaticSectionForEscola";
import ActivitiesSection from "@/components/super-admin/ActivitiesSection";
import QuickActionsSection from "@/components/super-admin/QuickActionsSection";
import AuditPageView from "@/components/audit/AuditPageView";
import { supabaseServer } from "@/lib/supabaseServer";
import { getBranding } from '@/lib/branding'
import { AcademicCapIcon, UsersIcon, BanknotesIcon, UserGroupIcon } from "@heroicons/react/24/outline";
import EscolaSettingsClient from "@/components/super-admin/EscolaSettingsClient";

export const dynamic = 'force-dynamic'

export default async function Page(props: { params: Promise<{ id: string }> }) {
  const { id: routeId } = await props.params
  const supabase = await supabaseServer()
  const escolaId = routeId

  // Try view, fallback to base table
  let fetched: any = null
  let ok = false
  const { data, error } = await supabase
    .from('escolas_view' as unknown as never)
    .select('id, nome, status, plano, cidade, estado, total_alunos, total_professores')
    .eq('id', String(escolaId))
    .maybeSingle()
  if (!error && data) { fetched = data; ok = true }
  if (!ok) {
    const { data: raw } = await supabase
      .from('escolas' as unknown as never)
      .select('id, nome, status, plano, endereco')
      .eq('id', String(escolaId))
      .maybeSingle()
    if (raw) {
      fetched = {
        id: (raw as any).id,
        nome: (raw as any).nome,
        status: (raw as any).status,
        plano: (raw as any).plano,
        cidade: (raw as any).endereco ?? null,
        estado: null,
        total_alunos: 0,
        total_professores: 0,
      }
      ok = true
    }
  }

  if (!ok) {
    return <p className="p-6">Escola não encontrada.</p>
  }

  const flags = await supabase
    .from('escolas')
    .select('aluno_portal_enabled, plano')
    .eq('id', String(fetched.id ?? ''))
    .maybeSingle()
  const alunoPortalEnabled = Boolean((flags.data as any)?.aluno_portal_enabled)
  const planVal = (flags.data as any)?.plano as string | undefined
  const plano = (planVal && ['basico','standard','premium'].includes(planVal)) ? (planVal as 'basico'|'standard'|'premium') : 'basico'

  const brand = getBranding()
  const waNumber = (brand.financeWhatsApp || '').replace(/\D/g, '')
  const waHref = waNumber ? `https://wa.me/${waNumber}` : null

  const kpis = [
    { title: "Alunos", value: Number(fetched.total_alunos ?? 0), icon: UsersIcon },
    { title: "Professores", value: Number(fetched.total_professores ?? 0), icon: UserGroupIcon },
    { title: "Notas Lançadas", value: `0%`, icon: AcademicCapIcon },
    { title: "Pagamentos em Dia", value: `0%`, icon: BanknotesIcon },
  ];

  return (
    <div className="space-y-6">
      <AuditPageView portal="super_admin" acao="PAGE_VIEW" entity="escola_edit" />
      {fetched.status === 'suspensa' && (
        <div className="bg-red-50 border border-red-200 text-red-800 rounded-lg p-4">
          <p className="font-semibold">Escola suspensa por pagamento</p>
          <p className="text-sm mt-1">A escola está com o acesso suspenso até regularização. Algumas ações ficam bloqueadas.</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {brand.financeEmail && (
              <a href={`mailto:${brand.financeEmail}`} className="px-3 py-1.5 rounded-md bg-blue-600 text-white hover:bg-blue-700 text-sm">Falar com Financeiro (e-mail)</a>
            )}
            {waHref && (
              <a href={waHref} target="_blank" rel="noreferrer" className="px-3 py-1.5 rounded-md bg-green-600 text-white hover:bg-green-700 text-sm">Falar no WhatsApp</a>
            )}
          </div>
        </div>
      )}
      <h1 className="text-2xl font-bold">
        {fetched.nome} ({fetched.cidade} - {fetched.estado ?? ''})
      </h1>
      <p className="text-gray-500">
        Plano: {String(fetched.plano ?? '')} · Status: {String(fetched.status ?? '')}
      </p>

      <EscolaSettingsClient escolaId={String(fetched.id)} initialAlunoPortalEnabled={alunoPortalEnabled} initialPlano={plano} />

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {kpis.map((kpi) => (
          <div
            key={kpi.title}
            className="bg-white shadow rounded-lg p-4 flex items-center"
          >
            <kpi.icon className="w-10 h-10 text-blue-600 mr-4" />
            <div>
              <p className="text-sm text-gray-500">{kpi.title}</p>
              <p className="text-xl font-bold">{kpi.value}</p>
            </div>
          </div>
        ))}
      </div>

      <ChartsStaticSectionForEscola escolaId={String(fetched.id)} />

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <ActivitiesSection activities={[]} />
        </div>
        <div className="lg:col-span-1">
          <QuickActionsSection />
        </div>
      </div>
    </div>
  );
}
