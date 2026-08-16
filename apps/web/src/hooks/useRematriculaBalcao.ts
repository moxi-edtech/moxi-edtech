import { useState, useCallback, useEffect } from "react";

// ─── Exported Types ──────────────────────────────────────────────────────────

export type RematriculaCardState =
  | "READY"
  | "DEBT_BLOCKED"
  | "PRICE_NOT_CONFIGURED"
  | "RECONFIRMATION_REQUIRED"
  | "FINALIST_PENDING"
  | "LEGACY_REVIEW_REQUIRED"
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

export interface ProgressaoBalcao {
  aplicada: boolean;
  modo: "promocao" | "retencao" | "indefinida";
  estado: "notas_pendentes" | "reprovado" | "classe_nao_identificada";
  classe_origem: number | null;
  classe_destino: number | null;
  turma_origem_id: string | null;
  mensagem: string;
  orientacao?: {
    titulo: string;
    mensagem: string;
    proximo_passo: string;
    acoes: Array<{ id: string; label: string; href: string; prioridade: "principal" | "secundaria" }>;
  } | null;
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
  destino_turma_id?: string | null;
  reclassificacao?: {
    id: string;
    tipo: string;
    status: string;
    destino_turma_id?: string | null;
  } | null;
  reconciliation?: { can_cancel: boolean; reason: string } | null;
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
  const [destinoTurmaId, setDestinoTurmaId] = useState<string | null>(null);
  const [reconciling, setReconciling] = useState(false);

  // ── Turmas ──────────────────────────────────────────────────────────────
  const [turmas, setTurmas] = useState<TurmaOption[]>([]);
  const [progressao, setProgressao] = useState<ProgressaoBalcao | null>(null);
  const [notasLancarDepois, setNotasLancarDepois] = useState(false);
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
        setDestinoTurmaId(data.destino_turma_id ?? null);
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
    setProgressao(null);
    setNotasLancarDepois(false);
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
      if (opts.matriculaId) params.set("matricula_id", opts.matriculaId);
      const res = await fetch(
        `/api/secretaria/turmas-simples?${params.toString()}`,
      );
      const data = await res.json();
      setProgressao(data.progressao ?? null);
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
  }, [anoLetivo?.id, opts.alunoId, opts.matriculaId, turmasFetched]);

  // ────────────────────────────────────────────────────────────────────────
  // Modal controls
  // ────────────────────────────────────────────────────────────────────────
  const openModal = useCallback(() => {
    setModalOpen(true);
    setStep(1);
    setSelectedTurmaId(
      cardState === "RECONFIRMATION_REQUIRED" ? destinoTurmaId : null,
    );
    setNotasLancarDepois(false);
    setResult(null);
    setApiError(null);
    fetchTurmas();
  }, [cardState, destinoTurmaId, fetchTurmas]);

  const closeModal = useCallback(() => {
    if (submitting) return;
    setModalOpen(false);
    // If result was set (success), refresh status to update the card
    if (result) {
      fetchStatus();
    }
  }, [submitting, result, fetchStatus]);

  const resolveLegacyPedido = useCallback(async () => {
    if (!pedido?.id || cardState !== "LEGACY_REVIEW_REQUIRED") return;
    const anoLetivoId = anoLetivo?.id;
    if (!anoLetivoId) {
      setApiError("Não foi possível identificar o ano letivo atual para este pedido.");
      return;
    }
    const anoLetivoLabel = anoLetivo.label ?? "o ano letivo atual";
    if (!window.confirm(`Associar este pedido incompleto a ${anoLetivoLabel} e iniciar uma nova operação de rematrícula?`)) {
      return;
    }
    setReconciling(true);
    try {
      const response = await fetch("/api/secretaria/balcao/rematriculas/reconcile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          pedido_id: pedido.id,
          action: "associate",
          ano_letivo_id: anoLetivoId,
        }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data.ok) throw new Error(data.error || "Não foi possível resolver o pedido incompleto.");
      await fetchStatus();
    } catch (error) {
      setApiError(error instanceof Error ? error.message : "Não foi possível resolver o pedido incompleto.");
    } finally {
      setReconciling(false);
    }
  }, [anoLetivo?.id, anoLetivo?.label, cardState, fetchStatus, pedido?.id]);

  const resolveReconciliation = useCallback(async () => {
    if (!pedido?.id || cardState !== "RECONCILIATION_REQUIRED") return;
    setReconciling(true);
    setApiError(null);
    try {
      const response = await fetch("/api/secretaria/balcao/rematriculas/reconcile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pedido_id: pedido.id, action: "complete" }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok && response.status !== 202) {
        throw new Error(data.error || "Não foi possível concluir a reconciliação.");
      }
      await fetchStatus();
    } catch (error) {
      setApiError(error instanceof Error ? error.message : "Não foi possível concluir a reconciliação.");
    } finally {
      setReconciling(false);
    }
  }, [cardState, fetchStatus, pedido?.id]);

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
          notas_lancar_depois: notasLancarDepois,
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
    notasLancarDepois,
  ]);

  // ────────────────────────────────────────────────────────────────────────
  // Return
  // ────────────────────────────────────────────────────────────────────────
  return {
    // Card state
    cardState,
    loading,
    refresh: fetchStatus,

    // Data from status endpoint
    service,
    debt,
    pedido,
    comprovante,
    anoLetivo,
    destinoTurmaId,
    reconciling,
    resolveLegacyPedido,
    resolveReconciliation,

    // Turmas
    turmas,
    turmasLoading,
    progressao,
    notasLancarDepois,
    setNotasLancarDepois,

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
