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
  X,
} from "lucide-react";
import { EnrollmentPostActions, type EnrollmentPostAction } from "@/components/secretaria/EnrollmentPostActions";
import type { TurmaOption, RematriculaResult, ProgressaoBalcao, RematriculaPaymentItem, ResultadoDecisaoBalcao } from "@/hooks/useRematriculaBalcao";

// ─── Types ───────────────────────────────────────────────────────────────────

type MetodoPagamento = "cash" | "tpa" | "transfer" | "mcx" | "kiwk";

interface RematriculaBalcaoModalProps {
  open: boolean;
  onClose: () => void;
  // Student data
  alunoNome: string;
  alunoProcesso: string;
  turmaAtual: string | null;
  matriculaId: string;
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
  notasLancarDepois: boolean;
  setNotasLancarDepois: (value: boolean) => void;
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
  REMATRICULA_DECISION_REQUIRED:
    "Confirme que as notas serão lançadas posteriormente.",
  CROSS_YEAR_ENTITY_MISMATCH:
    "A turma seleccionada não pertence ao ano lectivo.",
  DOCUMENT_PENDING:
    "Rematrícula concluída; comprovante pendente de emissão.",
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
  { id: "cash" as const, icon: Banknote, label: "Cash" },
  { id: "tpa" as const, icon: CreditCard, label: "TPA" },
  { id: "transfer" as const, icon: Wallet, label: "Transf" },
  { id: "mcx" as const, icon: Smartphone, label: "MCX" },
  { id: "kiwk" as const, icon: Smartphone, label: "KIWK" },
] as const;

const STEP_LABELS = ["Académico", "Financeiro", "Pagamento"];

// ─── Component ───────────────────────────────────────────────────────────────

