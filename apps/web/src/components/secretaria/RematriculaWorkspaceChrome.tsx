"use client";

import { CheckCircle2, ChevronRight, GraduationCap, LockKeyhole, CalendarDays } from "lucide-react";
import type { RematriculaCardState, TurmaOption } from "@/hooks/useRematriculaBalcao";
import type { RaaBalcaoTimeline } from "@/lib/rematricula/raa-balcao-timeline";
import { nextAcademicActionForBalcao, pendingSubjectsActionForBalcao } from "@/lib/rematricula/raa-balcao-next-action";
import { raaBalcaoPlan } from "@/lib/rematricula/raa-balcao-resolution";
import type { RaaBalcaoAcademic } from "@/lib/rematricula/raa-balcao-regime-guidance";

export type RaaProgressSnapshot = {
  matriculaId: string;
  total: number;
  registados: number;
  loading: boolean;
};

type Status = RematriculaCardState | "CHECKING" | null;
const ACTIONABLE: ReadonlySet<string> = new Set([
  "READY", "RECONFIRMATION_REQUIRED", "FINALIST_PENDING",
]);

export function rematriculaDisplayState(status: Status): {
  title: string; message: string; tone: "success" | "warning" | "muted";
} {
  if (status === "ALREADY_COMPLETED") return {
    title: "Concluída", message: "Rematrícula já registada.", tone: "success",
  };
  if (status === "DESTINATION_ENROLLED") return {
    title: "Matrícula existente", message: "Consulte a taxa no histórico financeiro antes de cobrar.", tone: "warning",
  };
  if (status === "RECONFIRMATION_REQUIRED") return {
    title: "Taxa por confirmar", message: "Confirme a taxa pendente. A turma já está atribuída.", tone: "warning",
  };
  // The server reports these only after a paid order with a verified
  // destination enrollment. Never show a CTA to charge or enroll again.
  if (status === "ACADEMIC_HISTORY_PENDING") return {
    title: "Histórico por conciliar",
    message: "A matrícula e o pagamento já existem. Regularize o histórico sem criar outra cobrança.",
    tone: "warning",
  };
  if (status === "DOCUMENT_PENDING") return {
    title: "Comprovativo pendente",
    message: "A matrícula e o pagamento já estão confirmados. Consulte ou recupere o comprovativo.",
    tone: "warning",
  };
  if (status && ACTIONABLE.has(status)) return {
    title: "Pode continuar", message: "Confirme a turma e o pagamento para concluir.", tone: "success",
  };
  if (!status || status === "CHECKING") return {
    title: "A verificar", message: "A consultar a situação académica.", tone: "muted",
  };
  if (status === "ACADEMIC_PENDING") return {
    title: "Ano em curso", message: "A decisão final ainda não está disponível.", tone: "warning",
  };
  if (status === "ACADEMIC_REVIEW_REQUIRED" || status === "ACADEMIC_CONDITIONAL_BLOCKED") return {
    title: "Recurso pendente", message: "Consulte os exames e pedidos antes de continuar.", tone: "warning",
  };
  if (status === "ACADEMIC_ATTENDANCE_REVIEW_REQUIRED") return {
    title: "Faltas por rever",
    message: "Analise as faltas e as justificações pendentes antes de revalidar a decisão oficial.",
    tone: "warning",
  };
  if (status === "ACADEMIC_DISCIPLINARY_REVIEW_REQUIRED") return {
    title: "Revisão disciplinar",
    message: "Reveja a ocorrência e registe a decisão com o perfil autorizado.",
    tone: "warning",
  };
  if (status === "ACADEMIC_NOT_APPROVED") return {
    title: "Resultado não aprovado",
    message: "Consulte a decisão académica e o destino permitido; não avance sem validação.",
    tone: "warning",
  };
  if (status === "ACADEMIC_CYCLE_COMPLETED") return {
    title: "Ciclo concluído", message: "Consulte os documentos de conclusão.", tone: "success",
  };
  if (status === "RECONCILIATION_REQUIRED") return {
    title: "Pagamento confirmado", message: "Falta concluir ou reconciliar a matrícula de destino, sem nova cobrança.", tone: "warning",
  };
  if (status === "PAYMENT_IN_PROGRESS") return {
    title: "Pagamento em curso", message: "Consulte a cobrança já iniciada e confirme a liquidação antes de concluir.", tone: "warning",
  };
  if (status === "DEBT_BLOCKED") return {
    title: "Dívida por regularizar", message: "Consulte os valores em aberto e regularize o pagamento existente.", tone: "warning",
  };
  if (status === "PRICE_NOT_CONFIGURED") return {
    title: "Taxa por configurar", message: "Configure o serviço de rematrícula antes de iniciar uma cobrança.", tone: "warning",
  };
  if (status === "PENDING_ORDER_REVIEW" || status === "LEGACY_REVIEW_REQUIRED") return {
    title: "Pedido por verificar", message: "Consulte o pedido existente e reconcilie-o antes de iniciar outro pagamento.", tone: "warning",
  };
  if (status === "TARGET_YEAR_NOT_CONFIGURED") return {
    title: "Ano de destino por configurar", message: "Verifique o ano letivo oficial e as turmas de destino.", tone: "warning",
  };
  if (status === "ERROR") return {
    title: "Consulta indisponível", message: "Não foi possível confirmar a operação. Verifique novamente antes de continuar.", tone: "warning",
  };
  if (status === "WINDOW_CLOSED") return {
    title: "Período fechado", message: "A direção pode reabrir o período neste atendimento.", tone: "warning",
  };
  if (status === "SOURCE_RECORD_REQUIRED") return {
    title: "Matrícula por confirmar", message: "Verifique o vínculo do aluno ao ano de origem antes de lançar notas ou avançar.", tone: "warning",
  };
  return { title: "A resolver", message: "Consulte as pendências para continuar.", tone: "warning" };
}

