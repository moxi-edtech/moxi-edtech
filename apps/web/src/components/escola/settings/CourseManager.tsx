"use client";

import { useEffect, useState } from "react";
import { BookOpen, Plus, Users, Pencil, Trash2, AlertCircle, Check, Link2Off, ChevronRight, LayoutGrid } from "lucide-react";
import type { ActiveCourse, CourseDetails, CurriculoStatus } from "./StructureMarketplace";

import { Button } from "@/components/ui/Button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Spinner } from "@/components/ui/Spinner";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

type ManagerTab = "turmas" | "disciplinas" | "avaliacao";

type ModeloAvaliacao = {
  id: string;
  nome: string;
  curso_id?: string | null;
};

type CourseAvaliacao = {
  global_default: ModeloAvaliacao | null;
  course_default: ModeloAvaliacao | null;
  modelos: ModeloAvaliacao[];
};

type CourseManagerProps = {
  selectedCourse: ActiveCourse | null;
  managerTab: ManagerTab;
  loadingDetails: boolean;
  details: CourseDetails | null;
  curriculoInfo?: CurriculoStatus[];
  curriculoAnoLetivo: { id: string; ano: number } | null;
  loadingAvaliacao: boolean;
  courseAvaliacao: CourseAvaliacao | null;
  onUpdateAvaliacao: (payload: { override: boolean; modeloId?: string | null }) => void;
  onTabChange: (tab: ManagerTab) => void;
  onGenerateTurmas: (cursoId: string) => void;
  generatingTurmas?: boolean;
  onCreateDisciplina: () => void;
  onEditDisciplina: (disciplina: CourseDetails["disciplinas"][number]) => void;
  onDeleteDisciplina: (id: string) => void;
  onResolvePendencias: () => void;
  onBack: () => void;
};

function cx(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(" ");
}

function getCurriculoBadge(status?: CurriculoStatus["status"]) {
  if (status === "published") return "bg-green-100 text-green-700 border-green-200";
  if (status === "draft") return "bg-amber-100 text-amber-700 border-amber-200";
  if (status === "archived") return "bg-slate-100 text-slate-500 border-slate-200";
  return "bg-slate-100 text-slate-500 border-slate-200";
}

