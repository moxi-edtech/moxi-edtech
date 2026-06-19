"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowLeftRight, BookOpen, CheckCircle2, Loader2, RefreshCw, Save, Users } from "lucide-react";
import { DashboardHeader } from "@/components/layout/DashboardHeader";
import { useToast } from "@/components/feedback/FeedbackSystem";
import { useEscolaId } from "@/hooks/useEscolaId";
import { buildPortalHref } from "@/lib/navigation";

type Portal = "admin" | "secretaria";
type Orientation = "alunos" | "disciplinas";

type TurmaOption = {
  id: string;
  nome: string;
  turno: string | null;
  ano_letivo: number | null;
  curso_id: string | null;
  classe_id: string | null;
  classe_nome: string | null;
  classe_numero: number | null;
};

type ClasseOption = {
  id: string;
  nome: string;
  numero: number | null;
  curso_id: string | null;
};

type DisciplinaPreview = {
  disciplina_id: string;
  disciplina_nome: string;
  ordem: number | null;
};

type LinhaPreview = {
  aluno_id: string;
  nome: string;
  numero_chamada: number | null;
  notas: Array<{
    disciplina_id: string;
    disciplina_nome: string;
    ordem: number | null;
    nota_final: number | null;
  }>;
};

type PreviewPayload = {
  turma: TurmaOption;
  classe: ClasseOption;
  ano_letivo: number;
  disciplinas: DisciplinaPreview[];
  linhas: LinhaPreview[];
  stats: {
    total_alunos: number;
    total_disciplinas: number;
    total_celulas: number;
    preenchidas: number;
    pendentes: number;
    registros_existentes: number;
  };
};

function getCellKey(alunoId: string, disciplinaId: string) {
  return `${alunoId}:${disciplinaId}`;
}

function parseGradeDraft(value: string) {
  const normalized = value.replace(",", ".").trim();
  if (!normalized) return null;
  const parsed = Number(normalized);
  if (!Number.isFinite(parsed)) return null;
  return Number(Math.min(20, Math.max(0, parsed)).toFixed(2));
}

function normalizeGradeDraft(value: string) {
  const parsed = parseGradeDraft(value);
  if (parsed === null) return value.trim() === "" ? "" : value;
  if (Number.isInteger(parsed)) return String(parsed);
  return String(parsed).replace(/\.?0+$/, "");
}

function buildDraftMap(preview: PreviewPayload | null) {
  const next: Record<string, string> = {};
  if (!preview) return next;
  for (const linha of preview.linhas) {
    for (const nota of linha.notas) {
      next[getCellKey(linha.aluno_id, nota.disciplina_id)] =
        typeof nota.nota_final === "number" ? normalizeGradeDraft(String(nota.nota_final)) : "";
    }
  }
  return next;
}

function formatTurmaLabel(turma: TurmaOption) {
  const meta = [turma.classe_nome, turma.turno].filter(Boolean).join(" • ");
  return meta ? `${turma.nome} (${meta})` : turma.nome;
}

function filterClassesForTurma(turma: TurmaOption | null, classes: ClasseOption[]) {
  if (!turma?.curso_id) return classes;
  const sameCourse = classes.filter((item) => item.curso_id === turma.curso_id);
  return sameCourse.length > 0 ? sameCourse : classes;
}

function pickSuggestedClasse(turma: TurmaOption | null, classes: ClasseOption[]) {
  if (!turma || classes.length === 0) return classes[0] ?? null;
  const sameCourse = filterClassesForTurma(turma, classes);
  const classesOrdenadas = [...sameCourse].sort((left, right) => {
    const leftNumero = typeof left.numero === "number" ? left.numero : Number.MAX_SAFE_INTEGER;
    const rightNumero = typeof right.numero === "number" ? right.numero : Number.MAX_SAFE_INTEGER;
    if (leftNumero !== rightNumero) return leftNumero - rightNumero;
    return left.nome.localeCompare(right.nome, "pt");
  });

  const turmaNumero = typeof turma.classe_numero === "number" ? turma.classe_numero : null;
  if (turmaNumero !== null) {
    const previous = classesOrdenadas.find((item) => item.numero === turmaNumero - 1);
    if (previous) return previous;
  }

  return classesOrdenadas[0] ?? null;
}