function formatAcademicDate(value: string): string {
  const [year, month, day] = value.slice(0, 10).split("-");
  return year && month && day ? day + "/" + month + "/" + year : value;
}

function provaLabel(timeline: RaaBalcaoTimeline): string {
  if (timeline.provas === "agendadas") return "Agendadas" + (timeline.proximaProvaEm ? " · " + formatAcademicDate(timeline.proximaProvaEm) : "");
  if (timeline.provas === "em_curso") return "Período de provas";
  if (timeline.provas === "datas_decorridas") return "Datas passadas · verificar realização";
  return "Sem datas confirmadas";
}

function exameLabel(timeline: RaaBalcaoTimeline): string {
  if (timeline.exames === "com_notas") return timeline.notasExameRegistadas + " nota(s) registada(s)";
  if (timeline.exames === "agendados") return "Sessão agendada";
  if (timeline.exames === "notas_pendentes") return "Notas por confirmar";
  return "Sem sessão de recurso";
}

export function RematriculaWorkspaceHeader({
  anoOrigem, anoDestino, status, motivo, progress, timeline, timelineAno, academic, canLancarNota = false, temPendencias = false,
}: {
  anoOrigem: string | null; anoDestino: string | null; status: Status;
  motivo: string | null; progress: RaaProgressSnapshot | null;
  timeline: RaaBalcaoTimeline | null; timelineAno: string | null; destinoMatriculaId: string | null;
  academic?: RaaBalcaoAcademic | null; canLancarNota?: boolean;
  temPendencias?: boolean;
}) {
  const baseDisplay = rematriculaDisplayState(status);
  const academicNext = nextAcademicActionForBalcao(status, timeline);
  // Calendar for the currently selected destination is not evidence of the
  // origin's trimester. Avoid deriving missing-grade urgency from another year.
  const timelineOrigem = timelineAno && anoOrigem && timelineAno === anoOrigem ? timeline : null;
  const subjectsNext = pendingSubjectsActionForBalcao(status, academic ?? null, canLancarNota, timelineOrigem);
  const display = {
    ...baseDisplay,
    title: subjectsNext?.title ?? academicNext.title ?? baseDisplay.title,
    message: subjectsNext?.message ?? academicNext.message ?? baseDisplay.message,
  };
  // The canonical RAA may still be blocked after every visible item is
  // decided. Keep the resolution link until the server changes the status.
  const showPendingLink = temPendencias && (Boolean(raaBalcaoPlan(status)) ||
    (status !== "ALREADY_COMPLETED" && progress !== null &&
      progress.total > progress.registados));
  const reasonNeedsDetail = motivo && motivo.trim() && status !== "ACADEMIC_PENDING";
  return (
    <header className="space-y-3" aria-label="Resumo da situação académica">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-sora text-xl font-bold tracking-tight text-foreground sm:text-2xl">Situação académica</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Origem: {anoOrigem ?? "Por confirmar"} · Destino: {anoDestino ?? "Por confirmar"}
          </p>
        </div>
        <span className={[
          "rounded-full px-2.5 py-1 text-xs font-semibold",
          display.tone === "success" ? "bg-emerald/10 text-emerald" :
          display.tone === "warning" ? "bg-amber/15 text-amber" : "bg-muted text-muted-foreground",
        ].join(" ")} role="status">{display.title}</span>
      </div>
      <section className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border bg-muted/20 p-3" aria-label="Próxima ação académica">
        <p className="min-w-0 flex-1 text-sm text-foreground">{display.message}</p>
        {showPendingLink && status !== "ALREADY_COMPLETED" && (
          <a href="#balcao-pendencias" className="inline-flex min-h-10 items-center gap-1 rounded-xl border border-border bg-background px-3 py-2 text-xs font-semibold text-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-amber/20">
            Ver pendências <ChevronRight className="h-4 w-4" aria-hidden="true" />
          </a>
        )}
        {reasonNeedsDetail && motivo !== display.message && (
          <details className="w-full text-xs text-muted-foreground">
            <summary className="cursor-pointer">Motivo</summary>
            <p className="mt-1">{motivo}</p>
          </details>
        )}
      </section>
      {!timeline && anoOrigem && status !== "CHECKING" && (
        <div role="status" className="flex items-center gap-2 text-xs text-muted-foreground">
          <CalendarDays className="h-4 w-4" aria-hidden="true" />
          Calendário por confirmar · consulte as datas da turma.
        </div>
      )}
      {timeline && (
        <details className="rounded-xl border border-border bg-muted/20 p-3" aria-label="Calendário de origem">
          <summary className="cursor-pointer text-xs font-medium text-foreground">
            Calendário {timelineAno ? "· " + timelineAno : ""} · {timeline.faseLabel}
          </summary>
          <div className="mt-3 grid gap-2 text-xs text-muted-foreground sm:grid-cols-3">
            {timeline.provas !== "sem_calendario" && (
              <p><span className="font-medium text-foreground">Provas:</span> {provaLabel(timeline)}</p>
            )}
            {(timeline.pautaFinalPublicada || timeline.publicacaoPautaPrevistaEm) && (
              <p><span className="font-medium text-foreground">Pauta:</span> {timeline.pautaFinalPublicada
                ? "Publicada" : "Prevista para " + formatAcademicDate(timeline.publicacaoPautaPrevistaEm!)}</p>
            )}
            {(timeline.exames !== "sem_sessao" || (timeline.pedidosReapreciacao ?? 0) > 0) && (
              <p><span className="font-medium text-foreground">Exames:</span> {exameLabel(timeline)}
                {(timeline.pedidosReapreciacao ?? 0) > 0 ? " · " + timeline.pedidosReapreciacao + " pedidos" : ""}
              </p>
            )}
          </div>
        </details>
      )}

    </header>
  );
}

