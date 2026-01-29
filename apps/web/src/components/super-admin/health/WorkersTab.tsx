// apps/web/src/components/super-admin/health/WorkersTab.tsx
'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/Button';
import type { OutboxMetrics } from '@/app/super-admin/health/types';
import { Database, Cpu, AlertTriangle } from 'lucide-react';

interface WorkersTabProps {
  outboxMetrics: OutboxMetrics;
  onRunWorker: () => void;
  onRecalcAggregates: () => void;
}

export function WorkersTab({ outboxMetrics, onRunWorker, onRecalcAggregates }: WorkersTabProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      {/* Outbox Metrics */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Database className="h-5 w-5" />
            Outbox Events
          </CardTitle>
          <CardDescription>Processamento assíncrono do sistema</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="text-center p-4 bg-blue-50 rounded-lg">
                <div className="text-2xl font-bold text-blue-700">{outboxMetrics.pending}</div>
                <div className="text-sm text-blue-600">Pendentes</div>
              </div>
              <div className="text-center p-4 bg-yellow-50 rounded-lg">
                <div className="text-2xl font-bold text-yellow-700">{outboxMetrics.retry}</div>
                <div className="text-sm text-yellow-600">Retry</div>
              </div>
              <div className="text-center p-4 bg-red-50 rounded-lg">
                <div className="text-2xl font-bold text-red-700">{outboxMetrics.failed}</div>
                <div className="text-sm text-red-600">Falhas</div>
              </div>
              <div className="text-center p-4 bg-green-50 rounded-lg">
                <div className="text-2xl font-bold text-green-700">{outboxMetrics.processing}</div>
                <div className="text-sm text-green-600">Processando</div>
              </div>
            </div>
            
            <div className="text-sm text-gray-600">
              Evento mais antigo pendente: 
              <span className={`font-medium ml-1 ${
                outboxMetrics.oldest_pending_minutes > 30 ? 'text-red-600' : 'text-green-600'
              }`}>
                {outboxMetrics.oldest_pending_minutes} minutos
              </span>
            </div>
            
            {outboxMetrics.oldest_pending_minutes > 30 && (
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertTitle>Outbox com eventos antigos</AlertTitle>
                <AlertDescription>Considere executar o worker manualmente ou investigar possíveis bloqueios.</AlertDescription>
              </Alert>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Worker Control */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Cpu className="h-5 w-5" />
            Worker Control
          </CardTitle>
          <CardDescription>Controle do processamento assíncrono</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="space-y-2">
              <h4 className="font-medium">Ações Rápidas</h4>
              <div className="grid grid-cols-1 gap-2">
                <Button variant="outline" className="justify-start" onClick={onRunWorker}>
                  <Cpu className="h-4 w-4 mr-2" />
                  Executar Worker (processar 50 eventos)
                </Button>
                <Button variant="outline" className="justify-start" onClick={onRecalcAggregates}>
                  <Database className="h-4 w-4 mr-2" />
                  Recalcular Todos Aggregates
                </Button>
                <Button variant="outline" className="justify-start" asChild>
                  <a href="/super-admin/outbox">
                    <Database className="h-4 w-4 mr-2" />
                    Ver Detalhes da Outbox
                  </a>
                </Button>
              </div>
            </div>
            
            <div className="pt-4 border-t">
              <h4 className="font-medium mb-2">Configuração</h4>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-600">Batch Size:</span>
                  <span className="font-mono">50 eventos</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Max Retries:</span>
                  <span className="font-mono">5 tentativas</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Auto-run:</span>
                  <span className="font-mono">A cada 10 segundos</span>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