export function RematriculaBalcaoModal(props: RematriculaBalcaoModalProps) {
  const {
    open,
    onClose,
    alunoNome,
    alunoProcesso,
    onPostAction,
    turmaAtual,
    matriculaId,
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
    notasLancarDepois,
    setNotasLancarDepois,
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
    if (open) {
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
  }, [open]);

  // Re-focus when step changes
  useEffect(() => {
    if (open && !result) {
      const timer = setTimeout(() => firstFocusRef.current?.focus(), 60);
      return () => clearTimeout(timer);
    }
  }, [open, step, result]);

  // ── Keyboard handling ───────────────────────────────────────────────────
  useEffect(() => {
    if (!open) return;
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
  }, [open, result, submitting, step, onClose]);

  if (!open) return null;

  // ── Helpers ──────────────────────────────────────────────────────────────
  const handleOverlayClick = (e: React.MouseEvent) => {
    if (e.target !== e.currentTarget) return;
    if (submitting) return;
    if (result || step < 3) onClose();
  };

  const selectedTurma = turmas.find((t) => t.id === selectedTurmaId);
  const academicOnly = decisaoResultado === "concluido";
  const singleStep = academicOnly || reconciliationOnly;
  const financialReady = !debt || debt.total <= 0;

  const canSubmit =
    !submitting &&
    (academicOnly || (Boolean(selectedTurmaId) && financialReady)) &&
    (academicOnly || paymentAlreadyValidated || (
      !(metodo === "tpa" && !detalhes.referencia.trim()) &&
      !(metodo === "transfer" && !detalhes.evidencia_url.trim())
    ));
  const academicReady =
    (academicOnly || Boolean(selectedTurmaId)) &&
    !(progressao?.estado === "notas_pendentes" && !notasLancarDepois && decisaoFonte !== "declaracao_administrativa_escola") &&
    !(decisaoFonte === "declaracao_administrativa_escola" && !decisaoMotivo.trim());

  // ── Render ───────────────────────────────────────────────────────────────
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-sm"
      onClick={handleOverlayClick}
    >
      <div
        className="relative w-full max-w-lg rounded-2xl bg-white shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
        role="dialog"
        aria-modal="true"
        aria-labelledby="rematricula-modal-title"
      >
        {/* ── Header (hidden on success) ──────────────────────────────── */}
        {!result && (
          <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
            <div>
              <h2
                id="rematricula-modal-title"
                className="font-bold text-slate-900"
              >
                {skipTurmaSelection
                  ? `Regularizar taxa de rematrícula ${anoLetivo.label}`
                  : `Confirmar rematrícula ${anoLetivo.label}`}
              </h2>

              {/* Step indicator */}
              {!skipTurmaSelection && <div className="flex items-center gap-3 mt-2.5">
                {STEP_LABELS.map((label, i) => {
                  const s = i + 1;
                  const isActive = s === step;
                  const isDone = s < step;
                  return (
                    <div key={s} className="flex items-center gap-1.5">
                      <div
                        className={`h-2 w-2 rounded-full transition-colors ${
                          isActive
                            ? "bg-[#1F6B3B]"
                            : isDone
                            ? "bg-[#1F6B3B]/40"
                            : "bg-slate-200"
                        }`}
                      />
                      <span
                        className={`text-[10px] font-semibold uppercase tracking-wide ${
                          isActive
                            ? "text-[#1F6B3B]"
                            : isDone
                            ? "text-[#1F6B3B]/50"
                            : "text-slate-300"
                        }`}
                      >
                        {label}
                      </span>
                    </div>
                  );
                })}
              </div>}
            </div>

            {!submitting && (
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
        <div className="flex-1 overflow-y-auto p-5">
          {/* ── Success ────────────────────────────────────────────── */}
          {result ? (
            <SuccessView
              alunoNome={alunoNome}
              anoLetivo={anoLetivo}
              selectedTurma={selectedTurma}
              service={service}
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
              anoLetivo={anoLetivo}
              turmas={turmas}
              turmasLoading={turmasLoading}
              progressao={progressao}
              cohort={cohort}
              skipTurmaSelection={skipTurmaSelection}
              notasLancarDepois={notasLancarDepois}
              setNotasLancarDepois={setNotasLancarDepois}
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
              serviceValor={service.valor_base}
              paymentAlreadyValidated={paymentAlreadyValidated}
              academicOnly={singleStep}
              reconciliationOnly={reconciliationOnly}
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
  anoLetivo,
  turmas,
  turmasLoading,
  progressao,
  cohort,
  skipTurmaSelection,
  notasLancarDepois,
  setNotasLancarDepois,
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
}: {
  alunoNome: string;
  alunoProcesso: string;
  turmaAtual: string | null;
  matriculaId: string;
  anoLetivo: { id: string; ano: number; label: string };
  turmas: TurmaOption[];
  turmasLoading: boolean;
  progressao: ProgressaoBalcao | null;
  cohort: { codigo: string; nome: string; modo: string } | null;
  skipTurmaSelection: boolean;
  notasLancarDepois: boolean;
  setNotasLancarDepois: (value: boolean) => void;
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
}) {
  return (
    <div className="space-y-5">
      {/* Student info */}
      <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-4 space-y-2.5 text-sm">
        <InfoRow label="Aluno" value={alunoNome} />
        <InfoRow label="Nº Processo" value={alunoProcesso} />
        <InfoRow label="Matrícula" value={matriculaId.slice(0, 8) + "…"} />
        <InfoRow label="Turma actual" value={turmaAtual || "—"} />
        <InfoRow label="Ano lectivo" value={anoLetivo.label} />
      </div>

      {skipTurmaSelection ? (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900">
          <strong className="block text-emerald-950">Regularização da taxa de rematrícula</strong>
          <span className="mt-1 block text-xs">O aluno já está matriculado em {anoLetivo.label}. A turma e a classe atuais serão preservadas; prossiga apenas para cobrar a taxa e emitir o comprovativo.</span>
        </div>
      ) : <>
      {/* Decisão académica no próprio atendimento */}
      <div className="rounded-xl border border-slate-200 bg-white p-4 space-y-3">
        <div>
          <p className="text-sm font-bold text-slate-900">Decisão académica</p>
          <p className="mt-1 text-xs text-slate-500">Registe aqui a decisão da escola. Não é necessário sair do balcão para abrir a pauta.</p>
        </div>
        {cohort && (
          <div className="rounded-xl border border-violet-200 bg-violet-50 p-3 text-xs text-violet-900">
            <strong className="block">{cohort.nome}</strong>
            <span>Exceção temporária {cohort.codigo}: a decisão administrativa é permitida para esta matrícula e ficará auditada.</span>
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
              className={`rounded-xl border px-2 py-2 text-xs font-bold transition-colors ${decisaoResultado === value ? "border-[#1F6B3B] bg-[#1F6B3B]/10 text-[#1F6B3B]" : "border-slate-200 text-slate-600 hover:bg-slate-50"}`}
            >
              {label}
            </button>
          ))}
        </div>
        <label className="block text-xs font-bold uppercase tracking-wide text-slate-500" htmlFor="rematricula-decisao-fonte">
          Fonte da decisão
        </label>
        <select
          id="rematricula-decisao-fonte"
          value={decisaoFonte}
          onChange={(event) => setDecisaoFonte(event.target.value)}
          className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-medium text-slate-900 outline-none focus:border-[#E3B23C] focus:ring-4 focus:ring-[#E3B23C]/20"
        >
          <option value="raa">RAA / registo académico</option>
          <option value="declaracao_administrativa_escola">Declaração administrativa da escola</option>
        </select>
        {decisaoFonte === "declaracao_administrativa_escola" && (
          <div className="space-y-2">
            <label className="block text-xs font-bold uppercase tracking-wide text-slate-500" htmlFor="rematricula-decisao-motivo">
              Motivo obrigatório
            </label>
            <input
              id="rematricula-decisao-motivo"
              value={decisaoMotivo}
              onChange={(event) => setDecisaoMotivo(event.target.value)}
              placeholder="Ex.: decisão confirmada pela direção no balcão"
              className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-[#E3B23C] focus:ring-4 focus:ring-[#E3B23C]/20"
            />
            <label className="block text-xs font-bold uppercase tracking-wide text-slate-500" htmlFor="rematricula-decisao-observacao">
              Observação (opcional)
            </label>
            <textarea
              id="rematricula-decisao-observacao"
              value={decisaoObservacao}
              onChange={(event) => setDecisaoObservacao(event.target.value)}
              rows={2}
              placeholder="Contexto adicional para a auditoria"
              className="w-full resize-none rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-[#E3B23C] focus:ring-4 focus:ring-[#E3B23C]/20"
            />
          </div>
        )}
      </div>

      {/* Turma selector */}
      {progressao && (
        <div className={`rounded-xl border p-3 text-sm ${progressao.estado === "reprovado" ? "border-amber-200 bg-amber-50 text-amber-800" : "border-sky-200 bg-sky-50 text-sky-800"}`}>
          <strong>{progressao.orientacao?.titulo ?? (progressao.estado === "reprovado" ? "Retenção académica" : "Progressão académica")}</strong>
          <p className="mt-1 text-xs">{progressao.orientacao?.mensagem ?? progressao.mensagem}</p>
          {progressao.orientacao?.proximo_passo && (
            <p className="mt-2 text-xs font-semibold">Próximo passo: {progressao.orientacao.proximo_passo}</p>
          )}
        </div>
      )}

      {progressao?.estado === "notas_pendentes" && (
        <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700">
          <input
            type="checkbox"
            checked={notasLancarDepois}
            onChange={(event) => setNotasLancarDepois(event.target.checked)}
            className="mt-0.5 h-4 w-4 rounded border-slate-300 text-[#1F6B3B] focus:ring-[#1F6B3B]"
          />
          <span>
            <strong className="block text-slate-900">Lançar notas depois e rematricular agora</strong>
            <span className="mt-0.5 block text-xs text-slate-500">A progressão fica provisória até o fechamento académico.</span>
          </span>
        </label>
      )}

      {decisaoResultado === "concluido" ? (
        <div className="rounded-xl border border-violet-200 bg-violet-50 p-3 text-sm text-violet-900">
          <strong className="block text-violet-950">Conclusão sem matrícula destino</strong>
          <span className="text-xs">Será encerrada apenas a matrícula de origem. Não haverá taxa nem criação de matrícula no novo ano.</span>
        </div>
      ) : <div className="space-y-2">
        <label
          htmlFor="rematricula-turma-select"
          className="block text-sm font-semibold text-slate-700"
        >
          Turma para {anoLetivo.label}{" "}
          <span className="text-rose-500">*</span>
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
            Não há turma elegível para esta decisão no ano de destino. Escolha
            <strong> Concluído</strong> quando o ciclo terminar aqui, ou peça à
            direção para preparar a turma correspondente antes de continuar.
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
}: {
  service: { id: string; nome: string; valor_base: number; pricing_origin?: "classe" | "fallback" };
  debt: { total: number; count: number } | null;
  selectedTurma?: TurmaOption;
  itensPagamento: RematriculaPaymentItem[];
  itensDisponiveis: RematriculaPaymentItem[];
  onAdicionarItem?: (item: RematriculaPaymentItem) => void;
  onRemoverItem?: (id: string, tipo: RematriculaPaymentItem["tipo"]) => void;
  onRegularizeDebt?: () => void;
}) {
  const itensAdicionais = itensPagamento.filter(
    (item) => item.id !== service.id && item.codigo !== "SERV_REMATRICULA",
  );
  const total = service.valor_base + itensAdicionais.reduce(
    (sum, item) => sum + Number(item.preco ?? 0) * Math.max(Number(item.quantidade ?? 1), 1),
    0,
  );
  const temMensalidade = itensAdicionais.some((item) => item.tipo === "mensalidade");
  const itemEstaSeleccionado = (item: RematriculaPaymentItem) => itensPagamento.some(
    (seleccionado) => seleccionado.id === item.id && seleccionado.tipo === item.tipo,
  );
  const mensalidadesDisponiveis = itensDisponiveis.filter((item) => item.tipo === "mensalidade");
  const servicosDisponiveis = itensDisponiveis.filter((item) => item.tipo === "servico");
  return (
    <div className="space-y-5">
      <h3 className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
        Resumo Financeiro
      </h3>

      <div className="rounded-xl border border-slate-200 overflow-hidden text-sm">
        <div className="flex justify-between border-b border-slate-100 p-3.5 bg-slate-50">
          <span className="text-slate-600">Classe/turma destino</span>
          <span className="text-right font-semibold text-slate-900">
            {selectedTurma?.classe_nome || "Classe não identificada"}
            {selectedTurma?.nome ? <span className="block text-xs font-normal text-slate-500">{selectedTurma.nome}</span> : null}
          </span>
        </div>
        <div className="flex justify-between border-b border-slate-100 p-3.5 bg-white">
          <span className="text-slate-600">Taxa de rematrícula</span>
          <span className="font-semibold text-slate-900">
            {service.valor_base > 0 ? kwanza.format(service.valor_base) : "Sem taxa"}
          </span>
        </div>
        {itensAdicionais.length > 0 && (
          <div className="border-b border-slate-100 bg-white p-3.5">
            <p className="mb-2 text-xs font-black uppercase tracking-wide text-slate-500">Serviços e cobranças adicionais</p>
            <div className="space-y-2">
              {itensAdicionais.map((item) => {
                const quantidade = Math.max(Number(item.quantidade ?? 1), 1);
                return (
                  <div key={`${item.tipo}-${item.id}`} className="flex justify-between gap-3 text-sm">
                    <span className="text-slate-600">{item.nome || item.descricao || "Serviço escolar"}{quantidade > 1 ? ` × ${quantidade}` : ""}</span>
                    <strong className="text-slate-900">{kwanza.format(Number(item.preco ?? 0) * quantidade)}</strong>
                  </div>
                );
              })}
            </div>
          </div>
        )}
        <div className="flex justify-between border-b border-slate-100 p-3.5 bg-white">
          <span className="text-slate-600">Mensalidade</span>
          <span className={temMensalidade ? "font-semibold text-emerald-700" : "text-slate-400 italic"}>
            {temMensalidade ? "Incluída acima" : "Não incluída"}
          </span>
        </div>
        <div className="flex justify-between p-3.5 bg-slate-50">
          <span className="font-bold text-slate-900">Total a pagar</span>
          <span className="font-black text-[#1F6B3B] text-base">
            {total > 0 ? kwanza.format(total) : "Sem taxa"}
          </span>
        </div>
      </div>
      <p className="text-xs text-slate-500">
        O valor acima foi resolvido para a turma destino. {service.pricing_origin === "classe" ? "Existe uma regra específica para esta classe." : "Não existe regra específica para esta classe; foi usado o valor de fallback."}
      </p>

      {itensDisponiveis.length > 0 && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50/40 p-3.5">
          <div className="mb-3">
            <p className="text-sm font-bold text-emerald-950">Adicionar a esta cobrança</p>
            <p className="mt-0.5 text-xs text-emerald-800">
              Os itens seleccionados serão liquidados no mesmo pagamento e constarão no recibo da rematrícula.
            </p>
          </div>
          <div className="space-y-2">
            {mensalidadesDisponiveis.map((item) => {
              const seleccionado = itemEstaSeleccionado(item);
              return (
                <button
                  key={`${item.tipo}-${item.id}`}
                  type="button"
                  onClick={() => seleccionado ? onRemoverItem?.(item.id, item.tipo) : onAdicionarItem?.(item)}
                  className={`flex w-full items-center justify-between gap-3 rounded-lg border px-3 py-2.5 text-left transition ${
                    seleccionado
                      ? "border-emerald-500 bg-emerald-100 text-emerald-950"
                      : "border-emerald-200 bg-white text-slate-700 hover:border-emerald-400"
                  }`}
                >
                  <span>
                    <span className="block text-xs font-bold">{item.nome || "Mensalidade"}</span>
                    <span className="block text-[11px]">Mensalidade</span>
                  </span>
                  <span className="flex shrink-0 items-center gap-2 text-xs font-black">
                    {kwanza.format(Number(item.preco ?? 0))}
                    <span className="rounded-md bg-white/80 px-1.5 py-0.5 text-[10px] font-bold">
                      {seleccionado ? "Remover" : "Adicionar"}
                    </span>
                  </span>
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
                  className={`flex w-full items-center justify-between gap-3 rounded-lg border px-3 py-2.5 text-left transition ${
                    seleccionado
                      ? "border-emerald-500 bg-emerald-100 text-emerald-950"
                      : "border-emerald-200 bg-white text-slate-700 hover:border-emerald-400"
                  }`}
                >
                  <span>
                    <span className="block text-xs font-bold">{item.nome || "Serviço escolar"}</span>
                    <span className="block text-[11px]">Serviço adicional</span>
                  </span>
                  <span className="flex shrink-0 items-center gap-2 text-xs font-black">
                    {kwanza.format(Number(item.preco ?? 0))}
                    <span className="rounded-md bg-white/80 px-1.5 py-0.5 text-[10px] font-bold">
                      {seleccionado ? "Remover" : "Adicionar"}
                    </span>
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {debt && debt.total > 0 && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
          <strong className="block text-amber-950">Mensalidades em aberto</strong>
          <span>
            Existem {debt.count} mensalidade(s) pendente(s), no total de {kwanza.format(debt.total)}.
            Esta taxa não substitui a regularização da dívida.
          </span>
          {onRegularizeDebt && (
            <button
              type="button"
              onClick={onRegularizeDebt}
              className="mt-3 inline-flex w-full items-center justify-center rounded-xl bg-amber-600 px-3 py-2.5 text-xs font-bold text-white hover:bg-amber-700"
            >
              Regularizar dívida neste atendimento
            </button>
          )}
        </div>
      )}

      {service.valor_base <= 0 && (
        <div
          role="alert"
          className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700"
        >
          Esta classe não cobra rematrícula. A matrícula será concluída sem pagamento.
        </div>
      )}
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
  paymentAlreadyValidated: boolean;
}) {
  if (paymentAlreadyValidated) {
    return (
      <div className="space-y-5">
        <h3 className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Pagamento</h3>
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900">
          <strong className="block">Pagamento da rematrícula validado</strong>
          <span className="mt-1 block text-xs">A secretaria confirmou o comprovativo. Falta apenas concluir a turma e a matrícula deste aluno.</span>
        </div>
        <div className="rounded-xl bg-slate-50 p-4 text-sm text-slate-700 text-center">
          Valor recebido: <strong className="text-slate-900">{kwanza.format(service.valor_base)}</strong>
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
          {kwanza.format(service.valor_base)}
        </strong>{" "}
        e deseja concluir a rematrícula?
      </div>
    </div>
  );
}

// ─── Success View ────────────────────────────────────────────────────────────

function SuccessView({
  alunoNome,
  anoLetivo,
  selectedTurma,
  service,
  metodo,
  paymentAlreadyValidated,
  onPostAction,
}: {
  alunoNome: string;
  anoLetivo: { id: string; ano: number; label: string };
  selectedTurma: TurmaOption | undefined;
  service: { id: string; nome: string; valor_base: number };
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

  return (
    <div className="space-y-6 text-center py-4">
      <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-[#1F6B3B]/10">
        <CheckCircle className="h-8 w-8 text-[#1F6B3B]" />
      </div>
      <div>
        <h3 className="text-xl font-bold text-slate-900">
          Rematrícula concluída
        </h3>
        <p className="text-sm text-slate-500 mt-1">
          O aluno foi rematriculado com sucesso.
        </p>
      </div>

      <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-left text-sm space-y-2.5">
        <InfoRow label="Aluno" value={alunoNome} />
        <InfoRow label="Ano" value={anoLetivo.label} />
        <InfoRow label="Turma" value={turmaLabel} />
        <InfoRow
          label="Pagamento"
          value={paymentAlreadyValidated
            ? `${kwanza.format(service.valor_base)} · Comprovativo validado`
            : `${kwanza.format(service.valor_base)} · ${METODOS_UI.find((m) => m.id === metodo)?.label || metodo}`}
        />
        <div className="flex justify-between">
          <span className="text-slate-500">Estado</span>
          <span className="font-semibold text-[#1F6B3B]">Pago</span>
        </div>
      </div>

      <EnrollmentPostActions onAction={onPostAction} />
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

  return (
    <div className="flex flex-col gap-2 sm:flex-row">
      {reciboUrl && (
        <button
          onClick={() => window.open(reciboUrl, "_blank", "noopener,noreferrer")}
          className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl
            bg-klasse-gold px-4 py-2.5 text-sm font-bold text-white
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
        Fechar
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
  serviceValor,
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
  serviceValor: number;
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

      {step < 3 && !academicOnly && !(step === 2 && serviceValor <= 0 && financialReady) ? (
        <button
          onClick={() => {
            if (step === 2 && !financialReady) {
              onRegularizeDebt?.();
              return;
            }
            setStep(step + 1);
          }}
          disabled={submitting || (step === 1 && !academicReady) || (step === 2 && serviceValor <= 0 && financialReady) || (step === 2 && !financialReady && !onRegularizeDebt)}
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
              {reconciliationOnly ? "Registar decisão e concluir matrícula" : academicOnly ? "Registar conclusão" : paymentAlreadyValidated ? "Concluir rematrícula" : serviceValor > 0 ? "Pagar e concluir rematrícula" : "Concluir matrícula"}
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
