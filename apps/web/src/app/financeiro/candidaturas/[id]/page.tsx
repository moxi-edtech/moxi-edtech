import { redirect } from 'next/navigation'

type Props = {
  params: Promise<{ id: string }>
}

export default async function FinanceiroCandidaturaRedirect({ params }: Props) {
  const { id } = await params
  redirect(`/financeiro/candidaturas?candidatura=${id}`)
}
