import PortalLayout from "@/components/layout/PortalLayout"
import AuditPageView from "@/components/audit/AuditPageView"
import VendaCaixaClient from "./VendaCaixaClient"

type PageParams = { params: Promise<{ id: string }> }

export default async function Page({ params }: PageParams) {
  const awaitedParams = await params
  return (
    <PortalLayout>
      <AuditPageView portal="financeiro" acao="PAGE_VIEW" entity="vendas_avulsas" />
      <VendaCaixaClient escolaId={awaitedParams.id} />
    </PortalLayout>
  )
}
