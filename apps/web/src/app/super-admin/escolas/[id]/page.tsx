// apps/web/src/app/super-admin/escolas/[id]/page.tsx
'use client';

import { useParams, useRouter } from 'next/navigation';
import { Button } from '@/components/ui/Button';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { XCircle, Loader2 } from 'lucide-react';
import { useEscolaMonitorData } from './hooks';
import EscolaMonitor from '@/components/super-admin/escola-monitor/EscolaMonitor';
import AuditPageView from '@/components/audit/AuditPageView';

export default function EscolaMonitoramentoPage() {
  const params = useParams() ?? {};
  const router = useRouter();
  const escolaId = typeof params.id === "string" ? params.id : "";
  
  const { 
    loading, 
    refreshing, 
    escola, 
    metricas, 
    performance, 
    atividades, 
    saude,
    loadEscolaData 
  } = useEscolaMonitorData(escolaId);
  
  if (loading) {
    return (
      <div className="min-h-screen bg-[#060d08] flex items-center justify-center">
        <div className="text-center space-y-4">
          <Loader2 className="w-10 h-10 animate-spin text-[#4ade80] mx-auto" />
          <p className="text-[#4ade80] font-medium animate-pulse">A carregar monitor central...</p>
        </div>
      </div>
    );
  }
  
  if (!escola || !metricas || !performance) {
    return (
      <div className="min-h-screen bg-[#060d08] p-6 flex items-center justify-center">
        <div className="text-center">
          <Alert variant="destructive" className="max-w-md mx-auto bg-red-900/20 border-red-900 text-red-200">
            <XCircle className="h-4 w-4" />
            <AlertTitle>Escola não encontrada</AlertTitle>
            <AlertDescription>
              A escola com ID {escolaId} não foi encontrada ou você não tem permissão para acessá-la.
            </AlertDescription>
          </Alert>
          <Button 
            className="mt-4 bg-[#4ade80] hover:bg-[#4ade80]/90 text-black font-bold" 
            onClick={() => router.push('/super-admin/escolas')}
          >
            Voltar para lista de escolas
          </Button>
        </div>
      </div>
    );
  }
  
  return (
    <div className="min-h-screen bg-[#060d08] p-4 md:p-6">
      <AuditPageView portal="super_admin" acao="PAGE_VIEW" entity="escola_monitor" entityId={escolaId} />
      
      <div className="max-w-7xl mx-auto">
        <EscolaMonitor 
          escola={escola}
          metricas={metricas}
          performance={performance}
          atividades={atividades}
          saude={saude}
          refreshing={refreshing}
          onRefresh={loadEscolaData}
          onUpdate={loadEscolaData}
        />
      </div>
    </div>
  );
}
