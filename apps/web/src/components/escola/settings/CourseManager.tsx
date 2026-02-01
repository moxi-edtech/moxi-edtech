"use client";

import { BookOpen, Plus, Users, Pencil, Trash2 } from "lucide-react";
import type { ActiveCourse, CourseDetails, CurriculoStatus } from "./StructureMarketplace";

type ManagerTab = "turmas" | "disciplinas";

type CourseManagerProps = {
  selectedCourse: ActiveCourse | null;
  managerTab: ManagerTab;
  loadingDetails: boolean;
  details: CourseDetails | null;
  curriculoInfo?: CurriculoStatus;
  curriculoAnoLetivo: { id: string; ano: number } | null;
  onTabChange: (tab: ManagerTab) => void;
  onGenerateTurmas: (cursoId: string) => void;
  onCreateDisciplina: () => void;
  onEditDisciplina: (disciplina: CourseDetails["disciplinas"][number]) => void;
  onDeleteDisciplina: (id: string) => void;
  onBack: () => void;
};

function cx(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(" ");
}

function Spinner({ label = "Carregando..." }: { label?: string }) {
  return (
    <div className="flex items-center gap-2 text-slate-500 text-sm">
      <span className="inline-block h-4 w-4 rounded-full border-2 border-slate-200 border-t-slate-600 animate-spin" />
      <span>{label}</span>
    </div>
  );
}

function getCurriculoBadge(status?: CurriculoStatus["status"]) {
  if (status === "published") return "bg-emerald-100 text-emerald-700";
  if (status === "draft") return "bg-amber-100 text-amber-700";
  if (status === "archived") return "bg-slate-100 text-slate-500";
  return "bg-slate-100 text-slate-500";
}

