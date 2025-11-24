"use client";

import { useState, useEffect } from 'react';
import { Calendar, RotateCcw, CheckCircle2, Save, Plus, AlertCircle, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { type AcademicSession } from '@/types/academico.types';
import Button from "@/components/ui/Button";
import { Input } from '@/components/ui/Input';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';

type Props = {
  escolaId: string;
  sessoes: AcademicSession[];
  sessaoAtiva: AcademicSession | null;
  onSessaoAtualizada: (sessao: AcademicSession | null) => void;
  onSessoesAtualizadas: (sessoes: AcademicSession[]) => void;
  onComplete?: () => void; // Nova prop para o wizard
};

export default function SessaoAcademicaStep({
  escolaId, sessoes, sessaoAtiva, onSessaoAtualizada, onSessoesAtualizadas, onComplete
}: Props) {
  const [loading, setLoading] = useState(false);
  const [rotating, setRotating] = useState(false);
  const [deletando, setDeletando] = useState<string | null>(null);
  const [forceConfirm, setForceConfirm] = useState<{
    sessaoId: string;
    sessaoNome: string;
    detalhes: string;
  } | null>(null);
  const [forcing, setForcing] = useState(false);
  const currentYear = new Date().getFullYear();
  
  const [formData, setFormData] = useState({
    nome: `Ano Letivo ${currentYear}-${currentYear + 1}`,
    startYear: currentYear.toString(),
    endYear: (currentYear + 1).toString(),
    mode: 'date' as 'date' | 'year',
    startDate: `${currentYear}-02-01`,
    endDate: `${currentYear + 1}-01-31`,
  });

  // Preencher formulário se estiver editando uma sessão existente
  useEffect(() => {
    if (sessaoAtiva) {
      try {
        const startYear = sessaoAtiva.data_inicio?.substring(0, 4);
        const endYear = sessaoAtiva.data_fim?.substring(0, 4);
        const startDate = sessaoAtiva.data_inicio?.substring(0, 10)
        const endDate = sessaoAtiva.data_fim?.substring(0, 10)
        
        if (startYear && endYear && !isNaN(parseInt(startYear)) && !isNaN(parseInt(endYear))) {
          setFormData({
            nome: sessaoAtiva.nome,
            startYear,
            endYear,
            startDate: startDate || `${currentYear}-02-01`,
            endDate: endDate || `${currentYear + 1}-01-31`,
            mode: 'date',
          });
        } else {
          console.warn("Datas da sessão ativa são inválidas:", { startYear, endYear });
        }
      } catch (error) {
        console.error("Erro ao processar datas da sessão:", error);
        setFormData({
          nome: `Ano Letivo ${currentYear}-${currentYear + 1}`,
          startYear: currentYear.toString(),
          endYear: (currentYear + 1).toString(),
          startDate: `${currentYear}-02-01`,
          endDate: `${currentYear + 1}-01-31`,
          mode: 'date',
        });
      }
    } else {
      setFormData({
        nome: `Ano Letivo ${currentYear}-${currentYear + 1}`,
        startYear: currentYear.toString(),
        endYear: (currentYear + 1).toString(),
        startDate: `${currentYear}-02-01`,
        endDate: `${currentYear + 1}-01-31`,
        mode: 'date',
      });
    }
  }, [sessaoAtiva, currentYear]);

  // Atualizar automaticamente o ano de término quando o ano de início mudar (modo year)
  useEffect(() => {
    if (formData.mode === 'year' && formData.startYear && !sessaoAtiva) {
      const startYearNum = parseInt(formData.startYear);
      if (!isNaN(startYearNum)) {
        setFormData(prev => ({
          ...prev,
          endYear: (startYearNum + 1).toString(),
          nome: `Ano Letivo ${startYearNum}-${startYearNum + 1}`
        }));
      }
    }
  }, [formData.startYear, sessaoAtiva]);

  const validarDados = () => {
    const startYearNum = parseInt(formData.startYear);
    const endYearNum = parseInt(formData.endYear);

    if (!formData.nome.trim()) {
      toast.error("Nome da sessão é obrigatório");
      return false;
    }
    if (formData.mode === 'year') {
      if (!formData.startYear || !formData.endYear) {
        toast.error("Anos de início e término são obrigatórios");
        return false;
      }
      if (isNaN(startYearNum) || isNaN(endYearNum)) {
        toast.error("Anos devem ser números válidos");
        return false;
      }
      if (startYearNum >= endYearNum) {
        toast.error("O ano de término deve ser maior que o ano de início");
        return false;
      }
      if (endYearNum - startYearNum !== 1) {
        toast.error("A sessão acadêmica deve ter exatamente 1 ano de duração");
        return false;
      }
      if (startYearNum < 2000 || startYearNum > 2100) {
        toast.error("Ano de início deve estar entre 2000 e 2100");
        return false;
      }
    } else {
      // modo date
      if (!formData.startDate || !formData.endDate) {
        toast.error("Datas de início e término são obrigatórias");
        return false;
      }
      const sd = new Date(formData.startDate)
      const ed = new Date(formData.endDate)
      if (isNaN(sd.getTime()) || isNaN(ed.getTime())) {
        toast.error("Datas inválidas");
        return false;
      }
      if (ed <= sd) {
        toast.error("A data de término deve ser após a data de início");
        return false;
      }
      const expected = new Date(sd)
      expected.setFullYear(expected.getFullYear() + 1)
      expected.setDate(expected.getDate() - 1)
      const toISO = (d: Date) => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`
      if (toISO(expected) !== toISO(ed)) {
        toast.error("A sessão deve durar 1 ano (fim = início + 1 ano - 1 dia)");
        return false;
      }
    }

    return true;
  };

  const handleDeletarSessao = async (sessaoId: string, sessaoNome: string) => {
    if (sessaoAtiva && sessaoAtiva.id === sessaoId) {
      toast.error("Não é possível deletar a sessão ativa");
      return;
    }

    if (!confirm(`Tem certeza que deseja deletar a sessão "${sessaoNome}"? Esta ação não pode ser desfeita.`)) {
      return;
    }

    setDeletando(sessaoId);
    const toastId = toast.loading("Deletando sessão...");

    try {
      const res = await fetch(`/api/escolas/${escolaId}/onboarding/session/${sessaoId}`, {
        method: 'DELETE',
      });

      const result = await res.json();
      if (!res.ok || !result?.ok) {
        const msg = result?.error || "Falha ao deletar sessão.";
        const canForce = typeof result?.error === 'string' && result.error.includes('?force=1');
        if (canForce) {
          toast.error(msg, { id: toastId });
          setForceConfirm({ sessaoId, sessaoNome, detalhes: msg });
          return;
        }
        throw new Error(msg);
      }

      const sessoesAtualizadas = sessoes.filter(s => s.id !== sessaoId);
      onSessoesAtualizadas(sessoesAtualizadas);
      const novaAtiva = sessoesAtualizadas.find(s => s.status === 'ativa') || null;
      onSessaoAtualizada(novaAtiva);

      toast.success("Sessão deletada com sucesso!", { id: toastId });

    } catch (error: any) {
      toast.error(error.message, { id: toastId });
    } finally {
      setDeletando(null);
    }
  };

  const handleForceDelete = async () => {
    if (!forceConfirm) return;
    setForcing(true);
    const toastId = toast.loading("Forçando exclusão (cascata)...");
    try {
      const res2 = await fetch(`/api/escolas/${escolaId}/onboarding/session/${forceConfirm.sessaoId}?force=1`, { method: 'DELETE' });
      const result2 = await res2.json();
      if (!res2.ok || !result2?.ok) throw new Error(result2.error || "Falha ao deletar sessão.");

      const sessoesAtualizadas = sessoes.filter(s => s.id !== forceConfirm.sessaoId);
      onSessoesAtualizadas(sessoesAtualizadas);
      const novaAtiva = sessoesAtualizadas.find(s => s.status === 'ativa') || null;
      onSessaoAtualizada(novaAtiva);
      setForceConfirm(null);
      toast.success("Sessão deletada com sucesso!", { id: toastId });
    } catch (e: any) {
      toast.error(e.message || "Erro ao forçar exclusão", { id: toastId });
    } finally {
      setForcing(false);
    }
  };

  const handleYearChange = (field: 'startYear' | 'endYear', value: string) => {
    const numValue = parseInt(value);
    
    if (isNaN(numValue) && value !== '') return;

    if (field === 'startYear') {
      setFormData({
        ...formData,
        startYear: value,
        endYear: value ? (numValue + 1).toString() : '',
        nome: value ? `Ano Letivo ${value}-${numValue + 1}` : ''
      });
    } else {
      const startYearNum = parseInt(formData.startYear);
      if (!isNaN(startYearNum) && numValue === startYearNum + 1) {
        setFormData({
          ...formData,
          endYear: value,
          nome: `Ano Letivo ${formData.startYear}-${value}`
        });
      } else {
        toast.error("O ano de término deve ser exatamente 1 ano após o ano de início");
        if (!isNaN(startYearNum)) {
          setFormData({
            ...formData,
            endYear: (startYearNum + 1).toString()
          });
        }
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validarDados()) return;

    setLoading(true);
    const toastId = toast.loading(
      sessaoAtiva ? "Atualizando sessão acadêmica..." : "Criando sessão acadêmica..."
    );

    try {
      const res = await fetch(`/api/escolas/${escolaId}/onboarding/session`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(
          formData.mode === 'year'
            ? {
                nome: formData.nome.trim(),
                startYear: formData.startYear,
                endYear: formData.endYear,
              }
            : {
                nome: formData.nome.trim(),
                startDate: formData.startDate,
                endDate: formData.endDate,
              }
        ),
      });

      const result = await res.json();
      if (!res.ok || !result?.ok) throw new Error(result.error || "Falha ao salvar sessão.");

      if (result.data) {
        onSessaoAtualizada(result.data);
        if (sessaoAtiva) {
          onSessoesAtualizadas(sessoes.map(s => s.id === sessaoAtiva.id ? result.data : s));
        } else {
          onSessoesAtualizadas([...sessoes, result.data]);
        }

        // 🔥 NOVO: Chamar onComplete se for uma nova sessão
        if (!sessaoAtiva && onComplete) {
          onComplete();
        }
      }

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
        body: JSON.stringify(
          formData.mode === 'year'
            ? {
                nome: formData.nome.trim(),
                startYear: formData.startYear,
                endYear: formData.endYear,
              }
            : {
                nome: formData.nome.trim(),
                startDate: formData.startDate,
                endDate: formData.endDate,
              }
        ),
      });

      const result = await res.json();
      if (!res.ok || !result?.ok) throw new Error(result.error || "Falha ao rotacionar sessão.");

      if (result.data) {
        onSessaoAtualizada(result.data.novaSessao);
        onSessoesAtualizadas(result.data.todasSessoes || []);
      }

      toast.success("Sessão rotacionada com sucesso! A anterior foi arquivada.", { id: toastId });

    } catch (error: any) {
      toast.error(error.message, { id: toastId });
    } finally {
      setRotating(false);
    }
  };

  const formatarPeriodo = (startYear: string, endYear: string) => {
    return `${startYear} - ${endYear}`;
  };

  const isEditando = !!sessaoAtiva;
  const startYearNum = parseInt(formData.startYear);
  const endYearNum = parseInt(formData.endYear);
  const duracao = isNaN(startYearNum) || isNaN(endYearNum) ? 0 : endYearNum - startYearNum;
  const duracaoCorreta = duracao === 1;

  const sessoesHistorico = sessoes.filter(s => !sessaoAtiva || s.id !== sessaoAtiva.id);

  return (
    <div className="space-y-6">
      {forceConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/40" onClick={() => !forcing && setForceConfirm(null)} />
          <div className="relative z-10 w-full max-w-md bg-white rounded-lg shadow-xl border p-6">
            <div className="flex items-start gap-3">
              <div className="p-2 rounded-full bg-red-50 border border-red-200 text-red-600">
                <Trash2 className="w-5 h-5" />
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-semibold text-gray-900">Excluir sessão arquivada</h3>
                <p className="text-sm text-gray-700 mt-1">
                  {forceConfirm.sessaoNome}
                </p>
                <div className="mt-3 p-3 bg-amber-50 border border-amber-200 rounded">
                  <p className="text-xs text-amber-800">
                    {forceConfirm.detalhes}
                  </p>
                  <p className="text-xs text-amber-800 mt-2">
                    Esta ação irá excluir em cascata os registros vinculados (períodos, turmas e matrículas). Não pode ser desfeita.
                  </p>
                </div>
              </div>
            </div>
            <div className="mt-6 flex items-center justify-end gap-3">
              <button
                type="button"
                className="px-4 py-2 rounded-md border bg-white text-gray-700 hover:bg-gray-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-gray-400/60 disabled:bg-gray-100 disabled:text-gray-400 disabled:border disabled:border-gray-300 disabled:hover:bg-gray-100 disabled:cursor-not-allowed"
                onClick={() => setForceConfirm(null)}
                disabled={forcing}
              >
                Cancelar
              </button>
              <button
                type="button"
                className="px-4 py-2 rounded-md bg-red-600 text-white hover:bg-red-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-600/60 disabled:bg-gray-200 disabled:text-gray-500 disabled:border disabled:border-gray-300 disabled:hover:bg-gray-200 disabled:cursor-not-allowed flex items-center gap-2"
                onClick={handleForceDelete}
                disabled={forcing}
              >
                {forcing && <span className="w-4 h-4 border-2 border-white/80 border-t-transparent rounded-full animate-spin" />}
                Forçar exclusão
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Header Simplificado para o Wizard */}
      <div className="text-center mb-6">
        <div className="flex items-center justify-center gap-3 mb-3">
          <div className="p-3 bg-blue-100 rounded-full">
            <Calendar className="w-6 h-6 text-blue-600" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-gray-900">Sessão Acadêmica</h2>
            <p className="text-gray-600">Configure o ano letivo atual da sua escola</p>
          </div>
        </div>
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        {/* FORMULÁRIO */}
        <Card className="p-6">
          <div className="flex items-center gap-2 mb-4">
            <Calendar className="w-5 h-5 text-blue-600" />
            <h3 className="text-lg font-semibold text-gray-900">
              {isEditando ? "Editar Sessão Ativa" : "Nova Sessão Acadêmica"}
            </h3>
          </div>

          {/* Aviso sobre duração fixa */}
          <div className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded-lg">
            <div className="flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-amber-600 mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-sm font-medium text-amber-800">Duração Fixa</p>
                <p className="text-xs text-amber-700">Cada sessão deve ter exatamente 1 ano de duração. Você pode definir por anos ou por datas exatas.</p>
              </div>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="flex gap-2 items-center">
              <label className="text-xs font-medium text-gray-700">Modo:</label>
              <button
                type="button"
                className={`text-xs px-2 py-1 rounded border ${formData.mode === 'date' ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-700 border-gray-300'}`}
                onClick={() => setFormData(prev => ({ ...prev, mode: 'date' }))}
              >Por datas</button>
              <button
                type="button"
                className={`text-xs px-2 py-1 rounded border ${formData.mode === 'year' ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-700 border-gray-300'}`}
                onClick={() => setFormData(prev => ({ ...prev, mode: 'year' }))}
              >Por anos</button>
            </div>

            {formData.mode === 'date' ? (
              <div className="grid md:grid-cols-2 gap-3">
                <Input 
                  label="Data de Início *" 
                  type="date"
                  value={formData.startDate}
                  onChange={(e) => {
                    const v = e.target.value
                    // Sugerir fim = início + 1 ano - 1 dia
                    const sd = new Date(v)
                    if (!isNaN(sd.getTime())) {
                      const end = new Date(sd)
                      end.setFullYear(end.getFullYear() + 1)
                      end.setDate(end.getDate() - 1)
                      const iso = `${end.getFullYear()}-${String(end.getMonth()+1).padStart(2,'0')}-${String(end.getDate()).padStart(2,'0')}`
                      setFormData(prev => ({ ...prev, startDate: v, endDate: iso }))
                    } else {
                      setFormData(prev => ({ ...prev, startDate: v }))
                    }
                  }}
                />
                <Input 
                  label="Data de Término *" 
                  type="date"
                  value={formData.endDate}
                  onChange={(e) => setFormData(prev => ({ ...prev, endDate: e.target.value }))}
                />
              </div>
            ) : (
              <div className="grid md:grid-cols-2 gap-3">
                <Input 
                  label="Ano de Início *" 
                  type="number"
                  min="2000"
                  max="2099"
                  value={formData.startYear}
                  onChange={(e) => handleYearChange('startYear', e.target.value)}
                />
                <Input 
                  label="Ano de Término *" 
                  type="number"
                  min="2001"
                  max="2100"
                  value={formData.endYear}
                  onChange={(e) => handleYearChange('endYear', e.target.value)}
                />
              </div>
            )}
            <div className="grid md:grid-cols-2 gap-3">
              <Input 
                label="Ano de Início *" 
                type="number"
                min="2000"
                max="2099"
                value={formData.startYear}
                onChange={(e) => handleYearChange('startYear', e.target.value)}
                placeholder="2024"
                required
              />
              
              <Input 
                label="Ano de Término *" 
                type="number"
                min="2001"
                max="2100"
                value={formData.endYear}
                onChange={(e) => handleYearChange('endYear', e.target.value)}
                placeholder="2025"
                required
                disabled={!sessaoAtiva}
                title={sessaoAtiva ? "Edite o ano de término" : "Calculado automaticamente"}
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
            <div className={`border rounded-lg p-3 ${
              duracaoCorreta 
                ? 'bg-green-50 border-green-200' 
                : 'bg-red-50 border-red-200'
            }`}>
              <h4 className="font-semibold text-sm mb-1 flex items-center gap-2">
                <Calendar className="w-4 h-4" />
                Pré-visualização
                {duracaoCorreta ? (
                  <Badge variant="success" className="text-xs">✓ Pronto</Badge>
                ) : (
                  <Badge variant="error" className="text-xs">Ajuste necessário</Badge>
                )}
              </h4>
              <p className={`text-sm ${duracaoCorreta ? 'text-green-700' : 'text-red-700'}`}>
                <strong>Período:</strong> {formatarPeriodo(formData.startYear, formData.endYear)}
              </p>
              <p className={`text-sm ${duracaoCorreta ? 'text-green-700' : 'text-red-700'}`}>
                <strong>Duração:</strong> {duracao} ano(s) {!duracaoCorreta && '- Deve ser 1 ano'}
              </p>
            </div>

            {/* Botões do Formulário */}
            <div className="flex gap-3 pt-3">
              <Button 
                type="submit"
                loading={loading}
                disabled={!formData.nome.trim() || !formData.startYear || !formData.endYear || !duracaoCorreta}
                className="flex-1"
              >
                {isEditando ? (
                  <>
                    <Save className="w-4 h-4 mr-2" />
                    Atualizar
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
                  disabled={loading || (formData.mode === 'year' && !duracaoCorreta)}
                >
                  <RotateCcw className="w-4 h-4 mr-2" />
                  Rotacionar
                </Button>
              )}
            </div>
          </form>
        </Card>

        {/* Painel de Informações */}
        <div className="space-y-4">
          {sessaoAtiva ? (
            <Card className="p-5 border-green-200 bg-green-50">
              <div className="flex items-center gap-2 mb-3">
                <CheckCircle2 className="w-5 h-5 text-green-600" />
                <h3 className="font-semibold text-green-900">Sessão Ativa</h3>
                <Badge variant="success" className="ml-auto">Ativa</Badge>
              </div>
              
              <div className="space-y-2">
                <div>
                  <span className="text-sm font-medium text-green-800">Nome:</span>
                  <p className="text-green-700 font-semibold">{sessaoAtiva.nome}</p>
                </div>
                
                <div>
                  <span className="text-sm font-medium text-green-800">Período:</span>
                  <p className="text-green-700 text-sm">
                    {new Date(sessaoAtiva.data_inicio).toLocaleDateString('pt-BR')} 
                    {" a "} 
                    {new Date(sessaoAtiva.data_fim).toLocaleDateString('pt-BR')}
                  </p>
                </div>
              </div>
            </Card>
          ) : (
            <Card className="p-5 border-yellow-200 bg-yellow-50">
              <div className="text-center py-4">
                <Calendar className="w-10 h-10 text-yellow-400 mx-auto mb-2" />
                <h3 className="font-semibold text-yellow-800 mb-1">
                  Nenhuma Sessão Ativa
                </h3>
                <p className="text-yellow-700 text-sm">
                  Crie uma sessão acadêmica para continuar
                </p>
              </div>
            </Card>
          )}

          {/* Histórico de Sessões (Condensado) */}
          {sessoesHistorico.length > 0 && (
            <Card className="p-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-semibold text-gray-900 text-sm">
                  Histórico ({sessoesHistorico.length})
                </h3>
                <Badge variant="neutral" className="text-xs">Arquivadas</Badge>
              </div>
              <div className="space-y-2 max-h-40 overflow-y-auto">
                {sessoesHistorico
                  .sort((a, b) => new Date(b.data_inicio).getTime() - new Date(a.data_inicio).getTime())
                  .map((sessao) => (
                    <div key={sessao.id} className="flex items-center justify-between p-2 border rounded bg-gray-50 group hover:bg-gray-100 transition-colors">
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-gray-900 text-sm truncate">{sessao.nome}</p>
                        <p className="text-xs text-gray-600">
                          {new Date(sessao.data_inicio).getFullYear()}-{new Date(sessao.data_fim).getFullYear()}
                        </p>
                      </div>
                      <button
                        onClick={() => handleDeletarSessao(sessao.id, sessao.nome)}
                        disabled={deletando === sessao.id}
                        className="p-1 text-red-600 hover:bg-red-50 rounded transition-colors opacity-0 group-hover:opacity-100 focus:opacity-100 disabled:opacity-50"
                        title="Deletar sessão"
                      >
                        {deletando === sessao.id ? (
                          <div className="w-3 h-3 border-2 border-red-600 border-t-transparent rounded-full animate-spin" />
                        ) : (
                          <Trash2 className="w-3 h-3" />
                        )}
                      </button>
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
