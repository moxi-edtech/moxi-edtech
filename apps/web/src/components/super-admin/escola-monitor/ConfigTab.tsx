// apps/web/src/components/super-admin/escola-monitor/ConfigTab.tsx
'use client';

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/Button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import type { EscolaDetalhes } from '@/app/super-admin/escolas/[id]/types';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';

interface ConfigTabProps {
  escola: EscolaDetalhes;
  onUpdate: () => void;
}

export function ConfigTab({ escola, onUpdate }: ConfigTabProps) {
  const supabase = createClientComponentClient();

  const togglePortalAluno = async () => {
    if (!escola) return;
    
    const newStatus = !escola.aluno_portal_enabled;
    if (!confirm(`Tem certeza que deseja ${newStatus ? 'ATIVAR' : 'DESATIVAR'} o Portal do Aluno para ${escola.nome}?`)) return;

    try {
      const { error } = await supabase
        .from('escolas')
        .update({ 
          aluno_portal_enabled: newStatus,
          updated_at: new Date().toISOString()
        })
        .eq('id', escola.id);
      
      if (error) throw error;
      
      alert(`Portal do aluno ${newStatus ? 'ativado' : 'desativado'} com sucesso!`);
      onUpdate(); // Trigger a data refresh on the parent page
    } catch (error) {
      console.error('Erro ao alterar portal:', error);
      alert('Erro ao alterar configuração');
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Configurações da Escola</CardTitle>
        <CardDescription>Ações administrativas e configurações de alto nível.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="flex items-center justify-between p-4 border rounded-lg">
          <div>
            <Label htmlFor="portal-aluno" className="font-medium">Portal do Aluno</Label>
            <p className="text-sm text-gray-600">Ativa ou desativa o acesso dos alunos ao portal.</p>
          </div>
          <Switch
            id="portal-aluno"
            checked={escola.aluno_portal_enabled}
            onCheckedChange={togglePortalAluno}
          />
        </div>

        <div className="flex items-center justify-between p-4 border rounded-lg bg-red-50 border-red-200">
          <div>
            <Label htmlFor="reset-escola" className="font-medium text-red-800">Resetar Escola</Label>
            <p className="text-sm text-red-600">Apaga todos os dados (alunos, turmas, etc). Ação irreversível.</p>
          </div>
          <Button variant="destructive" onClick={() => alert('Função de reset ainda não implementada.')}>
            Resetar Dados
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
