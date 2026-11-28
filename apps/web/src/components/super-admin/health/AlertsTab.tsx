// apps/web/src/components/super-admin/health/AlertsTab.tsx
'use client';

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import type { Alerta } from '@/app/super-admin/health/types';
import { AlertTriangle, CheckCircle, MessageSquare } from 'lucide-react';
import { useToast } from '@/components/feedback/FeedbackSystem';

interface AlertsTabProps {
  alertas: Alerta[];
}

const getAlertColor = (nivel: string) => {
  switch (nivel) {
    case 'critico': return 'border-red-50 dark:border-red-900/600 bg-red-50 dark:bg-red-950/30';
    case 'alto': return 'border-orange-50 dark:border-orange-900/600 bg-orange-50 dark:bg-orange-950/30';
    case 'medio': return 'border-yellow-50 dark:border-yellow-900/600 bg-yellow-50 dark:bg-yellow-950/30';
    case 'baixo': return 'border-border bg-muted';
    default: return 'border-border bg-muted';
  }
};

export function AlertsTab({ alertas }: AlertsTabProps) {
  const { success } = useToast();

  const sendTestAlert = async () => {
    success("Alerta enviado", "O alerta de teste foi disparado para todas as escolas activas.");
  };

  return (
    <div className="space-y-4">
      {alertas.length === 0 ? (
        <Alert>
          <CheckCircle className="h-4 w-4 text-green-600 dark:text-green-300" />
          <AlertTitle>Sem alertas críticos</AlertTitle>
          <AlertDescription>O sistema está funcionando normalmente.</AlertDescription>
        </Alert>
      ) : (
        alertas.map(alerta => (
          <Alert key={alerta.id} className={getAlertColor(alerta.nivel)}>
            <AlertTriangle className={`h-4 w-4 ${
              alerta.nivel === 'critico' ? 'text-red-600 dark:text-red-300' :
              alerta.nivel === 'alto' ? 'text-orange-600 dark:text-orange-300' :
              alerta.nivel === 'medio' ? 'text-yellow-600 dark:text-yellow-300' : 'text-muted-foreground'
            }`} />
            <AlertTitle className="flex items-center justify-between">
              <span>{alerta.titulo}</span>
              <Badge variant="outline" className={
                alerta.nivel === 'critico' ? 'border-red-600 text-red-600 dark:text-red-300' :
                alerta.nivel === 'alto' ? 'border-orange-600 text-orange-600 dark:text-orange-300' :
                alerta.nivel === 'medio' ? 'border-yellow-600 text-yellow-600 dark:text-yellow-300' : 
                'border-border text-muted-foreground'
              }>
                {alerta.nivel.toUpperCase()}
              </Badge>
            </AlertTitle>
            <AlertDescription className="flex justify-between items-center">
              <span>{alerta.descricao}</span>
              <span className="text-sm text-muted-foreground">
                {new Date(alerta.criado_em).toLocaleTimeString('pt-AO', { hour: '2-digit', minute: '2-digit' })}
              </span>
            </AlertDescription>
            {alerta.escola_id && (
              <div className="mt-2">
                <Button variant="outline" size="sm" asChild>
                  <a href={`/super-admin/escolas/${alerta.escola_id}`}>
                    Ver escola
                  </a>
                </Button>
              </div>
            )}
          </Alert>
        ))
      )}
      
      <div className="flex justify-end">
        <Button variant="outline" size="sm" onClick={sendTestAlert}>
          <MessageSquare className="h-4 w-4 mr-2" />
          Enviar Alerta de Teste
        </Button>
      </div>
    </div>
  );
}