export function RematriculaAcademicDestination({
  status, anoDestino, turma, taxaValor, canContinue, onContinue,
}: {
  status: Status; anoDestino: string | null; turma: TurmaOption | null;
  taxaValor?: number | null;
  canContinue: boolean; onContinue: () => void;
}) {
  const completed = status === "ALREADY_COMPLETED";
  const destinationEnrolled = status === "DESTINATION_ENROLLED";
  const cycleCompleted = status === "ACADEMIC_CYCLE_COMPLETED";
  const alreadyEnrolled = destinationEnrolled || status === "RECONFIRMATION_REQUIRED";
  const destination = turma
    ? [turma.classe_nome, turma.nome].filter(Boolean).join(" · ")
    : alreadyEnrolled ? "Turma já vinculada à matrícula" : "Turma de destino por selecionar";
  return (
    <section className="space-y-3 border-t border-border pt-4" aria-label="Destino académico">
      <div className="flex items-center gap-2">
        <GraduationCap className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
        <h3 className="text-sm font-semibold text-foreground">Destino académico</h3>
      </div>
      <div className="flex items-center gap-3 rounded-xl bg-muted/35 p-3.5">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-foreground">{cycleCompleted ? "Ciclo de ensino concluído" : destination}</p>
          <p className="mt-1 text-xs text-muted-foreground">
            {completed ? "Rematrícula já registada." :
              destinationEnrolled ? "Matrícula de destino existente." :
              cycleCompleted ? "Consulte os documentos de conclusão." :
              status === "RECONFIRMATION_REQUIRED" ? "Confirmar a rematrícula sem alterar a turma." :
              !canContinue ? "Disponível após regularização." :
              "Selecione a turma e confirme a operação."}
            {anoDestino && !completed && !cycleCompleted ? " · " + anoDestino : ""}
          </p>
        </div>
        {canContinue ? <ChevronRight className="h-4 w-4 shrink-0 text-emerald" aria-hidden="true" /> :
          completed || destinationEnrolled ? <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald" aria-hidden="true" /> :
          <LockKeyhole className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />}
      </div>
      {canContinue && !completed && !destinationEnrolled && !cycleCompleted && (
        <button type="button" onClick={onContinue} disabled={!canContinue}
          className={[
            "flex w-full items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-semibold transition",
            "focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-amber/20",
            canContinue ? "bg-amber text-white hover:brightness-95" : "cursor-not-allowed bg-muted text-muted-foreground",
          ].join(" ")}>
          {canContinue ? <ChevronRight className="h-4 w-4" aria-hidden="true" /> :
            <LockKeyhole className="h-4 w-4" aria-hidden="true" />}
          {status === "RECONFIRMATION_REQUIRED" ? (taxaValor != null && taxaValor > 0 ? "Regularizar taxa de rematrícula" : "Confirmar rematrícula") :
            canContinue ? "Continuar rematrícula" : "Rematrícula indisponível"}
        </button>
      )}
    </section>
  );
}
