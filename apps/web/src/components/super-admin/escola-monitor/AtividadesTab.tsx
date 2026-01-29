// apps/web/src/components/super-admin/escola-monitor/AtividadesTab.tsx
'use client';

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import type { AtividadeRecente } from '@/app/super-admin/escolas/[id]/types';
import { 
  CreditCard, 
  UserPlus, 
  GraduationCap, 
  Presentation, 
  Wrench, 
  MoreHorizontal
} from 'lucide-react';

interface AtividadesTabProps {
  atividades: AtividadeRecente[];
}

const getActivityIcon = (tipo: AtividadeRecente['tipo']) => {
  switch (tipo) {
    case 'pagamento': return <CreditCard className="h-4 w-4 text-green-500" />;
    case 'matricula': return <UserPlus className="h-4 w-4 text-blue-500" />;
    case 'nota': return <GraduationCap className="h-4 w-4 text-purple-500" />;
    case 'presenca': return <Presentation className="h-4 w-4 text-yellow-500" />;
    case 'config': return <Wrench className="h-4 w-4 text-gray-500" />;
    default: return <MoreHorizontal className="h-4 w-4 text-gray-400" />;
  }
};

export function AtividadesTab({ atividades }: AtividadesTabProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Atividade Recente</CardTitle>
        <CardDescription>Últimas 10 ações registradas para esta escola.</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {atividades.map((atividade) => (
            <div key={atividade.id} className="flex items-center gap-4 p-2 rounded-lg hover:bg-gray-50">
              <div className="p-2 bg-gray-100 rounded-full">
                {getActivityIcon(atividade.tipo)}
              </div>
              <div className="flex-grow">
                <p className="text-sm font-medium">{atividade.descricao}</p>
                <p className="text-xs text-gray-500">
                  Por: {atividade.usuario} • {new Date(atividade.timestamp).toLocaleString('pt-AO')}
                </p>
              </div>
              <Badge variant="outline">{atividade.tipo}</Badge>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
