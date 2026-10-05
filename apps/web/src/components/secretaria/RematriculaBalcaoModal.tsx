"use client";

import React, { useEffect, useRef } from "react";
import {
  Banknote,
  Check,
  CheckCircle,
  CreditCard,
  ExternalLink,
  Loader2,
  Printer,
  Smartphone,
  Wallet,
  AlertTriangle,
  X,
} from "lucide-react";
import { EnrollmentPostActions, type EnrollmentPostAction } from "@/components/secretaria/EnrollmentPostActions";
import type { TurmaOption, RematriculaResult, ProgressaoBalcao, RematriculaPaymentItem, ResultadoDecisaoBalcao } from "@/hooks/useRematriculaBalcao";
import {
  isAcademicHistoryPendingResult,
  isDocumentPendingResult,
} from "@/lib/secretaria/rematricula-result";

// ─── Types ───────────────────────────────────────────────────────────────────

type MetodoPagamento = "cash" | "tpa" | "transfer" | "mcx" | "kiwk";

interface RematriculaBalcaoModalProps {
  open: boolean;
  onClose: () => void;
  embedded?: boolean;
  // Student data
  alunoNome: string;
  alunoProcesso: string;
  turmaAtual: string | null;
  matriculaId: string;
  responsavelContato: string;
  setResponsavelContato: (value: string) => void;
  // Academic
  anoLetivo: { id: string; ano: number; label: string };
  // Financial
  service: { id: string; nome: string; valor_base: number };
  itensPagamento?: RematriculaPaymentItem[];
  itensDisponiveis?: RematriculaPaymentItem[];
  onAdicionarItem?: (item: RematriculaPaymentItem) => void;
  onRemoverItem?: (id: string, tipo: RematriculaPaymentItem["tipo"]) => void;
  paymentAlreadyValidated?: boolean;
  skipTurmaSelection?: boolean;
  debt?: { total: number; count: number } | null;
  cohort?: { codigo: string; nome: string; modo: string } | null;
  reconciliationOnly?: boolean;
  onRegularizeDebt?: () => void;
  // Turmas
  turmas: TurmaOption[];
  turmasLoading: boolean;
  progressao: ProgressaoBalcao | null;
  decisaoResultado: ResultadoDecisaoBalcao;
  setDecisaoResultado: (value: ResultadoDecisaoBalcao) => void;
  decisaoFonte: string;
  setDecisaoFonte: (value: string) => void;
  decisaoMotivo: string;
  setDecisaoMotivo: (value: string) => void;
  decisaoObservacao: string;
  setDecisaoObservacao: (value: string) => void;
  // Wizard state
  step: number;
  setStep: (n: number) => void;
  selectedTurmaId: string | null;
  setSelectedTurmaId: (id: string | null) => void;
  destinoTurma?: TurmaOption | null;
  // Payment
  metodo: MetodoPagamento;
  setMetodo: (m: MetodoPagamento) => void;
  detalhes: { referencia: string; evidencia_url: string; gateway_ref: string };
  setDetalhes: (
    d: Partial<{ referencia: string; evidencia_url: string; gateway_ref: string }>
  ) => void;
  // Submission
  submitting: boolean;
  result: RematriculaResult | null;
  apiError: string | null;
  submit: () => Promise<void>;
  onPostAction: (action: EnrollmentPostAction, turmaId?: string | null) => void;
}

// ─── Constants ───────────────────────────────────────────────────────────────

const kwanza = new Intl.NumberFormat("pt-AO", {
  style: "currency",
  currency: "AOA",
  maximumFractionDigits: 0,
});

const TURNO_LABEL: Record<string, string> = {
  M: "Manhã",
  T: "Tarde",
  N: "Noite",
};

const ERROR_MESSAGES: Record<string, string> = {
  ACADEMIC_YEAR_REQUIRED: "Seleccione o ano lectivo da operação.",
  ACADEMIC_YEAR_CLOSED: "Este ano lectivo não aceita alterações.",
  REMATRICULA_SOURCE_INVALID: "A matrícula actual do aluno não foi encontrada.",
  REMATRICULA_DEBT_REQUIRED: "Regularize as dívidas antes de rematricular.",
  REMATRICULA_PRICE_NOT_CONFIGURED:
    "O emolumento ainda não foi configurado pela escola.",
  PAYMENT_REQUIRED: "O pagamento não foi confirmado.",
  PAYMENT_IN_PROGRESS: "Já existe um pagamento em andamento.",
  REMATRICULA_RECONCILIATION_REQUIRED:
    "Pagamento confirmado; atendimento enviado para reconciliação.",
  REMATRICULA_PROGRESSION_INVALID:
    "A turma destino não respeita a progressão académica do aluno.",
  CROSS_YEAR_ENTITY_MISMATCH:
    "A turma seleccionada não pertence ao ano lectivo.",
  DOCUMENT_PENDING:
    "Rematrícula concluída; comprovante pendente de emissão.",
  ACADEMIC_HISTORY_PENDING:
    "Rematrícula concluída; falta reconciliar o histórico académico da matrícula de origem.",
  REMATRICULA_LEGACY_REVIEW_REQUIRED:
    "Existe um pedido antigo sem ano letivo. Envie-o para reconciliação antes de cobrar novamente.",
  FINALISTA_PROGRESSION_INVALID:
    "O finalista deve seguir para a classe imediatamente seguinte.",
  DECISAO_MOTIVO_REQUIRED:
    "Informe o motivo da decisão administrativa antes de concluir.",
  ASSISTED_TRANSITION_COHORT_REQUIRED:
    "Este aluno não pertence à coorte autorizada para decisão administrativa sem notas.",
  RECONCILIATION_DESTINATION_MISMATCH:
    "A turma escolhida é diferente da matrícula destino já preparada. Reveja o destino antes de confirmar.",
  RECONCILIATION_PROGRESSION_INVALID:
    "A decisão registada não corresponde à progressão entre a turma de origem e o destino preparado.",
  CONCLUSION_DESTINATION_REVIEW_REQUIRED:
    "Existe uma matrícula destino preparada. Reveja-a antes de concluir o ciclo do aluno.",
};

const METODOS_UI = [
  { id: "cash" as const, icon: Banknote, label: "Numerário" },
  { id: "tpa" as const, icon: CreditCard, label: "TPA" },
  { id: "transfer" as const, icon: Wallet, label: "Transfer." },
  { id: "mcx" as const, icon: Smartphone, label: "Multicaixa" },
  { id: "kiwk" as const, icon: Smartphone, label: "Kwik" },
] as const;

