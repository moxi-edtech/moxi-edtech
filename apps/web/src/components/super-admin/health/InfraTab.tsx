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
          <div className="space-y-2">
            <div className="text-sm text-gray-500">Em construção</div>
            <Progress value={0} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>API Requests</CardTitle>
          <CardDescription>Últimas 24 horas</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <div className="text-sm text-gray-500">Em construção</div>
            <Progress value={0} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Bandwidth</CardTitle>
          <CardDescription>Transferência de dados</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <div className="text-sm text-gray-500">Em construção</div>
            <Progress value={0} />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
