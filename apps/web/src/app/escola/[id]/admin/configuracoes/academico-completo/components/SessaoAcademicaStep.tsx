"use client";

import { useState, useEffect, useMemo } from 'react';
import { toast } from 'sonner';
import { Calendar, RotateCcw, CheckCircle2, Save, Plus } from 'lucide-react';
import { type AcademicSession } from '@/types/academico.types';
import { Button } from './ui/Button';
import { Input } from './ui/Input';
import { Card } from './ui/Card';
import { Badge } from './ui/Badge';
import { StepHeader } from './StepHeader';
import { createClient } from '@/lib/supabaseClient';

type Props = {
  escolaId: string;
  sessoes: AcademicSession[];
  sessaoAtiva: AcademicSession | null;
  onSessaoAtualizada: (sessao: AcademicSession) => void;
  onSessoesAtualizadas: (sessoes: AcademicSession[]) => void;
};

export default function SessaoAcademicaStep({
  escolaId, sessoes, sessaoAtiva, onSessaoAtualizada, onSessoesAtualizadas
}: Props) {
  const [loading, setLoading] = useState(false);
  const [rotating, setRotating] = useState(false);
  const currentYear = new Date().getFullYear();
  const supabase = useMemo(() => createClient(), []);
  
  const [formData, setFormData] = useState({
    nome: `Ano Letivo ${currentYear}-${currentYear + 1}`,
    startYear: currentYear.toString(),
    endYear: (currentYear + 1).toString(),
  });

  // Preencher formulário se estiver editando uma sessão existente
  useEffect(() => {
    if (sessaoAtiva) {
      const startYear = sessaoAtiva.data_inicio.substring(0, 4);
      const endYear = sessaoAtiva.data_fim.substring(0, 4);
      
      setFormData({
        nome: sessaoAtiva.nome,
        startYear,
        endYear,
      });
    } else {
      // Reset para valores padrão quando não há sessão ativa
      setFormData({
        nome: `Ano Letivo ${currentYear}-${currentYear + 1}`,
        startYear: currentYear.toString(),
        endYear: (currentYear + 1).toString(),
      });
    }
  }, [sessaoAtiva, currentYear]);

  const validarDados = () => {
    const startYearNum = parseInt(formData.startYear);
    const endYearNum = parseInt(formData.endYear);

    if (!formData.nome.trim()) {
      toast.error("Nome da sessão é obrigatório");
      return false;
    }

    if (!formData.startYear || !formData.endYear) {
      toast.error("Anos de início e término são obrigatórios");
      return false;
    }

    if (startYearNum >= endYearNum) {
      toast.error("O ano de término deve ser maior que o ano de início");
      return false;
    }

    if (endYearNum - startYearNum > 3) {
      toast.error("A sessão não pode ter mais de 3 anos de duração");
      return false;
    }

    if (startYearNum < 2000 || startYearNum > 2100) {
      toast.error("Ano de início deve estar entre 2000 e 2100");
      return false;
    }

    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validarDados()) return;

    setLoading(true);
    const toastId = toast.loading(
      sessaoAtiva ? "Atualizando sessão acadêmica..." : "Criando sessão acadêmica..."
    );

    try {
      // Usa endpoint de onboarding que faz upsert da sessão ativa
      const res = await fetch(`/api/escolas/${escolaId}/onboarding/session`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nome: formData.nome.trim(),
          startYear: formData.startYear,
          endYear: formData.endYear,
        }),
      });

      const result = await res.json();
      if (!res.ok || !result?.ok) throw new Error(result.error || "Falha ao salvar sessão.");

      // Atualização otimista para refletir imediatamente no painel da sessão ativa
      if (sessaoAtiva) {
        onSessaoAtualizada({
          ...sessaoAtiva,
          nome: formData.nome.trim(),
          data_inicio: `${formData.startYear}-01-01`,
          data_fim: `${formData.endYear}-12-31`,
          ano_letivo: `${formData.startYear}-${formData.endYear}`,
        } as any);
      }

      // Após salvar, recarrega sessões e propaga para o pai
      await refreshSessions();
      toast.success(sessaoAtiva ? "Sessão acadêmica atualizada com sucesso!" : "Sessão acadêmica criada com sucesso!", { id: toastId });

    } catch (error: any) {
      toast.error(error.message, { id: toastId });
    } finally {
      setLoading(false);
    }
  };

  const handleRotacionarSessao = async () => {
    if (!validarDados()) return;

    if (!confirm('Esta ação irá arquivar a sessão atual e criar uma nova. Deseja continuar?')) {
      return;
    }

    setRotating(true);
    const toastId = toast.loading("Rotacionando sessão acadêmica...");

    try {
      const res = await fetch(`/api/escolas/${escolaId}/onboarding/session/rotate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      const result = await res.json();
      if (!res.ok || !result?.ok) throw new Error(result.error || "Falha ao rotacionar sessão.");

      // Após rotacionar, recarrega sessões e propaga para o pai
      await refreshSessions();
      toast.success("Sessão rotacionada com sucesso! A anterior foi arquivada.", { id: toastId });

    } catch (error: any) {
      toast.error(error.message, { id: toastId });
    } finally {
      setRotating(false);
    }
  };

  // Recarrega as sessões da escola e atualiza o estado via callbacks do pai
  const refreshSessions = async () => {
    try {
      const { data: s } = await supabase
        .from('school_sessions')
        .select('id, nome, data_inicio, data_fim, status')
        .eq('escola_id', escolaId)
        .order('data_inicio', { ascending: false })
      const mapSessions: AcademicSession[] = (s || []).map((row: any) => ({
        id: row.id,
        nome: row.nome,
        ano_letivo: `${String(row.data_inicio).slice(0, 4)}-${String(row.data_fim).slice(0, 4)}`,
        data_inicio: String(row.data_inicio),
        data_fim: String(row.data_fim),
        status: row.status,
      }))
      onSessoesAtualizadas(mapSessions)
      const ativa = mapSessions.find(x => x.status === 'ativa') || mapSessions[0] || null
      if (ativa) onSessaoAtualizada(ativa)
    } catch (_) {
      // Silencia erro de refresh; callbacks não serão chamados
    }
  }

  const formatarPeriodo = (startYear: string, endYear: string) => {
    return `${startYear} - ${endYear}`;
  };

  const formatDateBR = (dateStr: string) => {
    const iso = String(dateStr).slice(0, 10);
    const parts = iso.split("-");
    if (parts.length === 3) {
      const [y, m, d] = parts;
      return `${d}/${m}/${y}`;
    }
    try {
      return new Date(dateStr).toLocaleDateString('pt-BR', { timeZone: 'UTC' });
    } catch {
      return String(dateStr);
    }
  };

  const isEditando = !!sessaoAtiva;

  return (
    <div className="space-y-8">
      <StepHeader
        icone={<Calendar className="w-8 h-8" />}
        titulo="Sessão Acadêmica"
        descricao="Configure o ano letivo atual para organizar períodos, turmas e matrículas."
      />
      
      <div className="grid lg:grid-cols-2 gap-8">
        {/* FORMULÁRIO EXPLÍCITO */}
        <Card className="p-6">
          <div className="flex items-center gap-2 mb-6">
            <Calendar className="w-5 h-5 text-blue-600" />
            <h3 className="text-lg font-semibold text-gray-900">
              {isEditando ? "Editar Sessão Ativa" : "Nova Sessão Acadêmica"}
            </h3>
          </div>

          {/* FORMULÁRIO COMEÇA AQUI */}
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid md:grid-cols-2 gap-4">
              <Input 
                label="Ano de Início *" 
                type="number"
                min="2000"
                max="2100"
                value={formData.startYear}
                onChange={(e) => setFormData({ ...formData, startYear: e.target.value })}
                placeholder="2024"
                required
              />
              
              <Input 
                label="Ano de Término *" 
                type="number"
                min="2001"
                max="2100"
                value={formData.endYear}
                onChange={(e) => setFormData({ ...formData, endYear: e.target.value })}
                placeholder="2025"
                required
              />
            </div>
            
            <Input 
              label="Nome da Sessão *"
              value={formData.nome}
              onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
              placeholder="Ex: Ano Letivo 2024-2025"
              maxLength={100}
              required
            />

            {/* Pré-visualização */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <h4 className="font-semibold text-blue-800 text-sm mb-1">Pré-visualização</h4>
              <p className="text-blue-700 text-sm">
                <strong>Período:</strong> {formatarPeriodo(formData.startYear, formData.endYear)}
              </p>
              <p className="text-blue-700 text-sm">
                <strong>Duração:</strong> {parseInt(formData.endYear) - parseInt(formData.startYear)} ano(s)
              </p>
            </div>

            {/* Botões do Formulário */}
            <div className="flex gap-3 pt-2">
              <Button 
                type="submit"
                loading={loading}
                disabled={!formData.nome.trim() || !formData.startYear || !formData.endYear}
                className="flex-1"
              >
                {isEditando ? (
                  <>
                    <Save className="w-4 h-4 mr-2" />
                    Atualizar Sessão
                  </>
                ) : (
                  <>
                    <Plus className="w-4 h-4 mr-2" />
                    Criar Sessão
                  </>
                )}
              </Button>
              
              {isEditando && (
                <Button 
                  type="button"
                  onClick={handleRotacionarSessao}
                  loading={rotating}
                  variant="outline"
                  disabled={loading}
                >
                  <RotateCcw className="w-4 h-4 mr-2" />
                  Rotacionar
                </Button>
              )}
            </div>
          </form>
          {/* FORMULÁRIO TERMINA AQUI */}
        </Card>

        {/* Painel de Informações */}
        <div className="space-y-6">
          {sessaoAtiva ? (
            <Card className="p-6 border-green-200 bg-green-50/50">
              <div className="flex items-center gap-2 mb-4">
                <CheckCircle2 className="w-5 h-5 text-green-600" />
                <h3 className="text-lg font-semibold text-green-900">Sessão Ativa</h3>
                <Badge variant="success" className="ml-auto">Ativa</Badge>
              </div>
              
              <div className="space-y-3">
                <div>
                  <span className="text-sm font-medium text-green-800">Nome:</span>
                  <p className="text-green-700 font-semibold">{sessaoAtiva.nome}</p>
                </div>
                
                <div>
                  <span className="text-sm font-medium text-green-800">Período:</span>
                  <p className="text-green-700">
                    {formatDateBR(sessaoAtiva.data_inicio)} a {formatDateBR(sessaoAtiva.data_fim)}
                  </p>
                </div>
                
                <div>
                  <span className="text-sm font-medium text-green-800">Status:</span>
                  <p className="text-green-700 capitalize">{sessaoAtiva.status}</p>
                </div>

                <div className="pt-2">
                  <p className="text-xs text-green-600">
                    💡 Você pode editar esta sessão ou rotacionar para criar uma nova.
                  </p>
                </div>
              </div>
            </Card>
          ) : (
            <Card className="p-6 border-yellow-200 bg-yellow-50/50">
              <div className="text-center py-8">
                <Calendar className="w-12 h-12 text-yellow-400 mx-auto mb-3" />
                <h3 className="text-lg font-semibold text-yellow-800 mb-2">
                  Nenhuma Sessão Ativa
                </h3>
                <p className="text-yellow-700 text-sm">
                  Use o formulário ao lado para criar a primeira sessão acadêmica.
                </p>
              </div>
            </Card>
          )}

          {/* Histórico de Sessões */}
          {sessoes.filter(s => !sessaoAtiva || s.id !== sessaoAtiva.id).length > 0 && (
            <Card className="p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">
                Histórico de Sessões ({sessoes.filter(s => !sessaoAtiva || s.id !== sessaoAtiva.id).length})
              </h3>
              <div className="space-y-3 max-h-60 overflow-y-auto">
                {sessoes
                  .filter(s => !sessaoAtiva || s.id !== sessaoAtiva.id)
                  .sort((a, b) => new Date(b.data_inicio).getTime() - new Date(a.data_inicio).getTime())
                  .map((sessao) => (
                    <div key={sessao.id} className="flex items-center justify-between p-3 border rounded-lg bg-gray-50">
                      <div className="flex-1">
                        <p className="font-medium text-gray-900">{sessao.nome}</p>
                        <p className="text-sm text-gray-600">
                          {formatDateBR(sessao.data_inicio)} - {formatDateBR(sessao.data_fim)}
                        </p>
                      </div>
                      <Badge variant={sessao.status === 'arquivada' ? 'neutral' : 'outline'}>
                        {sessao.status}
                      </Badge>
                    </div>
                  ))}
              </div>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
