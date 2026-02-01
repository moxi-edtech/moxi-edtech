// apps/web/src/components/super-admin/escola-monitor/EscolaMonitorHeader.tsx
'use client';

import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import type { EscolaDetalhes } from '@/app/super-admin/escolas/[id]/types';
import { RefreshCw, Eye, Database, Download, Calendar, Phone, Mail } from 'lucide-react';
import { useRouter } from 'next/navigation';

interface HeaderProps {
  escola: EscolaDetalhes;
  refreshing: boolean;
  onRefresh: () => void;
}

export function EscolaMonitorHeader({ escola, refreshing, onRefresh }: HeaderProps) {
  const router = useRouter();

  const impersonateEscola = async () => {
    // Implementação de impersonate deve ser feita com segurança no backend
    if (!confirm(`Acessar como ${escola?.nome}? Você será redirecionado para o portal da escola.`)) return;
    router.push(`/escola/${escola.id}/admin/dashboard`);
  };

  return (
    <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
      <div className="flex items-start gap-4">
        {escola.logo_url ? (
          <img 
            src={escola.logo_url} 
            alt={escola.nome}
            className="w-16 h-16 rounded-lg object-cover border"
          />
        ) : (
          <div 
            className="w-16 h-16 rounded-lg flex items-center justify-center text-white text-2xl font-bold"
            style={{ backgroundColor: escola.cor_primaria || '#3b82f6' }}
          >
            {escola.nome.charAt(0)}
          </div>
        )}
        
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-gray-900">{escola.nome}</h1>
          <div className="flex flex-wrap items-center gap-2 mt-1">
            <Badge variant="outline" className={escola.plano_atual === 'profissional' ? 'border-purple-600 text-purple-600' : 'border-blue-600 text-blue-600'}>
              {escola.plano_atual.toUpperCase()}
            </Badge>
            <Badge variant="secondary" className={escola.status === 'ativa' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}>
              {escola.status.toUpperCase()}
            </Badge>
            <Badge variant="outline">
              {escola.onboarding_finalizado ? 'ONBOARDED' : 'PENDING'}
            </Badge>
            <Badge variant="outline" className={escola.aluno_portal_enabled ? 'border-green-600 text-green-600' : 'border-gray-600 text-gray-600'}>
              {escola.aluno_portal_enabled ? 'PORTAL ON' : 'PORTAL OFF'}
            </Badge>
          </div>
          
          <div className="flex flex-wrap items-center gap-3 mt-2 text-sm text-gray-600">
            <div className="flex items-center gap-1">
              <Calendar className="h-3 w-3" />
              Criada em: {new Date(escola.created_at).toLocaleDateString('pt-AO')}
            </div>
            <div className="flex items-center gap-1">
              <Phone className="h-3 w-3" />
              {escola.telefone}
            </div>
            <div className="flex items-center gap-1">
              <Mail className="h-3 w-3" />
              {escola.email}
            </div>
          </div>
        </div>
      </div>
      
      <div className="flex flex-wrap gap-2">
        <Button variant="outline" size="sm" onClick={onRefresh} disabled={refreshing}>
          <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
          {refreshing ? 'Atualizando...' : 'Atualizar'}
        </Button>
        <Button variant="outline" size="sm" onClick={impersonateEscola}>
          <Eye className="h-4 w-4 mr-2" />
          Acessar como
        </Button>
        <Button variant="outline" size="sm" onClick={() => alert('Recalculando aggregates...')}>
          <Database className="h-4 w-4 mr-2" />
          Recalcular
        </Button>
        <Button variant="outline" size="sm" onClick={() => alert('Exportando dados...')}>
          <Download className="h-4 w-4 mr-2" />
          Exportar
        </Button>
      </div>
    </div>
  );
}
