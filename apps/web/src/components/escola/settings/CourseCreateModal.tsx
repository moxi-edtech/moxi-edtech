"use client";

import { useState } from "react";
import { Plus, X, BookOpen, Layers, Check } from "lucide-react";
import type { CourseDraft, DraftDisciplina } from "./StructureMarketplace";

import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Spinner } from "@/components/ui/Spinner";

type CourseCreateModalProps = {
  draft: CourseDraft;
  allClasses: string[];
  installing: boolean;
  onClose: () => void;
  onChangeLabel: (label: string) => void;
  onToggleClass: (clsKey: string) => void;
  onAddDisciplina: (disciplina: DraftDisciplina) => void;
  onRemoveDisciplina: (nome: string) => void;
  onSave: () => void;
};

const emptyDisciplina: DraftDisciplina = {
  nome: "",
  carga_horaria: 0,
  is_core: true,
  is_avaliavel: true,
  area: "",
  modelo_avaliacao_id: "",
};

function cx(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(" ");
}

function Modal({
  title,
  subtitle,
  onClose,
  children,
  footer,
}: {
  title: string;
  subtitle?: string;
  onClose: () => void;
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
  return (
    <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-sm p-4 flex items-center justify-center animate-in fade-in duration-200">
      <div className="w-full max-w-2xl rounded-2xl border border-slate-200 bg-white shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
        <div className="px-6 py-4 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
          <div>
            <h3 className="text-base font-bold text-slate-900">{title}</h3>
            {subtitle && <p className="text-xs text-slate-500 mt-0.5">{subtitle}</p>}
          </div>
          <Button variant="ghost" size="icon" onClick={onClose} className="rounded-full h-8 w-8 text-slate-400">
            <X className="w-4 h-4" />
          </Button>
        </div>
        <div className="p-6 max-h-[70vh] overflow-y-auto">{children}</div>
        {footer && <div className="px-6 py-4 border-t border-slate-100 bg-slate-50/50 flex justify-end gap-3">{footer}</div>}
      </div>
    </div>
  );
}

export default function CourseCreateModal({
  draft,
  allClasses,
  installing,
  onClose,
  onChangeLabel,
  onToggleClass,
  onAddDisciplina,
  onRemoveDisciplina,
  onSave,
}: CourseCreateModalProps) {
  const [showDisciplinaModal, setShowDisciplinaModal] = useState(false);
  const [disciplinaDraft, setDisciplinaDraft] = useState<DraftDisciplina>(emptyDisciplina);

  const resetDisciplinaDraft = () => setDisciplinaDraft(emptyDisciplina);

  const handleAddDisciplina = () => {
    if (!disciplinaDraft.nome.trim()) return;
    onAddDisciplina({
      ...disciplinaDraft,
      nome: disciplinaDraft.nome.trim(),
      area: disciplinaDraft.area.trim(),
      modelo_avaliacao_id: disciplinaDraft.modelo_avaliacao_id.trim(),
    });
    resetDisciplinaDraft();
    setShowDisciplinaModal(false);
  };

  return (
    <>
      <Modal
        onClose={onClose}
        title={draft.isCustom ? "Criar novo curso" : "Personalizar instalação"}
        subtitle={draft.isCustom ? "Configure as informações básicas do seu curso do zero." : `Ajustando preset: ${draft.label}`}
        footer={
          <>
            <Button
              variant="outline"
              onClick={onClose}
              className="rounded-full px-8"
            >
              Cancelar
            </Button>
            <Button
              onClick={onSave}
              loading={installing}
              tone="gold"
              className="rounded-full px-12 shadow-sm"
            >
              Finalizar e criar
            </Button>
          </>
        }
      >
        <div className="space-y-8">
          <div className="space-y-3">
            <label className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <BookOpen className="w-4 h-4 text-slate-400" />
              Nome do curso
            </label>
            <input
              value={draft.label}
              onChange={(e) => onChangeLabel(e.target.value)}
              className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm text-slate-900 focus:ring-4 focus:ring-slate-900/5 focus:border-slate-900 outline-none transition-all"
              placeholder="Ex: Técnico de Gestão Empresarial"
            />
          </div>

          <div className="space-y-3">
            <label className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <Layers className="w-4 h-4 text-slate-400" />
              Classes disponíveis
            </label>
            <div className="flex flex-wrap gap-2 p-4 rounded-2xl bg-slate-50 border border-slate-100">
              {allClasses.map((clsKey) => {
                const clsName = `${clsKey} Classe`;
                const selected = draft.classes.includes(clsName);
                return (
                  <button
                    key={clsKey}
                    type="button"
                    onClick={() => onToggleClass(clsKey)}
                    className={cx(
                      "rounded-full px-5 py-2 text-xs font-bold border transition-all duration-200",
                      selected
                        ? "bg-slate-900 text-white border-slate-900 shadow-sm scale-105"
                        : "bg-white text-slate-600 border-slate-200 hover:border-slate-400"
                    )}
                  >
                    {clsKey}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <label className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <Layers className="w-4 h-4 text-slate-400" />
                Plano Curricular ({draft.subjects.length})
              </label>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setShowDisciplinaModal(true)}
                className="rounded-full h-8 text-[11px] font-bold"
              >
                <Plus className="w-3 h-3 mr-1.5" />
                Adicionar Disciplina
              </Button>
            </div>

            <div className="rounded-2xl border border-slate-200 divide-y divide-slate-100 overflow-hidden shadow-sm">
              {draft.subjects.map((disciplina) => (
                <div
                  key={disciplina.nome}
                  className="flex items-center justify-between gap-4 bg-white px-5 py-4 group hover:bg-slate-50 transition-colors"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-slate-800 flex items-center gap-2">
                      {disciplina.nome}
                      {disciplina.is_core && (
                        <Badge className="bg-slate-100 text-slate-600 border-slate-200 text-[9px] font-bold uppercase">Core</Badge>
                      )}
                    </p>
                    <div className="flex items-center gap-2 text-[11px] text-slate-500 mt-1">
                      <span className="font-medium">{disciplina.carga_horaria}h semanais</span>
                      <span>•</span>
                      <span>{disciplina.area || "Geral"}</span>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => onRemoveDisciplina(disciplina.nome)}
                    className="h-8 w-8 text-slate-300 hover:text-red-600 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <X className="w-4 h-4" />
                  </Button>
                </div>
              ))}
              {draft.subjects.length === 0 && (
                <div className="px-6 py-10 flex flex-col items-center justify-center text-center bg-slate-50/50">
                  <div className="bg-white p-3 rounded-full border border-slate-200 mb-3 shadow-sm">
                    <BookOpen className="w-6 h-6 text-slate-300" />
                  </div>
                  <p className="text-xs text-slate-400 font-medium">Nenhuma disciplina adicionada ainda.</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </Modal>

      {showDisciplinaModal && (
        <Modal 
          title="Nova disciplina" 
          subtitle="Preencha os dados da disciplina que deseja adicionar ao curso."
          onClose={() => setShowDisciplinaModal(false)}
          footer={
            <>
              <Button
                variant="outline"
                onClick={() => {
                  resetDisciplinaDraft();
                  setShowDisciplinaModal(false);
                }}
                className="rounded-full px-6"
              >
                Cancelar
              </Button>
              <Button
                onClick={handleAddDisciplina}
                tone="gold"
                className="rounded-full px-8"
              >
                Adicionar agora
              </Button>
            </>
          }
        >
          <div className="space-y-5">
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-600 ml-1">Nome da Disciplina</label>
              <input
                value={disciplinaDraft.nome}
                onChange={(e) => setDisciplinaDraft({ ...disciplinaDraft, nome: e.target.value })}
                className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm text-slate-900 focus:ring-4 focus:ring-slate-900/5 focus:border-slate-900 outline-none transition-all"
                placeholder="Ex: Língua Portuguesa"
              />
            </div>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-600 ml-1">Aulas por semana</label>
                <input
                  type="number"
                  min={0}
                  value={disciplinaDraft.carga_horaria}
                  onChange={(e) =>
                    setDisciplinaDraft({
                      ...disciplinaDraft,
                      carga_horaria: Number(e.target.value || 0),
                    })
                  }
                  className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm text-slate-900 focus:ring-4 focus:ring-slate-900/5 focus:border-slate-900 outline-none"
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-600 ml-1">Área de Conhecimento</label>
                <input
                  value={disciplinaDraft.area}
                  onChange={(e) => setDisciplinaDraft({ ...disciplinaDraft, area: e.target.value })}
                  className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm text-slate-900 focus:ring-4 focus:ring-slate-900/5 focus:border-slate-900 outline-none"
                  placeholder="Ex: Linguagens"
                />
              </div>
            </div>

            <div className="flex flex-wrap gap-6 p-4 rounded-2xl bg-slate-50 border border-slate-100">
              <label className="flex items-center gap-3 cursor-pointer group">
                <input
                  type="checkbox"
                  checked={disciplinaDraft.is_core}
                  onChange={(e) =>
                    setDisciplinaDraft({ ...disciplinaDraft, is_core: e.target.checked })
                  }
                  className="w-4 h-4 rounded border-slate-300 text-slate-900 focus:ring-slate-900"
                />
                <span className="text-xs font-bold text-slate-700 group-hover:text-slate-900">Disciplina obrigatória (Core)</span>
              </label>
              <label className="flex items-center gap-3 cursor-pointer group">
                <input
                  type="checkbox"
                  checked={disciplinaDraft.is_avaliavel}
                  onChange={(e) =>
                    setDisciplinaDraft({ ...disciplinaDraft, is_avaliavel: e.target.checked })
                  }
                  className="w-4 h-4 rounded border-slate-300 text-slate-900 focus:ring-slate-900"
                />
                <span className="text-xs font-bold text-slate-700 group-hover:text-slate-900">Gera notas e faltas (Avaliável)</span>
              </label>
            </div>
          </div>
        </Modal>
      )}
    </>
  );
}
