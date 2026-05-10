import { supabaseServer } from "@/lib/supabaseServer";
import AuditPageView from "@/components/audit/AuditPageView";
import AdmissoesInboxClient from "@/components/secretaria/AdmissoesInboxClient";
import { DashboardHeader } from "@/components/layout/DashboardHeader";
import { resolveSecretariaEscolaIdForPage } from "@/lib/secretaria/resolveSecretariaEscolaIdForPage";

export const dynamic = 'force-dynamic'

type PageProps = {
  params?: Promise<{ id?: string }>;
};

const STATUS_MAP: Record<string, any> = {
  submetida: 'submetida',
  pendente: 'submetida',
  em_analise: 'em_analise',
  aprovada: 'aprovada',
  aguardando_pagamento: 'aprovada',
  matriculado: 'matriculado',
  convertida: 'matriculado',
}

function normalizeStatus(status: string | null | undefined) {
  const normalized = (status ?? '').toLowerCase()
  return STATUS_MAP[normalized] ?? normalized
}

function statusOr(statuses: string[]) {
  return statuses.map((status) => `status.ilike.${status}`).join(',')
}

const ALL_STATUSES = ['submetida', 'pendente', 'em_analise', 'aprovada', 'aguardando_pagamento', 'matriculado', 'convertida']

export default async function Page({ params }: PageProps = {}) {
  const routeParams = params ? await params : null;
  const s = await supabaseServer()
  const { data: sess } = await s.auth.getUser()
  const user = sess?.user
  let escolaId: string | null = null
  if (user) {
    escolaId = await resolveSecretariaEscolaIdForPage(
      s as any,
      user.id,
      routeParams?.id ?? null
    )
  }

  if (!escolaId) {
    return (
      <div className="p-8 text-slate-500">
        <AuditPageView portal="secretaria" acao="PAGE_VIEW" entity="admissoes_inbox" />
          Vincule seu perfil a uma escola para ver o inbox de admissões.
      </div>
    )
  }

  // Fetch initial items for SSR to improve perceived performance
  let initialItems: any[] = []
  try {
    const { data } = await s
      .from('candidaturas')
      .select(`
        id,
        escola_id,
        status,
        created_at,
        updated_at,
        matriculado_em,
        nome_candidato,
        cursos(nome),
        classes(nome)
      `)
      .eq('escola_id', escolaId)
      .or(statusOr(ALL_STATUSES))
      .order('created_at', { ascending: false })
      .limit(50)
    
    initialItems = (data || []).map(item => ({
      ...item,
      status: normalizeStatus(item.status)
    }))
  } catch (err) {
    console.error("[SSR Admissoes] Error fetching initial data:", err)
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="px-6 pt-6">
        <DashboardHeader
          title="Gestão de Admissões"
          description="Acompanhe e processe novas matrículas online com foco em produtividade."
          breadcrumbs={[
            { label: "Início", href: "/" },
            { label: "Secretaria", href: "/secretaria" },
            { label: "Admissões" },
          ]}
        />
      </div>

      <AuditPageView portal="secretaria" acao="PAGE_VIEW" entity="admissoes_inbox" />
      <AdmissoesInboxClient escolaId={escolaId} initialItems={initialItems} />
    </div>
  )
}
