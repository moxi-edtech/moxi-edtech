import EscolaAdminDashboard from "@/components/layout/escola-admin/EscolaAdminDashboard";

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  let escolaNome: string | undefined = undefined
  try {
    const res = await fetch(`/api/escolas/${id}/nome`, { cache: 'force-cache' })
    const json = await res.json().catch(() => null)
    if (res.ok && json?.ok && json?.nome) escolaNome = String(json.nome)
  } catch {}

  return <EscolaAdminDashboard escolaId={id} escolaNome={escolaNome} />;
}
