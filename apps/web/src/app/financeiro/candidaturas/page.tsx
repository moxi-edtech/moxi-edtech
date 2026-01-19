import { supabaseServer } from '@/lib/supabaseServer'
import { resolveEscolaIdForUser } from '@/lib/tenant/resolveEscolaIdForUser'
import { DashboardHeader } from '@/components/dashboard/DashboardHeader'
import { FinanceiroCandidaturasInbox } from '../_components/CandidaturasInbox'

type Props = {
  searchParams?: { candidatura?: string }
}

export default async function FinanceiroCandidaturasPage({ searchParams }: Props) {
  const supabase = await supabaseServer()
  const { data: userRes } = await supabase.auth.getUser()
  const user = userRes?.user
  if (!user) return null

  const escolaId = await resolveEscolaIdForUser(supabase as any, user.id)
  if (!escolaId) return null

  const { data } = await supabase
    .from('candidaturas')
    .select('id, nome_candidato, curso_id, classe_id, turma_preferencial_id, status, created_at, dados_candidato, cursos(nome)')
    .eq('escola_id', escolaId)
    .in('status', ['pendente', 'aguardando_compensacao'])
    .order('created_at', { ascending: false })

  const items = (data || []).map((c: any) => ({
    id: c.id,
    nome: c.nome_candidato,
    cursoNome: c.cursos?.nome || 'Curso',
    status: c.status,
    turmaPreferencialId: c.turma_preferencial_id || null,
    pagamento: c.dados_candidato?.pagamento || {},
    created_at: c.created_at,
  }))

  const selectedId = searchParams?.candidatura || null

  return (
    <main className="space-y-6 p-4 md:p-6">
      <DashboardHeader
        title="Inbox de Candidaturas"
        description="Compense pagamentos, valide comprovativos e converta em matrículas."
      />
      <FinanceiroCandidaturasInbox
        escolaId={escolaId}
        initialItems={items}
        initialSelectedId={selectedId}
      />
    </main>
  )
}
