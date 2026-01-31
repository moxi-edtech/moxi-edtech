// apps/web/src/components/super-admin/health/InfraTab.tsx
'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card';
import { Progress } from '@/components/ui/Progress';
import type { InfraMetrics } from '@/app/super-admin/health/types';

interface InfraTabProps {
  infraMetrics: InfraMetrics;
}

export function InfraTab({ infraMetrics }: InfraTabProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
      <Card>
        <CardHeader>
          <CardTitle>Database</CardTitle>
          <CardDescription>Uso do PostgreSQL</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div>
              <div className="flex justify-between text-sm mb-1">
                <span>Uso Atual</span>
                <span>{infraMetrics.db_size_mb}MB / {infraMetrics.db_size_limit_mb}MB</span>
              </div>
              <Progress value={(infraMetrics.db_size_mb / infraMetrics.db_size_limit_mb) * 100} />
            </div>
            <div className="text-sm text-gray-600">
              {infraMetrics.db_size_mb > infraMetrics.db_size_limit_mb * 0.8 ? (
                <span className="text-red-600">⚠️ Próximo do limite</span>
              ) : (
                <span className="text-green-600">✅ Saudável</span>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>API Requests</CardTitle>
          <CardDescription>Últimas 24 horas</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div>
              <div className="flex justify-between text-sm mb-1">
                <span>Chamadas</span>
                <span>{infraMetrics.api_calls_24h.toLocaleString('pt-AO')} / {infraMetrics.api_calls_limit.toLocaleString('pt-AO')}</span>
              </div>
              <Progress value={(infraMetrics.api_calls_24h / infraMetrics.api_calls_limit) * 100} />
            </div>
            <div className="text-sm text-gray-600">
              Média: {Math.round(infraMetrics.api_calls_24h / 24).toLocaleString('pt-AO')} reqs/hora
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Bandwidth</CardTitle>
          <CardDescription>Transferência de dados</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div>
              <div className="flex justify-between text-sm mb-1">
                <span>Este Mês</span>
                <span>{infraMetrics.bandwidth_mb}MB / {infraMetrics.bandwidth_limit_mb}MB</span>
              </div>
               <Progress value={(infraMetrics.bandwidth_mb / infraMetrics.bandwidth_limit_mb) * 100} />
            </div>
            <div className="text-sm text-gray-600">
              {infraMetrics.bandwidth_mb > infraMetrics.bandwidth_limit_mb * 0.9 ? (
                <span className="text-red-600">⚠️ Alto uso de banda</span>
              ) : (
                <span className="text-green-600">✅ Normal</span>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
