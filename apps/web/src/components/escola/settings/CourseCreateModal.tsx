"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import type { CourseDraft, DraftDisciplina } from "./StructureMarketplace";

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
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-sm p-4 flex items-center justify-center">
      <div className="w-full max-w-2xl rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
        <div className="p-4 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
          <p className="text-sm font-semibold text-slate-900">{title}</p>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
          >
            Fechar
          </button>
        </div>
        <div className="p-5">{children}</div>
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
        title={draft.isCustom ? "Criar curso" : "Personalizar instalação"}
      >
        <div className="space-y-5">
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-2">
              Nome do curso
            </label>
            <input
              value={draft.label}
              onChange={(e) => onChangeLabel(e.target.value)}
              className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm text-slate-900 focus:ring-4 focus:ring-klasse-gold/20 focus:border-klasse-gold outline-none"
              placeholder="Ex: Técnico de Gestão Empresarial"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-2">
              Classes
            </label>
            <div className="flex flex-wrap gap-2">
              {allClasses.map((clsKey) => {
                const clsName = `${clsKey} Classe`;
                const selected = draft.classes.includes(clsName);
                return (
                  <button
                    key={clsKey}
                    type="button"
                    onClick={() => onToggleClass(clsKey)}
                    className={cx(
                      "rounded-full px-4 py-2 text-xs font-semibold border transition",
                      selected
                        ? "bg-slate-900 text-white border-slate-900"
                        : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50"
                    )}
                  >
                    {clsKey}
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between gap-3 mb-2">
              <label className="block text-xs font-semibold text-slate-600">
                Disciplinas ({draft.subjects.length})
              </label>
              <button
                type="button"
                onClick={() => setShowDisciplinaModal(true)}
                className="rounded-full bg-klasse-gold px-4 py-2 text-xs font-semibold text-white hover:brightness-95"
              >
                <span className="inline-flex items-center gap-2">
                  <Plus className="w-4 h-4" />
                  Adicionar
                </span>
              </button>
            </div>

            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 flex flex-col gap-2 max-h-56 overflow-y-auto">
              {draft.subjects.map((disciplina) => (
                <div
                  key={disciplina.nome}
                  className="flex items-center justify-between gap-3 rounded-xl bg-white border border-slate-200 px-4 py-3"
                >
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-slate-800 truncate">
                      {disciplina.nome}
                    </p>
                    <p className="text-[11px] text-slate-500 mt-1">
                      {disciplina.carga_horaria}h · {disciplina.is_core ? "core" : "eletiva"} · {disciplina.is_avaliavel ? "avaliável" : "não avaliável"} · {disciplina.area || "sem área"} · {disciplina.modelo_avaliacao_id || "sem modelo"}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => onRemoveDisciplina(disciplina.nome)}
                    className="text-xs text-slate-400 hover:text-slate-900"
                    aria-label={`Remover ${disciplina.nome}`}
                  >
                    ✕
                  </button>
                </div>
              ))}
              {draft.subjects.length === 0 && (
                <p className="text-xs text-slate-500">Nenhuma disciplina adicionada.</p>
              )}
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-full border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={onSave}
              disabled={installing}
              className="rounded-full bg-klasse-gold px-4 py-2 text-xs font-semibold text-white hover:brightness-95 disabled:opacity-60"
            >
              {installing ? "Salvando..." : "Salvar"}
            </button>
          </div>
        </div>
      </Modal>

      {showDisciplinaModal && (
        <Modal title="Nova disciplina" onClose={() => setShowDisciplinaModal(false)}>
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-2">Nome</label>
              <input
                value={disciplinaDraft.nome}
                onChange={(e) => setDisciplinaDraft({ ...disciplinaDraft, nome: e.target.value })}
                className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm text-slate-900 focus:ring-4 focus:ring-klasse-gold/20 focus:border-klasse-gold outline-none"
                placeholder="Ex: Matemática"
              />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-2">Carga horária</label>
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
                  className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm text-slate-900 focus:ring-4 focus:ring-klasse-gold/20 focus:border-klasse-gold outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-2">Área</label>
                <input
                  value={disciplinaDraft.area}
                  onChange={(e) => setDisciplinaDraft({ ...disciplinaDraft, area: e.target.value })}
                  className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm text-slate-900 focus:ring-4 focus:ring-klasse-gold/20 focus:border-klasse-gold outline-none"
                  placeholder="Ex: Ciências"
                />
              </div>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-2">Modelo de avaliação</label>
              <input
                value={disciplinaDraft.modelo_avaliacao_id}
                onChange={(e) =>
                  setDisciplinaDraft({
                    ...disciplinaDraft,
                    modelo_avaliacao_id: e.target.value,
                  })
                }
                className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm text-slate-900 focus:ring-4 focus:ring-klasse-gold/20 focus:border-klasse-gold outline-none"
                placeholder="ID do modelo"
              />
            </div>
            <div className="flex flex-wrap gap-4 text-xs text-slate-600">
              <label className="inline-flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={disciplinaDraft.is_core}
                  onChange={(e) =>
                    setDisciplinaDraft({ ...disciplinaDraft, is_core: e.target.checked })
                  }
                />
                Disciplina core
              </label>
              <label className="inline-flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={disciplinaDraft.is_avaliavel}
                  onChange={(e) =>
                    setDisciplinaDraft({ ...disciplinaDraft, is_avaliavel: e.target.checked })
                  }
                />
                Avaliável
              </label>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => {
                  resetDisciplinaDraft();
                  setShowDisciplinaModal(false);
                }}
                className="rounded-full border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleAddDisciplina}
                className="rounded-full bg-klasse-gold px-4 py-2 text-xs font-semibold text-white hover:brightness-95"
              >
                Adicionar
              </button>
            </div>
          </div>
        </Modal>
      )}
    </>
  );
}
