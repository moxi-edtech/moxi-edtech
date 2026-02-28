// apps/web/src/components/super-admin/health/SchoolsTab.tsx
'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import type { EscolaMetricas } from '@/app/super-admin/health/types';

const formatCurrency = (value: number) => {
  return new Intl.NumberFormat('pt-AO', {
    style: 'currency',
    currency: 'AOA',
    minimumFractionDigits: 0
  }).format(value);
};

interface SchoolsTabProps {
  escolas: EscolaMetricas[];
}

export function SchoolsTab({ escolas }: SchoolsTabProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {escolas.map(escola => (
        <Card key={escola.id} className="hover:shadow-lg transition-shadow">
          <CardHeader className="pb-3">
            <div className="flex justify-between items-start">
              <div>
                <CardTitle className="text-lg">{escola.nome}</CardTitle>
                <CardDescription className="flex items-center gap-2 mt-1">
                  <Badge variant="outline">{escola.plano}</Badge>
                  <span className="text-xs">{formatCurrency(escola.mrr)}/mês</span>
                </CardDescription>
              </div>
              <Badge className={
                escola.sync_status === 'synced' ? 'bg-green-100 text-green-800' :
                escola.sync_status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                'bg-red-100 text-red-800'
              }>
                {escola.sync_status}
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Alunos:</span>
                <span className="font-medium">{escola.alunos_ativos}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Professores:</span>
                <span className="font-medium">{escola.professores}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Turmas:</span>
                <span className="font-medium">{escola.turmas}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Latência:</span>
                <span className="font-medium text-gray-500">Em construção</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Último acesso:</span>
                <span className="font-medium">
                  {new Date(escola.ultimo_acesso).toLocaleTimeString('pt-AO', { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
            </div>
            
            <div className="mt-4 pt-4 border-t flex justify-between">
              <Button variant="outline" size="sm" asChild>
                <a href={`/super-admin/escolas/${escola.id}`}>Detalhes</a>
              </Button>
              <Button variant="ghost" size="sm" asChild>
                <a href={`/admin/login-as?escola_id=${escola.id}`}>Acessar como</a>
              </Button>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
