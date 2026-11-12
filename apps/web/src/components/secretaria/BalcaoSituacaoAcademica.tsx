"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { AlertCircle, ArrowRight, BookOpen, CheckCircle2, RefreshCw } from "lucide-react";
import type { BalcaoActionId } from "@/lib/balcao/action-registry";
import {
  hasHistoricalPending, resolveStudentYearSituation,
  type SituacaoBalcaoPayload, type SituacaoBalcaoRow,
} from "@/lib/balcao/student-year-situation";

type Result = { key: string; loading: boolean; data: SituacaoBalcaoPayload | null; error: string | null };

/** Re-reads the year-specific SSOT. No student/academic-year snapshots may cross a selection. */
export function useBalcaoSituacaoAcademica(
  alunoId: string | null, anoLetivoId: string | null, enabled: boolean,
) {
  const key = enabled && alunoId && anoLetivoId ? alunoId + ":" + anoLetivoId : null;
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
}: {
  snapshot: SituacaoBalcaoPayload | null;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<unknown>;
  onNavigate?: (action: BalcaoActionId) => void;
  onCurrentGrade: (row: SituacaoBalcaoRow) => void;
  onHistoricalGrade: (row: SituacaoBalcaoRow) => void;
  hasFinancialPending?: boolean;
}) {
  const situation = snapshot ? resolveStudentYearSituation(snapshot) : null;
  const current = snapshot?.current ?? null;
  const previous = snapshot?.previous ?? null;
  const previousPending = snapshot ? hasHistoricalPending(snapshot) : false;
  // The existing notes modal is the only editor. The server scopes the allowed
  // previous-year matricula to the authenticated academic role; the RPC
  // independently checks this again before any historical write.
  const historicalTarget = [current, previous].find((row) =>
    row?.matricula_id === snapshot?.editable_historical_matricula_id) ?? null;

  const openHistoricalReview = () => {
    const existing = document.getElementById("balcao-historical-recovery-existing");
    if (existing) existing.scrollIntoView({ behavior: "smooth", block: "start" });
    else onNavigate?.("profile");
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
        const target = document.querySelector<HTMLElement>('[data-balcao-action="reenrollment"]');
        if (target) target.scrollIntoView({ behavior: "smooth", block: "start" });
        else onNavigate?.("enrollment");
        break;
      }
      case "historical":
        if (historicalTarget && historicalTarget.matricula_id === current?.matricula_id)
          onHistoricalGrade(historicalTarget);
        else openHistoricalReview();
        break;
    }
  };

  const mainLabel = situation?.action === "historical" && historicalTarget?.matricula_id === current?.matricula_id
    ? "Lançar notas de " + current?.ano_letivo
    : situation?.action === "historical" ? "Ver regularização" : situation?.actionLabel;
  const mainActionIsAvailable = situation?.action === "grade" || situation?.action === "historical" ||
    Boolean(onNavigate);

  return (
    <section aria-label="Estado do aluno no ano letivo" className="mb-4 rounded-xl border border-border bg-card p-4 sm:p-5">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-xs font-medium text-muted-foreground">Estado do aluno · Ano letivo selecionado</p>
          <h3 className="mt-1 font-sora text-base font-semibold text-emerald">
            {loading ? "A consultar vínculo escolar…" : error ? "Situação indisponível" : situation?.title ?? "A verificar situação"}
          </h3>
        </div>
        <button type="button" onClick={() => void refresh()} disabled={loading}
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
          <p className="mt-2 text-sm text-muted-foreground">{situation.description}</p>
          <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
            <span className="rounded-full bg-muted px-3 py-1.5 font-medium">{snapshot.ano.label}</span>
            <span className="rounded-full bg-muted px-3 py-1.5 font-medium">
              {current ? "Matrícula: " + (current.status_persistido ?? "em revisão") : "Sem matrícula neste ano"}
            </span>
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
            {situation.action && mainLabel && mainActionIsAvailable && (
              <button type="button" onClick={runAction} disabled={loading}
                className="inline-flex min-h-10 items-center gap-2 rounded-xl bg-amber px-4 py-2 text-xs font-semibold text-white hover:brightness-95 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-amber/20 disabled:opacity-60">
                {(situation.action === "grade" || situation.action === "historical") &&
                  <BookOpen className="h-4 w-4" aria-hidden="true" />}
                {mainLabel}<ArrowRight className="h-4 w-4" aria-hidden="true" />
              </button>
            )}
            {historicalTarget && previousPending && previous &&
              historicalTarget.matricula_id === previous.matricula_id && (
              <button type="button" onClick={() => onHistoricalGrade(historicalTarget)}
                disabled={loading}
                className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-amber/40 px-4 py-2 text-xs font-semibold hover:bg-muted disabled:opacity-60">
                Lançar notas de {previous.ano_letivo}<ArrowRight className="h-4 w-4" aria-hidden="true" />
              </button>
            )}
            {hasFinancialPending && onNavigate && (
              <button type="button" onClick={() => onNavigate("payment")}
                className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-amber/40 px-4 py-2 text-xs font-semibold hover:bg-muted">
                Regularizar pagamentos<ArrowRight className="h-4 w-4" />
              </button>
            )}
          </div>
          {previousPending && !historicalTarget && previous && (
            <p role="status" className="mt-3 text-xs text-muted-foreground">
              {previous.ano_letivo}: resultado anterior por regularizar. A correção requer um vínculo elegível e um operador autorizado.
            </p>
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
