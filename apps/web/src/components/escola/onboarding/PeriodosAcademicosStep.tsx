"use client";

import { useState } from 'react';
import { toast } from 'sonner';
import { BookOpen, Calendar, Plus, Zap } from 'lucide-react';
import { type AcademicPeriod, type AcademicSession } from '@/types/academico.types';
import Button from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';

type Props = {
  escolaId: string;
  sessaoAtiva: AcademicSession | null;
  periodos: AcademicPeriod[];
  onPeriodosAtualizados: (periodos: AcademicPeriod[]) => void;
  onComplete?: () => void;
};

const periodosOptions = [
  { value: 'TRIMESTRE', label: 'Trimestre' },
  { value: 'BIMESTRE', label: 'Bimestre' },
  { value: 'SEMESTRE', label: 'Semestre' },
  { value: 'ANUAL', label: 'Anual' },
];

// Utilitário simples para somar meses
const addMonths = (date: Date, months: number) => {
  const d = new Date(date)
  d.setMonth(d.getMonth() + months)
  return d
}

// 🔥 NOVO: Calcular períodos automaticamente
// Se customStartDate for informado, usa blocos de meses para todos os tipos;
// caso contrário, mantém o comportamento atual (TRIMESTRE por meses, demais por divisão de dias).
const calcularPeriodosAutomaticos = (
  tipo: string,
  dataInicioSessao: string,
  dataFimSessao: string,
  customStartDate?: string
): Omit<AcademicPeriod, 'id' | 'numero' | 'sessao_id'>[] => {
  const inicio = new Date(dataInicioSessao);
  const fim = new Date(dataFimSessao);
  const periodos: Omit<AcademicPeriod, 'id' | 'numero' | 'sessao_id'>[] = [];
  let dataAtual = new Date(customStartDate || dataInicioSessao);

  const sugestoesNomes = {
    TRIMESTRE: ["1º Trimestre", "2º Trimestre", "3º Trimestre"],
    BIMESTRE: ["1º Bimestre", "2º Bimestre", "3º Bimestre", "4º Bimestre", "5º Bimestre", "6º Bimestre"],
    SEMESTRE: ["1º Semestre", "2º Semestre"],
    ANUAL: ["Ano Letivo Completo"]
  };

  const maxByTipo: Record<string, number> = {
    TRIMESTRE: 3,
    BIMESTRE: 6,
    SEMESTRE: 2,
  ANUAL: 1,
  };

  // Mantido puro: sem referências a estados/handlers do componente
  const nomes = sugestoesNomes[tipo as keyof typeof sugestoesNomes] || [tipo];

  const monthsPerType: Record<string, number[]> = {
    TRIMESTRE: [3, 3, 3],
    BIMESTRE: [2, 2, 2, 2, 2, 2],
    SEMESTRE: [6, 6],
    ANUAL: [12],
  };

  if (customStartDate) {
    const blocks = monthsPerType[tipo] || [];
    for (let i = 0; i < blocks.length; i++) {
      const dataInicioPeriodo = new Date(dataAtual);
      const limite = addMonths(dataInicioPeriodo, blocks[i]);
      const dataFimPeriodo = new Date(Math.min(limite.getTime() - 24 * 60 * 60 * 1000, fim.getTime()));
      periodos.push({
        nome: nomes[i] || `${i + 1}º ${tipo.charAt(0) + tipo.slice(1).toLowerCase()}`,
        tipo,
        data_inicio: dataInicioPeriodo.toISOString().split('T')[0],
        data_fim: dataFimPeriodo.toISOString().split('T')[0],
      });
      const next = new Date(dataFimPeriodo);
      next.setDate(next.getDate() + 1);
      dataAtual = next;
      if (dataAtual > fim) break;
    }
  } else {
    if (tipo === 'TRIMESTRE') {
      // Gera 3 trimestres com no máximo 3 meses cada
      for (let i = 0; i < 3; i++) {
        const dataInicioPeriodo = new Date(dataAtual)
        const limite = addMonths(dataInicioPeriodo, 3)
        const dataFimPeriodo = new Date(Math.min(limite.getTime(), fim.getTime()))
        periodos.push({
          nome: nomes[i] || `${i + 1}º Trimestre`,
          tipo,
          data_inicio: dataInicioPeriodo.toISOString().split('T')[0],
          data_fim: dataFimPeriodo.toISOString().split('T')[0]
        })
        dataAtual = new Date(dataFimPeriodo)
        dataAtual.setDate(dataAtual.getDate() + 1)
        if (dataAtual > fim) break
      }
    } else {
      // Lógica anterior baseada em divisão por dias (bimestre/semestre/anual)
      const diffTime = Math.abs(fim.getTime() - inicio.getTime());
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      const diasPorPeriodo = Math.floor(diffDays /
        (tipo === 'BIMESTRE' ? 4 : tipo === 'SEMESTRE' ? 2 : 1));

      for (let i = 0; i < nomes.length; i++) {
        const dataInicioPeriodo = new Date(dataAtual);
        const dataFimPeriodo = new Date(dataAtual);
        dataFimPeriodo.setDate(dataFimPeriodo.getDate() + diasPorPeriodo - 1);

        if (dataFimPeriodo > fim) {
          dataFimPeriodo.setTime(fim.getTime());
        }

        periodos.push({
          nome: nomes[i],
          tipo,
          data_inicio: dataInicioPeriodo.toISOString().split('T')[0],
          data_fim: dataFimPeriodo.toISOString().split('T')[0]
        });

        dataAtual = new Date(dataFimPeriodo);
        dataAtual.setDate(dataAtual.getDate() + 1);
      }
    }
  }

  return periodos;
};

