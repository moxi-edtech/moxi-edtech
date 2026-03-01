import CobrancasListClient from "@/components/super-admin/cobrancas/CobrancasListClient";
import HistoricoReceitasClient from "@/components/super-admin/cobrancas/HistoricoReceitasClient";
import AuditPageView from "@/components/audit/AuditPageView";
import { DashboardHeader } from "@/components/dashboard/DashboardHeader";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export const dynamic = 'force-dynamic'

export default async function Page() {
  return (
    <div className="space-y-6">
      <AuditPageView portal="super_admin" acao="PAGE_VIEW" entity="billing_list" />
      
      <DashboardHeader
        title="Cobranças SaaS"
        description="Gestão de planos, subscrições e pagamentos das escolas no ecossistema Klasse."
        breadcrumbs={[
          { label: "Super Admin", href: "/super-admin" },
          { label: "Cobranças" }
        ]}
      />

      <Tabs defaultValue="assinaturas" className="w-full">
        <TabsList className="bg-slate-100 border border-slate-200">
          <TabsTrigger value="assinaturas" className="data-[state=active]:bg-white data-[state=active]:text-[#1F6B3B] font-bold">
            Gestão de Subscrições
          </TabsTrigger>
          <TabsTrigger value="historico" className="data-[state=active]:bg-white data-[state=active]:text-[#1F6B3B] font-bold">
            Histórico de Receitas
          </TabsTrigger>
        </TabsList>

        <TabsContent value="assinaturas" className="mt-6 border-none p-0">
          <CobrancasListClient />
        </TabsContent>

        <TabsContent value="historico" className="mt-6 border-none p-0">
          <HistoricoReceitasClient />
        </TabsContent>
      </Tabs>
    </div>
  );
}
