"use client";

import { useState } from "react";
import { toast } from "sonner";
import { type Discipline, type Course, type Class } from "@/types/academico.types";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { StepHeader } from "./StepHeader";

type Props = {
  escolaId: string;
  cursos: Course[];
  classes?: Class[];
  disciplinas: Discipline[];
  onDisciplinasAtualizadas: (disciplinas: Discipline[]) => void;
};

export default function DisciplinasStep({
  escolaId,
  cursos,
  classes = [],
  disciplinas,
  onDisciplinasAtualizadas,
}: Props) {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    nome: "",
    tipo: "core" as "core" | "eletivo",
    curso_id: "",
    classe_id: "",
    descricao: "",
  });
  const [vinculo, setVinculo] = useState<'curso' | 'classe'>(cursos.length > 0 ? 'curso' : 'classe');

  // Garante que quando não há cursos, o vínculo é classe
  if (vinculo === 'curso' && cursos.length === 0) {
    // eslint-disable-next-line react-compiler/react-compiler
    setVinculo('classe');
  }

  const handleCriarDisciplina = async () => {
    if (!formData.nome.trim()) {
      return toast.error("Informe o nome da disciplina.");
    }

    // Valida o vínculo escolhido
    if (vinculo === 'curso') {
      if (!formData.curso_id) return toast.error("Selecione o curso para essa disciplina.");
    } else {
      if (!formData.classe_id) return toast.error("Selecione a classe para essa disciplina.");
    }

    setLoading(true);
    const id = toast.loading("Criando disciplina...");
    try {
      const res = await fetch(`/api/escolas/${escolaId}/disciplinas`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nome: formData.nome,
          tipo: formData.tipo,
          curso_id: vinculo === 'curso' ? formData.curso_id : undefined,
          classe_id: vinculo === 'classe' ? formData.classe_id : undefined,
          descricao: formData.descricao || undefined,
        }),
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error || "Erro ao criar disciplina.");

      onDisciplinasAtualizadas([...disciplinas, result.data]);
      setFormData({ nome: "", tipo: "core", curso_id: "", classe_id: "", descricao: "" });
      toast.success("Disciplina criada!", { id });
    } catch (e: any) {
      toast.error(e.message, { id });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-8">
      <StepHeader
        icone={<span className="text-3xl">📚</span>}
        titulo="Disciplinas"
        descricao="Cadastre as disciplinas oferecidas em cada curso ou diretamente em classes (quando não houver curso)."
      />

      <div className="grid md:grid-cols-2 gap-8">
        {/* Formulário */}
        <div className="space-y-4 p-6 border rounded-lg bg-gray-50/50">
          {/* Vínculo: Curso ou Classe (se houver ambos) */}
          {cursos.length > 0 && classes.length > 0 && (
            <div>
              <label className="block text-sm font-medium mb-1">Vincular a *</label>
              <select
                value={vinculo}
                onChange={(e) => setVinculo(e.target.value as any)}
                className="w-full p-3 border rounded-lg"
              >
                <option value="curso">Curso</option>
                <option value="classe">Classe</option>
              </select>
            </div>
          )}

          {/* Curso (quando vínculo = curso) */}
          {vinculo === 'curso' && (
            <div>
              <label className="block text-sm font-medium mb-1">
                Curso *
              </label>
              <select
                value={formData.curso_id}
                onChange={(e) =>
                  setFormData({ ...formData, curso_id: e.target.value })
                }
                className="w-full p-3 border rounded-lg"
              >
                <option value="">Selecione</option>
                {cursos.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.nome || "—"}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Classe (quando vínculo = classe) */}
          {vinculo === 'classe' && (
            <div>
              <label className="block text-sm font-medium mb-1">Classe *</label>
              <select
                value={formData.classe_id}
                onChange={(e) => setFormData({ ...formData, classe_id: e.target.value })}
                className="w-full p-3 border rounded-lg"
              >
                <option value="">Selecione</option>
                {classes.map((cl) => (
                  <option key={cl.id} value={cl.id}>{cl.nome}</option>
                ))}
              </select>
            </div>
          )}

          <Input
            label="Nome da Disciplina *"
            placeholder="Ex: Matemática, Biologia"
            value={formData.nome}
            onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
          />

          <div>
            <label className="block text-sm font-medium mb-1">Tipo *</label>
            <select
              value={formData.tipo}
              onChange={(e) =>
                setFormData({ ...formData, tipo: e.target.value as any })
              }
              className="w-full p-3 border rounded-lg"
            >
              <option value="core">Obrigatória</option>
              <option value="eletivo">Eletiva</option>
            </select>
          </div>

          <Input
            label="Descrição (opcional)"
            value={formData.descricao}
            onChange={(e) =>
              setFormData({ ...formData, descricao: e.target.value })
            }
          />

          <Button
            onClick={handleCriarDisciplina}
            loading={loading}
            className="w-full"
          >
            Adicionar Disciplina
          </Button>
        </div>

        {/* Lista */}
        <div>
          <h3 className="font-semibold mb-2">
            Disciplinas Cadastradas ({disciplinas.length})
          </h3>
          <div className="space-y-2">
            {disciplinas.length === 0 ? (
              <p className="text-sm text-gray-500">
                Nenhuma disciplina cadastrada ainda.
              </p>
            ) : (
              disciplinas.map((d) => {
                const curso = cursos.find((c) => c.id === d.curso_id);
                const classe = classes.find((cl) => cl.id === (d as any).classe_id);
                return (
                  <div
                    key={d.id}
                    className="p-3 border rounded-md bg-white text-sm"
                  >
                    <p className="font-medium">{d.nome}</p>
                    {d.descricao && (
                      <p className="text-xs text-gray-600">{d.descricao}</p>
                    )}
                    <div className="flex flex-wrap gap-2 mt-1">
                      <span
                        className={`px-2 py-0.5 text-xs rounded-full ${
                          d.tipo === "core"
                            ? "bg-blue-100 text-blue-800"
                            : "bg-purple-100 text-purple-800"
                        }`}
                      >
                        {d.tipo === "core" ? "Obrigatória" : "Eletiva"}
                      </span>
                      {curso && (
                        <span className="px-2 py-0.5 text-xs bg-green-100 text-green-800 rounded-full">
                          Curso: {curso.nome || "—"}
                        </span>
                      )}
                      {classe && (
                        <span className="px-2 py-0.5 text-xs bg-amber-100 text-amber-800 rounded-full">
                          Classe: {classe.nome}
                        </span>
                      )}
                      {!curso && !classe && (
                        <span className="px-2 py-0.5 text-xs bg-gray-100 text-gray-800 rounded-full">
                          Sem vínculo
                        </span>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
