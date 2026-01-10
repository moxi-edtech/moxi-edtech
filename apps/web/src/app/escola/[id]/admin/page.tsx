export const dynamic = 'force-dynamic'

import EscolaAdminDashboard from "@/components/layout/escola-admin/EscolaAdminDashboard"

export default async function Page(props: { params: Promise<{ id: string }> }) {
  const { id } = await props.params

  // Fetch escola nome via API (service role), ensures it renders for admins
  let escolaNome: string | undefined = undefined
  try {
    const res = await fetch(`/api/escolas/${id}/nome`, { cache: 'force-cache' })
    const json = await res.json().catch(() => null)
    if (res.ok && json?.ok && json?.nome) escolaNome = String(json.nome)
  } catch {}

  return <EscolaAdminDashboard escolaId={id} escolaNome={escolaNome} />
}
