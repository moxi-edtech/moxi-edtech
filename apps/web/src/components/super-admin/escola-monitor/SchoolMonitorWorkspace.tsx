// apps/web/src/app/super-admin/escolas/[id]/page.tsx
'use client';

import { useWorkspaceNavigate } from '@/components/super-admin/workspace-navigation';
import EscolaSettingsClient from '@/components/super-admin/EscolaSettingsClient';
import SchoolOperatingProfileSettings from '@/components/super-admin/SchoolOperatingProfileSettings';
import { Button } from '@/components/ui/Button';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { XCircle, Loader2 } from 'lucide-react';
import { useEscolaMonitorData } from '@/app/super-admin/escolas/[id]/hooks';
import EscolaMonitor from '@/components/super-admin/escola-monitor/EscolaMonitor';
import AuditPageView from '@/components/audit/AuditPageView';

export default function SchoolMonitorWorkspace({ escolaId }: { escolaId: string }) {
  const navigate = useWorkspaceNavigate();
  
  const { 
    loading, 
    refreshing, 
    escola, 
    metricas, 
    performance, 
    atividades, 
    saude,
    planLimits,
    providers,
    loadEscolaData 
  } = useEscolaMonitorData(escolaId);
  
  if (loading) {
    return (
      <div className="min-h-[240px] flex items-center justify-center">
        <div className="text-center space-y-4">
          <Loader2 className="w-10 h-10 animate-spin text-emerald mx-auto" />
          <p className="text-muted-foreground font-medium animate-pulse">A carregar monitor central...</p>
        </div>
      </div>
    );
  }
  
  if (!escola || !metricas || !performance) {
    return (
      <div className="min-h-[240px] flex items-center justify-center">
        <div className="text-center">
          <Alert variant="destructive" className="max-w-md mx-auto bg-destructive/10 border-destructive/40 text-foreground">
            <XCircle className="h-4 w-4" />
            <AlertTitle>Escola não encontrada</AlertTitle>
            <AlertDescription>
              A escola com ID {escolaId} não foi encontrada ou você não tem permissão para acessá-la.
            </AlertDescription>
          </Alert>
          <Button 
            className="mt-4 bg-emerald hover:bg-emerald/90 text-white font-bold"
            onClick={() => navigate('/super-admin/escolas')}
          >
            Voltar para lista de escolas
          </Button>
        </div>
      </div>
    );
  }
  
  return (
    <div className="min-w-0">
      <AuditPageView portal="super_admin" acao="PAGE_VIEW" entity="escola_monitor" entityId={escolaId} />
      
      <div className="min-w-0 space-y-6">
        <EscolaSettingsClient escolaId={escola.id} initialAlunoPortalEnabled={escola.aluno_portal_enabled} initialPlano={escola.plano_atual} />
        <SchoolOperatingProfileSettings schoolId={escola.id} />
        <EscolaMonitor 
          escola={escola}
          metricas={metricas}
          performance={performance}
          atividades={atividades}
          saude={saude}
          planLimits={planLimits}
          providers={providers}
          refreshing={refreshing}
          onRefresh={loadEscolaData}
          onUpdate={loadEscolaData}
        />
      </div>
    </div>
  );
}
