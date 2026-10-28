"use client";

import { Fragment, useEffect, useId, useMemo, useState } from "react";
import { ChevronDown, Download, Eye, EyeOff, FileText, Loader2, LockKeyhole } from "lucide-react";
import {
  availablePeriods,
  formatPublishedGrade,
  periodAssessments,
  type GradeSubject,
} from "@/lib/aluno/gradesPresentation";

type Props = {
  /** Subjects come from the authorized enrolment. Scores must never be supplied when locked. */
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

/**
 * A gradebook, not a paywall disguised as grade data:
 * - the curriculum is visible independently of grade-payment access;
 * - locked cells contain NO score, fabricated score, average or CSS-blurred number;
 * - a user may hide already-authorized scores without affecting server permissions;
 * - scores are never averaged or inferred from incomplete assessment records.
 */
export function BoletimGradeGrid({
  subjects,
  locked,
  scope,
  yearLabel,
  loadingSubjects = false,
  subjectsError = null,
  historicalRead = false,
  downloading = false,
  downloadError = null,
  onDownload,
  onReapreciacao,
  onMelhoria,
}: Props) {
  const prefix = useId().replace(/:/g, "");
  const [showGrades, setShowGrades] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    // A mudança de aluno ou ano fecha detalhes do registo anterior.
    setExpandedId(null);
    setShowGrades(true);
  }, [scope]);

  // Respect the grade API's explicit gate even if a caller accidentally supplies scores.
  const safeSubjects = useMemo(() => subjects.map((subject) => ({
    id: subject.id,
    nome: subject.nome,
    avaliacoes: locked ? [] : subject.avaliacoes,
  })), [subjects, locked]);

  const publishedPeriods = availablePeriods(safeSubjects);
  // The three trimester columns are visual placeholders, not claims that
  // grades or even an assessment have been published in those periods.
  const periods = [...new Set([1, 2, 3, ...publishedPeriods])].sort((a, b) => a - b);
  const valuesVisible = !locked && showGrades;
  const hasPublishedAssessments = safeSubjects.some((s) => s.avaliacoes.length > 0);
  const tableMinWidth = periods.length > 3 ? "min-w-[540px]" : "min-w-0";

  return (
    <section aria-labelledby={`${prefix}-heading`} className="min-w-0 space-y-3" data-testid="aluno-boletim-grid">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 space-y-1">
          <h2 id={`${prefix}-heading`} className="text-lg font-semibold tracking-tight text-foreground sm:text-xl">
            Boletim de notas
          </h2>
          <p className="text-sm text-muted-foreground">
            {yearLabel ? `Ano letivo ${yearLabel} · ` : ""}
            {safeSubjects.length} disciplinas
            {locked ? " · Notas protegidas" : !hasPublishedAssessments ? " · Sem avaliações publicadas" : ""}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" onClick={() => setShowGrades((visible) => !visible)}
            disabled={locked}
            aria-pressed={valuesVisible}
            aria-label={locked ? "Exibir notas indisponível até à liberação do boletim" : valuesVisible ? "Ocultar notas" : "Exibir notas"}
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
        <LockKeyhole aria-hidden="true" className="h-4 w-4 shrink-0" />
        As disciplinas são visíveis. As notas só aparecem após a liberação do boletim.
      </p>}
      {!locked && !hasPublishedAssessments && <p className="text-sm text-muted-foreground">
        Ainda não há avaliações publicadas. Os campos vazios não representam nota zero.
      </p>}
      {!locked && !showGrades && <p role="status" className="text-sm text-muted-foreground">
        As notas estão ocultas apenas neste ecrã. O PDF continua a conter as avaliações autorizadas.
      </p>}
      {downloadError && <p role="alert" className="text-sm text-destructive">{downloadError}</p>}

      {loadingSubjects ? (
        <div role="status" aria-live="polite" className="space-y-2">
          <span className="sr-only">A carregar a grelha das disciplinas</span>
          <div aria-hidden="true" className="h-12 rounded-lg bg-muted/70 motion-safe:animate-pulse" />
          <div aria-hidden="true" className="h-44 rounded-lg bg-muted/40 motion-safe:animate-pulse" />
        </div>
      ) : subjectsError ? (
        <p role="alert" className="rounded-xl border border-border bg-card px-4 py-3 text-sm text-muted-foreground">
          Não foi possível consultar as disciplinas deste ano letivo. {subjectsError}
        </p>
      ) : safeSubjects.length === 0 ? (
        <div className="flex items-start gap-3 rounded-xl border border-border bg-card p-4 text-sm text-muted-foreground">
          <FileText aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" />
          Ainda não há disciplinas associadas a esta matrícula. Contacta a secretaria se esperavas encontrá-las aqui.
        </div>
      ) : (
        <div className={`overflow-x-auto rounded-xl border border-border bg-card ${tableMinWidth === "min-w-0" ? "" : ""}`}>
          <table className={`w-full table-fixed border-collapse ${tableMinWidth}`}>
            <caption className="sr-only">Grelha de disciplinas e notas por trimestre</caption>
            <colgroup>
              <col style={{ width: periods.length > 3 ? "36%" : "46%" }} />
              {periods.map((p) => <col key={p} style={{ width: `${(periods.length > 3 ? 64 : 54) / periods.length}%` }} />)}
            </colgroup>
            <thead className="bg-muted/50">
              <tr>
                <th scope="col" className="px-3 py-3 text-left text-xs font-semibold text-foreground sm:px-4 sm:text-sm">Disciplina</th>
                {periods.map((p) => <th scope="col" key={p} className="px-1 py-3 text-center text-xs font-semibold text-foreground sm:px-3 sm:text-sm">
                  {p}.º T
                </th>)}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {safeSubjects.map((disc) => {
                const open = expandedId === disc.id;
                const panelId = `${prefix}-details-${disc.id}`;
                const published = disc.avaliacoes.filter((item) => Number.isFinite(item.nota));
                return <Fragment key={disc.id}>
                  <tr className={open ? "bg-muted/20" : undefined}>
                    <th scope="row" className="px-2 py-1 text-left font-normal sm:px-3">
                      <button type="button" onClick={() => setExpandedId(open ? null : disc.id)}
                        aria-expanded={open} aria-controls={panelId}
                        aria-label={`${open ? "Fechar" : "Ver"} detalhes de ${disc.nome}`}
                        className={`flex min-h-11 w-full min-w-0 items-center gap-1.5 rounded-md px-1 py-1 text-left text-xs font-medium leading-5 text-foreground hover:text-primary sm:text-sm ${focus}`}>
                        <ChevronDown aria-hidden="true" className={`h-4 w-4 shrink-0 transition-transform motion-reduce:transition-none ${open ? "rotate-180" : ""}`} />
                        <span className="min-w-0 break-words">{disc.nome}</span>
                      </button>
                    </th>
                    {periods.map((p) => {
                      const grades = periodAssessments(disc, p);
                      return <td key={p} className="px-1 py-2 text-center align-middle sm:px-2">
                        {locked ? (
                          <span className="inline-flex items-center justify-center" aria-label="Notas protegidas">
                            <LockKeyhole aria-hidden="true" className="h-4 w-4 text-muted-foreground/70" />
                          </span>
                        ) : !showGrades ? (
                          <span className="inline-flex items-center justify-center" aria-label="Notas ocultadas">
                            <EyeOff aria-hidden="true" className="h-4 w-4 text-muted-foreground" />
                          </span>
                        ) : grades.length === 0 ? (
                          <span className="text-sm text-muted-foreground" aria-label="Sem avaliações publicadas">—</span>
                        ) : (
                          <span className="flex flex-wrap items-center justify-center gap-1" aria-label={`${grades.length} avaliações publicadas`}>
                            {grades.slice(0, 2).map((grade, index) => (
                              <span key={index} className="rounded-md bg-muted px-1.5 py-1 text-xs font-semibold tabular-nums text-foreground sm:text-sm">
                                {formatPublishedGrade(grade.nota)}
                              </span>
                            ))}
                            {grades.length > 2 && <span className="text-xs text-muted-foreground">+{grades.length - 2}</span>}
                          </span>
                        )}
                      </td>;
                    })}
                  </tr>
                  {open && <tr id={panelId} className="bg-muted/20">
                    <td colSpan={periods.length + 1} className="px-4 pb-4 pt-1">
                      {locked ? <p className="text-sm text-muted-foreground">As notas ainda estão protegidas. Consulta o estado do pedido abaixo.</p>
                      : !showGrades ? <p className="text-sm text-muted-foreground">Seleciona «Exibir notas» para consultar as avaliações.</p>
                      : published.length === 0 ? <p className="text-sm text-muted-foreground">Ainda não há avaliações publicadas nesta disciplina.</p>
                      : <div className="space-y-3">
                        <ul className="grid gap-2 sm:grid-cols-2">
                          {published.map((avaliacao, index) => (
                            <li key={`${avaliacao.trimestre}-${avaliacao.nome}-${index}`}
                              className="flex min-w-0 items-start justify-between gap-3 rounded-lg border border-border bg-card px-3 py-2 text-sm">
                              <div className="min-w-0"><p className="break-words font-medium text-foreground">{avaliacao.nome}</p>
                                <p className="text-xs text-muted-foreground">{avaliacao.trimestre}.º trimestre</p></div>
                              <span className="shrink-0 font-semibold tabular-nums text-foreground" aria-label={`Nota ${formatPublishedGrade(avaliacao.nota)}`}>
                                {formatPublishedGrade(avaliacao.nota)}
                              </span>
                            </li>
                          ))}
                        </ul>
                        {!historicalRead && <div className="flex flex-wrap gap-2">
                          {onReapreciacao && <button type="button" onClick={() => onReapreciacao(disc)}
                            className={`min-h-11 rounded-lg border border-border bg-card px-3 text-sm font-semibold text-foreground hover:bg-muted ${focus}`}>Pedir reapreciação</button>}
                          {onMelhoria && <button type="button" onClick={() => onMelhoria(disc)}
                            className={`min-h-11 rounded-lg border border-border bg-card px-3 text-sm font-semibold text-foreground hover:bg-muted ${focus}`}>Solicitar melhoria</button>}
                        </div>}
                      </div>}
                    </td>
                  </tr>}
                </Fragment>;
              })}
            </tbody>
          </table>
        </div>
      )}
      <p className="text-xs leading-5 text-muted-foreground">
        Os valores são avaliações lançadas pela escola, não médias calculadas. Seleciona uma disciplina para consultar os detalhes.
      </p>
    </section>
  );
}
