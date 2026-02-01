// apps/web/src/components/super-admin/health/AlertsTab.tsx
'use client';

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import type { Alerta } from '@/app/super-admin/health/types';
import { AlertTriangle, CheckCircle, MessageSquare } from 'lucide-react';

interface AlertsTabProps {
  alertas: Alerta[];
}

const getAlertColor = (nivel: string) => {
  switch (nivel) {
    case 'critico': return 'border-red-500 bg-red-50';
    case 'alto': return 'border-orange-500 bg-orange-50';
    case 'medio': return 'border-yellow-500 bg-yellow-50';
    case 'baixo': return 'border-blue-500 bg-blue-50';
    default: return 'border-gray-500 bg-gray-50';
  }
};

const sendTestAlert = async () => {
  alert('Alerta de teste enviado para todas escolas');
};

export function AlertsTab({ alertas }: AlertsTabProps) {
  return (
    <div className="space-y-4">
      {alertas.length === 0 ? (
        <Alert>
          <CheckCircle className="h-4 w-4 text-green-600" />
          <AlertTitle>Sem alertas críticos</AlertTitle>
          <AlertDescription>O sistema está funcionando normalmente.</AlertDescription>
        </Alert>
      ) : (
        alertas.map(alerta => (
          <Alert key={alerta.id} className={getAlertColor(alerta.nivel)}>
            <AlertTriangle className={`h-4 w-4 ${
              alerta.nivel === 'critico' ? 'text-red-600' :
              alerta.nivel === 'alto' ? 'text-orange-600' :
              alerta.nivel === 'medio' ? 'text-yellow-600' : 'text-blue-600'
            }`} />
            <AlertTitle className="flex items-center justify-between">
              <span>{alerta.titulo}</span>
              <Badge variant="outline" className={
                alerta.nivel === 'critico' ? 'border-red-600 text-red-600' :
                alerta.nivel === 'alto' ? 'border-orange-600 text-orange-600' :
                alerta.nivel === 'medio' ? 'border-yellow-600 text-yellow-600' : 
                'border-blue-600 text-blue-600'
              }>
                {alerta.nivel.toUpperCase()}
              </Badge>
            </AlertTitle>
            <AlertDescription className="flex justify-between items-center">
              <span>{alerta.descricao}</span>
              <span className="text-sm text-gray-500">
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
