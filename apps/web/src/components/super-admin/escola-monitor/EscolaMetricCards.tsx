// apps/web/src/components/super-admin/escola-monitor/EscolaMetricCards.tsx
'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import type { EscolaMetricas, PerformanceMetrics } from '@/app/super-admin/escolas/[id]/types';
import { Users, School, CreditCard, Activity } from 'lucide-react';

interface MetricCardsProps {
  metricas: EscolaMetricas | null;
  performance: PerformanceMetrics | null;
}

const formatCurrency = (value: number) => {
  return new Intl.NumberFormat('pt-AO', {
    style: 'currency',
    currency: 'AOA',
    minimumFractionDigits: 0
  }).format(value);
};

export function EscolaMetricCards({ metricas, performance }: MetricCardsProps) {
  if (!metricas || !performance) return null;

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium text-gray-600 flex items-center gap-2">
            <Users className="h-4 w-4" />
            Alunos
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">
            {metricas.alunos_ativos.toLocaleString('pt-AO')}
            <span className="text-sm font-normal text-gray-500 ml-2">
              / {metricas.alunos_total.toLocaleString('pt-AO')} total
            </span>
          </div>
          <div className="text-sm text-gray-600 mt-1">
            {metricas.alunos_inativos} inativos • {metricas.inadimplentes} inadimplentes
          </div>
        </CardContent>
      </Card>
      
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium text-gray-600 flex items-center gap-2">
            <School className="h-4 w-4" />
            Académico
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">
            {metricas.professores} professores
          </div>
          <div className="text-sm text-gray-600 mt-1">
            {metricas.turmas_ativas} turmas ativas • {metricas.matriculas_ativas} matrículas
          </div>
        </CardContent>
      </Card>
      
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium text-gray-600 flex items-center gap-2">
            <CreditCard className="h-4 w-4" />
            Financeiro
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">
            {formatCurrency(metricas.valor_pago)}
          </div>
          <div className="text-sm text-gray-600 mt-1">
            {formatCurrency(metricas.valor_pendente)} pendente
          </div>
        </CardContent>
      </Card>
      
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium text-gray-600 flex items-center gap-2">
            <Activity className="h-4 w-4" />
            Performance
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">
            {performance.latencia_media === null ? "Em construção" : `${performance.latencia_media}ms`}
          </div>
          <div className="text-sm text-gray-600 mt-1">
            {performance.accessos_24h} acessos 24h • Sync: 
            <Badge className={`ml-1 ${
              performance.sync_status === 'synced' ? 'bg-green-100 text-green-800' :
              performance.sync_status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
              'bg-red-100 text-red-800'
            }`}>
              {performance.sync_status}
            </Badge>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
