"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { AlertCircle, ArrowRight, BookOpen, CheckCircle2, RefreshCw } from "lucide-react";
import type { BalcaoActionId } from "@/lib/balcao/action-registry";
import { BalcaoHistoricalAcademicRecovery } from "@/components/secretaria/BalcaoHistoricalAcademicRecovery";
import { BalcaoPautaGrid } from "@/components/secretaria/BalcaoPautaGrid";
import { BalcaoPautaSourceClassPicker } from "@/components/secretaria/BalcaoPautaSourceClassPicker";
import { BalcaoEnrollmentCorrection } from "@/components/secretaria/BalcaoEnrollmentCorrection";
import {
  hasHistoricalPending, resolveStudentYearSituation,
  type SituacaoBalcaoPayload, type SituacaoBalcaoRow,
} from "@/lib/balcao/student-year-situation";

type Result = { key: string; loading: boolean; data: SituacaoBalcaoPayload | null; error: string | null };

/** Re-reads the year-specific SSOT. No student/academic-year snapshots may cross a selection. */
export function useBalcaoSituacaoAcademica(
  escolaId: string, alunoId: string | null, anoLetivoId: string | null, enabled: boolean,
) {
  // School scope belongs to the cache identity even if the selected student
  // or academic year happens to have an identical identifier on tenant switch.
  const key = enabled && escolaId && alunoId && anoLetivoId
    ? escolaId + ":" + alunoId + ":" + anoLetivoId : null;
  const requestSeq = useRef(0);
  const [snapshot, setSnapshot] = useState<Result | null>(null);

  const refresh = useCallback(async (signal?: AbortSignal) => {
    if (!key || !alunoId || !anoLetivoId) return;
    const seq = ++requestSeq.current;
    setSnapshot((current) => ({ key, loading: true,
      data: current?.key === key ? current.data : null, error: null }));
    try {
      const params = new URLSearchParams({ aluno_id: alunoId, ano_letivo_id: anoLetivoId });
      const response = await fetch("/api/secretaria/balcao/situacao-academica?" + params, {
        cache: "no-store", signal,
      });
      const payload = await response.json();
      if (!response.ok || payload?.ok !== true || payload?.aluno_id !== alunoId ||
          payload?.ano?.id !== anoLetivoId) {
        throw new Error(payload?.error || "Não foi possível verificar a situação académica.");
      }
      if (seq === requestSeq.current && !signal?.aborted) {
        setSnapshot({ key, loading: false, data: payload as SituacaoBalcaoPayload, error: null });
      }
    } catch (cause) {
      if (seq === requestSeq.current && !signal?.aborted) {
        setSnapshot({ key, loading: false, data: null,
          error: cause instanceof Error ? cause.message : "Falha na consulta." });
      }
    }
  }, [alunoId, anoLetivoId, key]);

  useEffect(() => {
    const controller = new AbortController();
    if (key) void refresh(controller.signal);
    return () => { controller.abort(); requestSeq.current += 1; };
  }, [key, refresh]);

  return {
    data: snapshot?.key === key ? snapshot.data : null,
    loading: Boolean(key) && (snapshot?.key !== key || snapshot.loading),
    error: snapshot?.key === key ? snapshot.error : null,
    refresh,
  };
}