function GradeMatrixInput({
  value,
  invalid,
  inputRef,
  onChange,
  onCommit,
  onNavigate,
}: {
  value: string;
  invalid: boolean;
  inputRef: (element: HTMLInputElement | null) => void;
  onChange: (value: string) => void;
  onCommit: () => void;
  onNavigate: (deltaRow: number, deltaCol: number) => void;
}) {
  return (
    <input
      ref={inputRef}
      type="text"
      inputMode="decimal"
      value={value}
      onChange={(event) => onChange(event.target.value)}
      onBlur={onCommit}
      onKeyDown={(event) => {
        if (["ArrowDown", "ArrowUp", "ArrowLeft", "ArrowRight", "Enter"].includes(event.key)) {
          event.preventDefault();
        }

        if (event.key === "ArrowDown" || event.key === "Enter") {
          onCommit();
          onNavigate(1, 0);
        }
        if (event.key === "ArrowUp") {
          onCommit();
          onNavigate(-1, 0);
        }
        if (event.key === "ArrowLeft") {
          onCommit();
          onNavigate(0, -1);
        }
        if (event.key === "ArrowRight") {
          onCommit();
          onNavigate(0, 1);
        }
      }}
      className={`h-10 w-20 rounded-lg border px-2 text-center text-sm font-semibold outline-none transition focus:ring-2 focus:ring-klasse-green-500 ${
        invalid
          ? "border-rose-300 bg-rose-50 text-rose-700"
          : value.trim() === ""
            ? "border-slate-200 bg-slate-50 text-slate-500"
            : "border-slate-200 bg-white text-slate-900"
      }`}
      placeholder="-"
    />
  );
}

