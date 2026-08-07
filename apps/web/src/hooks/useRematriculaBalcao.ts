import { useState, useCallback, useEffect } from "react";

// ─── Exported Types ──────────────────────────────────────────────────────────

export type RematriculaCardState =
  | "READY"
  | "DEBT_BLOCKED"
  | "PRICE_NOT_CONFIGURED"
  | "ALREADY_COMPLETED"
  | "PAYMENT_IN_PROGRESS"
  | "RECONCILIATION_REQUIRED";

export interface TurmaOption {
  id: string;
  nome: string;
  turno: string | null;
  capacidade_maxima: number | null;
  ocupacao_atual: number;
  classe_nome: string | null;
  curso_nome: string | null;
  turma_codigo: string | null;
  session_id: string | null;
}

export interface RematriculaResult {
  ok: boolean;
  pedido_id?: string;
  rematricula?: {
    matricula_id: string;
    ano_letivo_id: string;
    turma_id: string;
  };
  pagamento?: { id: string } | null;
  comprovante?: {
    ok?: boolean;
    docId?: string;
    publicId?: string;
    printUrl?: string;
  } | null;
  error?: string;
  code?: string;
}

type MetodoPagamento = "cash" | "tpa" | "transfer" | "mcx" | "kiwk";

interface StatusResponse {
  ok: boolean;
  status: RematriculaCardState;
  service: { id: string; nome: string; valor_base: number } | null;
  debt: { total: number; count: number } | null;
  pedido: {
    id: string;
    status: string;
    created_at: string;
    turma_id?: string;
    valor_cobrado?: number;
  } | null;
  comprovante: {
    docId: string;
    publicId: string;
    printUrl: string;
  } | null;
  ano_letivo: { id: string; ano: number; label: string } | null;
}

// ─── Error code → human message ──────────────────────────────────────────────

const ERROR_MESSAGES: Record<string, string> = {
  ACADEMIC_YEAR_REQUIRED: "Seleccione o ano lectivo da operação.",
  ACADEMIC_YEAR_CLOSED: "Este ano lectivo não aceita alterações.",
  REMATRICULA_SOURCE_INVALID:
    "A matrícula actual do aluno não foi encontrada.",
  REMATRICULA_DEBT_REQUIRED:
    "Regularize as dívidas antes de rematricular.",
  REMATRICULA_PRICE_NOT_CONFIGURED:
    "O emolumento ainda não foi configurado pela escola.",
  PAYMENT_REQUIRED: "O pagamento não foi confirmado.",
  PAYMENT_IN_PROGRESS: "Já existe um pagamento em andamento.",
  REMATRICULA_RECONCILIATION_REQUIRED:
    "Pagamento confirmado; atendimento enviado para reconciliação.",
  CROSS_YEAR_ENTITY_MISMATCH:
    "A turma seleccionada não pertence ao ano lectivo.",
  DOCUMENT_PENDING:
    "Rematrícula concluída; comprovante pendente de emissão.",
};

const DETALHES_VAZIOS = {
  referencia: "",
  evidencia_url: "",
  gateway_ref: "",
};

// ─── Hook ────────────────────────────────────────────────────────────────────