export function BalcaoSituacaoAcademica({
  snapshot, loading, error, refresh, onNavigate, onCurrentGrade, onHistoricalGrade, hasFinancialPending,
  pendingSourceMatriculaId, pendingDisciplines, onAcademicUpdated, onContinueEnrollment, canContinueEnrollment, onRegularizeDebt, percurso, percursoBusy = false,
}: {
  snapshot: SituacaoBalcaoPayload | null;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<unknown>;
  onNavigate?: (action: BalcaoActionId) => void;
  onCurrentGrade: (row: SituacaoBalcaoRow, disciplinaId?: string | null) => void;
  onHistoricalGrade: (row: SituacaoBalcaoRow, disciplinaId?: string | null) => void;
  hasFinancialPending?: boolean;
  pendingSourceMatriculaId?: string | null;
  pendingDisciplines?: Array<{ id: string; nome: string; status: string | null }>;
  onAcademicUpdated?: () => Promise<unknown>;
  onContinueEnrollment?: () => void;
  /** From the server's verified rematrícula status (READY), not from grades or payment assumptions. */
  canContinueEnrollment?: boolean;
  onRegularizeDebt?: () => void;
  percurso?: import("react").ReactNode;
  percursoBusy?: boolean;
}) {
  const situation = snapshot ? resolveStudentYearSituation(snapshot, Boolean(canContinueEnrollment && onContinueEnrollment)) : null;
  const current = snapshot?.current ?? null;
  const previous = snapshot?.previous ?? null;
  const previousPending = snapshot ? hasHistoricalPending(snapshot) : false;
  // The server scopes the allowed
  // previous-year matricula to the authenticated academic role; the RPC
  // independently checks this again before any historical write.
  const historicalTarget = [current, previous].find((row) =>
    row?.matricula_id === snapshot?.editable_historical_matricula_id) ?? null;
  // Review the exact persisted enrollment; never infer a source from another
  // student's dossier or depend on a conditionally mounted Catalogo panel.
  const historicalReviewTarget = previousPending && previous?.matricula_id ? previous
    : current && ["regularizacao_historica", "ano_encerrado"].includes(current.situacao_contextual) &&
      current.situacao_resultado !== "homologado" ? current : null;
  const [gridBusy, setPautaBusy] = useState(false);
  const pautaBusy = gridBusy || percursoBusy;
  const pautaRef = useRef<HTMLDivElement>(null);
  const [reviewOpenFor, setReviewOpenFor] = useState<string | null>(null);
  const reviewOpen = Boolean(historicalReviewTarget &&
    reviewOpenFor === historicalReviewTarget.matricula_id);
  const confirmedPendingRow = [previous, current].find((row) =>
    row?.matricula_id === pendingSourceMatriculaId) ?? null;
  const visiblePending = confirmedPendingRow && Array.isArray(pendingDisciplines)
    ? pendingDisciplines.filter((item) => item.id && item.nome?.trim()) : [];

  const openHistoricalReview = () => {
    if (historicalReviewTarget?.matricula_id) setReviewOpenFor(historicalReviewTarget.matricula_id);
  };

  const runAction = () => {
    if (loading || !snapshot || !situation) return;
    switch (situation.action) {
      case "grade":
        if (current && snapshot.can_write_current_grades) onCurrentGrade(current);
        break;
      case "enrollment":
      case "profile":
        onNavigate?.(situation.action);
        break;
      case "reenrollment": {
        if (!current && previous && snapshot.ano.ativo && canContinueEnrollment && onContinueEnrollment) {
          onContinueEnrollment();
          break;
        }
        if (previousPending && historicalReviewTarget) {
          openHistoricalReview();
          break;
        }
        const target = document.querySelector<HTMLElement>('[data-balcao-action="reenrollment"]');
        if (target) target.scrollIntoView({ behavior: "smooth", block: "start" });
        else onNavigate?.("profile"); // Never create a new enrollment in place of a real previous record.
        break;
      }
      case "historical":
        // One click opens the existing single-student pauta editor, even when
        // the source enrollment is in 2025 and the selected view is 2026.
        // The server's exact authorized historic enrollment is the only target.
        if (historicalTarget) onHistoricalGrade(historicalTarget);
        else openHistoricalReview();
        break;
    }
  };

  const previousYearReady = Boolean(historicalTarget && previousPending && previous &&
    historicalTarget.matricula_id === previous.matricula_id);
  const gradeCandidate = historicalTarget ?? (snapshot?.can_write_current_grades ? current : null);
  const inlineTarget = gradeCandidate?.turma_id && gradeCandidate.ano_letivo_id ? gradeCandidate : null;
  const historicalIsQualitative = snapshot?.historical_evaluation_scale === "qualitativa";
  const mainLabel = situation?.action === "historical" && historicalTarget
    ? "Lançar notas de " + historicalTarget.ano_letivo
    : situation?.action === "historical" ? historicalIsQualitative
      ? "Validar avaliação qualitativa de " + historicalReviewTarget?.ano_letivo
      : situation.actionLabel || "Ver regularização"
    : situation?.action === "grade" ? "Lançar notas de " + current?.ano_letivo
    : situation?.action === "reenrollment" && !current &&
      previous
      ? canContinueEnrollment && onContinueEnrollment
        ? "Concluir rematrícula de " + snapshot?.ano.ano
        : "Ver pendências da rematrícula"
    : situation?.actionLabel;
  const mainActionIsAvailable = Boolean(canContinueEnrollment && onContinueEnrollment) || situation?.action === "grade" ||
    (situation?.action === "historical" && Boolean(historicalReviewTarget || historicalTarget)) ||
    Boolean(onNavigate);

  return (
    <section aria-label="Estado do aluno no ano letivo" className="mb-4 rounded-xl border border-border bg-card p-4 sm:p-5">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-xs font-medium text-muted-foreground">Situação académica</p>
          <h3 className="mt-1 font-sora text-base font-semibold text-emerald">
            {loading ? "A consultar vínculo escolar…" : error ? "Situação indisponível" : situation?.title ?? "A verificar situação"}
          </h3>
        </div>
        <button type="button" onClick={() => void refresh()} disabled={loading || pautaBusy}
          aria-label="Atualizar situação académica"
          className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-border bg-background px-3 py-2 text-xs font-medium hover:bg-muted disabled:opacity-60">
          <RefreshCw className={"h-4 w-4 " + (loading ? "animate-spin" : "")} aria-hidden="true" />
          Atualizar
        </button>
      </div>

      {error ? (
        <p role="alert" className="mt-3 flex items-center gap-2 text-xs text-rose-700">
          <AlertCircle className="h-4 w-4 shrink-0" />{error}
        </p>
      ) : snapshot && situation ? (
        <>
          <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
            <span className="rounded-full bg-muted px-3 py-1.5 font-medium">{snapshot.ano.label}</span>
            {current?.situacao_resultado === "homologado" ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald/10 px-3 py-1.5 text-emerald">
                <CheckCircle2 className="h-3.5 w-3.5" /> Resultado oficial
              </span>
            ) : current && !snapshot.ano.ativo ? (
              <span className="rounded-full bg-amber/10 px-3 py-1.5 font-medium text-foreground">
                Resultado académico por verificar
              </span>
            ) : null}
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            {!inlineTarget && previousYearReady && situation.action !== "historical" && !canContinueEnrollment && historicalTarget && previous && (
              <button type="button" onClick={() => onHistoricalGrade(historicalTarget)}
                disabled={loading || pautaBusy}
                className="inline-flex min-h-10 items-center gap-2 rounded-xl bg-amber px-4 py-2 text-xs font-semibold text-white hover:brightness-95 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-amber/20 disabled:opacity-60">
                <BookOpen className="h-4 w-4" aria-hidden="true" />
                Lançar notas de {previous.ano_letivo}<ArrowRight className="h-4 w-4" aria-hidden="true" />
              </button>
            )}
            {situation.action && mainLabel && mainActionIsAvailable &&
              !(inlineTarget && ["historical", "grade"].includes(situation.action)) && (
              <button type="button" onClick={runAction} disabled={loading || pautaBusy}
                className={!inlineTarget && previousYearReady && situation.action !== "historical"
                  ? "inline-flex min-h-10 items-center gap-2 rounded-xl border border-border bg-background px-4 py-2 text-xs font-semibold text-foreground hover:bg-muted disabled:opacity-60"
                  : "inline-flex min-h-10 items-center gap-2 rounded-xl bg-amber px-4 py-2 text-xs font-semibold text-white hover:brightness-95 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-amber/20 disabled:opacity-60"}>
                {(situation.action === "grade" || situation.action === "historical") &&
                  <BookOpen className="h-4 w-4" aria-hidden="true" />}
                {mainLabel}<ArrowRight className="h-4 w-4" aria-hidden="true" />
              </button>
            )}
            {!percurso && historicalReviewTarget && (inlineTarget || (!historicalTarget && situation.action !== "historical")) && (
              <button type="button" onClick={openHistoricalReview} disabled={loading || pautaBusy}
                className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-border bg-background px-3 py-2 text-xs font-semibold hover:bg-muted disabled:opacity-60">
                {historicalIsQualitative
                  ? "Validar avaliação qualitativa de " + historicalReviewTarget.ano_letivo
                  : <>Validar resultado de {historicalReviewTarget.ano_letivo}</>}
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </button>
            )}
            {hasFinancialPending && onNavigate && (
              <button type="button" onClick={() => onRegularizeDebt ? onRegularizeDebt() : onNavigate("payment")} disabled={pautaBusy}
                className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-amber/40 px-4 py-2 text-xs font-semibold hover:bg-muted">
                Regularizar pagamentos<ArrowRight className="h-4 w-4" />
              </button>
            )}
          </div>
          {snapshot.can_rectify_class && current?.matricula_id && current.turma_id &&
            current.ano_letivo_id && (
            <fieldset disabled={pautaBusy} aria-label="Corrigir classe da matrícula">
              <BalcaoEnrollmentCorrection
                key={[snapshot.aluno_id, current.matricula_id, current.turma_id].join(":")}
                matriculaId={current.matricula_id}
                alunoId={snapshot.aluno_id}
                turmaId={current.turma_id}
                anoLetivoId={current.ano_letivo_id}
                onSaved={async () => {
                  await Promise.allSettled([refresh(), onAcademicUpdated?.()]);
                }}
              />
            </fieldset>
          )}
          {!percurso && previousPending && historicalTarget && previous &&
            snapshot.historical_evaluation_scale?.startsWith("quantitativa") && (
            <fieldset disabled={pautaBusy} aria-label="Corrigir turma da pauta">
            <BalcaoPautaSourceClassPicker
              key={historicalTarget.matricula_id}
              matriculaId={historicalTarget.matricula_id}
              alunoId={snapshot.aluno_id}
              onSaved={async () => {
                await Promise.allSettled([refresh(), onAcademicUpdated?.()]);
                // The refreshed source remounts the inline pauta for the corrected turma.
              }}
            />
            </fieldset>
          )}
          {reviewOpen && historicalReviewTarget && (
            <fieldset disabled={pautaBusy} id="balcao-historico-contextual" className="mt-4 border-t border-border pt-4">
              <BalcaoHistoricalAcademicRecovery
                key={historicalReviewTarget.matricula_id}
                matriculaId={historicalReviewTarget.matricula_id}
                turmaId={historicalReviewTarget.turma_id}
                disciplinasPendentes={confirmedPendingRow?.matricula_id === historicalReviewTarget.matricula_id
                  ? visiblePending.map((item) => item.id) : []}
                onRecheck={async () => { await refresh(); await onAcademicUpdated?.(); }}
                onLancarNotaHistorica={(disciplinaId) => {
                  if (inlineTarget?.matricula_id === historicalReviewTarget.matricula_id) {
                    pautaRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
                    pautaRef.current?.querySelector<HTMLInputElement>("input:not(:disabled)")?.focus({ preventScroll: true });
                  } else onHistoricalGrade(historicalReviewTarget, disciplinaId);
                }}
              />
            </fieldset>
          )}
          {percurso}
          {(!percurso || inlineTarget?.matricula_id === current?.matricula_id) && inlineTarget?.turma_id && inlineTarget.ano_letivo_id && (
            <div ref={pautaRef}><BalcaoPautaGrid
              key={[inlineTarget.escola_id, inlineTarget.aluno_id, inlineTarget.matricula_id,
                inlineTarget.turma_id, inlineTarget.ano_letivo_id].join(":")}
              escolaId={inlineTarget.escola_id} alunoId={inlineTarget.aluno_id}
              matriculaId={inlineTarget.matricula_id} turmaId={inlineTarget.turma_id}
              anoLetivoId={inlineTarget.ano_letivo_id} ano={inlineTarget.ano_letivo}
              historical={inlineTarget.matricula_id === historicalTarget?.matricula_id}
              onDirtyChange={setPautaBusy}
              onSaved={async () => { await onAcademicUpdated?.(); await refresh(); }}
            /></div>
          )}
          {!inlineTarget && visiblePending.length > 0 && confirmedPendingRow && (
            <div className="mt-4 rounded-xl border border-border p-3">
              <p className="text-xs font-semibold text-foreground">
                Disciplinas pendentes · {confirmedPendingRow.ano_letivo} ({visiblePending.length})
              </p>
              <ul className="mt-2 space-y-2">
                {visiblePending.map((item) => {
                  const canWriteHistorical = historicalTarget?.matricula_id === confirmedPendingRow.matricula_id;
                  const canWriteCurrent = snapshot.can_write_current_grades &&
                    current?.matricula_id === confirmedPendingRow.matricula_id;
                  return (
                    <li key={item.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-muted/40 px-3 py-2">
                      <span className="min-w-0 text-sm font-medium text-foreground">{item.nome}</span>
                      {canWriteHistorical && historicalTarget ? (
                        <button type="button" disabled={loading || pautaBusy}
                          onClick={() => onHistoricalGrade(historicalTarget, item.id)}
                          className="rounded-xl border border-border bg-background px-3 py-2 text-xs font-semibold hover:bg-muted disabled:opacity-60">
                          Lançar nota
                        </button>
                      ) : canWriteCurrent && current ? (
                        <button type="button" disabled={loading || pautaBusy}
                          onClick={() => onCurrentGrade(current, item.id)}
                          className="rounded-xl border border-border bg-background px-3 py-2 text-xs font-semibold hover:bg-muted disabled:opacity-60">
                          Lançar nota
                        </button>
                      ) : historicalReviewTarget?.matricula_id === confirmedPendingRow.matricula_id ? (
                        <button type="button" disabled={loading || pautaBusy} onClick={openHistoricalReview}
                          className="rounded-xl border border-border bg-background px-3 py-2 text-xs font-semibold hover:bg-muted disabled:opacity-60">
                          Rever
                        </button>
                      ) : null}
                    </li>
                  );
                })}
              </ul>
            </div>
          )}

        </>
      ) : (
        <p role="status" className="mt-2 text-xs text-muted-foreground">
          {loading ? "A validar matrícula, histórico e ano letivo." : "Selecione um ano letivo válido."}
        </p>
      )}
    </section>
  );
}