const STEP_LABELS = ["Destino", "Cobrança", "Confirmar"];

// ─── Component ───────────────────────────────────────────────────────────────

export function RematriculaBalcaoModal(props: RematriculaBalcaoModalProps) {
  const {
    open,
    onClose,
    embedded = false,
    alunoNome,
    alunoProcesso,
    onPostAction,
    turmaAtual,
    matriculaId,
    responsavelContato,
    setResponsavelContato,
    anoLetivo,
    service,
    itensPagamento = [],
    itensDisponiveis = [],
    onAdicionarItem,
    onRemoverItem,
    paymentAlreadyValidated = false,
    skipTurmaSelection = false,
    debt = null,
    cohort = null,
    reconciliationOnly = false,
    onRegularizeDebt,
    turmas,
    turmasLoading,
    progressao,
    decisaoResultado,
    setDecisaoResultado,
    decisaoFonte,
    setDecisaoFonte,
    decisaoMotivo,
    setDecisaoMotivo,
    decisaoObservacao,
    setDecisaoObservacao,
    step,
    setStep,
    selectedTurmaId,
    setSelectedTurmaId,
    destinoTurma = null,
    metodo,
    setMetodo,
    detalhes,
    setDetalhes,
    submitting,
    result,
    apiError,
    submit,
  } = props;

  // ── Focus management ────────────────────────────────────────────────────
  const firstFocusRef = useRef<HTMLSelectElement | HTMLButtonElement | null>(null);
  const triggerRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (open && !embedded) {
      // Save the element that opened the modal
      triggerRef.current = document.activeElement as HTMLElement;
      // Focus the first interactive element after render
      const timer = setTimeout(() => firstFocusRef.current?.focus(), 60);
      return () => clearTimeout(timer);
    } else if (triggerRef.current) {
      // Return focus to the trigger element
      triggerRef.current.focus();
      triggerRef.current = null;
    }
  }, [embedded, open]);

  // Re-focus when step changes
  useEffect(() => {
    if (open && !result && !embedded) {
      const timer = setTimeout(() => firstFocusRef.current?.focus(), 60);
      return () => clearTimeout(timer);
    }
  }, [embedded, open, step, result]);

  // ── Keyboard handling ───────────────────────────────────────────────────
  useEffect(() => {
    if (!open || embedded) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      // During submission, block Escape
      if (submitting) return;
      // After result, always allow close
      if (result) { onClose(); return; }
      // During payment step (step 3), block Escape to prevent accidental close
      if (step >= 3) return;
      // Steps 1-2: allow close
      onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [embedded, open, result, submitting, step, onClose]);

  if (!open) return null;

  // ── Helpers ──────────────────────────────────────────────────────────────
  const handleOverlayClick = (e: React.MouseEvent) => {
    if (e.target !== e.currentTarget) return;
    if (submitting) return;
    if (result || step < 3) onClose();
  };

  const selectedTurma = turmas.find((t) => t.id === selectedTurmaId) ?? destinoTurma ?? undefined;
  const academicOnly = reconciliationOnly && decisaoResultado === "concluido";
  const singleStep = academicOnly || reconciliationOnly;
  const financialReady = !debt || debt.total <= 0;
  const itensAdicionais = itensPagamento.filter(
    (item) => item.id !== service.id && item.codigo !== "SERV_REMATRICULA",
  );
  const paymentTotal = service.valor_base + itensAdicionais.reduce(
    (sum, item) => sum + Number(item.preco ?? 0) * Math.max(Number(item.quantidade ?? 1), 1),
    0,
  );

  const academicReady = reconciliationOnly
    ? (academicOnly || Boolean(selectedTurmaId))
      && !(decisaoFonte === "declaracao_administrativa_escola" && !decisaoMotivo.trim())
    : skipTurmaSelection
      ? true
      : ["aprovado", "condicional"].includes(progressao?.estado ?? "") && Boolean(selectedTurmaId);

  const canSubmit =
    !submitting &&
    academicReady &&
    (academicOnly || financialReady) &&
    (academicOnly || paymentAlreadyValidated || (
      !(metodo === "tpa" && !detalhes.referencia.trim()) &&
      !(metodo === "transfer" && !detalhes.evidencia_url.trim())
    ));

  const disabledReason =
    submitting
      ? "A operação está a ser processada."
      : !academicReady
        ? reconciliationOnly
          ? "Conclua a decisão académica e selecione o destino quando aplicável."
          : "Selecione uma turma de destino elegível."
        : !academicOnly && !financialReady
          ? "Regularize as mensalidades vencidas antes de continuar."
          : !academicOnly && !paymentAlreadyValidated && metodo === "tpa" && !detalhes.referencia.trim()
            ? "Informe a referência do TPA."
            : !academicOnly && !paymentAlreadyValidated && metodo === "transfer" && !detalhes.evidencia_url.trim()
              ? "Adicione o comprovativo da transferência."
              : null;

  const stepTitle =
    step === 1
      ? "Definir destino"
      : step === 2
        ? "Rever cobrança"
        : "Confirmar rematrícula";

  // ── Render ───────────────────────────────────────────────────────────────
  return (
    <div
      className={embedded ? "w-full" : "fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-sm"}
      onClick={embedded ? undefined : handleOverlayClick}
    >
      <div
        className={embedded
          ? "relative w-full overflow-hidden rounded-2xl border border-slate-200 bg-white"
          : "relative w-full max-w-lg rounded-2xl bg-white shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"}
        role={embedded ? undefined : "dialog"}
        aria-modal={embedded ? undefined : true}
        aria-labelledby="rematricula-modal-title"
      >
        {/* ── Header (hidden on success) ──────────────────────────────── */}
        {!result && (
          <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-400">
                Rematrícula · {anoLetivo.label}
              </p>
              <h2
                id="rematricula-modal-title"
                className="mt-1 text-base font-black text-slate-900"
              >
                {skipTurmaSelection ? "Regularizar taxa" : stepTitle}
              </h2>

              {/* Step indicator */}
              {!skipTurmaSelection && !reconciliationOnly && <div className="mt-3 flex items-center gap-2">
                {STEP_LABELS.map((label, i) => {
                  const s = i + 1;
                  const isActive = s === step;
                  const isDone = s < step;
                  return (
                    <div
                      key={s}
                      className={[
                        "rounded-full px-2.5 py-1 text-[10px] font-bold transition-colors",
                        isActive
                          ? "bg-slate-950 text-white"
                          : isDone
                            ? "bg-emerald-50 text-emerald"
                            : "bg-slate-100 text-slate-400",
                      ].join(" ")}
                    >
                      {label}
                    </div>
                  );
                })}
              </div>}
            </div>

            {!submitting && !embedded && (
              <button
                onClick={onClose}
                className="rounded-xl p-2 hover:bg-slate-50 text-slate-400 transition-colors"
                aria-label="Fechar"
              >
                <X className="h-5 w-5" />
              </button>
            )}
          </div>
        )}

        {/* ── Body ────────────────────────────────────────────────────── */}
        <div className={embedded ? "p-5" : "flex-1 overflow-y-auto p-5"}>
          {/* ── Success ────────────────────────────────────────────── */}
          {result ? (
            <SuccessView
              result={result}
              alunoNome={alunoNome}
              anoLetivo={anoLetivo}
              selectedTurma={selectedTurma}
              service={service}
              paymentTotal={paymentTotal}
              metodo={metodo}
              paymentAlreadyValidated={paymentAlreadyValidated}
              onPostAction={(action) => onPostAction(action, selectedTurma?.id ?? result.rematricula?.turma_id ?? null)}
            />
          ) : step === 1 ? (
            /* ── Step 1: Academic summary ───────────────────────── */
            <StepAcademico
              alunoNome={alunoNome}
              alunoProcesso={alunoProcesso}
              turmaAtual={turmaAtual}
              matriculaId={matriculaId}
              responsavelContato={responsavelContato}
              setResponsavelContato={setResponsavelContato}
              anoLetivo={anoLetivo}
              turmas={turmas}
              turmasLoading={turmasLoading}
              progressao={progressao}
              cohort={cohort}
              reconciliationOnly={reconciliationOnly}
              skipTurmaSelection={skipTurmaSelection}
              decisaoResultado={decisaoResultado}
              setDecisaoResultado={setDecisaoResultado}
              decisaoFonte={decisaoFonte}
              setDecisaoFonte={setDecisaoFonte}
              decisaoMotivo={decisaoMotivo}
              setDecisaoMotivo={setDecisaoMotivo}
              decisaoObservacao={decisaoObservacao}
              setDecisaoObservacao={setDecisaoObservacao}
              selectedTurmaId={selectedTurmaId}
              setSelectedTurmaId={setSelectedTurmaId}
              selectRef={firstFocusRef as React.RefObject<HTMLSelectElement>}
              compact={embedded}
            />
          ) : step === 2 ? (
            /* ── Step 2: Financial summary ──────────────────────── */
            <StepFinanceiro
              service={service}
              debt={debt}
              selectedTurma={selectedTurma}
              itensPagamento={itensPagamento}
              itensDisponiveis={itensDisponiveis}
              onAdicionarItem={onAdicionarItem}
              onRemoverItem={onRemoverItem}
              onRegularizeDebt={onRegularizeDebt}
              paymentAlreadyValidated={paymentAlreadyValidated}
            />
          ) : (
            /* ── Step 3: Payment ────────────────────────────────── */
            <StepPagamento
              metodo={metodo}
              setMetodo={setMetodo}
              detalhes={detalhes}
              setDetalhes={setDetalhes}
              submitting={submitting}
              apiError={apiError}
              service={service}
              itensPagamento={itensPagamento}
              paymentAlreadyValidated={paymentAlreadyValidated}
            />
          )}
        </div>

        {/* ── Submitting overlay ───────────────────────────────────── */}
        {submitting && (
          <div
            className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-white/80 backdrop-blur-sm"
            aria-live="polite"
          >
            <Loader2 className="h-8 w-8 animate-spin text-[#1F6B3B] mb-3" />
            <p className="text-sm font-semibold text-slate-700">
              A processar pagamento e rematrícula…
            </p>
          </div>
        )}

        {/* ── Footer ──────────────────────────────────────────────── */}
        <div className="border-t border-slate-200 bg-slate-50 px-5 py-4">
          {result ? (
            <FooterSuccess result={result} onClose={onClose} />
          ) : (
            <FooterWizard
              step={step}
              setStep={setStep}
              onClose={onClose}
              submitting={submitting}
              canSubmit={canSubmit}
              academicReady={academicReady}
              financialReady={financialReady}
              onRegularizeDebt={onRegularizeDebt}
              paymentTotal={paymentTotal}
              paymentAlreadyValidated={paymentAlreadyValidated}
              academicOnly={singleStep}
              reconciliationOnly={reconciliationOnly}
              disabledReason={disabledReason}
              submit={submit}
            />
          )}
        </div>
      </div>
    </div>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// Sub-components
// ═════════════════════════════════════════════════════════════════════════════

// ─── Step 1: Academic ────────────────────────────────────────────────────────

function StepAcademico({
  alunoNome,
  alunoProcesso,
  turmaAtual,
  matriculaId,
  responsavelContato,
  setResponsavelContato,
  anoLetivo,
  turmas,
  turmasLoading,
  progressao,
  cohort,
  reconciliationOnly,
  skipTurmaSelection,
  decisaoResultado,
  setDecisaoResultado,
  decisaoFonte,
  setDecisaoFonte,
  decisaoMotivo,
  setDecisaoMotivo,
  decisaoObservacao,
  setDecisaoObservacao,
  selectedTurmaId,
  setSelectedTurmaId,
  selectRef,
  compact,
}: {
  alunoNome: string;
  alunoProcesso: string;
  turmaAtual: string | null;
  matriculaId: string;
  responsavelContato: string;
  setResponsavelContato: (value: string) => void;
  anoLetivo: { id: string; ano: number; label: string };
  turmas: TurmaOption[];
  turmasLoading: boolean;
  progressao: ProgressaoBalcao | null;
  cohort: { codigo: string; nome: string; modo: string } | null;
  reconciliationOnly: boolean;
  skipTurmaSelection: boolean;
  decisaoResultado: ResultadoDecisaoBalcao;
  setDecisaoResultado: (value: ResultadoDecisaoBalcao) => void;
  decisaoFonte: string;
  setDecisaoFonte: (value: string) => void;
  decisaoMotivo: string;
  setDecisaoMotivo: (value: string) => void;
  decisaoObservacao: string;
  setDecisaoObservacao: (value: string) => void;
  selectedTurmaId: string | null;
  setSelectedTurmaId: (id: string | null) => void;
  selectRef: React.RefObject<HTMLSelectElement>;
  compact: boolean;
}) {
  return (
    <div className="space-y-5">
      {compact ? (
        <div className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-slate-50/60 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-400">Origem</p>
            <p className="mt-1 text-sm font-black text-slate-900">{turmaAtual || "Turma não identificada"}</p>
            <p className="mt-0.5 text-xs text-slate-500">Processo {alunoProcesso}</p>
          </div>
          <div className="sm:text-right">
            <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-400">Ano destino</p>
            <p className="mt-1 text-sm font-black text-slate-900">{anoLetivo.label}</p>
          </div>
        </div>
      ) : (
        <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-4 space-y-2.5 text-sm">
          <InfoRow label="Aluno" value={alunoNome} />
          <InfoRow label="Nº Processo" value={alunoProcesso} />
          <InfoRow label="Matrícula" value={matriculaId.slice(0, 8) + "…"} />
          <InfoRow label="Turma actual" value={turmaAtual || "—"} />
          <InfoRow label="Ano lectivo" value={anoLetivo.label} />
        </div>
      )}

      <div>
        <label htmlFor="rematricula-contacto-encarregado" className="mb-1.5 block text-xs font-bold text-slate-700">
          Contacto do encarregado
        </label>
        <input
          id="rematricula-contacto-encarregado"
          type="tel"
          inputMode="tel"
          value={responsavelContato}
          onChange={(event) => setResponsavelContato(event.target.value)}
          placeholder="Ex.: +244 9XX XXX XXX"
          className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-[#E3B23C] focus:ring-4 focus:ring-[#E3B23C]/20"
        />
        <p className="mt-1.5 text-[11px] text-slate-500">Use o número atual do encarregado para os contactos desta matrícula.</p>
      </div>

      {skipTurmaSelection ? (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900">
          <strong className="block text-emerald-950">Regularização da taxa de rematrícula</strong>
          <span className="mt-1 block text-xs">O aluno já está matriculado em {anoLetivo.label}. A turma e a classe atuais serão preservadas; prossiga apenas para cobrar a taxa e emitir o comprovativo.</span>
        </div>
      ) : <>
      {reconciliationOnly ? (
        /* Exceção histórica: usada apenas para recuperar operações antigas já
           iniciadas/pagas. Não é um caminho de elegibilidade para nova rematrícula. */
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 space-y-3">
          <div>
            <p className="text-sm font-bold text-amber-950">Reconciliação académica histórica</p>
            <p className="mt-1 text-xs text-amber-800">
              Esta decisão existe somente para concluir uma operação antiga. Novas rematrículas obedecem exclusivamente à decisão e aos bloqueios devolvidos pelo RAA.
            </p>
          </div>
          {cohort && (
            <div className="rounded-xl border border-violet-200 bg-violet-50 p-3 text-xs text-violet-900">
              <strong className="block">{cohort.nome}</strong>
              <span>Exceção auditada {cohort.codigo}; não cria uma regra geral de rematrícula.</span>
            </div>
          )}
          <div className="grid grid-cols-3 gap-2">
            {([
              ["aprovado", "Aprovado"],
              ["reprovado", "Reprovado"],
              ["concluido", "Concluído"],
            ] as const).map(([value, label]) => (
              <button
                key={value}
                type="button"
                onClick={() => setDecisaoResultado(value)}
                className={`rounded-xl border px-2 py-2 text-xs font-bold transition-colors ${decisaoResultado === value ? "border-[#1F6B3B] bg-[#1F6B3B]/10 text-[#1F6B3B]" : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"}`}
              >
                {label}
              </button>
            ))}
          </div>
          <label className="block text-xs font-bold uppercase tracking-wide text-amber-800" htmlFor="rematricula-decisao-fonte">
            Fonte da decisão
          </label>
          <select
            id="rematricula-decisao-fonte"
            value={decisaoFonte}
            onChange={(event) => setDecisaoFonte(event.target.value)}
            className="w-full rounded-xl border border-amber-200 bg-white px-3 py-2.5 text-sm font-medium text-slate-900 outline-none focus:border-[#E3B23C] focus:ring-4 focus:ring-[#E3B23C]/20"
          >
            <option value="declaracao_administrativa_escola">Declaração administrativa da escola</option>
          </select>
          <div className="space-y-2">
            <label className="block text-xs font-bold uppercase tracking-wide text-amber-800" htmlFor="rematricula-decisao-motivo">
              Motivo obrigatório
            </label>
            <input
              id="rematricula-decisao-motivo"
              value={decisaoMotivo}
              onChange={(event) => setDecisaoMotivo(event.target.value)}
              placeholder="Motivo da reconciliação histórica"
              className="w-full rounded-xl border border-amber-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-[#E3B23C] focus:ring-4 focus:ring-[#E3B23C]/20"
            />
            <label className="block text-xs font-bold uppercase tracking-wide text-amber-800" htmlFor="rematricula-decisao-observacao">
              Observação (opcional)
            </label>
            <textarea
              id="rematricula-decisao-observacao"
              value={decisaoObservacao}
              onChange={(event) => setDecisaoObservacao(event.target.value)}
              rows={2}
              placeholder="Contexto adicional para a auditoria"
              className="w-full resize-none rounded-xl border border-amber-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-[#E3B23C] focus:ring-4 focus:ring-[#E3B23C]/20"
            />
          </div>
        </div>
      ) : null}

      {/* Turma selector */}
      {progressao && (
        <div className={`rounded-xl border p-4 ${
          progressao.estado === "reprovado"
            ? "border-amber-200 bg-amber-50/70"
            : progressao.estado === "condicional"
              ? "border-violet-200 bg-violet-50/70"
              : "border-emerald-200 bg-emerald-50/60"
        }`}>
          <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-500">Situação académica</p>
          <p className="mt-1 text-sm font-black text-slate-900">
            {progressao.orientacao?.titulo
              ?? (progressao.estado === "reprovado"
                ? "Retenção académica"
                : progressao.estado === "condicional"
                  ? "Progressão condicional"
                  : "Progressão autorizada")}
          </p>
          <p className="mt-1 text-xs leading-5 text-slate-600">{progressao.orientacao?.mensagem ?? progressao.mensagem}</p>
          {progressao.orientacao?.proximo_passo && (
            <p className="mt-2 text-xs font-bold text-slate-700">{progressao.orientacao.proximo_passo}</p>
          )}
        </div>
      )}

      {reconciliationOnly && decisaoResultado === "concluido" ? (
        <div className="rounded-xl border border-violet-200 bg-violet-50 p-3 text-sm text-violet-900">
          <strong className="block text-violet-950">Conclusão sem matrícula destino</strong>
          <span className="text-xs">Será encerrada apenas a matrícula de origem. Não haverá taxa nem criação de matrícula no novo ano.</span>
        </div>
      ) : <div className="space-y-2">
        <label
          htmlFor="rematricula-turma-select"
          className="block text-sm font-semibold text-slate-700"
        >
          Turma de destino <span className="text-rose-500">*</span>
        </label>
        <select
          id="rematricula-turma-select"
          ref={selectRef}
          value={selectedTurmaId || ""}
          onChange={(e) => setSelectedTurmaId(e.target.value || null)}
          disabled={turmasLoading}
          className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5
            text-sm font-medium text-slate-900 outline-none
            focus:border-[#E3B23C] focus:ring-4 focus:ring-[#E3B23C]/20
            disabled:opacity-50 disabled:cursor-wait"
        >
          <option value="" disabled>
            {turmasLoading ? "A carregar turmas…" : "Seleccionar turma…"}
          </option>
          {turmas.map((t) => {
            const cap = t.capacidade_maxima;
            const ocu = t.ocupacao_atual ?? 0;
            const isFull = cap !== null && ocu >= cap;
            const turnoStr = t.turno ? TURNO_LABEL[t.turno] || t.turno : "";
            const vagasStr = `${ocu}/${cap ?? "∞"} vagas`;

            return (
              <option key={t.id} value={t.id} disabled={isFull}>
                {t.nome}
                {turnoStr ? ` · ${turnoStr}` : ""}
                {` · ${vagasStr}`}
                {isFull ? " (Sem vagas)" : ""}
              </option>
            );
          })}
        </select>
        {!turmasLoading && turmas.length === 0 && (
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
            Não há turma elegível para a decisão devolvida pelo RAA no ano de destino.
            Corrija a configuração da classe/turma ou resolva a situação académica indicada antes de continuar.
          </div>
        )}
        {selectedTurmaId && turmas.find((turma) => turma.id === selectedTurmaId) && (
          <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-xs text-emerald-900">
            <strong className="block">Destino: {turmas.find((turma) => turma.id === selectedTurmaId)?.nome}</strong>
            <span className="mt-1 block">A turma só será gravada quando a operação for confirmada.</span>
          </div>
        )}
      </div>}
      </>}
    </div>
  );
}

// ─── Step 2: Financial ───────────────────────────────────────────────────────

function StepFinanceiro({
  service,
  debt,
  selectedTurma,
  itensPagamento,
  itensDisponiveis,
  onAdicionarItem,
  onRemoverItem,
  onRegularizeDebt,
  paymentAlreadyValidated,
}: {
  service: { id: string; nome: string; valor_base: number; pricing_origin?: "classe" | "fallback" };
  debt: { total: number; count: number } | null;
  selectedTurma?: TurmaOption;
  itensPagamento: RematriculaPaymentItem[];
  itensDisponiveis: RematriculaPaymentItem[];
  onAdicionarItem?: (item: RematriculaPaymentItem) => void;
  onRemoverItem?: (id: string, tipo: RematriculaPaymentItem["tipo"]) => void;
  onRegularizeDebt?: () => void;
  paymentAlreadyValidated: boolean;
}) {
  const itensAdicionais = itensPagamento.filter(
    (item) => item.id !== service.id && item.codigo !== "SERV_REMATRICULA",
  );
  const total = service.valor_base + itensAdicionais.reduce(
    (sum, item) => sum + Number(item.preco ?? 0) * Math.max(Number(item.quantidade ?? 1), 1),
    0,
  );
  const itemEstaSeleccionado = (item: RematriculaPaymentItem) => itensPagamento.some(
    (seleccionado) => seleccionado.id === item.id && seleccionado.tipo === item.tipo,
  );
  const mensalidadesDisponiveis = itensDisponiveis.filter((item) => item.tipo === "mensalidade");
  const servicosDisponiveis = itensDisponiveis.filter((item) => item.tipo === "servico");
  const hasDebt = Boolean(debt && debt.total > 0);

  const toggleMensalidade = (item: RematriculaPaymentItem, index: number) => {
    const selected = itemEstaSeleccionado(item);
    if (selected) {
      mensalidadesDisponiveis.slice(index).forEach((candidate) => {
        if (itemEstaSeleccionado(candidate)) onRemoverItem?.(candidate.id, candidate.tipo);
      });
      return;
    }

    mensalidadesDisponiveis.slice(0, index + 1).forEach((candidate) => {
      if (!itemEstaSeleccionado(candidate)) onAdicionarItem?.(candidate);
    });
  };

  return (
    <div className="space-y-5">
      {hasDebt ? (
        <div className="rounded-xl border border-rose-200 bg-rose-50/70 p-4">
          <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-rose-600">Bloqueio financeiro</p>
          <div className="mt-1 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-black text-rose-950">
                {debt?.count ?? 0} mensalidade{debt?.count === 1 ? "" : "s"} em atraso
              </p>
              <p className="mt-1 text-xs leading-5 text-rose-700">
                Regularize {kwanza.format(debt?.total ?? 0)} antes de confirmar a rematrícula.
              </p>
            </div>
            {onRegularizeDebt ? (
              <button
                type="button"
                onClick={onRegularizeDebt}
                className="shrink-0 rounded-xl bg-slate-950 px-4 py-2.5 text-xs font-bold text-white transition hover:bg-slate-800"
              >
                Regularizar dívida
              </button>
            ) : null}
          </div>
        </div>
      ) : paymentAlreadyValidated ? (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50/60 p-4">
          <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-emerald">Pagamento validado</p>
          <p className="mt-1 text-sm font-black text-emerald-950">A cobrança já está confirmada.</p>
          <p className="mt-1 text-xs text-emerald-800">Não será criado um novo pagamento.</p>
        </div>
      ) : null}

      <div>
        <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-400">Resumo</p>
        <div className="mt-2 overflow-hidden rounded-xl border border-slate-200 bg-white">
          <div className="flex items-start justify-between gap-4 px-4 py-3.5">
            <div>
              <p className="text-xs font-bold text-slate-900">Destino</p>
              <p className="mt-0.5 text-xs text-slate-500">
                {selectedTurma?.classe_nome || "Classe não identificada"}
                {selectedTurma?.nome ? ` · ${selectedTurma.nome}` : ""}
              </p>
            </div>
          </div>

          <div className="flex items-center justify-between gap-4 border-t border-slate-100 px-4 py-3.5">
            <div>
              <p className="text-xs font-bold text-slate-900">Taxa de rematrícula</p>
              <p className="mt-0.5 text-[11px] text-slate-400">
                {service.pricing_origin === "classe" ? "Valor da classe destino" : "Valor padrão da escola"}
              </p>
            </div>
            <strong className="text-sm text-slate-900">
              {service.valor_base > 0 ? kwanza.format(service.valor_base) : "Sem taxa"}
            </strong>
          </div>

          {itensAdicionais.map((item) => {
            const quantidade = Math.max(Number(item.quantidade ?? 1), 1);
            return (
              <div
                key={`${item.tipo}-${item.id}`}
                className="flex items-center justify-between gap-4 border-t border-slate-100 px-4 py-3.5"
              >
                <div>
                  <p className="text-xs font-bold text-slate-900">{item.nome || item.descricao || "Cobrança adicional"}</p>
                  <p className="mt-0.5 text-[11px] text-slate-400">
                    {item.tipo === "mensalidade" ? "Mensalidade do ano destino" : "Serviço adicional"}
                    {quantidade > 1 ? ` · × ${quantidade}` : ""}
                  </p>
                </div>
                <strong className="text-sm text-slate-900">
                  {kwanza.format(Number(item.preco ?? 0) * quantidade)}
                </strong>
              </div>
            );
          })}

          <div className="flex items-end justify-between gap-4 border-t border-slate-200 bg-slate-50 px-4 py-4">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-400">Total da operação</p>
              <p className="mt-0.5 text-xs text-slate-500">
                {itensAdicionais.length > 0 ? "Taxa + itens selecionados" : "Taxa de rematrícula"}
              </p>
            </div>
            <strong className="text-xl font-black text-slate-950">{kwanza.format(total)}</strong>
          </div>
        </div>
      </div>

      {!paymentAlreadyValidated && !hasDebt && itensDisponiveis.length > 0 ? (
        <div>
          <div className="mb-2">
            <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-400">Opcional</p>
            <h3 className="mt-1 text-sm font-black text-slate-900">Adicionar ao mesmo pagamento</h3>
            {mensalidadesDisponiveis.length > 0 ? (
              <p className="mt-1 text-xs leading-5 text-slate-500">
                Pode incluir as primeiras mensalidades do novo ano. Ao escolher um mês, os anteriores entram automaticamente.
              </p>
            ) : null}
          </div>

          <div className="space-y-2">
            {mensalidadesDisponiveis.map((item, index) => {
              const seleccionado = itemEstaSeleccionado(item);
              return (
                <button
                  key={`${item.tipo}-${item.id}`}
                  type="button"
                  onClick={() => toggleMensalidade(item, index)}
                  className={[
                    "flex w-full items-center justify-between gap-3 rounded-xl border px-3.5 py-3 text-left transition",
                    seleccionado
                      ? "border-emerald/30 bg-emerald/5"
                      : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50",
                  ].join(" ")}
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="truncate text-xs font-bold text-slate-900">{item.nome || "Mensalidade"}</p>
                      {seleccionado ? (
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald">
                          <CheckCircle className="h-3 w-3" /> Incluída
                        </span>
                      ) : null}
                    </div>
                    <p className="mt-0.5 text-[11px] text-slate-400">
                      {item.data_vencimento
                        ? `Vence ${new Intl.DateTimeFormat("pt-AO").format(new Date(`${item.data_vencimento}T00:00:00Z`))}`
                        : "Mensalidade do ano destino"}
                    </p>
                  </div>
                  <strong className="shrink-0 text-xs text-slate-900">{kwanza.format(Number(item.preco ?? 0))}</strong>
                </button>
              );
            })}

            {servicosDisponiveis.map((item) => {
              const seleccionado = itemEstaSeleccionado(item);
              return (
                <button
                  key={`${item.tipo}-${item.id}`}
                  type="button"
                  onClick={() => seleccionado ? onRemoverItem?.(item.id, item.tipo) : onAdicionarItem?.(item)}
                  className={[
                    "flex w-full items-center justify-between gap-3 rounded-xl border px-3.5 py-3 text-left transition",
                    seleccionado
                      ? "border-emerald/30 bg-emerald/5"
                      : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50",
                  ].join(" ")}
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="truncate text-xs font-bold text-slate-900">{item.nome || "Serviço escolar"}</p>
                      {seleccionado ? (
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald">
                          <CheckCircle className="h-3 w-3" /> Incluído
                        </span>
                      ) : null}
                    </div>
                    <p className="mt-0.5 text-[11px] text-slate-400">Serviço adicional</p>
                  </div>
                  <strong className="shrink-0 text-xs text-slate-900">{kwanza.format(Number(item.preco ?? 0))}</strong>
                </button>
              );
            })}
          </div>
        </div>
      ) : null}

      {service.valor_base <= 0 && !paymentAlreadyValidated ? (
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs text-slate-600">
          Esta classe não cobra taxa de rematrícula. A operação pode ser concluída sem pagamento.
        </div>
      ) : null}
    </div>
  );
}

// ─── Step 3: Payment ─────────────────────────────────────────────────────────

function StepPagamento({
  metodo,
  setMetodo,
  detalhes,
  setDetalhes,
  submitting,
  apiError,
  service,
  itensPagamento,
  paymentAlreadyValidated,
}: {
  metodo: MetodoPagamento;
  setMetodo: (m: MetodoPagamento) => void;
  detalhes: { referencia: string; evidencia_url: string; gateway_ref: string };
  setDetalhes: (
    d: Partial<{ referencia: string; evidencia_url: string; gateway_ref: string }>
  ) => void;
  submitting: boolean;
  apiError: string | null;
  service: { id: string; nome: string; valor_base: number };
  itensPagamento: RematriculaPaymentItem[];
  paymentAlreadyValidated: boolean;
}) {
  const total = service.valor_base + itensPagamento
    .filter((item) => item.id !== service.id && item.codigo !== "SERV_REMATRICULA")
    .reduce((sum, item) => sum + Number(item.preco ?? 0) * Math.max(Number(item.quantidade ?? 1), 1), 0);
  if (paymentAlreadyValidated) {
    return (
      <div className="space-y-5">
        <h3 className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Pagamento</h3>
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900">
          <strong className="block">Pagamento da rematrícula validado</strong>
          <span className="mt-1 block text-xs">A secretaria confirmou o comprovativo. Falta apenas concluir a turma e a matrícula deste aluno.</span>
        </div>
        <div className="rounded-xl bg-slate-50 p-4 text-sm text-slate-700 text-center">
          Valor recebido: <strong className="text-slate-900">{kwanza.format(total)}</strong>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <h3 className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
        Método de Pagamento
      </h3>

      {/* Method grid */}
      <div className="grid grid-cols-5 gap-2">
        {METODOS_UI.map((m) => {
          const Icon = m.icon;
          const active = metodo === m.id;
          return (
            <button
              key={m.id}
              type="button"
              onClick={() => setMetodo(m.id)}
              disabled={submitting}
              className={`flex flex-col items-center justify-center gap-1.5 rounded-xl border p-2.5 transition-all ${
                active
                  ? "border-[#1F6B3B] bg-[#1F6B3B]/5 text-[#1F6B3B] ring-2 ring-[#1F6B3B]/20"
                  : "border-slate-200 bg-white text-slate-500 hover:bg-slate-50 hover:border-slate-300"
              } disabled:opacity-50 disabled:cursor-not-allowed`}
            >
              <Icon className="h-5 w-5" />
              <span className="text-[10px] font-bold uppercase tracking-wide">
                {m.label}
              </span>
            </button>
          );
        })}
      </div>

      {/* Conditional fields */}
      {metodo === "tpa" && (
        <div className="space-y-1.5">
          <label
            htmlFor="rematricula-ref-tpa"
            className="block text-xs font-bold uppercase tracking-wide text-slate-500"
          >
            Referência TPA <span className="text-rose-500">*</span>
          </label>
          <input
            id="rematricula-ref-tpa"
            type="text"
            value={detalhes.referencia}
            onChange={(e) => setDetalhes({ referencia: e.target.value })}
            disabled={submitting}
            className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none
              focus:border-[#E3B23C] focus:ring-4 focus:ring-[#E3B23C]/20
              disabled:bg-slate-50 disabled:text-slate-400"
            placeholder="Ref. do talão"
          />
        </div>
      )}

      {metodo === "transfer" && (
        <div className="space-y-1.5">
          <label
            htmlFor="rematricula-evidence"
            className="block text-xs font-bold uppercase tracking-wide text-slate-500"
          >
            Comprovativo (URL) <span className="text-rose-500">*</span>
          </label>
          <input
            id="rematricula-evidence"
            type="url"
            value={detalhes.evidencia_url}
            onChange={(e) => setDetalhes({ evidencia_url: e.target.value })}
            disabled={submitting}
            className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none
              focus:border-[#E3B23C] focus:ring-4 focus:ring-[#E3B23C]/20
              disabled:bg-slate-50 disabled:text-slate-400"
            placeholder="https://…"
          />
        </div>
      )}

      {(metodo === "mcx" || metodo === "kiwk") && (
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <label
              htmlFor="rematricula-ref-mcx"
              className="block text-xs font-bold uppercase tracking-wide text-slate-500"
            >
              Referência
            </label>
            <input
              id="rematricula-ref-mcx"
              type="text"
              value={detalhes.referencia}
              onChange={(e) => setDetalhes({ referencia: e.target.value })}
              disabled={submitting}
              className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none
                focus:border-[#E3B23C] focus:ring-4 focus:ring-[#E3B23C]/20
                disabled:bg-slate-50"
            />
          </div>
          <div className="space-y-1.5">
            <label
              htmlFor="rematricula-gw-ref"
              className="block text-xs font-bold uppercase tracking-wide text-slate-500"
            >
              ID Gateway
            </label>
            <input
              id="rematricula-gw-ref"
              type="text"
              value={detalhes.gateway_ref}
              onChange={(e) => setDetalhes({ gateway_ref: e.target.value })}
              disabled={submitting}
              className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none
                focus:border-[#E3B23C] focus:ring-4 focus:ring-[#E3B23C]/20
                disabled:bg-slate-50"
            />
          </div>
        </div>
      )}

      {/* Error */}
      {apiError && (
        <div
          role="alert"
          className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700 font-medium"
        >
          {ERROR_MESSAGES[apiError] || apiError}
        </div>
      )}

      {/* Confirmation text */}
      <div className="rounded-xl bg-slate-50 p-4 border border-slate-100 text-sm text-slate-700 text-center font-medium">
        Confirma que recebeu{" "}
        <strong className="text-slate-900">
          {kwanza.format(total)}
        </strong>{" "}
        e deseja concluir a rematrícula?
      </div>
    </div>
  );
}

// ─── Success View ────────────────────────────────────────────────────────────

function SuccessView({
  result,
  alunoNome,
  anoLetivo,
  selectedTurma,
  service,
  paymentTotal,
  metodo,
  paymentAlreadyValidated,
  onPostAction,
}: {
  result: RematriculaResult;
  alunoNome: string;
  anoLetivo: { id: string; ano: number; label: string };
  selectedTurma: TurmaOption | undefined;
  service: { id: string; nome: string; valor_base: number };
  paymentTotal: number;
  metodo: MetodoPagamento;
  paymentAlreadyValidated: boolean;
  onPostAction: (action: EnrollmentPostAction) => void;
}) {
  const turnoStr = selectedTurma?.turno
    ? TURNO_LABEL[selectedTurma.turno] || selectedTurma.turno
    : "";
  const turmaLabel = selectedTurma
    ? `${selectedTurma.nome}${turnoStr ? ` · ${turnoStr}` : ""}`
    : "—";
  const documentPending = isDocumentPendingResult(result);
  const academicHistoryPending = isAcademicHistoryPendingResult(result);
  const partialCompletion = documentPending || academicHistoryPending;

  return (
    <div className="space-y-6 text-center py-4">
      <div
        className={`mx-auto flex h-16 w-16 items-center justify-center rounded-full ${
          partialCompletion ? "bg-amber-100" : "bg-[#1F6B3B]/10"
        }`}
      >
        {partialCompletion ? (
          <AlertTriangle className="h-8 w-8 text-amber-700" />
        ) : (
          <CheckCircle className="h-8 w-8 text-[#1F6B3B]" />
        )}
      </div>
      <div>
        <h3 className="text-xl font-bold text-slate-900">
          {academicHistoryPending
            ? "Rematrícula concluída · histórico académico pendente"
            : documentPending
              ? "Rematrícula concluída · comprovante pendente"
              : "Rematrícula concluída"}
        </h3>
        <p className="text-sm text-slate-500 mt-1">
          {academicHistoryPending
            ? "A matrícula e o pagamento foram preservados. Falta apenas reconciliar o histórico académico da matrícula de origem."
            : documentPending
              ? "A matrícula e o pagamento foram preservados. Falta apenas emitir o comprovante."
              : "A matrícula do ano destino foi criada ou actualizada com a turma seleccionada."}
        </p>
      </div>

      {partialCompletion && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-left text-sm text-amber-950">
          <p className="font-bold">Não faça uma nova cobrança.</p>
          <p className="mt-1 text-xs leading-relaxed text-amber-900/80">
            {academicHistoryPending
              ? "Feche esta etapa para atualizar o atendimento. Ao retomar, o Balcão reutiliza a matrícula e o pagamento já confirmados e tenta reconciliar somente o histórico académico."
              : "Feche esta etapa para atualizar o atendimento. O Balcão reutiliza o pagamento já confirmado e permite tentar emitir o comprovante novamente."}
          </p>
        </div>
      )}

      <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-left text-sm space-y-2.5">
        <InfoRow label="Aluno" value={alunoNome} />
        <InfoRow label="Ano" value={anoLetivo.label} />
        <InfoRow label="Turma" value={turmaLabel} />
        <InfoRow
          label="Pagamento"
          value={paymentTotal <= 0
            ? "Não aplicável"
            : paymentAlreadyValidated
              ? `${kwanza.format(paymentTotal)} · Comprovativo validado`
              : `${kwanza.format(paymentTotal)} · ${METODOS_UI.find((m) => m.id === metodo)?.label || metodo}`}
        />
        <div className="flex justify-between gap-4">
          <span className="text-slate-500">Matrícula</span>
          <span className="font-semibold text-[#1F6B3B]">Concluída</span>
        </div>
        {documentPending && (
          <div className="flex justify-between gap-4">
            <span className="text-slate-500">Comprovante</span>
            <span className="font-semibold text-amber-700">Pendente de emissão</span>
          </div>
        )}
        {academicHistoryPending && (
          <div className="flex justify-between gap-4">
            <span className="text-slate-500">Histórico académico</span>
            <span className="font-semibold text-amber-700">Pendente de reconciliação</span>
          </div>
        )}
      </div>

      {!partialCompletion && <EnrollmentPostActions onAction={onPostAction} />}
    </div>
  );
}

// ─── Footer: Success ─────────────────────────────────────────────────────────

function FooterSuccess({
  result,
  onClose,
}: {
  result: RematriculaResult;
  onClose: () => void;
}) {
  const printUrl = result.comprovante?.printUrl;
  const reciboUrl = result.recibo?.print_url;
  const documentPending = isDocumentPendingResult(result);
  const academicHistoryPending = isAcademicHistoryPendingResult(result);
  const partialCompletion = documentPending || academicHistoryPending;

  return (
    <div className="flex flex-col gap-2 sm:flex-row">
      {reciboUrl && (
        <button
          onClick={() => window.open(reciboUrl, "_blank", "noopener,noreferrer")}
          className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl
            bg-amber px-4 py-2.5 text-sm font-bold text-white
            hover:brightness-110 transition-colors"
        >
          <Printer className="h-4 w-4" />
          Abrir recibo
        </button>
      )}
      {printUrl && (
        <>
          <button
            onClick={() => window.open(printUrl, "_blank", "noopener,noreferrer")}
            className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl
              bg-[#1F6B3B] px-4 py-2.5 text-sm font-bold text-white
              hover:brightness-110 transition-colors"
          >
            <Printer className="h-4 w-4" />
            Abrir comprovante
          </button>
          <button
            onClick={() => window.open(printUrl, "_blank", "noopener,noreferrer")}
            className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl
              bg-white border border-slate-200 px-4 py-2.5 text-sm font-bold text-slate-700
              hover:bg-slate-50 transition-colors"
          >
            <ExternalLink className="h-4 w-4" />
            Abrir comprovante
          </button>
        </>
      )}
      <button
        onClick={onClose}
        className={`${
          printUrl ? "" : "flex-1 "
        }rounded-xl bg-slate-200 px-4 py-2.5 text-sm font-bold text-slate-700
          hover:bg-slate-300 transition-colors`}
      >
        {partialCompletion ? "Fechar e atualizar estado" : "Fechar"}
      </button>
    </div>
  );
}

// ─── Footer: Wizard ──────────────────────────────────────────────────────────

function FooterWizard({
  step,
  setStep,
  onClose,
  submitting,
  canSubmit,
  academicReady,
  financialReady,
  onRegularizeDebt,
  paymentTotal,
  paymentAlreadyValidated,
  academicOnly,
  reconciliationOnly,
  submit,
}: {
  step: number;
  setStep: (n: number) => void;
  onClose: () => void;
  submitting: boolean;
  canSubmit: boolean;
  academicReady: boolean;
  financialReady: boolean;
  onRegularizeDebt?: () => void;
  paymentTotal: number;
  paymentAlreadyValidated: boolean;
  academicOnly: boolean;
  reconciliationOnly: boolean;
  submit: () => Promise<void>;
}) {
  return (
    <div className="flex justify-between">
      <button
        onClick={() => (step > 1 ? setStep(step - 1) : onClose())}
        disabled={submitting}
        className="rounded-xl px-4 py-2.5 text-sm font-bold text-slate-600
          hover:bg-slate-200 transition-colors disabled:opacity-50"
      >
        {step > 1 ? "Voltar" : "Cancelar"}
      </button>

      {step < 3 && !academicOnly && !(step === 2 && paymentTotal <= 0 && financialReady) ? (
        <button
          onClick={() => {
            if (step === 2 && !financialReady) {
              onRegularizeDebt?.();
              return;
            }
            setStep(step + 1);
          }}
          disabled={submitting || (step === 1 && !academicReady) || (step === 2 && paymentTotal <= 0 && financialReady) || (step === 2 && !financialReady && !onRegularizeDebt)}
          className="rounded-xl bg-[#E3B23C] px-6 py-2.5 text-sm font-bold text-slate-900
            hover:brightness-95 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {step === 2 && !financialReady ? "Regularizar dívida" : "Próximo"}
        </button>
      ) : (
        <button
          onClick={submit}
          disabled={!canSubmit}
          className="inline-flex items-center gap-2 rounded-xl bg-[#1F6B3B] px-6 py-2.5
            text-sm font-bold text-white hover:brightness-110 transition-colors
            disabled:opacity-70 disabled:cursor-not-allowed"
        >
          {submitting ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              A processar…
            </>
          ) : (
            <>
              <Check className="h-4 w-4" />
              {reconciliationOnly ? "Registar decisão e concluir matrícula" : academicOnly ? "Registar conclusão" : paymentAlreadyValidated ? "Concluir rematrícula" : paymentTotal > 0 ? "Pagar e concluir rematrícula" : "Concluir matrícula"}
            </>
          )}
        </button>
      )}
    </div>
  );
}

// ─── Shared atoms ────────────────────────────────────────────────────────────

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between">
      <span className="text-slate-500">{label}</span>
      <span className="font-semibold text-slate-900">{value}</span>
    </div>
  );
}
