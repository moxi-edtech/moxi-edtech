"use client";

import { AlertTriangle, CalendarDays } from "lucide-react";

export type AdmissionCalendarIssue =
  | "ACADEMIC_CALENDAR_NOT_CONFIGURED"
  | "ACADEMIC_CALENDAR_YEAR_MISMATCH";

type Props = {
  escolaId: string;
  anoLetivo: number | null;
  issue: AdmissionCalendarIssue;
  message?: string | null;
  onReviewTurma?: () => void;
  onResume: () => void;
};

/**
 * O calendário é herdado da fonte oficial (decreto MED) pelo contrato académico.
 * A secretaria não cria anos, trimestres ou datas de provas a partir da matrícula.
 * Um erro de sincronização mantém a candidatura aberta para correção na origem.
 */
export function AdmissionCalendarResolution({
  anoLetivo,
  issue,
  message,
  onReviewTurma,
  onResume,
}: Props) {
  const mismatch = issue === "ACADEMIC_CALENDAR_YEAR_MISMATCH";

  return (
    <section role="alert" aria-label="Verificar ano letivo da candidatura"
      className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-foreground dark:border-amber-500/40 dark:bg-amber-500/10">
      <div className="flex items-start gap-3">
        <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-700 dark:text-amber-300" />
        <div className="min-w-0 flex-1 space-y-3">
          <div>
            <h3 className="text-sm font-bold text-foreground">
              {mismatch ? "Rever turma da candidatura" : "Calendário oficial indisponível"}
            </h3>
            <p className="mt-1 text-xs leading-5 text-muted-foreground">
              {message || (mismatch
                ? "A turma selecionada não corresponde ao ano letivo da candidatura."
                : "O calendário herdado do decreto ainda não está disponível para esta operação.")}
            </p>
          </div>
          <p className="flex items-start gap-2 text-xs text-muted-foreground">
            <CalendarDays className="mt-0.5 h-4 w-4 shrink-0" />
            {mismatch
              ? `Selecione uma turma vinculada ao ano ${anoLetivo ?? "da candidatura"}. Os vínculos de outras turmas não serão alterados.`
              : `O ano ${anoLetivo ?? "letivo"} e os trimestres, provas e datas devem vir do decreto oficial. A matrícula fica preservada enquanto a sincronização é verificada.`}
          </p>
          <div className="flex flex-wrap gap-2">
            {onReviewTurma && (
              <button type="button" onClick={onReviewTurma}
                className="min-h-10 rounded-lg border border-border bg-card px-3 py-2 text-xs font-semibold text-foreground hover:bg-muted">
                Rever turma
              </button>
            )}
            <button type="button" onClick={onResume}
              className="min-h-10 rounded-lg border border-border bg-card px-3 py-2 text-xs font-semibold text-foreground hover:bg-muted">
              {mismatch ? "Voltar à matrícula" : "Tentar novamente"}
            </button>
          </div>
          {!mismatch && (
            <p className="text-xs text-muted-foreground">
              Se persistir, a direção deve verificar a sincronização do decreto na configuração académica.
              Não é necessário criar períodos manualmente.
            </p>
          )}
        </div>
      </div>
    </section>
  );
}
