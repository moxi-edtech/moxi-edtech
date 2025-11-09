"use client";

import { useMemo, useState } from "react";
import { toast } from "sonner";
import { BookOpen, Plus, GraduationCap, Users, CheckCircle2, Edit2, Trash2, Home, Settings } from "lucide-react";
import { type Discipline, type Course, type Class } from "@/types/academico.types";
import Button from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Select } from "@/components/ui/Select";

type Props = {
  escolaId: string;
  cursos: Course[];
  classes: Class[];
  disciplinas: Discipline[];
  onDisciplinasAtualizadas: (disciplinas: Discipline[]) => void;
  onComplete?: () => void;
  onHome?: () => void;
  // 🔥 CORREÇÃO: Props opcionais para configurações
  tipoPresenca?: 'secao' | 'curso';
  estrutura?: 'classes' | 'secoes' | 'cursos';
  onTipoPresencaChange?: (v: 'secao' | 'curso') => void;
  onEstruturaChange?: (v: 'classes' | 'secoes' | 'cursos') => void;
};

export default function ConfiguracaoAcademicaStep({
  escolaId,
  cursos,
  classes,
  disciplinas,
  onDisciplinasAtualizadas,
  onComplete,
  onHome,
  // 🔥 CORREÇÃO: Valores padrão e props opcionais
  tipoPresenca = 'secao',
  estrutura = 'classes',
  onTipoPresencaChange,
  onEstruturaChange
}: Props) {
  const [loading, setLoading] = useState(false);
  const [savingConfig, setSavingConfig] = useState(false);
  
  // 🔥 CORREÇÃO: Estado local para quando as props não são fornecidas
  const [configLocal, setConfigLocal] = useState({
    tipoPresenca: tipoPresenca,
    estrutura: estrutura
  });

  const [formData, setFormData] = useState({
    nome: "",
    tipo: "core" as "core" | "eletivo",
    curso_id: "",
    classe_id: "",
    descricao: "",
  });

  // Determinar vínculo automático - SEMPRE priorizar classe
  const vinculo = classes.length > 0 ? 'classe' : 'curso';
  const temCursos = cursos.length > 0;
  const temClasses = classes.length > 0;

  // Mapas para exibir nomes de classe/curso na lista
  const classeNameById = useMemo(() => {
    const map: Record<string, string> = {};
    for (const c of classes) map[c.id] = c.nome;
    return map;
  }, [classes]);
  const cursoNameById = useMemo(() => {
    const map: Record<string, string> = {};
    for (const c of cursos) map[c.id] = c.nome || "";
    return map;
  }, [cursos]);

  // Disciplinas comuns pré-definidas
  const disciplinasComuns = [
    "Matemática", "Língua Portuguesa", "História", "Geografia", 
    "Ciências Físico-Químicas", "Biologia", "Inglês", "Francês",
    "Educação Física", "Educação Visual", "Educação Musical",
    "Filosofia", "Química", "Física", "Desenho"
  ];

  // 🔥 CORREÇÃO: Funções seguras para mudança de configuração
  const handleTipoPresencaChange = (novoTipo: 'secao' | 'curso') => {
    if (onTipoPresencaChange) {
      onTipoPresencaChange(novoTipo);
    } else {
      setConfigLocal(prev => ({ ...prev, tipoPresenca: novoTipo }));
    }
  };

  const handleEstruturaChange = (novaEstrutura: 'classes' | 'secoes' | 'cursos') => {
    if (onEstruturaChange) {
      onEstruturaChange(novaEstrutura);
    } else {
      setConfigLocal(prev => ({ ...prev, estrutura: novaEstrutura }));
    }
  };

  // 🔥 CORREÇÃO: Usar valores locais ou props
  const tipoPresencaAtual = onTipoPresencaChange ? tipoPresenca : configLocal.tipoPresenca;
  const estruturaAtual = onEstruturaChange ? estrutura : configLocal.estrutura;

  // 🔥 SALVAR CONFIGURAÇÕES DA ESTRUTURA
  const handleSalvarConfiguracoes = async () => {
    setSavingConfig(true);
    const id = toast.loading('Salvando configurações...');
    try {
      const res = await fetch(`/api/escolas/${escolaId}/onboarding/preferences`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          tipo_presenca: tipoPresencaAtual, 
          estrutura: estruturaAtual 
        }),
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error || 'Falha ao salvar.');
      toast.success('Configurações salvas!', { id });
    } catch (e: any) {
      toast.error(e.message || 'Erro ao salvar.', { id });
    } finally {
      setSavingConfig(false);
    }
  };

  const handleCriarDisciplina = async () => {
    if (!formData.nome.trim()) {
      return toast.error("Informe o nome da disciplina.");
    }

    // Validação: SEMPRE precisa ter classe quando disponível
    if (temClasses && !formData.classe_id) {
      return toast.error("Selecione a classe para esta disciplina.");
    }

    // Validação: Se vinculando a curso, precisa ter curso selecionado
    if (vinculo === 'curso' && !formData.curso_id) {
      return toast.error("Selecione o curso para esta disciplina.");
    }

    setLoading(true);
    const id = toast.loading("Criando disciplina...");
    try {
      const res = await fetch(`/api/escolas/${escolaId}/disciplinas`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nome: formData.nome.trim(),
          tipo: formData.tipo,
          curso_id: vinculo === 'curso' ? formData.curso_id : undefined,
          classe_id: formData.classe_id || undefined,
          descricao: formData.descricao || undefined,
        }),
      });
      
      const result = await res.json();
      if (!res.ok) throw new Error(result.error || "Erro ao criar disciplina.");

      const novasDisciplinas = [...disciplinas, result.data];
      onDisciplinasAtualizadas(novasDisciplinas);
      
      // Reset do formulário mantendo o vínculo atual
      setFormData(prev => ({ 
        ...prev, 
        nome: "", 
        descricao: "",
      }));
      
      toast.success("Disciplina criada com sucesso!", { id });

      // Sugerir continuar após criar algumas disciplinas
      if (novasDisciplinas.length >= 3 && onComplete) {
        setTimeout(() => {
          if (confirm("Disciplina criada! Deseja finalizar a configuração?")) {
            onComplete();
          }
        }, 1000);
      }

    } catch (e: any) {
      toast.error(e.message, { id });
    } finally {
      setLoading(false);
    }
  };

  const handleExcluirDisciplina = async (disciplinaId: string) => {
    if (!confirm("Tem certeza que deseja excluir esta disciplina?")) {
      return;
    }

    const id = toast.loading("Excluindo disciplina...");
    try {
      const res = await fetch(`/api/escolas/${escolaId}/disciplinas/${disciplinaId}`, {
        method: "DELETE",
      });
      
      const result = await res.json();
      if (!res.ok) throw new Error(result.error || "Erro ao excluir disciplina.");

      const disciplinasAtualizadas = disciplinas.filter(d => d.id !== disciplinaId);
      onDisciplinasAtualizadas(disciplinasAtualizadas);
      
      toast.success("Disciplina excluída com sucesso!", { id });
    } catch (e: any) {
      toast.error(e.message, { id });
    }
  };

  const handleEditarDisciplina = (disciplina: Discipline) => {
    setFormData({
      nome: disciplina.nome,
      tipo: disciplina.tipo,
      curso_id: disciplina.curso_id || "",
      classe_id: disciplina.classe_id || "",
      descricao: disciplina.descricao || "",
    });

    document.getElementById('formulario-disciplina')?.scrollIntoView({ 
      behavior: 'smooth' 
    });

    toast.info(`Editando disciplina: ${disciplina.nome}`);
  };

  const handleDisciplinaRapida = (nome: string) => {
    setFormData(prev => ({ ...prev, nome }));
  };

  return (
    <div className="space-y-6">
      {/* Header com Botão Home */}
      <div className="text-center mb-6 relative">
        {onHome && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onHome}
            className="absolute left-0 top-1/2 transform -translate-y-1/2 flex items-center gap-2 text-gray-600 hover:text-gray-900"
          >
            <Home className="w-4 h-4" />
            Início
          </Button>
        )}
        <div className="flex items-center justify-center gap-3 mb-3">
          <div className="p-3 bg-purple-100 rounded-full">
            <Settings className="w-6 h-6 text-purple-600" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-gray-900">Configuração Acadêmica</h2>
            <p className="text-gray-600">
              Defina a estrutura pedagógica e cadastre as disciplinas
            </p>
          </div>
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* COLUNA 1: CONFIGURAÇÕES DA ESTRUTURA */}
        <div className="lg:col-span-1 space-y-6">
          {/* Estrutura Pedagógica */}
          <Card className="p-6">
            <div className="sticky top-0 z-10 -mx-6 -mt-6 px-6 pt-6 pb-4 bg-white border-b flex items-center justify-between">
              <h3 className="font-semibold text-lg flex items-center gap-2">
                <Settings className="w-5 h-5 text-purple-600" />
                Estrutura Pedagógica
              </h3>
              <Button
                onClick={handleSalvarConfiguracoes}
                loading={savingConfig}
              >
                Salvar Configurações
              </Button>
            </div>

            <div className="space-y-6">
              {/* Tipo de Presença */}
              <div>
                <h4 className="font-medium text-gray-900 mb-3">Tipo de Presença</h4>
                <div className="grid gap-3">
                  <button
                    type="button"
                    onClick={() => handleTipoPresencaChange('secao')} 
                    className={`p-4 border-2 rounded-lg text-left transition-all ${
                      tipoPresencaAtual === 'secao' ? 'border-teal-500 bg-teal-50' : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <div className="text-2xl mb-2">👥</div>
                    <h5 className="font-semibold mb-1 text-sm">Por Seção/Turma</h5>
                    <p className="text-xs text-gray-600">Ideal para escolas com organização tradicional por turmas.</p>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleTipoPresencaChange('curso')} 
                    className={`p-4 border-2 rounded-lg text-left transition-all ${
                      tipoPresencaAtual === 'curso' ? 'border-teal-500 bg-teal-50' : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <div className="text-2xl mb-2">📚</div>
                    <h5 className="font-semibold mb-1 text-sm">Por Curso/Disciplina</h5>
                    <p className="text-xs text-gray-600">Ideal para contextos com grades curriculares variadas.</p>
                  </button>
                </div>
              </div>

              {/* Estrutura Acadêmica */}
              <div>
                <Select 
                  label="Estrutura Acadêmica" 
                  value={estruturaAtual} 
                  onChange={(e) => handleEstruturaChange(e.target.value as any)} 
                >
                  <option value="classes">Classes</option>
                  <option value="secoes">Seções</option>
                  <option value="cursos">Cursos</option>
                </Select>
                <p className="text-xs text-gray-500 mt-1">
                  Escolha a estrutura predominante para organização.
                </p>
              </div>

            </div>
          </Card>

          {/* Resumo da Configuração */}
          <Card className="p-6 bg-blue-50 border-blue-200">
            <h4 className="font-semibold text-blue-900 mb-3">Configuração Atual</h4>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-blue-700">Presença:</span>
                <Badge variant="outline" className="text-xs">
                  {tipoPresencaAtual === 'secao' ? 'Por Seção' : 'Por Curso'}
                </Badge>
              </div>
              <div className="flex justify-between">
                <span className="text-blue-700">Estrutura:</span>
                <Badge variant="outline" className="text-xs">
                  {estruturaAtual}
                </Badge>
              </div>
              <div className="flex justify-between">
                <span className="text-blue-700">Disciplinas:</span>
                <Badge variant={disciplinas.length > 0 ? "success" : "neutral"} className="text-xs">
                  {disciplinas.length}
                </Badge>
              </div>
            </div>
          </Card>
        </div>

        {/* COLUNA 2: DISCIPLINAS */}
        <div className="lg:col-span-2 space-y-6">
          {/* Aviso sobre Vínculo com Classes */}
          {temClasses && (
            <Card className="bg-blue-50 border-blue-200">
              <div className="p-4">
                <div className="flex items-start gap-3">
                  <Users className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" />
                  <div>
                    <h3 className="font-semibold text-blue-900 text-sm">
                      Disciplinas vinculadas às Classes
                    </h3>
                    <p className="text-blue-700 text-sm">
                      Todas as disciplinas devem estar vinculadas a uma classe. 
                      {temCursos && " Opcionalmente, podem também estar vinculadas a cursos específicos."}
                    </p>
                  </div>
                </div>
              </div>
            </Card>
          )}

          <div className="grid lg:grid-cols-2 gap-6">
            {/* Formulário de Disciplina */}
            <Card id="formulario-disciplina" className="p-6">
              <h3 className="font-semibold text-lg mb-4 flex items-center gap-2">
                <Plus className="w-5 h-5 text-emerald-600" />
                Nova Disciplina
              </h3>

              <div className="space-y-4">
                {/* Classe (SEMPRE quando disponível) */}
                {temClasses && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Classe *
                    </label>
                    <select
                      value={formData.classe_id}
                      onChange={(e) => setFormData({ ...formData, classe_id: e.target.value })}
                      className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-colors"
                      required
                    >
                      <option value="">Selecione a classe...</option>
                      {classes.map((cl) => (
                        <option key={cl.id} value={cl.id}>{cl.nome}</option>
                      ))}
                    </select>
                  </div>
                )}

                {/* Curso (Opcional) */}
                {temCursos && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Curso (Opcional)
                    </label>
                    <select
                      value={formData.curso_id}
                      onChange={(e) => setFormData({ ...formData, curso_id: e.target.value })}
                      className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-colors"
                    >
                      <option value="">Sem vínculo com curso</option>
                      {cursos.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.nome || "—"}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {/* Nome da disciplina */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Nome da disciplina *</label>
                  <Input
                    placeholder="Ex.: Matemática"
                    value={formData.nome}
                    onChange={(e) => setFormData({ ...formData, nome: e.target.value })} label={""}                  />
                </div>

                {/* Tipo */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Tipo</label>
                  <select
                    value={formData.tipo}
                    onChange={(e) => setFormData({ ...formData, tipo: e.target.value as 'core' | 'eletivo' })}
                    className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-colors"
                  >
                    <option value="core">Núcleo comum</option>
                    <option value="eletivo">Eletivo</option>
                  </select>
                </div>

                {/* Descrição */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Descrição (opcional)</label>
                  <textarea
                    value={formData.descricao}
                    onChange={(e) => setFormData({ ...formData, descricao: e.target.value })}
                    rows={3}
                    className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-colors"
                    placeholder="Breve descrição, ementa ou observações"
                  />
                </div>

                {/* Sugestões rápidas */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Sugestões rápidas</label>
                  <div className="flex flex-wrap gap-2">
                    {disciplinasComuns.map((nome) => (
                      <button
                        key={nome}
                        type="button"
                        onClick={() => handleDisciplinaRapida(nome)}
                        className="px-2 py-1 text-xs border rounded-full hover:bg-gray-50"
                      >
                        {nome}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Ações */}
                <div className="pt-2 flex items-center gap-3">
                  <Button onClick={handleCriarDisciplina} loading={loading}>
                    Adicionar Disciplina
                  </Button>
                </div>
              </div>
            </Card>

            {/* Lista de Disciplinas */}
            <Card className="p-6">
              <h3 className="font-semibold text-lg mb-4 flex items-center gap-2">
                <BookOpen className="w-5 h-5 text-emerald-600" />
                Disciplinas cadastradas
              </h3>

              {disciplinas.length === 0 ? (
                <p className="text-sm text-gray-500">Nenhuma disciplina cadastrada ainda.</p>
              ) : (
                <ul className="divide-y divide-gray-200">
                  {disciplinas.map((d) => (
                    <li key={d.id} className="py-3 flex items-center justify-between gap-3">
                      <div>
                        <div className="font-medium text-gray-900">{d.nome}</div>
                        <div className="text-xs text-gray-500 flex items-center gap-2 mt-1">
                          <Badge variant="outline">{d.tipo === 'core' ? 'Núcleo' : 'Eletivo'}</Badge>
                          {d.classe_id && (
                            <span className="inline-flex items-center gap-1">
                              <Users className="w-3 h-3" /> Classe: {classeNameById[d.classe_id] || d.classe_id}
                            </span>
                          )}
                          {d.curso_id && (
                            <span className="inline-flex items-center gap-1">
                              <GraduationCap className="w-3 h-3" /> Curso: {cursoNameById[d.curso_id] || d.curso_id}
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          className="p-2 rounded hover:bg-gray-100"
                          title="Editar"
                          onClick={() => handleEditarDisciplina(d)}
                        >
                          <Edit2 className="w-4 h-4 text-gray-600" />
                        </button>
                        <button
                          className="p-2 rounded hover:bg-gray-100"
                          title="Excluir"
                          onClick={() => handleExcluirDisciplina(d.id)}
                        >
                          <Trash2 className="w-4 h-4 text-red-600" />
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          </div>
        </div>
      </div>

      {/* Ação para Finalizar (código permanece igual) */}
      {/* ... */}
    </div>
  );
}
