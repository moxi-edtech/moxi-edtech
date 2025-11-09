"use client";

import { useState } from "react";
import { toast } from "sonner";
import { type Class } from "@/types/academico.types";
import Button from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { StepHeader } from "./StepHeader";

type Props = {
  escolaId: string;
  classes: Class[];
  onClassesAtualizadas: (novasClasses: Class[]) => void;
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
  },
  {
    id: "medio",
    nome: "Ensino Médio Técnico-Profissional",
    classes: ["10ª Classe", "11ª Classe", "12ª Classe", "13ª Classe"],
  },
];

export default function ClassesStep({
  escolaId,
  classes,
  onClassesAtualizadas,
}: Props) {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    nome: "",
    descricao: "",
    nivel: "",
  });
  const [editando, setEditando] = useState<string | null>(null);

  const handleSubmit = async (bulk = false) => {
    if (!formData.nivel) {
      toast.error("Selecione o nível de ensino.");
      return;
    }
    if (!bulk && !formData.nome.trim()) {
      toast.error("Selecione a classe.");
      return;
    }

    setLoading(true);
    const toastId = toast.loading(
      bulk ? "Criando classes em lote..." : editando ? "Atualizando classe..." : "Criando classe..."
    );

    try {
      if (bulk) {
        // cria todas as classes do nível escolhido
        const nivelData = niveisEnsino.find((n) => n.id === formData.nivel);
        if (!nivelData) throw new Error("Nível inválido.");

        const res = await fetch(`/api/escolas/${escolaId}/classes/bulk`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            nivel: formData.nivel,
            classes: nivelData.classes,
          }),
        });
        const result = await res.json();
        if (!res.ok) throw new Error(result.error || "Falha ao criar classes.");
        onClassesAtualizadas([...classes, ...result.data]);
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

        if (editando) {
          onClassesAtualizadas(
            classes.map((c) => (c.id === editando ? result.data : c))
          );
        } else {
          onClassesAtualizadas([...classes, result.data]);
        }
      }

      toast.success(
        bulk
          ? "Classes criadas com sucesso!"
          : `Classe ${editando ? "atualizada" : "criada"} com sucesso!`,
        { id: toastId }
      );
      cancelarEdicao();
    } catch (error: any) {
      toast.error(
        error.message ||
          `Erro ao ${bulk ? "criar classes" : editando ? "atualizar" : "criar"} classe.`,
        { id: toastId }
      );
    } finally {
      setLoading(false);
    }
  };

  const handleExcluir = async (id: string) => {
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

  return (
    <div className="space-y-8">
      <StepHeader
        icone={<span className="text-3xl">🏫</span>}
        titulo="Criar Classes"
        descricao="Configure as classes da sua escola de acordo com os níveis de ensino de Angola."
      />

      <div className="grid md:grid-cols-2 gap-8 items-start">
        {/* Formulário */}
        <div className="space-y-4 p-6 border rounded-lg bg-gray-50/50">
          <h3 className="font-semibold text-lg">
            {editando ? "Editar Classe" : "Adicionar Nova Classe"}
          </h3>

          {/* Dropdown de nível */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              Nível de Ensino *
            </label>
            <select
              value={formData.nivel}
              onChange={(e) =>
                setFormData({ ...formData, nivel: e.target.value, nome: "" })
              }
              className="w-full p-3 border border-gray-300 rounded-lg"
            >
              <option value="">Selecione</option>
              {niveisEnsino.map((n) => (
                <option key={n.id} value={n.id}>
                  {n.nome}
                </option>
              ))}
            </select>
          </div>

          {/* Dropdown de classes por nível */}
          {formData.nivel && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                Classe *
              </label>
              <select
                value={formData.nome}
                onChange={(e) =>
                  setFormData({ ...formData, nome: e.target.value })
                }
                className="w-full p-3 border border-gray-300 rounded-lg"
              >
                <option value="">Selecione</option>
                {niveisEnsino
                  .find((n) => n.id === formData.nivel)
                  ?.classes.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
              </select>
            </div>
          )}

          <Input
            label="Descrição (Opcional)"
            placeholder="Alguma observação sobre a classe"
            value={formData.descricao}
            onChange={(e) =>
              setFormData({ ...formData, descricao: e.target.value })
            }
          />

          <div className="flex gap-3 pt-2">
            <Button onClick={() => handleSubmit()} loading={loading} className="flex-1">
              {editando ? "Atualizar" : "Adicionar"}
            </Button>
            {!editando && (
              <Button
                onClick={() => handleSubmit(true)}
                variant="secondary"
                className="flex-1"
              >
                Criar todas do nível
              </Button>
            )}
            {editando && (
              <Button onClick={cancelarEdicao} variant="secondary">
                Cancelar
              </Button>
            )}
          </div>
        </div>

        {/* Lista de Classes */}
        <div className="space-y-3">
          <h3 className="font-semibold text-lg">
            Classes Existentes ({classes.length})
          </h3>
          {classes.length === 0 ? (
            <p className="text-center text-gray-500 py-6">
              Nenhuma classe criada ainda.
            </p>
          ) : (
            <div className="space-y-2 max-h-[400px] overflow-y-auto pr-2">
              {classes.map((classe) => (
                <div
                  key={classe.id}
                  className="flex justify-between items-center p-3 border rounded-md hover:bg-gray-50"
                >
                  <div>
                    <p className="font-medium text-gray-800">{classe.nome}</p>
                    {classe.descricao && (
                      <p className="text-sm text-gray-500">
                        {classe.descricao}
                      </p>
                    )}
                    {(classe as any).nivel && (
                      <p className="text-xs text-green-700 mt-1">
                        {
                          niveisEnsino.find(
                            (n) => n.id === (classe as any).nivel
                          )?.nome
                        }
                      </p>
                    )}
                  </div>
                  <div className="flex gap-3">
                    <button
                      onClick={() => editarClasse(classe)}
                      className="text-sm font-medium text-blue-600 hover:underline"
                    >
                      Editar
                    </button>
                    <button
                      onClick={() => handleExcluir(classe.id)}
                      className="text-sm font-medium text-red-600 hover:underline"
                    >
                      Excluir
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