export default function CourseManager({
  selectedCourse,
  managerTab,
  loadingDetails,
  details,
  curriculoInfo,
  curriculoAnoLetivo,
  loadingAvaliacao,
  courseAvaliacao,
  onUpdateAvaliacao,
  onTabChange,
  onGenerateTurmas,
  generatingTurmas = false,
  onCreateDisciplina,
  onEditDisciplina,
  onDeleteDisciplina,
  onResolvePendencias,
  onBack,
}: CourseManagerProps) {
  const [overrideCurso, setOverrideCurso] = useState(false);
  const [modeloSelecionado, setModeloSelecionado] = useState<string>("");

  useEffect(() => {
    const courseDefault = courseAvaliacao?.course_default ?? null;
    const fallback = courseAvaliacao?.global_default ?? null;
    setOverrideCurso(Boolean(courseDefault));
    setModeloSelecionado(courseDefault?.id ?? fallback?.id ?? "");
  }, [courseAvaliacao]);
  const pendenciasCount = details
    ? details.disciplinas.filter((disc) => disc.status_completude !== "completo").length
    : 0;
  const curriculoList = curriculoInfo ?? [];
  const overallStatus = curriculoList.length === 0
    ? "none"
    : curriculoList.every((row) => row.status === "published")
      ? "published"
      : curriculoList.some((row) => row.status === "draft")
        ? "draft"
        : curriculoList[0]?.status ?? "none";
  const latestVersion = curriculoList.reduce(
    (acc, row) => Math.max(acc, row.version ?? 0),
    0
  );
  const classNameById = new Map(details?.classes.map((cls) => [cls.id, cls.nome]) ?? []);
  const canGenerateTurmas = overallStatus === "published";
  const hasNoTurmas = Boolean(details?.classes.length) && (details?.turmas.length ?? 0) === 0;

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
      {/* Header */}
      <div className="border-b border-slate-200 p-6 bg-slate-50/50">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <nav className="flex items-center gap-2 text-xs font-medium text-slate-500 mb-1">
              <button onClick={onBack} className="hover:text-slate-900 transition-colors">Cursos ativos</button>
              <ChevronRight className="w-3 h-3" />
              <span className="text-slate-900">{selectedCourse?.nome}</span>
            </nav>
            <div className="flex items-center gap-3">
              <div className="bg-slate-900 p-2 rounded-xl">
                <BookOpen className="w-5 h-5 text-white" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
                  {selectedCourse?.nome ?? "Curso"}
                  <Badge className="bg-green-500/10 text-green-600 border-green-500/20 text-[10px] uppercase tracking-wider font-bold">
                    Ativo
                  </Badge>
                </h2>
                <p className="text-xs text-slate-500 font-mono">
                  ID: {selectedCourse?.codigo ?? selectedCourse?.id?.slice(0, 8) ?? "Sem código"}
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              onClick={onBack}
              className="rounded-full shadow-sm"
            >
              Voltar
            </Button>
          </div>
        </div>

        <div className="mt-8">
          <Tabs
            value={managerTab}
            onValueChange={(v) => onTabChange(v as ManagerTab)}
            className="w-full"
          >
            <TabsList className="bg-slate-100 p-1 w-full md:w-auto">
              <TabsTrigger value="turmas" className="rounded-full px-8 text-xs font-bold">
                Turmas
              </TabsTrigger>
              <TabsTrigger value="disciplinas" className="rounded-full px-8 text-xs font-bold">
                Currículo
              </TabsTrigger>
              <TabsTrigger value="avaliacao" className="rounded-full px-8 text-xs font-bold">
                Avaliação
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
      </div>

      {/* Body */}
      <div className="p-6 bg-white min-h-[400px]">
        {loadingDetails ? (
          <div className="py-24 flex flex-col items-center justify-center gap-4">
            <Spinner size={32} className="text-slate-400" />
            <p className="text-sm text-slate-500 animate-pulse">Carregando detalhes do curso...</p>
          </div>
        ) : !details ? (
          <div className="py-24 flex flex-col items-center justify-center text-center">
            <AlertCircle className="w-12 h-12 text-slate-300 mb-4" />
            <p className="text-slate-500 font-medium">Não foi possível carregar os detalhes.</p>
            <Button variant="link" onClick={onBack}>Voltar aos cursos</Button>
          </div>
        ) : (
          <div className="max-w-5xl mx-auto">
            {managerTab === "avaliacao" && (
              <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
                <Card>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <div>
                        <CardTitle className="text-lg">Regra de Avaliação do Curso</CardTitle>
                        <CardDescription>
                          Defina como as notas e faltas serão processadas para este curso especificamente.
                        </CardDescription>
                      </div>
                      {overrideCurso ? (
                        <Badge className="bg-amber-500/10 text-amber-600 border-amber-500/20">
                          <Check className="h-3 w-3 mr-1" /> Customizado
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-slate-400">
                          Herdado da escola
                        </Badge>
                      )}
                    </div>
                  </CardHeader>

                  <CardContent className="space-y-6">
                    {loadingAvaliacao ? (
                      <div className="py-12 flex justify-center">
                        <div className="flex items-center gap-2 text-sm text-slate-500">
                          <Spinner size={16} className="text-slate-400" />
                          <span>Carregando configurações...</span>
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        <label className="flex items-center gap-3 p-4 rounded-xl border border-slate-200 cursor-pointer hover:bg-slate-50 transition-colors">
                          <input
                            type="checkbox"
                            checked={overrideCurso}
                            onChange={(event) => setOverrideCurso(event.target.checked)}
                            className="w-4 h-4 rounded border-slate-300 text-slate-900 focus:ring-slate-900"
                          />
                          <div>
                            <p className="text-sm font-bold text-slate-900">Substituir regra padrão</p>
                            <p className="text-xs text-slate-500">Ative para selecionar um modelo específico para este curso.</p>
                          </div>
                        </label>

                        <div className={cx("space-y-2", !overrideCurso && "opacity-50 pointer-events-none")}>
                          <label className="text-xs font-bold text-slate-600 ml-1">Modelo de avaliação</label>
                          <select
                            value={modeloSelecionado}
                            onChange={(event) => setModeloSelecionado(event.target.value)}
                            disabled={!overrideCurso}
                            className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm focus:ring-4 focus:ring-slate-900/5 focus:border-slate-900 outline-none appearance-none bg-white shadow-sm"
                          >
                            <option value="">Selecione um modelo</option>
                            {(courseAvaliacao?.modelos ?? []).map((modelo) => (
                              <option key={modelo.id} value={modelo.id}>
                                {modelo.nome}
                              </option>
                            ))}
                          </select>
                        </div>

                        {overrideCurso && !modeloSelecionado && (
                          <Alert className="bg-amber-50 border-amber-200 text-amber-800 py-3">
                            <AlertCircle className="h-4 w-4 text-amber-600" />
                            <AlertDescription className="text-xs font-medium">
                              Você deve selecionar um modelo para salvar as alterações.
                            </AlertDescription>
                          </Alert>
                        )}
                      </div>
                    )}
                  </CardContent>

                  <CardFooter className="border-t border-slate-100 bg-slate-50/50 py-4">
                    <Button
                      onClick={() =>
                        onUpdateAvaliacao({
                          override: overrideCurso,
                          modeloId: overrideCurso ? modeloSelecionado : null,
                        })
                      }
                      disabled={overrideCurso && !modeloSelecionado}
                      tone="slate"
                      className="rounded-full px-8"
                    >
                      Salvar alterações
                    </Button>
                  </CardFooter>
                </Card>
              </div>
            )}
            
            {managerTab === "turmas" && (
              <div className="space-y-8 animate-in fade-in slide-in-from-bottom-2 duration-300">
                {hasNoTurmas && (
                  <Alert className="bg-amber-50 border-amber-200 text-amber-800 p-6 flex flex-col md:flex-row md:items-center justify-between gap-6">
                    <div className="flex gap-4">
                      <div className="bg-amber-100 p-2 rounded-xl h-fit">
                        <Users className="w-6 h-6 text-amber-600" />
                      </div>
                      <div>
                        <AlertTitle className="text-base font-bold text-amber-900">
                          {canGenerateTurmas ? "Preparar estrutura de turmas" : "Currículo pendente de publicação"}
                        </AlertTitle>
                        <AlertDescription className="text-sm text-amber-800 mt-1 max-w-xl">
                          {canGenerateTurmas
                            ? "O currículo já está pronto. Agora você pode gerar as turmas iniciais para este ano letivo e começar a matricular alunos."
                            : "Você precisa publicar o currículo (no botão ao lado) para que o sistema saiba quais classes existem neste curso."}
                        </AlertDescription>
                      </div>
                    </div>
                    {canGenerateTurmas && (
                      <Button
                        onClick={() => selectedCourse && onGenerateTurmas(selectedCourse.id)}
                        disabled={!selectedCourse || !canGenerateTurmas || generatingTurmas}
                        tone="gold"
                        className="rounded-full px-8 shadow-sm whitespace-nowrap"
                        loading={generatingTurmas}
                      >
                        <Plus className="w-4 h-4 mr-2" />
                        Preparar turmas
                      </Button>
                    )}
                  </Alert>
                )}

                {details.classes.map((classe) => {
                  const turmas = details.turmas.filter((t) => t.classe === classe.nome);
                  return (
                    <div key={classe.id} className="space-y-4">
                      <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                        <div className="flex items-center gap-2">
                          <LayoutGrid className="w-4 h-4 text-slate-400" />
                          <h3 className="text-base font-bold text-slate-800">{classe.nome}</h3>
                          <Badge variant="outline" className="text-[10px] uppercase font-bold text-slate-400 border-slate-200">
                            {turmas.length} {turmas.length === 1 ? "turma" : "turmas"}
                          </Badge>
                        </div>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => selectedCourse && onGenerateTurmas(selectedCourse.id)}
                          disabled={!selectedCourse || !canGenerateTurmas || generatingTurmas}
                          className="rounded-full h-8 text-[11px] font-bold"
                        >
                          <Plus className="w-3 h-3 mr-1.5" />
                          Nova Turma
                        </Button>
                      </div>

                      {turmas.length === 0 ? (
                        <div className="p-12 rounded-2xl border border-dashed border-slate-200 flex flex-col items-center justify-center text-center">
                          <Users className="w-8 h-8 text-slate-200 mb-2" />
                          <p className="text-sm text-slate-400">Nenhuma turma criada para a {classe.nome}.</p>
                        </div>
                      ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                          {turmas.map((turma) => (
                            <Card key={turma.id} className="hover:border-slate-300 transition-colors shadow-none border-slate-200">
                              <CardHeader className="p-4 pb-2">
                                <div className="flex items-start justify-between">
                                  <CardTitle className="text-sm font-bold">{turma.nome}</CardTitle>
                                  <Button variant="ghost" size="icon" className="h-7 w-7 text-slate-400">
                                    <Pencil className="w-3.5 h-3.5" />
                                  </Button>
                                </div>
                              </CardHeader>
                              <CardContent className="p-4 pt-0">
                                <div className="flex items-center gap-4 mt-2">
                                  <div className="flex items-center gap-1.5 text-xs text-slate-500 font-medium">
                                    <LayoutGrid className="w-3.5 h-3.5 text-slate-300" />
                                    {turma.turno}
                                  </div>
                                  <div className="flex items-center gap-1.5 text-xs text-slate-500 font-medium">
                                    <Users className="w-3.5 h-3.5 text-slate-300" />
                                    {turma.total_alunos} alunos
                                  </div>
                                </div>
                              </CardContent>
                            </Card>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {managerTab === "disciplinas" && (
              <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
                <Card className="bg-slate-900 text-white border-none overflow-hidden shadow-xl">
                  <div className="absolute top-0 right-0 p-8 opacity-10 pointer-events-none">
                    <BookOpen size={120} />
                  </div>
                  <CardHeader className="relative z-10">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                      <div>
                        <CardTitle className="text-lg font-bold">Estrutura Curricular</CardTitle>
                        <CardDescription className="text-slate-400">
                          Ano Letivo {curriculoAnoLetivo?.ano} · {details.disciplinas.length} Disciplinas
                        </CardDescription>
                      </div>
                      <div className="flex items-center gap-3">
                        {pendenciasCount > 0 && (
                          <Badge className="bg-amber-500 text-amber-950 border-none font-bold py-1 px-3">
                            {pendenciasCount} pendências
                          </Badge>
                        )}
                        <Badge className={cx("py-1 px-3 font-bold border-none", getCurriculoBadge(overallStatus as CurriculoStatus["status"]))}>
                          {overallStatus === "none" ? "sem currículo" : overallStatus.toUpperCase()}
                        </Badge>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="relative z-10">
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                      <div className="bg-white/5 rounded-xl p-3 border border-white/10">
                        <p className="text-[10px] uppercase font-bold text-slate-400 tracking-wider mb-1">Versão Atual</p>
                        <p className="text-sm font-mono font-bold text-white">{latestVersion || "—"}</p>
                      </div>
                      <div className="bg-white/5 rounded-xl p-3 border border-white/10">
                        <p className="text-[10px] uppercase font-bold text-slate-400 tracking-wider mb-1">Ciclo</p>
                        <p className="text-sm font-bold text-white">{curriculoAnoLetivo?.ano ?? "—"}</p>
                      </div>
                      <div className="bg-white/5 rounded-xl p-3 border border-white/10">
                        <p className="text-[10px] uppercase font-bold text-slate-400 tracking-wider mb-1">Ref Interna</p>
                        <p className="text-sm font-mono text-[10px] text-white opacity-60 truncate">{selectedCourse?.id}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <div className="flex items-center justify-between gap-4 pt-2">
                  <h4 className="text-base font-bold text-slate-900">Disciplinas por classe</h4>
                  <div className="flex items-center gap-2">
                    {pendenciasCount > 0 && (
                      <Button
                        onClick={onResolvePendencias}
                        variant="outline"
                        tone="amber"
                        className="rounded-full shadow-sm"
                      >
                        Resolver pendências
                      </Button>
                    )}
                    <Button
                      onClick={onCreateDisciplina}
                      tone="gold"
                      className="rounded-full shadow-md"
                    >
                      <Plus className="w-4 h-4 mr-2" />
                      Adicionar Disciplina
                    </Button>
                  </div>
                </div>

                <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden shadow-sm">
                  <table className="w-full text-left">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-100 text-[10px] uppercase font-bold text-slate-400 tracking-wider">
                        <th className="px-6 py-4 w-12">#</th>
                        <th className="px-6 py-4">Disciplina</th>
                        <th className="px-6 py-4 hidden md:table-cell">Código</th>
                        <th className="px-6 py-4 hidden sm:table-cell text-center">Aulas/Sem</th>
                        <th className="px-6 py-4 text-center">Status</th>
                        <th className="px-6 py-4 text-right">Ações</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {details.disciplinas.map((disc, idx) => (
                        <tr key={disc.id} className="group hover:bg-slate-50/50 transition-colors">
                          <td className="px-6 py-4 text-xs font-mono text-slate-300">
                            {(idx + 1).toString().padStart(2, "0")}
                          </td>
                          <td className="px-6 py-4">
                            <div className="flex flex-col">
                              <span className="text-sm font-bold text-slate-800 flex items-center gap-2">
                                {disc.nome}
                                {disc.is_core && (
                                  <Badge className="bg-slate-900 text-white text-[9px] h-4 py-0 px-1.5 border-none font-bold uppercase">Core</Badge>
                                )}
                              </span>
                              <span className="text-[11px] text-slate-400 mt-0.5 sm:hidden">{disc.codigo}</span>
                            </div>
                          </td>
                          <td className="px-6 py-4 hidden md:table-cell text-xs font-mono text-slate-500">
                            {disc.codigo}
                          </td>
                          <td className="px-6 py-4 hidden sm:table-cell text-center text-xs font-bold text-slate-700">
                            {disc.carga_horaria_semanal}
                          </td>
                          <td className="px-6 py-4 text-center">
                            <div className="flex items-center justify-center gap-2">
                              {disc.status_completude !== "completo" ? (
                                <Badge className="bg-amber-100 text-amber-700 border-amber-200 text-[9px] font-bold uppercase">Pendente</Badge>
                              ) : (
                                <Badge className="bg-green-100 text-green-700 border-green-200 text-[9px] font-bold uppercase">Ok</Badge>
                              )}
                              {disc.modelo_excecao_id && (
                                <span title="Exceção de avaliação">
                                  <Link2Off className="w-3 h-3 text-red-400" />
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="px-6 py-4 text-right">
                            <div className="flex items-center justify-end gap-1">
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => onEditDisciplina(disc)}
                                className="h-8 w-8 text-slate-400 hover:text-slate-900 hover:bg-white border border-transparent hover:border-slate-200 rounded-lg transition-all"
                              >
                                <Pencil className="w-4 h-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => onDeleteDisciplina(disc.id)}
                                className="h-8 w-8 text-slate-400 hover:text-red-600 hover:bg-red-50 border border-transparent hover:border-red-100 rounded-lg transition-all"
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {details.disciplinas.length === 0 && (
                    <div className="px-6 py-12 flex flex-col items-center justify-center text-center">
                      <BookOpen className="w-10 h-10 text-slate-200 mb-2" />
                      <p className="text-sm text-slate-400">Nenhuma disciplina cadastrada.</p>
                      <Button variant="link" size="sm" onClick={onCreateDisciplina} className="mt-1">Começar agora</Button>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
