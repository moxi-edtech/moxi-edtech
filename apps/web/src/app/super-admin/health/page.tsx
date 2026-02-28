// apps/web/src/app/super-admin/health/page.tsx
'use client';

import { Button } from '@/components/ui/Button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useHealthData } from './hooks';
import { AlertsTab } from '@/components/super-admin/health/AlertsTab';
import { SchoolsTab } from '@/components/super-admin/health/SchoolsTab';
import { WorkersTab } from '@/components/super-admin/health/WorkersTab';
import { InfraTab } from '@/components/super-admin/health/InfraTab';
import { SystemStatus } from '@/components/super-admin/health/SystemStatus';
import AuditPageView from '@/components/audit/AuditPageView';
import { 
  AlertTriangle, 
  School, 
  Database,
  Cpu,
} from 'lucide-react';

export default function AdminHealthDashboard() {
  const {
    loading,
    refreshing,
    lastUpdated,
    systemHealth,
    escolas,
    outboxMetrics,
    infraMetrics,
    alertas,
    loadHealthData,
    handleRecalcAggregates,
    handleRunOutboxWorker,
  } = useHealthData();

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 p-6">
        <div className="max-w-7xl mx-auto">
          <div className="animate-pulse space-y-4">
            <div className="h-8 bg-gray-200 rounded w-1/4"></div>
            <div className="h-40 bg-gray-200 rounded"></div>
            <div className="h-10 bg-gray-200 rounded w-full"></div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="h-64 bg-gray-200 rounded"></div>
              <div className="h-64 bg-gray-200 rounded"></div>
              <div className="h-64 bg-gray-200 rounded"></div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-6">
      <AuditPageView portal="super_admin" acao="PAGE_VIEW" entity="health_dashboard" />
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-gray-900">Dashboard de Saúde</h1>
            <p className="text-gray-600 mt-1">
              Monitoramento em tempo real do KLASSE • Angola
              {lastUpdated && <span className="ml-2 text-sm text-gray-500">Atualizado: {lastUpdated}</span>}
            </p>
          </div>
          
          <div className="flex flex-wrap gap-2">
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => loadHealthData()}
              disabled={refreshing}
            >
              {refreshing ? 'Atualizando...' : 'Atualizar Agora'}
            </Button>
          </div>
        </div>

        {/* Status Geral */}
        <div className="mb-6">
          <SystemStatus systemHealth={systemHealth} escolas={escolas} />
        </div>

        {/* Tabs Principal */}
        <Tabs defaultValue="alertas" className="mb-6">
          <TabsList className="grid w-full grid-cols-2 md:grid-cols-4 mb-4">
            <TabsTrigger value="alertas" className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4" />
              Alertas ({alertas.length})
            </TabsTrigger>
            <TabsTrigger value="escolas" className="flex items-center gap-2">
              <School className="h-4 w-4" />
              Escolas ({escolas.length})
            </TabsTrigger>
            <TabsTrigger value="outbox" className="flex items-center gap-2">
              <Database className="h-4 w-4" />
              Outbox & Workers
            </TabsTrigger>
            <TabsTrigger value="infra" className="flex items-center gap-2">
              <Cpu className="h-4 w-4" />
              Infraestrutura
            </TabsTrigger>
          </TabsList>

          <TabsContent value="alertas">
            <AlertsTab alertas={alertas} />
          </TabsContent>
          <TabsContent value="escolas">
            <SchoolsTab escolas={escolas} />
          </TabsContent>
          <TabsContent value="outbox">
            <WorkersTab 
              outboxMetrics={outboxMetrics} 
              onRunWorker={handleRunOutboxWorker}
              onRecalcAggregates={handleRecalcAggregates}
            />
          </TabsContent>
          <TabsContent value="infra">
            <InfraTab infraMetrics={infraMetrics} />
          </TabsContent>
        </Tabs>
        
        {/* Footer Actions */}
        <div className="mt-8 pt-6 border-t border-gray-200">
          <div className="flex flex-wrap justify-between items-center gap-4">
            <div className="text-sm text-gray-600">
              <p>KLASSE Admin • Sistema de monitoramento para Angola</p>
              <p className="mt-1">Para suporte emergencial: +244 900 000 000 (WhatsApp)</p>
            </div>
            
            <div className="flex gap-2">
              <Button variant="outline" size="sm" asChild>
                <a href="/super-admin/logs">
                  Ver Logs Completos
                </a>
              </Button>
              <Button variant="destructive" size="sm">
                Modo Manutenção
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
