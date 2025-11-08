"use client";

import { useState } from "react";
import { toast } from "sonner";
import { type Course, type AcademicSession } from "@/types/academico.types";
import { Button } from "./ui/Button";
import { Input } from "./ui/Input";
import { StepHeader } from "./StepHeader";

type Props = {
  escolaId: string;
  sessaoAtiva: AcademicSession | null;
  cursos: Course[];
  onCursosAtualizados: (cursos: Course[]) => void;
};

const niveisEnsino = [
  {
    id: "base",
    nome: "Ensino de Base (1ª – 6ª)",
    precisaCurso: false,
  },
  {
    id: "secundario1",
    nome: "1º Ciclo do Ensino Secundário (7ª – 9ª)",
    precisaCurso: false,
  },
  {
    id: "secundario2",
    nome: "2º Ciclo do Ensino Secundário (10ª – 13ª)",
    precisaCurso: true,
  },
  {
    id: "completo",
    nome: "Escola Completa (1ª – 13ª)",
    precisaCurso: true,
  },
];

export default function CursosStep({
  escolaId,
  sessaoAtiva,
  cursos,
  onCursosAtualizados,
}: Props) {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    nome: "",
    descricao: "",
    nivel: "",
  });

  const nivelSelecionado = niveisEnsino.find((n) => n.id === formData.nivel);
  const precisaNome = nivelSelecionado?.precisaCurso ?? false;

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
        tipo: "core", // sempre core para curso
        sessao_id: sessaoAtiva.id,
      };

      const res = await fetch(`/api/escolas/${escolaId}/cursos`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const result = await res.json();
      if (!res.ok) throw new Error(result.error || "Erro ao criar curso.");
      onCursosAtualizados([...cursos, result.data]);

      setFormData({ nome: "", descricao: "", nivel: "" });
      toast.success("Curso criado!", { id });
    } catch (e: any) {
      toast.error(e.message, { id });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-8">
      <StepHeader
        icone={<span className="text-3xl">🎓</span>}
        titulo="Cursos"
        descricao="Cadastre cursos apenas quando aplicável (2º ciclo ou escolas completas). 
        Disciplinas são sempre gerenciadas no passo seguinte."
      />

      <div className="grid md:grid-cols-2 gap-8 items-start">
        {/* Formulário */}
        <div className="space-y-4 p-6 border rounded-lg bg-gray-50/50">
          {/* Nível */}
          <div>
            <label className="block text-sm font-medium mb-1">Nível *</label>
            <select
              value={formData.nivel}
              onChange={(e) =>
                setFormData({ ...formData, nivel: e.target.value })
              }
              className="w-full p-3 border rounded-lg"
            >
              <option value="">Selecione</option>
              {niveisEnsino.map((n) => (
                <option key={n.id} value={n.id}>
                  {n.nome}
                </option>
              ))}
            </select>
          </div>

          {/* Nome do Curso - só habilitado quando necessário */}
          <Input
            label="Nome do Curso"
            placeholder="Ex: Ciências Físicas, Informática"
            value={formData.nome}
            onChange={(e) =>
              setFormData({ ...formData, nome: e.target.value })
            }
            disabled={!precisaNome}
          />

          <Input
            label="Descrição (opcional)"
            value={formData.descricao}
            onChange={(e) =>
              setFormData({ ...formData, descricao: e.target.value })
            }
          />

          <Button
            onClick={handleCriarCurso}
            loading={loading}
            className="w-full"
          >
            Adicionar Curso
          </Button>
        </div>

        {/* Lista */}
        <div>
          <h3 className="font-semibold mb-2">
            Cursos Existentes ({cursos.length})
          </h3>
          <div className="space-y-2">
            {cursos.length === 0 ? (
              <p className="text-sm text-gray-500">Nenhum curso cadastrado.</p>
            ) : (
              cursos.map((c) => (
                <div key={c.id} className="p-3 border rounded-md bg-white">
                  <p className="font-medium">{c.nome || "—"}</p>
                  {c.descricao && (
                    <p className="text-xs text-gray-600">{c.descricao}</p>
                  )}
                  {c.nivel && (
                    <p className="text-xs text-green-700 mt-1">
                      {
                        niveisEnsino.find((n) => n.id === c.nivel)?.nome ||
                        c.nivel
                      }
                    </p>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