export default function MigracaoPautasPage({ portal }: { portal: Portal }) {
  const { escolaId, escolaSlug } = useEscolaId();
  const { success, error } = useToast();
  const inputRefs = useRef<Record<string, HTMLInputElement | null>>({});

  const [loadingBase, setLoadingBase] = useState(true);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [turmas, setTurmas] = useState<TurmaOption[]>([]);
  const [classes, setClasses] = useState<ClasseOption[]>([]);
  const [selectedTurmaId, setSelectedTurmaId] = useState("");
  const [selectedClasseId, setSelectedClasseId] = useState("");
  const [anoLetivo, setAnoLetivo] = useState(String(new Date().getFullYear() - 1));
  const [orientation, setOrientation] = useState<Orientation>("alunos");
  const [preview, setPreview] = useState<PreviewPayload | null>(null);
  const [draftGrades, setDraftGrades] = useState<Record<string, string>>({});

  const escolaParam = escolaSlug || escolaId;
  const portalRoot = buildPortalHref(escolaParam, portal === "admin" ? "/admin" : "/secretaria");
  const currentTurma = turmas.find((item) => item.id === selectedTurmaId) ?? null;
  const availableClasses = filterClassesForTurma(currentTurma, classes);
  const parsedAnoLetivo = Number.parseInt(anoLetivo, 10);
  const hasValidYear = Number.isFinite(parsedAnoLetivo) && parsedAnoLetivo >= 1900 && parsedAnoLetivo <= 2100;

  const fetchHistoricoData = useCallback(async (params?: URLSearchParams) => {
    const suffix = params && params.toString() ? `?${params.toString()}` : "";
    const response = await fetch(`/api/secretaria/historico-transitado${suffix}`, { cache: "no-store" });
    const json = await response.json().catch(() => ({}));
    if (!response.ok || !json?.ok) {
      throw new Error(json?.error ?? "Falha ao carregar a migração de pautas.");
    }
    return json as {
      turmas: TurmaOption[];
      classes: ClasseOption[];
      preview: PreviewPayload | null;
    };
  }, []);

  function applyTurmaDefaults(nextTurmaId: string, nextTurmas: TurmaOption[], nextClasses: ClasseOption[]) {
    const turma = nextTurmas.find((item) => item.id === nextTurmaId) ?? null;
    const suggestedClasse = pickSuggestedClasse(turma, nextClasses);
    const suggestedAno = turma?.ano_letivo ? turma.ano_letivo - 1 : new Date().getFullYear() - 1;

    setSelectedTurmaId(nextTurmaId);
    setSelectedClasseId(suggestedClasse?.id ?? "");
    setAnoLetivo(String(suggestedAno));
    setPreview(null);
    setDraftGrades({});
  }

  const reloadPreview = useCallback(async (nextTurmaId: string, nextClasseId: string, nextAnoLetivo: number) => {
    setLoadingPreview(true);
    setFeedback(null);

    try {
      const params = new URLSearchParams({
        turma_id: nextTurmaId,
        classe_id: nextClasseId,
        ano_letivo: String(nextAnoLetivo),
      });
      const json = await fetchHistoricoData(params);
      setTurmas(Array.isArray(json.turmas) ? json.turmas : []);
      setClasses(Array.isArray(json.classes) ? json.classes : []);
      setPreview(json.preview ?? null);
      setDraftGrades(buildDraftMap(json.preview ?? null));
    } catch (err) {
      const message = err instanceof Error ? err.message : "Erro desconhecido.";
      setPreview(null);
      setDraftGrades({});
      setFeedback(message);
    } finally {
      setLoadingPreview(false);
    }
  }, [fetchHistoricoData]);

  useEffect(() => {
    let active = true;

    async function run() {
      setLoadingBase(true);
      setFeedback(null);

      try {
        const json = await fetchHistoricoData();
        if (!active) return;

        const nextTurmas = Array.isArray(json.turmas) ? json.turmas : [];
        const nextClasses = Array.isArray(json.classes) ? json.classes : [];
        setTurmas(nextTurmas);
        setClasses(nextClasses);

        if (nextTurmas.length > 0) {
          applyTurmaDefaults(nextTurmas[0].id, nextTurmas, nextClasses);
        }
      } catch (err) {
        if (!active) return;
        const message = err instanceof Error ? err.message : "Erro desconhecido.";
        setFeedback(message);
        setTurmas([]);
        setClasses([]);
      } finally {
        if (active) setLoadingBase(false);
      }
    }

    void run();

    return () => {
      active = false;
    };
  }, [fetchHistoricoData]);

  useEffect(() => {
    if (!selectedTurmaId || !selectedClasseId || !hasValidYear) return;
    void reloadPreview(selectedTurmaId, selectedClasseId, parsedAnoLetivo);
  }, [selectedTurmaId, selectedClasseId, hasValidYear, parsedAnoLetivo, reloadPreview]);

  function updateDraft(alunoId: string, disciplinaId: string, value: string) {
    const key = getCellKey(alunoId, disciplinaId);
    setDraftGrades((current) => ({
      ...current,
      [key]: value,
    }));
  }

  function commitDraft(alunoId: string, disciplinaId: string) {
    const key = getCellKey(alunoId, disciplinaId);
    setDraftGrades((current) => ({
      ...current,
      [key]: normalizeGradeDraft(current[key] ?? ""),
    }));
  }

  function focusNext(rowIndex: number, columnIndex: number, deltaRow: number, deltaCol: number) {
    const next = inputRefs.current[`${rowIndex + deltaRow}:${columnIndex + deltaCol}`];
    if (!next) return;
    next.focus();
    next.select();
  }

  const totalCells = preview?.stats.total_celulas ?? 0;
  let filledCells = 0;
  let invalidCells = 0;

  if (preview) {
    for (const linha of preview.linhas) {
      for (const disciplina of preview.disciplinas) {
        const raw = draftGrades[getCellKey(linha.aluno_id, disciplina.disciplina_id)] ?? "";
        const parsed = parseGradeDraft(raw);
        if (parsed !== null) {
          filledCells += 1;
        } else if (raw.trim() !== "") {
          invalidCells += 1;
        }
      }
    }
  }

  const missingCells = Math.max(totalCells - filledCells - invalidCells, 0);
  const canSave =
    Boolean(preview) &&
    !saving &&
    !loadingPreview &&
    totalCells > 0 &&
    invalidCells === 0 &&
    missingCells === 0;

  function renderGridByAluno(activePreview: PreviewPayload) {
    return (
      <table className="min-w-full border-separate border-spacing-0 bg-white text-sm">
        <thead>
          <tr>
            <th className="sticky left-0 top-0 z-30 border-b border-r border-slate-200 bg-slate-950 px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-white">
              Aluno
            </th>
            {activePreview.disciplinas.map((disciplina) => (
              <th
                key={disciplina.disciplina_id}
                className="sticky top-0 z-20 border-b border-slate-200 bg-slate-100 px-3 py-3 text-center text-xs font-semibold text-slate-700"
              >
                {disciplina.disciplina_nome}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {activePreview.linhas.map((linha, rowIndex) => (
            <tr key={linha.aluno_id}>
              <th className="sticky left-0 z-10 border-b border-r border-slate-200 bg-white px-4 py-3 text-left align-middle">
                <div className="min-w-[220px]">
                  <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                    Nº {linha.numero_chamada ?? rowIndex + 1}
                  </p>
                  <p className="mt-1 text-sm font-semibold text-slate-900">{linha.nome}</p>
                </div>
              </th>

              {activePreview.disciplinas.map((disciplina, columnIndex) => {
                const cellKey = getCellKey(linha.aluno_id, disciplina.disciplina_id);
                const rawValue = draftGrades[cellKey] ?? "";
                const invalid = rawValue.trim() !== "" && parseGradeDraft(rawValue) === null;

                return (
                  <td
                    key={cellKey}
                    className="border-b border-r border-slate-100 px-2 py-2 text-center last:border-r-0"
                  >
                    <GradeMatrixInput
                      value={rawValue}
                      invalid={invalid}
                      inputRef={(element) => {
                        inputRefs.current[`${rowIndex}:${columnIndex}`] = element;
                      }}
                      onChange={(value) => updateDraft(linha.aluno_id, disciplina.disciplina_id, value)}
                      onCommit={() => commitDraft(linha.aluno_id, disciplina.disciplina_id)}
                      onNavigate={(deltaRow, deltaCol) => focusNext(rowIndex, columnIndex, deltaRow, deltaCol)}
                    />
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    );
  }

  function renderGridByDisciplina(activePreview: PreviewPayload) {
    return (
      <table className="min-w-full border-separate border-spacing-0 bg-white text-sm">
        <thead>
          <tr>
            <th className="sticky left-0 top-0 z-30 border-b border-r border-slate-200 bg-slate-950 px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-white">
              Disciplina
            </th>
            {activePreview.linhas.map((linha) => (
              <th
                key={linha.aluno_id}
                className="sticky top-0 z-20 border-b border-slate-200 bg-slate-100 px-3 py-3 text-center text-xs font-semibold text-slate-700"
              >
                {`Nº ${linha.numero_chamada ?? "—"} · ${linha.nome}`}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {activePreview.disciplinas.map((disciplina, rowIndex) => (
            <tr key={disciplina.disciplina_id}>
              <th className="sticky left-0 z-10 border-b border-r border-slate-200 bg-white px-4 py-3 text-left align-middle">
                <div className="min-w-[220px]">
                  <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                    Ordem {disciplina.ordem ?? "—"}
                  </p>
                  <p className="mt-1 text-sm font-semibold text-slate-900">{disciplina.disciplina_nome}</p>
                </div>
              </th>

              {activePreview.linhas.map((linha, columnIndex) => {
                const cellKey = getCellKey(linha.aluno_id, disciplina.disciplina_id);
                const rawValue = draftGrades[cellKey] ?? "";
                const invalid = rawValue.trim() !== "" && parseGradeDraft(rawValue) === null;

                return (
                  <td
                    key={cellKey}
                    className="border-b border-r border-slate-100 px-2 py-2 text-center last:border-r-0"
                  >
                    <GradeMatrixInput
                      value={rawValue}
                      invalid={invalid}
                      inputRef={(element) => {
                        inputRefs.current[`${rowIndex}:${columnIndex}`] = element;
                      }}
                      onChange={(value) => updateDraft(linha.aluno_id, disciplina.disciplina_id, value)}
                      onCommit={() => commitDraft(linha.aluno_id, disciplina.disciplina_id)}
                      onNavigate={(deltaRow, deltaCol) => focusNext(rowIndex, columnIndex, deltaRow, deltaCol)}
                    />
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    );
  }

  async function handleSaveAll() {
    if (!preview) return;
    if (!canSave) {
      error("Grelha incompleta", "Preencha todas as células e corrija valores inválidos antes de salvar.");
      return;
    }

    const registros = preview.linhas.map((linha) => ({
      aluno_id: linha.aluno_id,
      notas: preview.disciplinas.map((disciplina) => ({
        disciplina_id: disciplina.disciplina_id,
        disciplina_nome: disciplina.disciplina_nome,
        ordem: disciplina.ordem,
        nota_final: parseGradeDraft(draftGrades[getCellKey(linha.aluno_id, disciplina.disciplina_id)] ?? "") ?? 0,
      })),
    }));

    setSaving(true);
    setFeedback(null);

    try {
      const response = await fetch("/api/secretaria/historico-transitado", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          turma_id: preview.turma.id,
          classe_id: preview.classe.id,
          ano_letivo: preview.ano_letivo,
          registros,
        }),
      });
      const json = await response.json().catch(() => ({}));
      if (!response.ok || !json?.ok) {
        throw new Error(json?.error ?? "Falha ao salvar a migração de pautas.");
      }

      success(
        "Migração concluída",
        `${json.result?.total_alunos ?? preview.stats.total_alunos} alunos foram distribuídos para o histórico transitado.`,
      );
      await reloadPreview(preview.turma.id, preview.classe.id, preview.ano_letivo);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Erro desconhecido.";
      setFeedback(message);
      error("Falha ao salvar", message);
    } finally {
      setSaving(false);
    }
  }

  const pageTitle = "Migração de Pautas";
  const portalLabel = portal === "admin" ? "Admin" : "Secretaria";

  return (
    <div className="mx-auto flex w-full max-w-[1600px] flex-col gap-6 px-4 py-6 md:px-6">
      <DashboardHeader
        title={pageTitle}
        description="Selecione a turma actual, escolha a classe passada e lance as notas de todos os alunos numa única grelha."
        breadcrumbs={[
          { label: "Início", href: portalRoot },
          { label: portalLabel, href: portalRoot },
          { label: pageTitle },
        ]}
        actions={
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                if (preview && hasValidYear) {
                  void reloadPreview(preview.turma.id, preview.classe.id, parsedAnoLetivo);
                }
              }}
              disabled={!preview || loadingPreview}
              className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-600 transition hover:border-slate-300 hover:text-slate-900 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {loadingPreview ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
              Atualizar
            </button>
            <button
              type="button"
              onClick={() => void handleSaveAll()}
              disabled={!canSave}
              className="inline-flex items-center gap-2 rounded-xl bg-klasse-green px-4 py-2 text-xs font-semibold text-white transition hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              Salvar tudo
            </button>
          </div>
        }
      />

      <section className="grid gap-4 xl:grid-cols-[340px_minmax(0,1fr)]">
        <div className="space-y-4">
          <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-slate-400">Contexto</p>
            <div className="mt-4 space-y-4">
              <label className="block space-y-1.5">
                <span className="text-xs font-semibold text-slate-600">Turma actual</span>
                <select
                  value={selectedTurmaId}
                  onChange={(event) => applyTurmaDefaults(event.target.value, turmas, classes)}
                  className="w-full rounded-2xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none transition focus:border-klasse-green focus:ring-2 focus:ring-klasse-green/20"
                >
                  <option value="">Selecione a turma</option>
                  {turmas.map((turma) => (
                    <option key={turma.id} value={turma.id}>
                      {formatTurmaLabel(turma)}
                    </option>
                  ))}
                </select>
              </label>

              <label className="block space-y-1.5">
                <span className="text-xs font-semibold text-slate-600">Classe passada</span>
                <select
                  value={selectedClasseId}
                  onChange={(event) => {
                    setSelectedClasseId(event.target.value);
                    setPreview(null);
                    setDraftGrades({});
                  }}
                  className="w-full rounded-2xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none transition focus:border-klasse-green focus:ring-2 focus:ring-klasse-green/20"
                  disabled={availableClasses.length === 0}
                >
                  <option value="">Selecione a classe</option>
                  {availableClasses.map((classe) => (
                    <option key={classe.id} value={classe.id}>
                      {typeof classe.numero === "number" ? `${classe.numero}ª · ${classe.nome}` : classe.nome}
                    </option>
                  ))}
                </select>
              </label>

              <label className="block space-y-1.5">
                <span className="text-xs font-semibold text-slate-600">Ano letivo do histórico</span>
                <input
                  type="number"
                  value={anoLetivo}
                  onChange={(event) => {
                    setAnoLetivo(event.target.value);
                    setPreview(null);
                    setDraftGrades({});
                  }}
                  className="w-full rounded-2xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none transition focus:border-klasse-green focus:ring-2 focus:ring-klasse-green/20"
                />
              </label>
            </div>
          </div>

          <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-slate-400">Grelha</p>
                <h2 className="mt-1 text-sm font-semibold text-slate-900">Modo de navegação</h2>
              </div>
              <div className="inline-flex rounded-2xl border border-slate-200 bg-slate-50 p-1">
                <button
                  type="button"
                  onClick={() => setOrientation("alunos")}
                  className={`rounded-xl px-3 py-1.5 text-xs font-semibold transition ${
                    orientation === "alunos" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500"
                  }`}
                >
                  Alunos em linhas
                </button>
                <button
                  type="button"
                  onClick={() => setOrientation("disciplinas")}
                  className={`rounded-xl px-3 py-1.5 text-xs font-semibold transition ${
                    orientation === "disciplinas" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500"
                  }`}
                >
                  Disciplinas em linhas
                </button>
              </div>
            </div>

            <div className="mt-4 rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-3 text-xs text-slate-500">
              <p className="font-semibold text-slate-700">Atalhos</p>
              <p className="mt-1">Use setas e `Enter` para navegar como Excel. O save dispara apenas quando decidir fechar a grelha.</p>
            </div>
          </div>

          <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-slate-400">Resumo</p>
            <div className="mt-4 grid grid-cols-2 gap-3">
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
                <div className="flex items-center gap-2 text-slate-500">
                  <Users className="h-4 w-4" />
                  <span className="text-[11px] font-semibold uppercase tracking-wider">Alunos</span>
                </div>
                <p className="mt-2 text-2xl font-bold text-slate-900">{preview?.stats.total_alunos ?? 0}</p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
                <div className="flex items-center gap-2 text-slate-500">
                  <BookOpen className="h-4 w-4" />
                  <span className="text-[11px] font-semibold uppercase tracking-wider">Disciplinas</span>
                </div>
                <p className="mt-2 text-2xl font-bold text-slate-900">{preview?.stats.total_disciplinas ?? 0}</p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-white p-3">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Preenchidas</p>
                <p className="mt-2 text-xl font-bold text-klasse-green">{filledCells}</p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-white p-3">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Pendentes</p>
                <p className="mt-2 text-xl font-bold text-amber-600">{missingCells + invalidCells}</p>
              </div>
            </div>

            {preview?.stats.registros_existentes ? (
              <div className="mt-4 inline-flex items-center gap-2 rounded-full border border-klasse-green/20 bg-klasse-green/5 px-3 py-1 text-[11px] font-semibold text-klasse-green">
                <CheckCircle2 className="h-3.5 w-3.5" />
                {preview.stats.registros_existentes} históricos já existiam e serão sobrescritos no save.
              </div>
            ) : null}
          </div>
        </div>

        <div className="space-y-4">
          <div className="rounded-3xl border border-slate-200 bg-white shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-5 py-4">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-slate-400">Editor</p>
                <h2 className="mt-1 text-sm font-semibold text-slate-900">
                  {preview ? `${preview.turma.nome} → ${preview.classe.nome} (${preview.ano_letivo})` : "Monte a grelha"}
                </h2>
              </div>
              <div className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-[11px] font-semibold text-slate-500">
                <ArrowLeftRight className="h-3.5 w-3.5" />
                {orientation === "alunos" ? "Vertical por aluno" : "Horizontal por aluno"}
              </div>
            </div>

            {feedback ? (
              <div className="mx-5 mt-5 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                {feedback}
              </div>
            ) : null}

            {loadingBase || loadingPreview ? (
              <div className="flex min-h-[420px] items-center justify-center px-5 py-10 text-sm text-slate-500">
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Montando grelha de migração...
              </div>
            ) : preview ? (
              preview.stats.total_alunos === 0 || preview.stats.total_disciplinas === 0 ? (
                <div className="px-5 py-10 text-center text-sm text-slate-500">
                  A turma actual ou a classe passada ainda não têm dados suficientes para montar a pauta.
                </div>
              ) : (
                <div className="overflow-auto px-5 py-5">
                  <div className="mb-3 text-xs text-slate-500">
                    {invalidCells > 0
                      ? `${invalidCells} célula(s) com valor inválido.`
                      : missingCells > 0
                        ? `${missingCells} célula(s) por preencher antes do save.`
                        : "Grelha pronta para salvar em lote."}
                  </div>
                  <div className="max-h-[72vh] overflow-auto rounded-2xl border border-slate-200">
                    {orientation === "alunos" ? renderGridByAluno(preview) : renderGridByDisciplina(preview)}
                  </div>
                </div>
              )
            ) : (
              <div className="flex min-h-[420px] items-center justify-center px-5 py-10 text-center text-sm text-slate-500">
                Selecione a turma actual, a classe passada e o ano letivo para montar a grelha.
              </div>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
