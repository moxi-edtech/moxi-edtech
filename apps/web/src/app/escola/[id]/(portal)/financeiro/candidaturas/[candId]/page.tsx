import { redirect } from 'next/navigation'

type Props = {
  params: Promise<{ id: string; candId: string }>
}

export default async function FinanceiroCandidaturaRedirect({ params }: Props) {
  const { id: escolaId, candId } = await params
  redirect(`/escola/${escolaId}/financeiro/candidaturas?candidatura=${candId}`)
}
