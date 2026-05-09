import { supabaseServer } from '@/lib/supabaseServer'
import { DashboardHeader } from '@/components/dashboard/DashboardHeader'
import { FinanceiroCandidaturasInbox } from '@/app/financeiro/_components/CandidaturasInbox'

type Props = {
  params: Promise<{ id: string }>
  searchParams?: Promise<{ candidatura?: string }>
}

export default async function FinanceiroCandidaturasPage({ params, searchParams }: Props) {
  const { id: escolaId } = await params;
  const supabase = await supabaseServer()

  const { data } = await supabase
    .from('candidaturas')
    .select('id, nome_candidato, curso_id, classe_id, turma_preferencial_id, status, created_at, dados_candidato, cursos(nome)')
    .eq('escola_id', escolaId)
    .in('status', ['aguardando_compensacao', 'aguardando_pagamento'])
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

  const resolvedParams = searchParams ? await searchParams : null
  const selectedId = resolvedParams?.candidatura || null

  return (
    <main className="space-y-6">
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
