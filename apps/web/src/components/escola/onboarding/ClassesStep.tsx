"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Users, Plus, BookOpen, Edit2, Trash2, Zap } from "lucide-react";
import { type Class } from "@/types/academico.types";
import Button from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";

type Props = {
  escolaId: string;
  classes: Class[];
  onClassesAtualizadas: (novasClasses: Class[]) => void;
  onComplete?: () => void;
};

const niveisEnsino = [
  {
    id: "base",
    nome: "Ensino de Base",
    classes: [
      "Iniciação",
      "1ª Classe",
      "2ª Classe",
      "3ª Classe",
      "4ª Classe",
      "5ª Classe",
      "6ª Classe",
    ],
    cor: "blue",
    total: 7
  },
  {
    id: "secundario",
    nome: "Ensino Secundário",
    classes: [
      "7ª Classe",
      "8ª Classe",
      "9ª Classe",
      "10ª Classe",
      "11ª Classe",
      "12ª Classe",
    ],
    cor: "green",
    total: 6
  },
  {
    id: "medio",
    nome: "Ensino Médio Técnico-Profissional",
    classes: ["10ª Classe", "11ª Classe", "12ª Classe", "13ª Classe"],
    cor: "purple",
    total: 4
  },
];

export default function ClassesStep({
  escolaId,
  classes,
  onClassesAtualizadas,
  onComplete
}: Props) {
  const [loading, setLoading] = useState(false);
  const [bulkLoading, setBulkLoading] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    nome: "",
    descricao: "",
    nivel: "",
  });
  const [editando, setEditando] = useState<string | null>(null);

  // 🔥 CORREÇÃO: Verificar se já existem classes do nível selecionado
  const classesExistentesNoNivel = (nivelId: string) => {
    return classes.filter(c => (c as any).nivel === nivelId);
  };

  // 🔥 CORREÇÃO: Obter classes que ainda não foram criadas
  const obterClassesParaCriar = (nivelId: string) => {
    const nivelData = niveisEnsino.find(n => n.id === nivelId);
    if (!nivelData) return [];
    
    const classesExistentes = classesExistentesNoNivel(nivelId).map(c => c.nome);
    return nivelData.classes.filter(classe => !classesExistentes.includes(classe));
  };

  const handleSubmit = async (bulk = false) => {
    if (!formData.nivel) {
      toast.error("Selecione o nível de ensino.");
      return;
    }
    if (!bulk && !formData.nome.trim()) {
      toast.error("Selecione a classe.");
      return;
    }

    // 🔥 CORREÇÃO: Verificar se há classes para criar em lote
    if (bulk) {
      const classesParaCriar = obterClassesParaCriar(formData.nivel);
      if (classesParaCriar.length === 0) {
        toast.info(`Todas as classes deste nível já foram criadas.`);
        return;
      }
    }

    if (bulk) {
      setBulkLoading(formData.nivel);
    } else {
      setLoading(true);
    }

    const toastId = toast.loading(
      bulk ? "Criando classes em lote..." : editando ? "Atualizando classe..." : "Criando classe..."
    );

    try {
      if (bulk) {
        const nivelData = niveisEnsino.find((n) => n.id === formData.nivel);
        if (!nivelData) throw new Error("Nível inválido.");

        // 🔥 CORREÇÃO: Usar apenas classes que ainda não existem
        const classesParaCriar = obterClassesParaCriar(formData.nivel);

        const res = await fetch(`/api/escolas/${escolaId}/classes/bulk`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            nivel: formData.nivel,
            classes: classesParaCriar,
          }),
        });
        
        const result = await res.json();
        if (!res.ok) throw new Error(result.error || "Falha ao criar classes.");
        
        const novasClasses = [...classes, ...result.data];
        onClassesAtualizadas(novasClasses);
        
        toast.success(`${classesParaCriar.length} classes criadas com sucesso!`, { id: toastId });

        // 🔥 CORREÇÃO: Reset do formulário após criação em lote
        setFormData({ nome: "", descricao: "", nivel: "" });

        // Sugerir continuar após criar classes em lote
        if (novasClasses.length >= 3 && onComplete) {
          setTimeout(() => {
            if (confirm("Classes criadas! Deseja continuar para a próxima etapa?")) {
              onComplete();
            }
          }, 1500);
        }
      } else {
        const url = editando
          ? `/api/escolas/${escolaId}/classes/${editando}`
          : `/api/escolas/${escolaId}/classes`;
        const method = editando ? "PUT" : "POST";

        const res = await fetch(url, {
          method,
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ...formData,
            ordem: editando ? undefined : classes.length + 1,
          }),
        });

        const result = await res.json();
        if (!res.ok) throw new Error(result.error || "Falha na operação");

        let novasClasses;
        if (editando) {
          novasClasses = classes.map((c) => (c.id === editando ? result.data : c));
        } else {
          novasClasses = [...classes, result.data];
        }
        
        onClassesAtualizadas(novasClasses);

        toast.success(
          `Classe ${editando ? "atualizada" : "criada"} com sucesso!`,
          { id: toastId }
        );

        // Reset do formulário após criação individual
        if (!editando) {
          setFormData({ nome: "", descricao: "", nivel: formData.nivel });
        }

        // Sugerir continuar após criar algumas classes
        if (!editando && novasClasses.length >= 3 && onComplete) {
          setTimeout(() => {
            if (confirm("Classe criada! Deseja continuar para a próxima etapa?")) {
              onComplete();
            }
          }, 1000);
        }
      }
      
      if (!bulk) {
        cancelarEdicao();
      }
    } catch (error: any) {
      toast.error(
        error.message ||
          `Erro ao ${bulk ? "criar classes" : editando ? "atualizar" : "criar"} classe.`,
        { id: toastId }
      );
    } finally {
      setLoading(false);
      setBulkLoading(null);
    }
  };

  const handleExcluir = async (id: string) => {
    if (!confirm("Tem certeza que deseja excluir esta classe?")) {
      return;
    }

    const toastId = toast.loading("Excluindo classe...");
    try {
      const res = await fetch(`/api/escolas/${escolaId}/classes/${id}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("Falha ao excluir classe");
      onClassesAtualizadas(classes.filter((c) => c.id !== id));
      toast.success("Classe excluída com sucesso!", { id: toastId });
    } catch (error: any) {
      toast.error(error.message || "Erro ao excluir classe.", { id: toastId });
    }
  };

  const editarClasse = (classe: Class) => {
    setFormData({
      nome: classe.nome,
      descricao: classe.descricao || "",
      nivel: (classe as any).nivel || "",
    });
    setEditando(classe.id);
  };

  const cancelarEdicao = () => {
    setFormData({ nome: "", descricao: "", nivel: "" });
    setEditando(null);
  };

  // Calcular estatísticas por nível
  const estatisticasNiveis = niveisEnsino.map(nivel => {
    const classesDoNivel = classes.filter(c => (c as any).nivel === nivel.id);
    const classesParaCriar = obterClassesParaCriar(nivel.id);
    return {
      ...nivel,
      criadas: classesDoNivel.length,
      pendentes: classesParaCriar.length,
      progresso: (classesDoNivel.length / nivel.total) * 100
    };
  });

  // 🔥 CORREÇÃO: Verificar se pode criar em lote
  const podeCriarEmLote = (nivelId: string) => {
    return obterClassesParaCriar(nivelId).length > 0;
  };

  return (
    <div className="space-y-6">
      {/* Header Simplificado para o Wizard */}
      <div className="text-center mb-6">
        <div className="flex items-center justify-center gap-3 mb-3">
          <div className="p-3 bg-orange-100 rounded-full">
            <Users className="w-6 h-6 text-orange-600" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-gray-900">Classes/Turmas</h2>
            <p className="text-gray-600">
              Configure as classes da sua escola de acordo com o sistema angolano
            </p>
          </div>
        </div>
      </div>

      {/* Estatísticas Rápidas */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {estatisticasNiveis.map((nivel) => (
          <Card key={nivel.id} className="p-4 border-l-4" style={{ borderLeftColor: `var(--${nivel.cor}-500)` }}>
            <div className="flex justify-between items-start">
              <div>
                <h3 className="font-semibold text-gray-900 text-sm">{nivel.nome}</h3>
                <p className="text-2xl font-bold text-gray-900">{nivel.criadas}</p>
                <p className="text-xs text-gray-500">
                  {nivel.pendentes > 0 ? `${nivel.pendentes} pendentes` : 'Completo'}
                </p>
              </div>
              <Badge variant={nivel.criadas === nivel.total ? "success" : "outline"}>
                {nivel.criadas === nivel.total ? "Completo" : `${Math.round(nivel.progresso)}%`}
              </Badge>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-1.5 mt-2">
              <div 
                className="h-1.5 rounded-full transition-all duration-500"
                style={{ 
                  width: `${nivel.progresso}%`,
                  backgroundColor: `var(--${nivel.cor}-500)`
                }}
              ></div>
            </div>
          </Card>
        ))}
      </div>

      <div className="grid lg:grid-cols-2 gap-6 items-start">
        {/* Formulário */}
        <Card className="p-6">
          <h3 className="font-semibold text-lg mb-4 flex items-center gap-2">
            {editando ? <Edit2 className="w-5 h-5 text-blue-600" /> : <Plus className="w-5 h-5 text-blue-600" />}
            {editando ? "Editar Classe" : "Nova Classe"}
          </h3>

          <div className="space-y-4">
            {/* Nível de Ensino */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Nível de Ensino *
              </label>
              <select
                value={formData.nivel}
                onChange={(e) =>
                  setFormData({ ...formData, nivel: e.target.value, nome: "" })
                }
                className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors"
              >
                <option value="">Selecione o nível...</option>
                {niveisEnsino.map((n) => (
                  <option key={n.id} value={n.id}>
                    {n.nome} ({classesExistentesNoNivel(n.id).length}/{n.total})
                  </option>
                ))}
              </select>
            </div>

            {/* Classe */}
            {formData.nivel && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Classe *
                </label>
                <select
                  value={formData.nome}
                  onChange={(e) =>
                    setFormData({ ...formData, nome: e.target.value })
                  }
                  className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors"
                >
                  <option value="">Selecione a classe...</option>
                  {niveisEnsino
                    .find((n) => n.id === formData.nivel)
                    ?.classes.map((c) => {
                      const jaExiste = classesExistentesNoNivel(formData.nivel).some(classe => classe.nome === c);
                      return (
                        <option key={c} value={c} disabled={jaExiste}>
                          {c} {jaExiste ? "✓" : ""}
                        </option>
                      );
                    })}
                </select>
                {formData.nivel && (
                  <p className="text-xs text-gray-500 mt-1">
                    {obterClassesParaCriar(formData.nivel).length} classes disponíveis para criar
                  </p>
                )}
              </div>
            )}

            {/* Descrição */}
            <Input
              label="Descrição (Opcional)"
              placeholder="Ex: Turma da manhã, turma especial, etc."
              value={formData.descricao}
              onChange={(e) =>
                setFormData({ ...formData, descricao: e.target.value })
              }
            />

            {/* Botões de Ação */}
            <div className="flex gap-3 pt-2">
              <Button 
                onClick={() => handleSubmit()} 
                loading={loading}
                disabled={!formData.nivel || !formData.nome}
                className="flex-1"
              >
                {editando ? "Atualizar" : "Criar Classe"}
              </Button>
              
              {!editando && formData.nivel && podeCriarEmLote(formData.nivel) && (
                <Button
                  onClick={() => handleSubmit(true)}
                  loading={bulkLoading === formData.nivel}
                  variant="outline"
                  className="flex-1"
                  title={`Criar ${obterClassesParaCriar(formData.nivel).length} classes restantes`}
                >
                  <Zap className="w-4 h-4 mr-2" />
                  Criar Todas ({obterClassesParaCriar(formData.nivel).length})
                </Button>
              )}
              
              {editando && (
                <Button onClick={cancelarEdicao} variant="ghost">
                  Cancelar
                </Button>
              )}
            </div>
          </div>
        </Card>

        {/* Lista de Classes */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-lg">Classes Existentes</h3>
            <Badge variant={classes.length > 0 ? "success" : "neutral"}>
              {classes.length} {classes.length === 1 ? 'classe' : 'classes'}
            </Badge>
          </div>

          {classes.length === 0 ? (
            <Card className="p-6 text-center border-dashed">
              <BookOpen className="w-12 h-12 text-gray-300 mx-auto mb-3" />
              <h4 className="font-medium text-gray-700 mb-1">Nenhuma classe criada</h4>
              <p className="text-sm text-gray-500">
                Crie classes para organizar os estudantes por turmas
              </p>
            </Card>
          ) : (
            <div className="space-y-3 max-h-96 overflow-y-auto">
              {classes.map((classe) => {
                const nivelInfo = niveisEnsino.find(n => n.id === (classe as any).nivel);
                return (
                  <Card key={classe.id} className="p-4 group hover:shadow-md transition-shadow">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-semibold text-gray-900">{classe.nome}</span>
                          {nivelInfo && (
                            <Badge 
                              variant="outline" 
                              className="text-xs"
                              style={{ 
                                borderColor: `var(--${nivelInfo.cor}-300)`,
                                color: `var(--${nivelInfo.cor}-700)`,
                                backgroundColor: `var(--${nivelInfo.cor}-50)`
                              }}
                            >
                              {nivelInfo.nome}
                            </Badge>
                          )}
                        </div>
                        
                        {classe.descricao && (
                          <p className="text-sm text-gray-600 mb-2">{classe.descricao}</p>
                        )}
                      </div>
                      
                      <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={() => editarClasse(classe)}
                          className="p-1.5 text-blue-600 hover:bg-blue-50 rounded transition-colors"
                          title="Editar classe"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleExcluir(classe.id)}
                          className="p-1.5 text-red-600 hover:bg-red-50 rounded transition-colors"
                          title="Excluir classe"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </Card>
                );
              })}
            </div>
          )}

          {/* Ação para Continuar */}
          {classes.length > 0 && onComplete && (
            <Card className="bg-green-50 border-green-200 p-4">
              <div className="text-center">
                <p className="text-sm text-green-800 mb-3">
                  ✅ {classes.length} {classes.length === 1 ? 'classe criada' : 'classes criadas'} com sucesso!
                </p>
                <Button 
                  onClick={onComplete}
                  className="w-full"
                >
                  Continuar para Disciplinas →
                </Button>
              </div>
            </Card>
          )}
        </div>
      </div>

      {/* Ação Global para Continuar */}
      {classes.length >= 3 && onComplete && (
        <div className="text-center pt-4 border-t">
          <Button 
            onClick={onComplete}
            variant="outline"
            className="flex items-center gap-2 mx-auto"
          >
            Continuar para Próxima Etapa →
          </Button>
        </div>
      )}
    </div>
  );
}