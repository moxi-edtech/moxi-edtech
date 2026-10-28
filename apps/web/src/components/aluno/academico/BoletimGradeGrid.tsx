"use client";

import { Fragment, useEffect, useId, useMemo, useState } from "react";
import { ChevronDown, Download, Eye, EyeOff, FileText, Loader2, LockKeyhole } from "lucide-react";
import {
  formatPublishedGrade,
  isSubjectOffered,
  periodAssessments,
  subjectsInTrimester,
  trimesterClassification,
  trimesterStatus,
  type GradeSubject,
} from "@/lib/aluno/gradesPresentation";

type Props = {
  /** Curriculum is authorized separately; assessments and finals are always gated server-side. */
  subjects: GradeSubject[];
  locked: boolean;
  scope: string;
  yearLabel?: string | null;
  loadingSubjects?: boolean;
  subjectsError?: string | null;
  historicalRead?: boolean;
  downloading?: boolean;
  downloadError?: string | null;
  onDownload: () => void;
  onReapreciacao?: (subject: GradeSubject) => void;
  onMelhoria?: (subject: GradeSubject) => void;
};

const focus = "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2";
type View = "trimestre" | "disciplina";

function TermValue({ subject, term, locked, showGrades }: {
  subject: GradeSubject; term: number; locked: boolean; showGrades: boolean;
}) {
  const offered = isSubjectOffered(subject, term);
  if (offered === false) return <span className="text-xs text-muted-foreground">Não lecionada</span>;
  if (locked) return <span className="inline-flex items-center gap-1.5 text-sm text-muted-foreground" aria-label="Notas protegidas">
    <LockKeyhole aria-hidden="true" className="h-4 w-4" /> <span className="sr-only">Notas protegidas</span>
  </span>;
  if (!showGrades) return <span aria-label="Notas ocultadas"><EyeOff aria-hidden="true" className="inline h-4 w-4 text-muted-foreground" /></span>;
  const final = trimesterClassification(subject, term);
  if (final) return <span className="text-base font-semibold tabular-nums text-foreground">{formatPublishedGrade(final.nota!)}</span>;
  if (trimesterStatus(subject, term) === "pendente") return <span className="text-xs text-muted-foreground">Em apuramento</span>;
  return <span className="text-xs text-muted-foreground">Sem classificação</span>;
}

