"use client";

import { CheckCircle2, ChevronRight, GraduationCap, LockKeyhole, ShieldCheck } from "lucide-react";
import type { RematriculaCardState, TurmaOption } from "@/hooks/useRematriculaBalcao";

export type RaaProgressSnapshot = {
  matriculaId: string;
  total: number;
  registados: number;
  loading: boolean;
};

type Status = RematriculaCardState | "CHECKING" | null;
const COMPLETED: ReadonlySet<string> = new Set(["ALREADY_COMPLETED"]);
const ACTIONABLE: ReadonlySet<string> = new Set([
  "READY", "RECONFIRMATION_REQUIRED", "DOCUMENT_PENDING",
  "ACADEMIC_HISTORY_PENDING", "FINALIST_PENDING",
]);

export function rematriculaDisplayState(status: Status): {
  title: string; message: string; tone: "success" | "warning" | "muted";
} {
  if (status && COMPLETED.has(status)) return {
    title: "Concluída", message: "A rematrícula deste ano já foi registada.", tone: "success",
  };
  if (status && ACTIONABLE.has(status)) return {
    title: "Pode continuar", message: "Continue com o destino e a confirmação nos passos autorizados.", tone: "success",
  };
  if (!status || status === "CHECKING") return {
    title: "A verificar", message: "A consultar a decisão e o histórico académico oficiais.", tone: "muted",
  };
  if (status === "ACADEMIC_CYCLE_COMPLETED") return {
    title: "Ciclo concluído", message: "O processo termina com a documentação, não com uma matrícula automática.", tone: "success",
  };
  return { title: "Em análise", message: "Resolva as pendências e volte a verificar a decisão oficial do RAA.", tone: "warning" };
}

export function RematriculaWorkspaceHeader({
  anoDestino, status, motivo, progress,
}: {
  anoDestino: string | null; status: Status; motivo: string | null;
  progress: RaaProgressSnapshot | null;
}) {
  const display = rematriculaDisplayState(status);
  const count = progress && progress.total > 0 && !progress.loading ? progress : null;
  return (
    <header className="space-y-4" aria-label="Resumo da rematrícula">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-sora text-xl font-bold tracking-tight text-foreground sm:text-2xl">Rematrícula</h2>
          <p className="mt-1 text-sm text-muted-foreground">Ano letivo de destino · {anoDestino ?? "A confirmar pelo calendário oficial"}</p>
        </div>
        <span className={[
          "rounded-full px-2.5 py-1 text-xs font-semibold",
          display.tone === "success" ? "bg-emerald/10 text-emerald" :
          display.tone === "warning" ? "bg-amber/15 text-amber" : "bg-muted text-muted-foreground",
        ].join(" ")} role="status">{display.title}</span>
      </div>
      <section className="rounded-xl border border-border bg-muted/25 p-3.5 sm:p-4" aria-label="Elegibilidade académica">
        <div className="flex items-center gap-2">
          <ShieldCheck className="h-4 w-4 text-emerald" aria-hidden="true" />
          <h3 className="text-sm font-semibold text-foreground">Elegibilidade académica</h3>
        </div>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">{motivo || display.message}</p>
        {count ? (
          <div className="mt-3 space-y-1.5">
            <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
              <span>Registos analisados</span>
              <span className="tabular-nums">{count.registados} de {count.total}</span>
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-border" role="progressbar"
              aria-valuemin={0} aria-valuemax={count.total} aria-valuenow={count.registados}
              aria-label="Registos das pendências analisados">
              <div className="h-full rounded-full bg-emerald transition-[width]"
                style={{ width: count.total ? (count.registados / count.total * 100) + "%" : "0%" }} />
            </div>
          </div>
        ) : (
          <p className="mt-3 text-xs text-muted-foreground">
            {progress?.loading ? "A consultar as pendências…" :
              "A decisão oficial, e não o número de formulários, determina a elegibilidade."}
          </p>
        )}
      </section>
    </header>
  );
}

export function RematriculaAcademicDestination({
  status, anoDestino, turma, canContinue, onContinue,
}: {
  status: Status; anoDestino: string | null; turma: TurmaOption | null;
  canContinue: boolean; onContinue: () => void;
}) {
  const completed = status === "ALREADY_COMPLETED";
  const cycleCompleted = status === "ACADEMIC_CYCLE_COMPLETED";
  const destination = turma
    ? [turma.classe_nome, turma.nome].filter(Boolean).join(" · ")
    : "Turma de destino por selecionar";
  return (
    <section className="space-y-3 border-t border-border pt-4" aria-label="Destino académico">
      <div className="flex items-center gap-2">
        <GraduationCap className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
        <h3 className="text-sm font-semibold text-foreground">Destino académico</h3>
      </div>
      <div className="flex items-center gap-3 rounded-xl bg-muted/35 p-3.5">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-foreground">{cycleCompleted ? "Ciclo de ensino concluído" : destination}</p>
          <p className="mt-1 text-xs leading-5 text-muted-foreground">
            {completed ? "A matrícula de destino já se encontra registada." :
              cycleCompleted ? "Consulte a documentação de conclusão neste Balcão." :
              !canContinue ? "Disponível após validação oficial da elegibilidade." :
              turma ? "Confirme o destino, o pagamento e a matrícula." :
                "Selecione a turma elegível no próximo passo, sem sair deste atendimento."}
            {anoDestino && !completed && !cycleCompleted ? " · " + anoDestino : ""}
          </p>
        </div>
        {canContinue ? <ChevronRight className="h-4 w-4 shrink-0 text-emerald" aria-hidden="true" /> :
          completed ? <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald" aria-hidden="true" /> :
          <LockKeyhole className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />}
      </div>
      <button type="button" onClick={onContinue} disabled={!canContinue}
        className={[
          "flex w-full items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-semibold transition",
          "focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-amber/20",
          canContinue ? "bg-amber text-white hover:brightness-95" : "cursor-not-allowed bg-muted text-muted-foreground",
        ].join(" ")}>
        {canContinue ? <ChevronRight className="h-4 w-4" aria-hidden="true" /> :
          <LockKeyhole className="h-4 w-4" aria-hidden="true" />}
        {completed ? "Rematrícula concluída" :
          cycleCompleted ? "Conclusão de ciclo — sem nova matrícula" :
          canContinue ? "Continuar rematrícula" : "Concluir rematrícula"}
      </button>
      <p className="text-xs leading-5 text-muted-foreground">
        A conclusão depende da decisão oficial do RAA, das permissões do operador e das verificações de matrícula e pagamento.
      </p>
    </section>
  );
}