export default function PeriodosAcademicosStep({ 
  escolaId, 
  sessaoAtiva, 
  periodos, 
  onPeriodosAtualizados,
  onComplete 
}: Props) {
  const [loading, setLoading] = useState(false);
  const [bulkLoading, setBulkLoading] = useState(false);
  const [savingBulk, setSavingBulk] = useState(false);
  const [preview, setPreview] = useState<Omit<AcademicPeriod, 'id' | 'numero' | 'sessao_id'>[] | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingForm, setEditingForm] = useState<{ nome: string; data_inicio: string; data_fim: string; tipo?: string } | null>(null);
  const [formData, setFormData] = useState({
    nome: "",
    tipo: "TRIMESTRE",
    data_inicio: "",
    data_fim: "",
  });

  // Validação: precisa ter sessão ativa
  if (!sessaoAtiva) {
    return (
      <div className="text-center py-8 border rounded-lg bg-yellow-50">
        <div className="p-4">
          <Calendar className="w-12 h-12 text-yellow-500 mx-auto mb-3" />
          <h3 className="font-semibold text-yellow-800 mb-2">
            Sessão Acadêmica Necessária
          </h3>
          <p className="text-yellow-700 text-sm">
            Crie uma sessão acadêmica antes de adicionar períodos
          </p>
        </div>
      </div>
    );
  }

  const handleCriarPeriodo = async (periodoData?: typeof formData | Omit<AcademicPeriod, 'id' | 'numero' | 'sessao_id'>) => {
    if (!sessaoAtiva) return;

    const dados = periodoData || formData;

    // Validações básicas
    if (!dados.nome.trim()) {
      toast.error("Nome do período é obrigatório");
      return;
    }

    if (!dados.data_inicio || !dados.data_fim) {
      toast.error("Datas de início e término são obrigatórias");
      return;
    }

    // Validações de data
    if (new Date(dados.data_inicio) >= new Date(dados.data_fim)) {
      toast.error("A data de término deve ser posterior à data de início");
      return;
    }

    // Verifica se o período está dentro da sessão acadêmica
    const inicioSessao = new Date(sessaoAtiva.data_inicio);
    const fimSessao = new Date(sessaoAtiva.data_fim);
    const inicioPeriodo = new Date(dados.data_inicio);
    const fimPeriodo = new Date(dados.data_fim);

    if (inicioPeriodo < inicioSessao) {
      toast.error("O período não pode começar antes da sessão acadêmica");
      return;
    }

    if (fimPeriodo > fimSessao) {
      toast.error("O período não pode terminar depois da sessão acadêmica");
      return;
    }

    if (!periodoData) {
      setLoading(true);
    }

    const toastId = periodoData 
      ? toast.loading(`Criando ${dados.nome}...`)
      : toast.loading("Criando período acadêmico...");

    try {
      // Regra: Trimestre com no máximo 3 meses
      if (dados.tipo === 'TRIMESTRE') {
        const inicioPeriodo = new Date(dados.data_inicio)
        const fimPeriodo = new Date(dados.data_fim)
        const limite = addMonths(inicioPeriodo, 3)
        if (fimPeriodo > limite) {
          toast.error('O trimestre deve ter no máximo 3 meses.')
          return
        }
      }

      const res = await fetch(`/api/escolas/${escolaId}/semestres`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...dados,
          sessao_id: sessaoAtiva.id,
          numero: periodos.length + 1,
        }),
      });

      const result = await res.json();
      if (!res.ok) throw new Error(result.error || "Falha ao criar o período.");

      const novosPeriodos = [...periodos, result.data];
      onPeriodosAtualizados(novosPeriodos);
      
      if (!periodoData) {
        // Reset do formulário apenas para criação manual
        setFormData({ nome: "", tipo: "TRIMESTRE", data_inicio: "", data_fim: "" });
      }
      
      toast.success(`Período ${dados.nome} criado com sucesso!`, { id: toastId });

      return result.data;

    } catch (error: any) {
      toast.error(error.message, { id: toastId });
      throw error;
    } finally {
      if (!periodoData) {
        setLoading(false);
      }
    }
  };

  // 🔥 NOVO: Gerar sugestão de períodos (pré-visualização)
  const handleGerarSugestao = async () => {
    if (!sessaoAtiva) return;

    setBulkLoading(true);
    const toastId = toast.loading("Gerando sugestão de períodos...");

    try {
      // Se o usuário informou uma data de início no formulário, use-a como início do 1º período
      let firstStart = formData.data_inicio?.trim() || undefined;
      if (firstStart) {
        // Valida se está dentro da sessão
        if (new Date(firstStart) < new Date(sessaoAtiva.data_inicio) || new Date(firstStart) > new Date(sessaoAtiva.data_fim)) {
          toast.error("A data do 1º período deve estar dentro da sessão acadêmica", { id: toastId });
          setBulkLoading(false);
          return;
        }
      }

      const periodosParaCriar = calcularPeriodosAutomaticos(
        formData.tipo, 
        sessaoAtiva.data_inicio, 
        sessaoAtiva.data_fim,
        firstStart
      );
      setPreview(periodosParaCriar);
      toast.success(`Sugestão com ${periodosParaCriar.length} períodos gerada! Revise e salve.`, { id: toastId });

    } catch (error: any) {
      toast.error("Erro ao gerar sugestão", { id: toastId });
    } finally {
      setBulkLoading(false);
    }
  };

  const handleSalvarEmLote = async () => {
    if (!preview || preview.length === 0) return;
    if (!sessaoAtiva) return;
    setSavingBulk(true);
    const toastId = toast.loading("Salvando períodos...");
    try {
      const criados: any[] = [];
      const base = periodos.length;
      for (let i = 0; i < preview.length; i++) {
        const p = preview[i];
        // validações básicas
        if (new Date(p.data_inicio) < new Date(sessaoAtiva.data_inicio) || new Date(p.data_fim) > new Date(sessaoAtiva.data_fim)) {
          throw new Error(`Período ${p.nome} está fora da sessão`);
        }
        if (p.tipo === 'TRIMESTRE') {
          const limite = addMonths(new Date(p.data_inicio), 3);
          if (new Date(p.data_fim) > limite) throw new Error(`Trimestre "${p.nome}" deve ter no máximo 3 meses`);
        }

        // Cria diretamente via API para evitar estado obsoleto durante o loop
        const res = await fetch(`/api/escolas/${escolaId}/semestres`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            ...p,
            sessao_id: sessaoAtiva.id,
            numero: base + i + 1,
          }),
        });
        const result = await res.json();
        if (!res.ok) throw new Error(result.error || `Falha ao criar ${p.nome}.`);
        criados.push(result.data);
      }
      onPeriodosAtualizados([...periodos, ...criados]);
      toast.success(`${criados.length} períodos salvos!`, { id: toastId });
      setPreview(null);
      if (criados.length > 0 && onComplete) onComplete();
    } catch (e: any) {
      toast.error(e?.message || 'Falha ao salvar em lote', { id: toastId });
    } finally {
      setSavingBulk(false);
    }
  }

  // Sugestões automáticas de nomes baseadas no tipo
  const sugestoesNomes = {
    TRIMESTRE: ["1º Trimestre", "2º Trimestre", "3º Trimestre"],
    BIMESTRE: ["1º Bimestre", "2º Bimestre", "3º Bimestre", "4º Bimestre", "5º Bimestre", "6º Bimestre"],
    SEMESTRE: ["1º Semestre", "2º Semestre"],
    ANUAL: ["Ano Letivo Completo"]
  };

  // 🔥 CORREÇÃO: Agora recebe o evento do select
  const handleTipoChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const tipo = e.target.value;
    setFormData(prev => ({
      ...prev,
      tipo,
      nome: sugestoesNomes[tipo as keyof typeof sugestoesNomes]?.[0] || "",
      data_inicio: "",
      data_fim: ""
    }));
  };

  // 🔥 NOVO: Verificar se pode criar automaticamente
  const podeCriarAutomaticamente = formData.tipo !== "ANUAL" && periodos.length === 0;

  // Limites por tipo para impedir exceder a quantidade padrão
  const maxByTipo: Record<string, number> = {
    TRIMESTRE: 3,
    BIMESTRE: 6,
    SEMESTRE: 2,
    ANUAL: 1,
  };

  // Verifica se limite do tipo atual foi atingido
  const reachedLimit = (() => {
    const count = periodos.filter(p => p.tipo === formData.tipo).length;
    const max = maxByTipo[formData.tipo] ?? Infinity;
    return count >= max;
  })();

  // Edição inline de períodos criados
  const beginEdit = (p: AcademicPeriod) => {
    setEditingId(p.id);
    setEditingForm({ nome: p.nome, data_inicio: p.data_inicio, data_fim: p.data_fim, tipo: p.tipo });
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditingForm(null);
  };

  const saveEdit = async (p: AcademicPeriod) => {
    if (!editingForm) return;
    const toastId = toast.loading('Salvando alterações...');
    try {
      const res = await fetch(`/api/escolas/${escolaId}/semestres`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: p.id, ...editingForm }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Falha ao editar período');
      const updated = json.data as AcademicPeriod;
      const list = periodos.map(x => x.id === p.id ? { ...x, ...updated } : x);
      onPeriodosAtualizados(list);
      toast.success('Período atualizado!', { id: toastId });
      cancelEdit();
    } catch (e: any) {
      toast.error(e?.message || 'Erro ao atualizar', { id: toastId });
    }
  };

  const deletePeriodo = async (p: AcademicPeriod) => {
    if (!confirm(`Excluir "${p.nome}"? Esta ação não pode ser desfeita.`)) return;
    const toastId = toast.loading('Excluindo período...');
    try {
      const res = await fetch(`/api/escolas/${escolaId}/semestres?id=${encodeURIComponent(p.id)}`, { method: 'DELETE' });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error((json as any)?.error || 'Falha ao excluir período');
      onPeriodosAtualizados(periodos.filter(x => x.id !== p.id));
      toast.success('Período excluído', { id: toastId });
    } catch (e: any) {
      toast.error(e?.message || 'Erro ao excluir', { id: toastId });
    }
  };

  return (
    <div className="space-y-6">
      {/* Header Simplificado para o Wizard */}
      <div className="text-center mb-6">
        <div className="flex items-center justify-center gap-3 mb-3">
          <div className="p-3 bg-green-100 rounded-full">
            <BookOpen className="w-6 h-6 text-green-600" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-gray-900">Períodos Acadêmicos</h2>
            <p className="text-gray-600">Divida o ano letivo em trimestres, bimestres ou semestres</p>
          </div>
        </div>

        {/* Info da Sessão Ativa */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 max-w-md mx-auto">
          <p className="text-sm text-blue-800">
            <strong>Sessão:</strong> {sessaoAtiva.nome}
          </p>
          <p className="text-xs text-blue-700">
            {new Date(sessaoAtiva.data_inicio).toLocaleDateString('pt-BR')} a {new Date(sessaoAtiva.data_fim).toLocaleDateString('pt-BR')}
          </p>
        </div>
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Formulário de Criação */}
        <Card className="p-6">
          <h3 className="font-semibold text-lg mb-4 flex items-center gap-2">
            <Plus className="w-5 h-5 text-green-600" />
            Adicionar Período
          </h3>

          <div className="space-y-4">
            <Select
              label="Tipo de Período *"
              options={periodosOptions}
              value={formData.tipo}
              onChange={handleTipoChange}
            />

            <Input
              label="Nome do Período *"
              placeholder="Ex: 1º Trimestre"
              value={formData.nome}
              onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
            />

            <div className="grid md:grid-cols-2 gap-3">
              <Input
                label="Data de Início *"
                type="date"
                value={formData.data_inicio}
                onChange={(e) => setFormData({ ...formData, data_inicio: e.target.value })}
                min={sessaoAtiva.data_inicio}
                max={sessaoAtiva.data_fim}
              />
              <Input
                label="Data de Término *"
                type="date"
                value={formData.data_fim}
                onChange={(e) => setFormData({ ...formData, data_fim: e.target.value })}
                min={sessaoAtiva.data_inicio}
                max={sessaoAtiva.data_fim}
              />
            </div>

            <p className="text-xs text-gray-500">
              Dica: se usar "Criar Todos", a "Data de Início" acima será usada como início do 1º período.
            </p>

            {/* Sugestões Rápidas */}
            {formData.tipo && formData.tipo !== "ANUAL" && (
              <div className="bg-gray-50 p-3 rounded-lg border">
                <p className="text-xs font-medium text-gray-700 mb-2">Sugestões:</p>
                <div className="flex flex-wrap gap-1">
                  {sugestoesNomes[formData.tipo as keyof typeof sugestoesNomes]?.map((sugestao, index) => (
                    <button
                      key={sugestao}
                      type="button"
                      onClick={() => setFormData(prev => ({ ...prev, nome: sugestao }))}
                      className="px-2 py-1 text-xs bg-white border border-gray-300 rounded hover:bg-gray-50 transition-colors"
                    >
                      {sugestao}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Botões de Ação */}
            <div className="flex gap-3">
              <Button
                onClick={() => handleCriarPeriodo()}
                loading={loading}
                disabled={!formData.nome || !formData.data_inicio || !formData.data_fim || reachedLimit}
                className="flex-1"
                title={reachedLimit ? `Limite para ${formData.tipo.toLowerCase()} atingido` : undefined}
              >
                <Plus className="w-4 h-4 mr-2" />
                Adicionar Período
              </Button>

              {podeCriarAutomaticamente && (
                <Button
                  onClick={handleGerarSugestao}
                  loading={bulkLoading}
                  variant="outline"
                  className="flex-1"
                  title={`Gerar ${sugestoesNomes[formData.tipo as keyof typeof sugestoesNomes]?.length || 0} períodos automaticamente a partir da data informada`}
                >
                  <Zap className="w-4 h-4 mr-2" />
                  Gerar Sugestão
                </Button>
              )}
            </div>

            {podeCriarAutomaticamente && (
              <p className="text-xs text-gray-500 text-center">
                💡 <strong>Dica:</strong> Use "Criar Todos" para gerar {sugestoesNomes[formData.tipo as keyof typeof sugestoesNomes]?.length} períodos automaticamente
              </p>
            )}
          </div>
        </Card>

        {/* Lista de Períodos */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-lg">
              Períodos Configurados
            </h3>
            <Badge variant={periodos.length > 0 ? "success" : "neutral"}>
              {periodos.length} {periodos.length === 1 ? 'período' : 'períodos'}
            </Badge>
          </div>

          {periodos.length === 0 ? (
            <Card className="p-6 text-center border-dashed">
              <BookOpen className="w-12 h-12 text-gray-300 mx-auto mb-3" />
              <h4 className="font-medium text-gray-700 mb-1">Nenhum período criado</h4>
              <p className="text-sm text-gray-500">
                Adicione períodos para dividir o ano letivo
              </p>
            </Card>
          ) : (
            <div className="space-y-3 max-h-96 overflow-y-auto">
              {periodos.map((periodo, index) => {
                const isEditing = editingId === periodo.id
                return (
                  <Card key={periodo.id} className="p-4 border-l-4 border-l-green-500">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1">
                        {isEditing ? (
                          <div className="grid md:grid-cols-4 gap-2">
                            <Input label="Nome" value={editingForm?.nome || ''} onChange={(e)=> setEditingForm(f => f ? { ...f, nome: e.target.value } : f)} />
                            <Input label="Início" type="date" value={editingForm?.data_inicio || ''} onChange={(e)=> setEditingForm(f => f ? { ...f, data_inicio: e.target.value } : f)} />
                            <Input label="Término" type="date" value={editingForm?.data_fim || ''} onChange={(e)=> setEditingForm(f => f ? { ...f, data_fim: e.target.value } : f)} />
                            <div className="text-xs text-gray-500">Tipo: {editingForm?.tipo || periodo.tipo}</div>
                          </div>
                        ) : (
                          <>
                            <div className="flex items-center gap-2 mb-1">
                              <span className="font-semibold text-gray-900">{periodo.nome}</span>
                              <Badge variant="outline" className="text-xs">{periodo.tipo}</Badge>
                            </div>
                            <p className="text-sm text-gray-600">
                              {new Date(periodo.data_inicio).toLocaleDateString('pt-BR')} a {new Date(periodo.data_fim).toLocaleDateString('pt-BR')}
                            </p>
                            <p className="text-xs text-gray-500 mt-1">Período {index + 1} de {periodos.length}</p>
                          </>
                        )}
                      </div>
                      <div className="flex flex-col gap-2 w-40">
                        {isEditing ? (
                          <>
                            <Button size="sm" onClick={()=> saveEdit(periodo)}>Salvar</Button>
                            <Button size="sm" variant="outline" onClick={cancelEdit}>Cancelar</Button>
                          </>
                        ) : (
                          <>
                            <Button size="sm" variant="outline" onClick={()=> beginEdit(periodo)}>Editar</Button>
                            <Button size="sm" variant="danger" onClick={()=> deletePeriodo(periodo)}>Excluir</Button>
                          </>
                        )}
                      </div>
                    </div>
                  </Card>
                )
              })}
            </div>
          )}

          {/* Pré-visualização e edição antes de salvar em lote */}
          {preview && (
            <Card className="p-4 border-blue-200 bg-blue-50">
              <h4 className="font-semibold text-blue-900 mb-3">Pré-visualização</h4>
              <div className="space-y-2 max-h-80 overflow-y-auto">
                {preview.map((p, idx) => (
                  <div key={idx} className="grid md:grid-cols-4 gap-2 items-end bg-white p-3 rounded border">
                    <Input
                      label="Nome"
                      value={p.nome}
                      onChange={(e) => {
                        const v = e.target.value
                        setPreview(prev => prev ? prev.map((it,i)=> i===idx? { ...it, nome: v }: it) : prev)
                      }}
                    />
                    <Input
                      label="Início"
                      type="date"
                      value={p.data_inicio}
                      onChange={(e) => {
                        const v = e.target.value
                        setPreview(prev => prev ? prev.map((it,i)=> i===idx? { ...it, data_inicio: v }: it) : prev)
                      }}
                    />
                    <Input
                      label="Término"
                      type="date"
                      value={p.data_fim}
                      onChange={(e) => {
                        const v = e.target.value
                        setPreview(prev => prev ? prev.map((it,i)=> i===idx? { ...it, data_fim: v }: it) : prev)
                      }}
                    />
                    <div className="text-xs text-gray-500">
                      Tipo: <span className="font-medium">{p.tipo}</span>
                    </div>
                  </div>
                ))}
              </div>
              <div className="flex items-center justify-end gap-2 mt-3">
                <Button variant="outline" onClick={() => setPreview(null)}>Cancelar</Button>
                <Button onClick={handleSalvarEmLote} loading={savingBulk}>
                  Salvar em Lote
                </Button>
              </div>
            </Card>
          )}

          {/* Dica para Múltiplos Períodos */}
          {periodos.length > 0 && periodos.length < 3 && formData.tipo !== "ANUAL" && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
              <p className="text-sm text-blue-800 text-center">
                💡 <strong>Dica:</strong> Crie {formData.tipo === "TRIMESTRE" ? "3 trimestres" : 
                  formData.tipo === "BIMESTRE" ? "6 bimestres" : "2 semestres"} para cobrir todo o ano letivo.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Ação Rápida para Continuar */}
      {periodos.length > 0 && onComplete && (
        <div className="text-center pt-4 border-t">
          <Button 
            onClick={onComplete}
            variant="outline"
            className="flex items-center gap-2 mx-auto"
          >
            Continuar para Próxima Etapa →
          </Button>
          <p className="text-xs text-gray-500 mt-2">
            Períodos configurados! Pronto para avançar.
          </p>
        </div>
      )}
    </div>
  );
}
