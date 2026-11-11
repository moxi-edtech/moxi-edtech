"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { AlertCircle, ArrowRight, BookOpen, CheckCircle2, RefreshCw } from "lucide-react";
import type { BalcaoActionId } from "@/lib/balcao/action-registry";
import {
  hasHistoricalPending, resolveStudentYearSituation,
  type SituacaoBalcaoPayload, type SituacaoBalcaoRow,
} from "@/lib/balcao/student-year-situation";
import { BalcaoHistoricalAcademicRecovery } from "@/components/secretaria/BalcaoHistoricalAcademicRecovery";

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
    setSnapshot({ key, loading: true, data: null, error: null });
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
  alunoId, snapshot, loading, error, refresh, onNavigate, onCurrentGrade, onHistoricalGrade, onAcademicUpdated,
}: {
  alunoId: string;
  snapshot: SituacaoBalcaoPayload | null;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<unknown>;
  onNavigate?: (action: BalcaoActionId) => void;
  onCurrentGrade: (row: SituacaoBalcaoRow) => void;
  onHistoricalGrade: (row: SituacaoBalcaoRow, disciplinaId?: string | null) => void;
  onAcademicUpdated: () => void;
}) {
  const situation = snapshot ? resolveStudentYearSituation(snapshot) : null;
  const current = snapshot?.current ?? null;
  const previous = snapshot?.previous ?? null;
  const historical = current && situation?.action === "historical" ? current : null;
  const previousPending = snapshot ? hasHistoricalPending(snapshot) : false;

  const runAction = () => {
    if (!snapshot || !situation) return;
    switch (situation.action) {
      case "grade":
        if (current && snapshot.can_write_current_grades) onCurrentGrade(current);
        break;
      case "enrollment":
      case "profile":
        onNavigate?.(situation.action);
        break;
      case "reenrollment":
        document.querySelector<HTMLElement>('[data-balcao-action="reenrollment"]')
          ?.scrollIntoView({ behavior: "smooth", block: "start" });
        break;
      case "historical":
        document.getElementById("balcao-historico-contextual")
          ?.scrollIntoView({ behavior: "smooth", block: "start" });
        break;
    }
  };

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
            {situation.action && situation.actionLabel && (
              <button type="button" onClick={runAction}
                className="inline-flex min-h-10 items-center gap-2 rounded-xl bg-amber px-4 py-2 text-xs font-semibold text-white hover:brightness-95 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-amber/20">
                {situation.action === "grade" && <BookOpen className="h-4 w-4" aria-hidden="true" />}
                {situation.actionLabel}<ArrowRight className="h-4 w-4" aria-hidden="true" />
              </button>
            )}
            {previousPending && !historical && (
              <button type="button" onClick={() => document.getElementById("balcao-historical-recovery-existing")
                ?.scrollIntoView({ behavior: "smooth", block: "start" })}
                className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-amber/40 px-4 py-2 text-xs font-semibold hover:bg-muted">
                Regularizar histórico de {previous?.ano_letivo}<ArrowRight className="h-4 w-4" />
              </button>
            )}
          </div>
          {previousPending && !historical && (
            <p role="status" className="mt-3 text-xs text-amber-800">
              {previous?.ano_letivo}: regularização histórica pendente. A matrícula de {snapshot.ano.ano} mantém o seu estado real.
            </p>
          )}
          {historical && historical.ano_letivo_id && (
            <div id="balcao-historico-contextual" className="mt-4 border-t border-border pt-4">
              <BalcaoHistoricalAcademicRecovery
                key={historical.matricula_id}
                matriculaId={historical.matricula_id}
                turmaId={historical.turma_id}
                disciplinasPendentes={[]}
                onLancarNotaHistorica={(disciplinaId) => onHistoricalGrade(historical, disciplinaId)}
                onRecheck={async () => { await refresh(); onAcademicUpdated(); }}
              />
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
