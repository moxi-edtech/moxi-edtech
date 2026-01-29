// apps/web/src/app/super-admin/escolas/[id]/page.tsx
'use client';

import { useParams, useRouter } from 'next/navigation';
import { Button } from '@/components/ui/Button';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { XCircle, BarChart3, Activity, CreditCard, FileText, Edit } from 'lucide-react';
import { useEscolaMonitorData } from './hooks';
import { EscolaMonitorHeader } from '@/components/super-admin/escola-monitor/EscolaMonitorHeader';
import { EscolaMetricCards } from '@/components/super-admin/escola-monitor/EscolaMetricCards';
import { AtividadesTab } from '@/components/super-admin/escola-monitor/AtividadesTab';
import { ConfigTab } from '@/components/super-admin/escola-monitor/ConfigTab';

export default function EscolaMonitoramentoPage() {
  const params = useParams();
  const router = useRouter();
  const escolaId = params.id as string;
  
  const { 
    loading, 
    refreshing, 
    escola, 
    metricas, 
    performance, 
    atividades, 
    alertas, 
    loadEscolaData 
  } = useEscolaMonitorData(escolaId);
  
  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 p-6">
        <div className="max-w-7xl mx-auto">
          <div className="animate-pulse space-y-4">
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 rounded-lg bg-gray-200"></div>
              <div className="space-y-2">
                <div className="h-8 bg-gray-200 rounded w-48"></div>
                <div className="h-4 bg-gray-200 rounded w-64"></div>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="h-24 bg-gray-200 rounded-lg"></div>
              ))}
            </div>
            <div className="h-10 bg-gray-200 rounded w-full"></div>
            <div className="h-96 bg-gray-200 rounded-lg"></div>
          </div>
        </div>
      </div>
    );
  }
  
  if (!escola) {
    return (
      <div className="min-h-screen bg-gray-50 p-6 flex items-center justify-center">
        <div className="text-center">
          <Alert variant="destructive" className="max-w-md mx-auto">
            <XCircle className="h-4 w-4" />
            <AlertTitle>Escola não encontrada</AlertTitle>
            <AlertDescription>
              A escola com ID {escolaId} não foi encontrada ou você não tem permissão para acessá-la.
            </AlertDescription>
          </Alert>
          <Button className="mt-4" onClick={() => router.push('/super-admin/escolas')}>
            Voltar para lista de escolas
          </Button>
        </div>
      </div>
    );
  }
  
  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-6">
      <div className="max-w-7xl mx-auto">
        <EscolaMonitorHeader escola={escola} refreshing={refreshing} onRefresh={loadEscolaData} />
        
        {alertas.length > 0 && (
          <div className="mb-6">
            <Alert variant="destructive">
               <AlertTriangle className="h-4 w-4" />
              <AlertTitle>Alertas Urgentes</AlertTitle>
              <AlertDescription>
                <ul className="mt-2 space-y-1">
                  {alertas.map(alerta => <li key={alerta.id}>{alerta.titulo}: {alerta.descricao}</li>)}
                </ul>
              </AlertDescription>
            </Alert>
          </div>
        )}
        
        <EscolaMetricCards metricas={metricas} performance={performance} />
        
        <Tabs defaultValue="atividades" className="mb-6">
          <TabsList className="grid w-full grid-cols-2 md:grid-cols-5 mb-4">
            <TabsTrigger value="atividades" className="flex items-center gap-2">
              <FileText className="h-4 w-4" />
              Atividades
            </TabsTrigger>
            <TabsTrigger value="overview" className="flex items-center gap-2">
              <BarChart3 className="h-4 w-4" />
              Visão Geral
            </TabsTrigger>
            <TabsTrigger value="performance" className="flex items-center gap-2">
              <Activity className="h-4 w-4" />
              Performance
            </TabsTrigger>
            <TabsTrigger value="financeiro" className="flex items-center gap-2">
              <CreditCard className="h-4 w-4" />
              Financeiro
            </TabsTrigger>
            <TabsTrigger value="config" className="flex items-center gap-2">
              <Edit className="h-4 w-4" />
              Configuração
            </TabsTrigger>
          </TabsList>
          
          <TabsContent value="atividades">
            <AtividadesTab atividades={atividades} />
          </TabsContent>
          <TabsContent value="overview">
            <p>Visão Geral (WIP)</p>
          </TabsContent>
          <TabsContent value="performance">
            <p>Performance (WIP)</p>
          </TabsContent>
          <TabsContent value="financeiro">
            <p>Financeiro (WIP)</p>
          </TabsContent>
          <TabsContent value="config">
            <ConfigTab escola={escola} onUpdate={loadEscolaData} />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