export function BoletimGradeGrid({
  subjects, locked, scope, yearLabel, loadingSubjects = false, subjectsError = null,
  historicalRead = false, downloading = false, downloadError = null,
  onDownload, onReapreciacao, onMelhoria,
}: Props) {
  const prefix = useId().replace(/:/g, "");
  const [view, setView] = useState<View>("trimestre");
  const [term, setTerm] = useState(1);
  const [selectedSubjectId, setSelectedSubjectId] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [showGrades, setShowGrades] = useState(true);

  useEffect(() => {
    setExpandedId(null);
    setSelectedSubjectId(null);
    setShowGrades(true);
    setTerm(1);
    setView("trimestre");
  }, [scope]);

  // A locked API response cannot smuggle scores into the grid or its details.
  const safeSubjects = useMemo(() => subjects.map((subject) => ({
    id: subject.id,
    nome: subject.nome,
    periodosAtivos: subject.periodosAtivos ?? null,
    avaliacoes: locked ? [] : subject.avaliacoes,
    classificacoes: locked ? [] : (subject.classificacoes ?? []),
  })), [subjects, locked]);
  const quarterSubjects = subjectsInTrimester(safeSubjects, term);
  const selectedSubject = safeSubjects.find((s) => s.id === selectedSubjectId) ?? safeSubjects[0] ?? null;
  const hasPublishedAssessments = safeSubjects.some((s) => s.avaliacoes.length > 0);
  const hasFinals = safeSubjects.some(s => s.classificacoes.some(c => c.status === "disponivel"));
  const valuesVisible = !locked && showGrades;

  const selectView = (next: View) => {
    setView(next);
    setExpandedId(null);
  };

  const detail = (subject: GradeSubject, selectedTerm: number | null) => {
    const entries = selectedTerm === null
      ? subject.avaliacoes.filter(a => Number.isFinite(a.nota))
      : periodAssessments(subject, selectedTerm);
    return <div className="space-y-3 py-2" data-testid="boletim-assessment-details">
      {locked ? <p className="text-sm text-muted-foreground">As classificações e avaliações estão protegidas. Consulta o estado do pedido abaixo.</p>
        : !showGrades ? <p className="text-sm text-muted-foreground">Seleciona «Exibir notas» para consultar os detalhes.</p>
        : entries.length === 0 ? <p className="text-sm text-muted-foreground">Ainda não há avaliações publicadas neste período.</p>
        : <ul className="space-y-2">
          {entries.map((grade, index) => <li key={`${grade.trimestre}-${grade.nome}-${index}`}
            className="flex items-start justify-between gap-3 rounded-lg border border-border bg-card px-3 py-2 text-sm">
            <span className="min-w-0">
              <span className="block break-words font-medium text-foreground">{grade.nome}</span>
              {selectedTerm === null && <span className="text-xs text-muted-foreground">{grade.trimestre}.º trimestre</span>}
            </span>
            <span className="shrink-0 font-semibold tabular-nums text-foreground" aria-label={`Nota ${formatPublishedGrade(grade.nota)}`}>
              {formatPublishedGrade(grade.nota)}
            </span>
          </li>)}
        </ul>}
      {!locked && showGrades && entries.length > 0 && !historicalRead && (
        <div className="flex flex-wrap gap-2">
          {onReapreciacao && <button type="button" onClick={() => onReapreciacao(subject)}
            className={`min-h-11 rounded-lg border border-border bg-card px-3 text-sm font-semibold text-foreground hover:bg-muted ${focus}`}>Pedir reapreciação</button>}
          {onMelhoria && <button type="button" onClick={() => onMelhoria(subject)}
            className={`min-h-11 rounded-lg border border-border bg-card px-3 text-sm font-semibold text-foreground hover:bg-muted ${focus}`}>Solicitar melhoria</button>}
        </div>
      )}
    </div>;
  };

  return <section aria-labelledby={`${prefix}-heading`} className="min-w-0 space-y-4" data-testid="aluno-boletim-grid">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div className="min-w-0 space-y-1">
        <h2 id={`${prefix}-heading`} className="text-lg font-semibold tracking-tight text-foreground sm:text-xl">
          Boletim de notas
        </h2>
        <p className="text-sm text-muted-foreground">
          {yearLabel ? `Ano letivo ${yearLabel} · ` : ""}
          {safeSubjects.length} disciplinas{locked ? " · Notas protegidas" : ""}
        </p>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" onClick={() => setShowGrades(visible => !visible)} disabled={locked}
          aria-pressed={valuesVisible} aria-label={locked ? "Exibir notas indisponível até à liberação do boletim" : valuesVisible ? "Ocultar notas" : "Exibir notas"}
          className={`inline-flex min-h-11 items-center gap-2 rounded-lg border border-border bg-card px-3 text-sm font-semibold text-foreground hover:bg-muted disabled:cursor-not-allowed disabled:opacity-60 ${focus}`}>
          {valuesVisible ? <EyeOff aria-hidden="true" className="h-4 w-4" /> : <Eye aria-hidden="true" className="h-4 w-4" />}
          {valuesVisible ? "Ocultar notas" : "Exibir notas"}
        </button>
        <button type="button" disabled={locked || downloading} onClick={onDownload}
          aria-label={locked ? "Imprimir boletim indisponível até à liberação" : "Descarregar boletim em PDF para imprimir"}
          className={`inline-flex min-h-11 items-center gap-2 rounded-lg bg-primary px-3 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-60 ${focus}`}>
          {downloading ? <Loader2 aria-hidden="true" className="h-4 w-4 motion-safe:animate-spin" /> : <Download aria-hidden="true" className="h-4 w-4" />}
          {downloading ? "A preparar PDF…" : "Imprimir / PDF"}
        </button>
      </div>
    </div>

    {locked && <p className="flex items-center gap-2 text-sm text-muted-foreground">
      <LockKeyhole aria-hidden="true" className="h-4 w-4 shrink-0" /> As disciplinas são visíveis. As notas aparecem após a liberação do boletim.
    </p>}
    {!locked && !hasPublishedAssessments && !hasFinals && <p className="text-sm text-muted-foreground">
      Ainda não há avaliações publicadas. Os campos vazios não representam nota zero.
    </p>}
    {!locked && !showGrades && <p role="status" className="text-sm text-muted-foreground">
      As notas estão ocultas neste ecrã; o PDF mantém as classificações autorizadas.
    </p>}
    {downloadError && <p role="alert" className="text-sm text-destructive">{downloadError}</p>}

    <div className="flex w-full flex-wrap gap-1 rounded-xl border border-border bg-muted/40 p-1" role="group" aria-label="Modo de consulta do boletim">
      {([["trimestre", "Por trimestre"], ["disciplina", "Por disciplina"]] as const).map(([id,label]) =>
        <button key={id} type="button" aria-pressed={view === id} onClick={() => selectView(id)}
          className={`min-h-11 flex-1 rounded-lg px-3 text-sm font-semibold ${view === id ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"} ${focus}`}>{label}</button>)}
    </div>

    {loadingSubjects ? <div role="status" aria-live="polite" className="space-y-2">
      <span className="sr-only">A carregar a grelha das disciplinas</span>
      <div aria-hidden="true" className="h-12 rounded-lg bg-muted/70 motion-safe:animate-pulse" />
      <div aria-hidden="true" className="h-44 rounded-lg bg-muted/40 motion-safe:animate-pulse" />
    </div> : subjectsError ? <p role="alert" className="rounded-xl border border-border bg-card px-4 py-3 text-sm text-muted-foreground">
      Não foi possível consultar as disciplinas deste ano letivo. {subjectsError}
    </p> : safeSubjects.length === 0 ? <div className="flex items-start gap-3 rounded-xl border border-border bg-card p-4 text-sm text-muted-foreground">
      <FileText aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" />
      Ainda não há disciplinas associadas a esta matrícula. Contacta a secretaria se esperavas encontrá-las aqui.
    </div> : view === "trimestre" ? <>
      <div className="grid grid-cols-3 gap-2" role="group" aria-label="Selecionar trimestre">
        {[1, 2, 3].map(p => <button type="button" key={p} onClick={() => { setTerm(p); setExpandedId(null); }}
          aria-pressed={term === p}
          className={`min-h-11 rounded-lg border px-1.5 py-2 text-xs font-semibold sm:px-3 sm:text-sm ${term === p ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card text-foreground hover:bg-muted"} ${focus}`}>
          {p}.º trimestre
        </button>)}
      </div>
      <div className="overflow-hidden rounded-xl border border-border bg-card">
        <table className="w-full table-fixed border-collapse">
          <caption className="sr-only">Disciplinas lecionadas e classificação do {term}.º trimestre</caption>
          <colgroup><col style={{ width: "68%" }} /><col style={{ width: "32%" }} /></colgroup>
          <thead className="bg-muted/50"><tr>
            <th scope="col" className="px-3 py-3 text-left text-sm font-semibold text-foreground sm:px-4">Disciplina</th>
            <th scope="col" className="px-2 py-3 text-right text-xs font-semibold text-foreground sm:px-4 sm:text-sm">Classificação</th>
          </tr></thead>
          <tbody className="divide-y divide-border">
            {quarterSubjects.map(subject => {
              const open = expandedId === subject.id;
              const label = `${prefix}-term-${term}-${subject.id}`;
              return <Fragment key={subject.id}>
                <tr key={`${subject.id}-main`}>
                  <th scope="row" className="px-2 py-1 text-left font-normal sm:px-3">
                    <button type="button" onClick={() => setExpandedId(open ? null : subject.id)}
                      aria-expanded={open} aria-controls={label}
                      aria-label={`${open ? "Fechar" : "Ver"} detalhes de ${subject.nome}`}
                      className={`flex min-h-11 w-full items-center gap-2 rounded-lg px-1 py-2 text-left text-sm font-medium text-foreground hover:text-primary ${focus}`}>
                      <ChevronDown aria-hidden="true" className={`h-4 w-4 shrink-0 transition-transform motion-reduce:transition-none ${open ? "rotate-180" : ""}`} />
                      <span className="min-w-0 break-words">{subject.nome}</span>
                    </button>
                  </th>
                  <td className="px-2 py-2 text-right align-middle sm:px-4">
                    <TermValue subject={subject} term={term} locked={locked} showGrades={showGrades} />
                    {isSubjectOffered(subject, term) === null && <span className="block text-[10px] text-muted-foreground">Período por confirmar</span>}
                  </td>
                </tr>
                {open && <tr id={label} key={`${subject.id}-details`} className="bg-muted/20">
                  <td colSpan={2} className="px-4 pb-3">{detail(subject, term)}</td>
                </tr>}
              </Fragment>;
            })}
          </tbody>
        </table>
        {quarterSubjects.length === 0 && <p className="px-4 py-5 text-sm text-muted-foreground">
          Não há disciplinas configuradas para este trimestre.
        </p>}
      </div>
      <p className="text-xs leading-5 text-muted-foreground">
        A classificação apresentada é a do trimestre, não a nota de uma prova. Seleciona uma disciplina para ver as avaliações.
      </p>
    </> : <>
      <label htmlFor={`${prefix}-subject`} className="block text-sm font-medium text-foreground">
        Disciplina
      </label>
      <select id={`${prefix}-subject`} value={selectedSubject?.id ?? ""} onChange={e => { setSelectedSubjectId(e.target.value); setExpandedId(null); }}
        className={`min-h-11 w-full rounded-lg border border-border bg-card px-3 text-sm text-foreground ${focus}`}>
        {safeSubjects.map(subject => <option key={subject.id} value={subject.id}>{subject.nome}</option>)}
      </select>
      {selectedSubject && <div className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-card">
        {[1, 2, 3].map(p => {
          const offered = isSubjectOffered(selectedSubject, p);
          const open = expandedId === `${selectedSubject.id}:${p}`;
          const label = `${prefix}-annual-${selectedSubject.id}-${p}`;
          return <div key={p} className="px-3 py-3 sm:px-4">
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0 space-y-0.5">
                <p className="text-sm font-semibold text-foreground">{p}.º trimestre</p>
                <p className="text-xs text-muted-foreground">
                  {offered === false ? "Disciplina não lecionada neste período"
                    : offered === null ? "Período por confirmar" : "Disciplina lecionada"}
                </p>
              </div>
              <div className="min-w-0 text-right">
                <TermValue subject={selectedSubject} term={p} locked={locked} showGrades={showGrades} />
              </div>
            </div>
            {offered !== false && <button type="button" aria-expanded={open} aria-controls={label}
              onClick={() => setExpandedId(open ? null : `${selectedSubject.id}:${p}`)}
              className={`mt-1 inline-flex min-h-11 items-center gap-1 text-xs font-semibold text-primary ${focus}`}>
              {open ? "Fechar avaliações" : "Ver avaliações"}
              <ChevronDown aria-hidden="true" className={`h-4 w-4 transition-transform ${open ? "rotate-180" : ""}`} />
            </button>}
            {open && offered !== false && <div id={label}>{detail(selectedSubject, p)}</div>}
          </div>;
        })}
      </div>}
      <p className="text-xs leading-5 text-muted-foreground">
        A vista anual mostra os trimestres de cada disciplina, incluindo aqueles em que não foi lecionada. Não são calculadas médias anuais.
      </p>
    </>}
  </section>;
}
