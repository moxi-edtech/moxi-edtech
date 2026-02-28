import CobrancasListClient from "@/components/super-admin/cobrancas/CobrancasListClient";
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
          <div className="rounded-2xl bg-white border border-slate-200 p-12 text-center shadow-sm">
            <div className="w-12 h-12 rounded-full bg-slate-50 flex items-center justify-center mx-auto mb-4 border border-slate-100">
              <span className="text-xl">📜</span>
            </div>
            <h3 className="text-slate-900 font-bold mb-1">Módulo de Auditoria Consolidada</h3>
            <p className="text-slate-500 text-sm max-w-xs mx-auto italic">O histórico detalhado de receitas globais e projeções de fluxo está agendado para a Fase 2 da implementação.</p>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
