"use client";

import { useState } from "react";
import { toast } from "sonner";
import { GraduationCap, Plus, BookOpen, Info } from "lucide-react";
import { type Course, type AcademicSession } from "@/types/academico.types";
import Button from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";

type Props = {
  escolaId: string;
  sessaoAtiva: AcademicSession | null;
  cursos: Course[];
  onCursosAtualizados: (cursos: Course[]) => void;
  onComplete?: () => void; // Nova prop para o wizard
};

const niveisEnsino = [
  {
    id: "base",
    nome: "Ensino de Base (1ª – 6ª)",
    precisaCurso: false,
    descricao: "Não requer cursos específicos"
  },
  {
    id: "secundario1",
    nome: "1º Ciclo do Ensino Secundário (7ª – 9ª)",
    precisaCurso: false,
    descricao: "Não requer cursos específicos"
  },
  {
    id: "secundario2",
    nome: "2º Ciclo do Ensino Secundário (10ª – 13ª)",
    precisaCurso: true,
    descricao: "Requer cursos específicos por área"
  },
  {
    id: "completo",
    nome: "Escola Completa (1ª – 13ª)",
    precisaCurso: true,
    descricao: "Requer cursos para o 2º ciclo"
  },
];

export default function CursosStep({
  escolaId,
  sessaoAtiva,
  cursos,
  onCursosAtualizados,
  onComplete
}: Props) {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    nome: "",
    descricao: "",
    nivel: "",
  });

  const nivelSelecionado = niveisEnsino.find((n) => n.id === formData.nivel);
  const precisaNome = nivelSelecionado?.precisaCurso ?? false;
  const cursosOpcionais = !precisaNome && formData.nivel;

  const handleCriarCurso = async () => {
    if (!formData.nivel) {
      return toast.error("Selecione o nível de ensino.");
    }
    if (!sessaoAtiva?.id) {
      return toast.error("Crie ou ative uma sessão acadêmica antes.");
    }
    if (precisaNome && !formData.nome.trim()) {
      return toast.error("Digite o nome do curso (obrigatório no 2º ciclo).");
    }

    setLoading(true);
    const id = toast.loading("Criando curso...");
    try {
      const payload = {
        ...formData,
        tipo: "core",
        sessao_id: sessaoAtiva.id,
      };

      const res = await fetch(`/api/escolas/${escolaId}/cursos`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const result = await res.json();
      if (!res.ok) throw new Error(result.error || "Erro ao criar curso.");
      
      const novosCursos = [...cursos, result.data];
      onCursosAtualizados(novosCursos);

      setFormData({ nome: "", descricao: "", nivel: "" });
      toast.success("Curso criado!", { id });

      // 🔥 NOVO: Se é o primeiro curso em nível obrigatório, sugerir continuar
      if (precisaNome && cursos.length === 0 && novosCursos.length > 0 && onComplete) {
        setTimeout(() => {
          if (confirm("Curso criado! Deseja continuar para a próxima etapa?")) {
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

  return (
    <div className="space-y-6">
      {/* Header Simplificado para o Wizard */}
      <div className="text-center mb-6">
        <div className="flex items-center justify-center gap-3 mb-3">
          <div className="p-3 bg-purple-100 rounded-full">
            <GraduationCap className="w-6 h-6 text-purple-600" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-gray-900">Cursos (Opcional)</h2>
            <p className="text-gray-600">
              Configure cursos específicos para o 2º ciclo do ensino secundário
            </p>
          </div>
        </div>
      </div>

      {/* Aviso sobre Cursos Opcionais */}
      <Card className="bg-blue-50 border-blue-200">
        <Card className="p-4 border-0 bg-transparent">
          <div className="flex items-start gap-3">
            <Info className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" />
            <div>
              <h3 className="font-semibold text-blue-900 text-sm">
                Cursos são opcionais
              </h3>
              <p className="text-blue-700 text-sm">
                Apenas necessários para o <strong>2º ciclo do ensino secundário (10ª-13ª)</strong> ou escolas completas.
                Para outros níveis, você pode pular esta etapa.
              </p>
            </div>
          </div>
        </Card>
      </Card>

      <div className="grid lg:grid-cols-2 gap-6 items-start">
        {/* Formulário */}
        <Card className="p-6">
          <h3 className="font-semibold text-lg mb-4 flex items-center gap-2">
            <Plus className="w-5 h-5 text-purple-600" />
            {cursosOpcionais ? "Adicionar Curso (Opcional)" : "Novo Curso"}
          </h3>

          <div className="space-y-4">
            {/* Nível de Ensino */}
            <div>
              <label className="block text-sm font-medium mb-2 text-gray-700">
                Nível de Ensino *
              </label>
              <select
                value={formData.nivel}
                onChange={(e) => setFormData({ ...formData, nivel: e.target.value })}
                className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-colors"
              >
                <option value="">Selecione o nível...</option>
                {niveisEnsino.map((n) => (
                  <option key={n.id} value={n.id}>
                    {n.nome}
                  </option>
                ))}
              </select>
              
              {nivelSelecionado && (
                <p className={`text-xs mt-2 p-2 rounded ${
                  nivelSelecionado.precisaCurso 
                    ? 'bg-purple-50 text-purple-700 border border-purple-200' 
                    : 'bg-gray-50 text-gray-600 border border-gray-200'
                }`}>
                  {nivelSelecionado.descricao}
                </p>
              )}
            </div>

            {/* Nome do Curso */}
            <Input
              label={precisaNome ? "Nome do Curso *" : "Nome do Curso (Opcional)"}
              placeholder="Ex: Ciências Físicas, Informática, Gestão"
              value={formData.nome}
              onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
              disabled={!precisaNome && !formData.nivel}
              required={precisaNome}
            />

            {/* Descrição */}
            <Input
              label="Descrição (opcional)"
              placeholder="Breve descrição sobre o curso..."
              value={formData.descricao}
              onChange={(e) => setFormData({ ...formData, descricao: e.target.value })}
            />

            <Button
              onClick={handleCriarCurso}
              loading={loading}
              disabled={precisaNome ? !formData.nivel || !formData.nome.trim() : !formData.nivel}
              className="w-full"
              variant={cursosOpcionais ? "outline" : "default"}
            >
              <Plus className="w-4 h-4 mr-2" />
              {cursosOpcionais ? "Adicionar Curso (Opcional)" : "Criar Curso"}
            </Button>

            {/* Ação para pular cursos opcionais */}
            {cursosOpcionais && onComplete && (
              <Button
                onClick={onComplete}
                variant="ghost"
                className="w-full text-gray-600 hover:text-gray-800"
              >
                Pular esta etapa →
              </Button>
            )}
          </div>
        </Card>

        {/* Lista de Cursos */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-lg">Cursos Existentes</h3>
            <Badge variant={cursos.length > 0 ? "success" : "neutral"}>
              {cursos.length} {cursos.length === 1 ? 'curso' : 'cursos'}
            </Badge>
          </div>

          {cursos.length === 0 ? (
            <Card className="p-6 text-center border-dashed">
              <BookOpen className="w-12 h-12 text-gray-300 mx-auto mb-3" />
              <h4 className="font-medium text-gray-700 mb-1">
                {cursosOpcionais ? "Nenhum curso opcional criado" : "Nenhum curso criado"}
              </h4>
              <p className="text-sm text-gray-500">
                {cursosOpcionais 
                  ? "Adicione cursos opcionais se desejar" 
                  : "Crie cursos para o 2º ciclo do ensino secundário"
                }
              </p>
            </Card>
          ) : (
            <div className="space-y-3 max-h-96 overflow-y-auto">
              {cursos.map((curso) => {
                const nivelInfo = niveisEnsino.find(n => n.id === curso.nivel);
                return (
                  <Card key={curso.id} className="p-4 border-l-4 border-l-purple-500">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-semibold text-gray-900">
                            {curso.nome || "Curso sem nome"}
                          </span>
                          {nivelInfo && (
                            <Badge 
                              variant={nivelInfo.precisaCurso ? "default" : "outline"} 
                              className="text-xs"
                            >
                              {nivelInfo.precisaCurso ? "Obrigatório" : "Opcional"}
                            </Badge>
                          )}
                        </div>
                        
                        {curso.descricao && (
                          <p className="text-sm text-gray-600 mb-2">{curso.descricao}</p>
                        )}
                        
                        {curso.nivel && (
                          <p className="text-xs text-purple-700 font-medium">
                            {nivelInfo?.nome || curso.nivel}
                          </p>
                        )}
                      </div>
                    </div>
                  </Card>
                );
              })}
            </div>
          )}

          {/* Ação para Continuar quando há cursos */}
          {cursos.length > 0 && onComplete && (
            <Card className="bg-green-50 border-green-200 p-4">
              <div className="text-center">
                <p className="text-sm text-green-800 mb-3">
                  ✅ Cursos configurados com sucesso!
                </p>
                <Button 
                  onClick={onComplete}
                  className="w-full"
                >
                  Continuar para Próxima Etapa →
                </Button>
              </div>
            </Card>
          )}
        </div>
      </div>

      {/* Ação Global para Pular */}
      {cursos.length === 0 && onComplete && (
        <div className="text-center pt-4 border-t">
          <p className="text-sm text-gray-600 mb-3">
            Esta etapa é opcional para a maioria dos níveis de ensino
          </p>
          <Button 
            onClick={onComplete}
            variant="outline"
            className="flex items-center gap-2 mx-auto"
          >
            Pular Cursos e Continuar →
          </Button>
        </div>
      )}
    </div>
  );
}