export default function CourseManager({
  selectedCourse,
  managerTab,
  loadingDetails,
  details,
  curriculoInfo,
  curriculoAnoLetivo,
  onTabChange,
  onGenerateTurmas,
  onCreateDisciplina,
  onEditDisciplina,
  onDeleteDisciplina,
  onBack,
}: CourseManagerProps) {
  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200">
      {/* Header */}
      <div className="border-b border-slate-200 p-6 bg-slate-50">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <BookOpen className="w-4 h-4 text-slate-400" />
              <h2 className="text-base font-semibold text-slate-900 truncate">
                {selectedCourse?.nome ?? "Curso"}
              </h2>
              <span className="rounded-full bg-slate-900 text-white text-[10px] font-semibold px-2 py-1">
                ativo
              </span>
            </div>
            <p className="text-xs text-slate-500 font-mono mt-1 truncate">
              {selectedCourse?.codigo ?? "Sem código"}
            </p>
          </div>

          <div className="flex items-center gap-2">
            <div className="rounded-full border border-slate-200 bg-white p-1 flex">
              <button
                type="button"
                onClick={() => onTabChange("turmas")}
                className={cx(
                  "px-4 py-2 text-xs font-semibold rounded-full transition",
                  managerTab === "turmas"
                    ? "bg-slate-900 text-white"
                    : "text-slate-600 hover:text-slate-900"
                )}
              >
                Turmas
              </button>
              <button
                type="button"
                onClick={() => onTabChange("disciplinas")}
                className={cx(
                  "px-4 py-2 text-xs font-semibold rounded-full transition",
                  managerTab === "disciplinas"
                    ? "bg-klasse-gold text-white"
                    : "text-slate-600 hover:text-slate-900"
                )}
              >
                Currículo
              </button>
            </div>

            <button
              type="button"
              onClick={onBack}
              className="rounded-full border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
            >
              Voltar
            </button>
          </div>
        </div>
      </div>

      {/* Body */}
      <div className="p-6">
        {loadingDetails ? (
          <div className="py-20 flex justify-center">
            <Spinner label="Carregando detalhes..." />
          </div>
        ) : !details ? (
          <div className="text-sm text-slate-500">Não foi possível carregar.</div>
        ) : (
          <>
            {managerTab === "turmas" && (
              <div className="space-y-6">
                {details.classes.map((classe) => {
                  const turmas = details.turmas.filter((t) => t.classe === classe.nome);
                  return (
                    <div key={classe.id} className="rounded-xl border border-slate-200 overflow-hidden">
                      <div className="bg-slate-950 text-white px-4 py-3 flex items-center justify-between">
                        <div className="text-sm font-semibold">{classe.nome}</div>
                        <button
                          type="button"
                          onClick={() => selectedCourse && onGenerateTurmas(selectedCourse.id)}
                          className="inline-flex items-center gap-2 rounded-full bg-klasse-gold px-4 py-2 text-xs font-semibold text-white hover:brightness-95"
                        >
                          <Plus className="w-4 h-4" />
                          Gerar turmas
                        </button>
                      </div>

                      {turmas.length === 0 ? (
                        <div className="p-6 text-sm text-slate-600">
                          Nenhuma turma ainda.
                        </div>
                      ) : (
                        <div className="p-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                          {turmas.map((turma) => (
                            <div
                              key={turma.id}
                              className="rounded-xl border border-slate-200 bg-white p-4"
                            >
                              <div className="flex items-start justify-between gap-2">
                                <div className="min-w-0">
                                  <p className="font-semibold text-slate-900 truncate">{turma.nome}</p>
                                  <p className="text-xs text-slate-500 mt-1">
                                    Turno: <span className="font-semibold">{turma.turno}</span>
                                  </p>
                                </div>

                                <button
                                  type="button"
                                  className="rounded-full border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                                >
                                  Editar
                                </button>
                              </div>

                              <div className="mt-3 flex items-center gap-2 text-xs text-slate-600">
                                <Users className="w-4 h-4 text-slate-400" />
                                {turma.total_alunos} alunos
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {managerTab === "disciplinas" && (
              <div className="max-w-3xl space-y-4">
                <div className="rounded-xl border border-slate-200 bg-white p-4">
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <h3 className="text-sm font-semibold text-slate-900">Versão do currículo</h3>
                      <p className="text-xs text-slate-500">
                        Contrato acadêmico aplicado por versão.
                      </p>
                    </div>
                    <span
                      className={cx(
                        "inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold",
                        getCurriculoBadge(curriculoInfo?.status)
                      )}
                    >
                      {curriculoInfo?.status ?? "sem currículo"}
                    </span>
                  </div>
                  <div className="mt-3 grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs text-slate-600">
                    <div className="rounded-lg border border-slate-200 px-3 py-2">
                      Versão: <span className="font-semibold">{curriculoInfo?.version ?? "-"}</span>
                    </div>
                    <div className="rounded-lg border border-slate-200 px-3 py-2">
                      Ano letivo: <span className="font-semibold">{curriculoAnoLetivo?.ano ?? "-"}</span>
                    </div>
                    <div className="rounded-lg border border-slate-200 px-3 py-2">
                      Curso ID: <span className="font-mono text-[11px]">{selectedCourse?.id ?? "-"}</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-semibold text-slate-900">Plano curricular</h4>
                  <button
                    type="button"
                    onClick={onCreateDisciplina}
                    className="bg-slate-900 text-white px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 hover:bg-slate-800 shadow-sm"
                  >
                    <Plus className="w-4 h-4" />
                    Adicionar Disciplina
                  </button>
                </div>

                <div className="rounded-xl border border-slate-200 overflow-hidden">
                  <div className="bg-slate-50 px-4 py-3 text-xs font-semibold text-slate-600">
                    Disciplinas ({details.disciplinas.length})
                  </div>
                  <div className="divide-y divide-slate-100">
                    {details.disciplinas.map((disc, idx) => (
                      <div key={disc.id} className="px-4 py-3 group">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <span className="text-slate-300 font-mono text-xs w-6">
                              {(idx + 1).toString().padStart(2, "0")}
                            </span>
                            <div>
                              <div className="font-medium text-slate-800 flex items-center gap-2">
                                {disc.nome}
                                {disc.is_core && (
                                  <span className="rounded-full bg-slate-900 text-white px-2 py-0.5 text-[10px] font-semibold">
                                    Core
                                  </span>
                                )}
                              </div>
                              <div className="text-xs text-slate-500 font-mono">
                                {disc.codigo} · {disc.carga_horaria_semanal} aulas/sem ·{" "}
                                {disc.is_avaliavel
                                  ? disc.avaliacao_mode === "herdar_escola"
                                    ? "Aval: escola"
                                    : "Aval: custom"
                                  : "Sem nota"}
                              </div>
                            </div>
                          </div>

                          <div className="inline-flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button
                              type="button"
                              onClick={() => onEditDisciplina(disc)}
                              className="text-slate-300 hover:text-slate-700 p-2 rounded-xl hover:bg-slate-100"
                              title="Editar"
                            >
                              <Pencil className="w-4 h-4" />
                            </button>
                            <button
                              type="button"
                              onClick={() => onDeleteDisciplina(disc.id)}
                              className="text-slate-300 hover:text-red-500 p-2 rounded-xl hover:bg-red-50"
                              title="Remover"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                    {details.disciplinas.length === 0 && (
                      <div className="px-4 py-6 text-sm text-slate-500">
                        Nenhuma disciplina cadastrada.
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
