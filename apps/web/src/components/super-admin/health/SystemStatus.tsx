// apps/web/src/components/super-admin/health/SystemStatus.tsx
'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import type { SystemHealth, EscolaMetricas } from '@/app/super-admin/health/types';
import { Activity, School, Users, CreditCard, Clock } from 'lucide-react';

interface SystemStatusProps {
  systemHealth: SystemHealth;
  escolas: EscolaMetricas[];
}

const getStatusColor = (status: string) => {
  switch (status) {
    case 'healthy': return 'bg-green-100 dark:bg-green-950/30 text-green-800 dark:text-green-200';
    case 'degraded': return 'bg-yellow-100 dark:bg-yellow-950/30 text-yellow-800 dark:text-yellow-200';
    case 'critical': return 'bg-red-100 dark:bg-red-950/30 text-red-800 dark:text-red-200';
    default: return 'bg-muted text-foreground';
  }
};

const formatCurrency = (value: number) => {
  return new Intl.NumberFormat('pt-AO', {
    style: 'currency',
    currency: 'AOA',
    minimumFractionDigits: 0
  }).format(value);
};

export function SystemStatus({ systemHealth }: SystemStatusProps) {

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Activity className={`h-6 w-6 ${
              systemHealth.status === 'healthy' ? 'text-green-600 dark:text-green-300' :
              systemHealth.status === 'degraded' ? 'text-yellow-600 dark:text-yellow-300' : 'text-red-600 dark:text-red-300'
            }`} />
            <CardTitle>Status do Sistema</CardTitle>
          </div>
          <Badge className={getStatusColor(systemHealth.status)}>
            {systemHealth.status === 'healthy' ? 'SAUDÁVEL' :
             systemHealth.status === 'degraded' ? 'DEGRADADO' : 'CRÍTICO'}
          </Badge>
        </div>
        <CardDescription>Saúde geral da plataforma KLASSE</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <School className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">Escolas Ativas</span>
            </div>
            <div className="text-2xl font-bold">{systemHealth.escolas_ativas ?? 0}</div>
          </div>
          
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">Alunos Totais</span>
            </div>
            <div className="text-2xl font-bold">{(systemHealth.alunos_totais ?? 0).toLocaleString('pt-AO')}</div>
          </div>
          
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <CreditCard className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">MRR Total</span>
            </div>
            <div className="text-2xl font-bold">{formatCurrency(systemHealth.mrr_total ?? 0)}</div>
          </div>
          
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">Latência Média</span>
            </div>
            <div className="text-2xl font-bold text-muted-foreground">Em construção</div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