export function useRematriculaBalcao(opts: {
  escolaId: string;
  alunoId: string | null;
  matriculaId: string | null;
  academicYearId: string | null;
}) {
  // ── Status data ─────────────────────────────────────────────────────────
  const [cardState, setCardState] = useState<RematriculaCardState | null>(null);
  const [loading, setLoading] = useState(false);
  const [service, setService] = useState<StatusResponse["service"]>(null);
  const [debt, setDebt] = useState<StatusResponse["debt"]>(null);
  const [pedido, setPedido] = useState<StatusResponse["pedido"]>(null);
  const [comprovante, setComprovante] =
    useState<StatusResponse["comprovante"]>(null);
  const [anoLetivo, setAnoLetivo] =
    useState<StatusResponse["ano_letivo"]>(null);

  // ── Turmas ──────────────────────────────────────────────────────────────
  const [turmas, setTurmas] = useState<TurmaOption[]>([]);
  const [turmasLoading, setTurmasLoading] = useState(false);
  const [turmasFetched, setTurmasFetched] = useState(false);

  // ── Modal wizard ────────────────────────────────────────────────────────
  const [modalOpen, setModalOpen] = useState(false);
  const [step, setStep] = useState(1);
  const [selectedTurmaId, setSelectedTurmaId] = useState<string | null>(null);
  const [metodo, setMetodoState] = useState<MetodoPagamento>("cash");
  const [detalhes, setDetalhesState] = useState(DETALHES_VAZIOS);

  // ── Submission ──────────────────────────────────────────────────────────
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<RematriculaResult | null>(null);
  const [apiError, setApiError] = useState<string | null>(null);

  // ────────────────────────────────────────────────────────────────────────
  // Fetch rematrícula eligibility status
  // ────────────────────────────────────────────────────────────────────────
  const fetchStatus = useCallback(async () => {
    if (!opts.alunoId || !opts.matriculaId) {
      setCardState(null);
      return;
    }

    setLoading(true);
    try {
      const params = new URLSearchParams({
        aluno_id: opts.alunoId,
        matricula_id: opts.matriculaId,
      });
      if (opts.academicYearId) {
        params.set("ano_letivo_id", opts.academicYearId);
      }

      const res = await fetch(
        `/api/secretaria/balcao/rematriculas/status?${params.toString()}`,
      );
      const data: StatusResponse = await res.json();

      if (data.ok) {
        setCardState(data.status);
        setService(data.service);
        setDebt(data.debt);
        setPedido(data.pedido);
        setComprovante(data.comprovante);
        setAnoLetivo(data.ano_letivo);
      } else {
        setCardState(null);
      }
    } catch (e) {
      console.error("[useRematriculaBalcao] Error fetching status:", e);
      setCardState(null);
    } finally {
      setLoading(false);
    }
  }, [opts.alunoId, opts.matriculaId, opts.academicYearId]);

  // Auto-fetch on aluno/matricula change
  useEffect(() => {
    fetchStatus();
    // Reset modal state when student changes
    setModalOpen(false);
    setStep(1);
    setSelectedTurmaId(null);
    setResult(null);
    setApiError(null);
    setTurmasFetched(false);
    setTurmas([]);
  }, [fetchStatus]);

  // ────────────────────────────────────────────────────────────────────────
  // Lazy-fetch turmas when modal opens
  // ────────────────────────────────────────────────────────────────────────
  const fetchTurmas = useCallback(async () => {
    if (!anoLetivo?.id || !opts.alunoId) return;
    if (turmasFetched) return;

    setTurmasLoading(true);
    try {
      const params = new URLSearchParams({
        session_id: anoLetivo.id,
        aluno_id: opts.alunoId,
      });
      const res = await fetch(
        `/api/secretaria/turmas-simples?${params.toString()}`,
      );
      const data = await res.json();
      if (data.items && Array.isArray(data.items)) {
        setTurmas(
          data.items.map((t: any) => ({
            id: t.id,
            nome: t.nome ?? t.turma_nome ?? "—",
            turno: t.turno ?? null,
            capacidade_maxima: t.capacidade_maxima ?? null,
            ocupacao_atual: Number(t.ocupacao_atual ?? 0),
            classe_nome: t.classe_nome ?? t.classe?.nome ?? null,
            curso_nome: t.curso_nome ?? t.curso?.nome ?? null,
            turma_codigo: t.turma_codigo ?? null,
            session_id: t.session_id ?? null,
          })),
        );
        setTurmasFetched(true);
      }
    } catch (e) {
      console.error("[useRematriculaBalcao] Error fetching turmas:", e);
    } finally {
      setTurmasLoading(false);
    }
  }, [anoLetivo?.id, opts.alunoId, turmasFetched]);

  // ────────────────────────────────────────────────────────────────────────
  // Modal controls
  // ────────────────────────────────────────────────────────────────────────
  const openModal = useCallback(() => {
    setModalOpen(true);
    setStep(1);
    setResult(null);
    setApiError(null);
    fetchTurmas();
  }, [fetchTurmas]);

  const closeModal = useCallback(() => {
    if (submitting) return;
    setModalOpen(false);
    // If result was set (success), refresh status to update the card
    if (result) {
      fetchStatus();
    }
  }, [submitting, result, fetchStatus]);

  // Reset detalhes when payment method changes
  const setMetodo = useCallback((m: MetodoPagamento) => {
    setMetodoState(m);
    setDetalhesState(DETALHES_VAZIOS);
  }, []);

  const setDetalhes = useCallback(
    (d: Partial<typeof DETALHES_VAZIOS>) => {
      setDetalhesState((prev) => ({ ...prev, ...d }));
    },
    [],
  );

  // ────────────────────────────────────────────────────────────────────────
  // Submit rematrícula
  // ────────────────────────────────────────────────────────────────────────
  const submit = useCallback(async () => {
    if (
      !opts.alunoId ||
      !opts.matriculaId ||
      !anoLetivo?.id ||
      !selectedTurmaId
    ) {
      return;
    }

    setSubmitting(true);
    setApiError(null);
    setResult(null);

    try {
      const res = await fetch("/api/secretaria/balcao/rematriculas", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Idempotency-Key": crypto.randomUUID(),
        },
        body: JSON.stringify({
          aluno_id: opts.alunoId,
          matricula_id: opts.matriculaId,
          ano_letivo_id: anoLetivo.id,
          destino_turma_id: selectedTurmaId,
          metodo,
          reference: detalhes.referencia.trim() || null,
          evidence_url: detalhes.evidencia_url.trim() || null,
          gateway_ref: detalhes.gateway_ref.trim() || null,
        }),
      });

      const data = await res.json();

      if (data.ok || res.status === 202) {
        // Success or partial success (document pending)
        setResult(data);
        setStep(4); // → success view
      } else {
        // Map error code to human message, fall back to raw error
        const code = data.code as string | undefined;
        const mapped = code ? ERROR_MESSAGES[code] : null;
        setApiError(mapped ?? data.error ?? "Ocorreu um erro desconhecido.");
      }
    } catch {
      setApiError("Erro de comunicação com o servidor.");
    } finally {
      setSubmitting(false);
    }
  }, [
    opts.alunoId,
    opts.matriculaId,
    anoLetivo?.id,
    selectedTurmaId,
    metodo,
    detalhes,
  ]);

  // ────────────────────────────────────────────────────────────────────────
  // Return
  // ────────────────────────────────────────────────────────────────────────
  return {
    // Card state
    cardState,
    loading,

    // Data from status endpoint
    service,
    debt,
    pedido,
    comprovante,
    anoLetivo,

    // Turmas
    turmas,
    turmasLoading,

    // Modal
    modalOpen,
    openModal,
    closeModal,
    step,
    setStep,

    // Payment
    metodo,
    setMetodo,
    detalhes,
    setDetalhes,

    // Turma selection
    selectedTurmaId,
    setSelectedTurmaId,

    // Submission
    submitting,
    result,
    apiError,
    submit,

    // Actions
    refreshStatus: fetchStatus,
  };
}
