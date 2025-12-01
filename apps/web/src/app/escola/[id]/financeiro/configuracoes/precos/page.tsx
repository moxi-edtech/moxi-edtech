import PortalLayout from "@/components/layout/PortalLayout"
import AuditPageView from "@/components/audit/AuditPageView"
import PrecosClient from "./PrecosClient"

export const dynamic = "force-dynamic"

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const awaited = await params
  return (
    <PortalLayout>
      <AuditPageView portal="financeiro" acao="PAGE_VIEW" entity="financeiro_precos" />
      <PrecosClient escolaId={awaited.id} />
    </PortalLayout>
  )
}
