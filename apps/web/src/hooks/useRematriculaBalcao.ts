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
  | "DOCUMENT_PENDING"
  | "PAYMENT_IN_PROGRESS"
  | "PENDING_ORDER_REVIEW"
  | "RECONCILIATION_REQUIRED"
  | "WINDOW_CLOSED"
  | "SOURCE_RECORD_REQUIRED"
  | "ERROR";

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
  estado: "notas_pendentes" | "reprovado" | "concluido" | "classe_nao_identificada";
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
  recibo?: {
    ok?: boolean;
    doc_id?: string | null;
    public_id?: string | null;
    print_url?: string | null;
  } | null;
  comprovante?: {
    ok?: boolean;
    docId?: string;
    publicId?: string;
    printUrl?: string;
  } | null;
  error?: string;
  code?: string;
}

export type RematriculaPaymentItem = {
  id: string;
  tipo: "mensalidade" | "servico";
  nome?: string;
  descricao?: string | null;
  codigo?: string | null;
  preco: number;
  quantidade?: number;
  origem_matricula_id?: string | null;
};

type TurmaPayload = {
  id: string;
  nome?: string | null;
  turma_nome?: string | null;
  turno?: string | null;
  capacidade_maxima?: number | null;
  ocupacao_atual?: number | null;
  classe_nome?: string | null;
  classe?: { nome?: string | null } | null;
  curso_nome?: string | null;
  curso?: { nome?: string | null } | null;
  turma_codigo?: string | null;
  session_id?: string | null;
};

type MetodoPagamento = "cash" | "tpa" | "transfer" | "mcx" | "kiwk";
export type ResultadoDecisaoBalcao = "aprovado" | "reprovado" | "concluido";

interface StatusResponse {
  ok: boolean;
  status: RematriculaCardState;
  service: { id: string; nome: string; valor_base: number; pricing_origin?: "classe" | "fallback" } | null;
  debt: { total: number; count: number } | null;
  pedido: {
    id: string;
    status: string;
    created_at: string;
    turma_id?: string;
    valor_cobrado?: number;
    has_payment_intent?: boolean;
  } | null;
  comprovante: {
    docId: string;
    publicId: string;
    printUrl: string;
  } | null;
  ano_letivo: { id: string; ano: number; label: string } | null;
  destino_turma_id?: string | null;
  destino_turma?: TurmaOption | null;
  reclassificacao?: {
    id: string;
    tipo: string;
    status: string;
    destino_turma_id?: string | null;
  } | null;
  reconciliation?: { can_cancel: boolean; reason: string } | null;
  cohort?: { codigo: string; nome: string; modo: string } | null;
  window?: {
    configured: boolean;
    open: boolean;
    data_inicio?: string | null;
    data_fim?: string | null;
  };
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
  GUARDIAN_CONTACT_REQUIRED: "Não foi possível validar o contacto do encarregado.",
  REMATRICULA_WINDOW_CLOSED:
    "O período de rematrícula não está aberto para este ano letivo.",
  FINALISTA_PROGRESSION_INVALID:
    "O finalista deve seguir para a classe imediatamente seguinte.",
  DECISAO_MOTIVO_REQUIRED:
    "Informe o motivo da decisão administrativa antes de concluir.",
  ASSISTED_TRANSITION_COHORT_REQUIRED:
    "Este aluno não pertence à coorte autorizada para decisão administrativa sem notas.",
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
  responsavelContato?: string | null;
  itensPagamento?: RematriculaPaymentItem[];
}) {
  const draftKey = `klasse:rematricula:draft:${opts.escolaId}:${opts.alunoId ?? "-"}:${opts.matriculaId ?? "-"}:${opts.academicYearId ?? "-"}`;
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
  const [destinoTurma, setDestinoTurma] = useState<StatusResponse["destino_turma"]>(null);
  const [reconciling, setReconciling] = useState(false);
  const [cohort, setCohort] = useState<StatusResponse["cohort"]>(null);

  // ── Turmas ──────────────────────────────────────────────────────────────
  const [turmas, setTurmas] = useState<TurmaOption[]>([]);
  const [progressao, setProgressao] = useState<ProgressaoBalcao | null>(null);
  const [notasLancarDepois, setNotasLancarDepois] = useState(false);
  const [decisaoResultado, setDecisaoResultado] = useState<ResultadoDecisaoBalcao>("aprovado");
  const [decisaoFonte, setDecisaoFonte] = useState("raa");
  const [decisaoMotivo, setDecisaoMotivo] = useState("");
  const [decisaoObservacao, setDecisaoObservacao] = useState("");
  const [turmasLoading, setTurmasLoading] = useState(false);
  const [turmasFetchedFor, setTurmasFetchedFor] = useState<ResultadoDecisaoBalcao | null>(null);

  // ── Modal wizard ────────────────────────────────────────────────────────
  const [modalOpen, setModalOpen] = useState(false);
  const [reconciliationMode, setReconciliationMode] = useState(false);
  const [step, setStep] = useState(1);
  const [selectedTurmaId, setSelectedTurmaId] = useState<string | null>(null);
  const [metodo, setMetodoState] = useState<MetodoPagamento>("cash");
  const [detalhes, setDetalhesState] = useState(DETALHES_VAZIOS);

  // ── Submission ──────────────────────────────────────────────────────────
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<RematriculaResult | null>(null);
  const [apiError, setApiError] = useState<string | null>(null);
  const [idempotencyKey, setIdempotencyKey] = useState<string | null>(null);
  const [responsavelContato, setResponsavelContato] = useState("");

  // ────────────────────────────────────────────────────────────────────────
  // Fetch rematrícula eligibility status
  // ────────────────────────────────────────────────────────────────────────
  const fetchStatus = useCallback(async (destinationTurmaId?: string | null) => {
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
      if (destinationTurmaId) params.set("destino_turma_id", destinationTurmaId);

      const res = await fetch(
        `/api/secretaria/balcao/rematriculas/status?${params.toString()}`,
      );
      const data: StatusResponse = await res.json();

      if (res.ok && data.ok) {
        setApiError(null);
        setCardState(data.status);
        setService(data.service);
        setDebt(data.debt);
        setPedido(data.pedido);
        setComprovante(data.comprovante);
        setAnoLetivo(data.ano_letivo);
        setDestinoTurmaId(data.destino_turma_id ?? null);
        setDestinoTurma(data.destino_turma ?? null);
        setCohort(data.cohort ?? null);
      } else {
        setCardState("ERROR");
        setApiError((data as any)?.error ?? "Não foi possível verificar a elegibilidade da matrícula.");
      }
    } catch (e) {
      console.error("[useRematriculaBalcao] Error fetching status:", e);
      setApiError("Não foi possível atualizar o estado da rematrícula. Verifique a ligação e tente novamente.");
    } finally {
      setLoading(false);
    }
  }, [opts.alunoId, opts.matriculaId, opts.academicYearId]);

  // Auto-fetch on aluno/matricula change
  useEffect(() => {
    fetchStatus();
    // Reset modal state when student changes
    setModalOpen(false);
    setReconciliationMode(false);
    setStep(1);
    setSelectedTurmaId(null);
    setResult(null);
    setApiError(null);
    setTurmasFetchedFor(null);
    setTurmas([]);
    setProgressao(null);
    setCohort(null);
    setNotasLancarDepois(false);
    setDecisaoResultado("aprovado");
    setDecisaoFonte("raa");
    setDecisaoMotivo("");
    setDecisaoObservacao("");
    setIdempotencyKey(null);
    setResponsavelContato(opts.responsavelContato ?? "");

    try {
      const raw = sessionStorage.getItem(draftKey);
      if (raw) {
        const draft = JSON.parse(raw) as {
          step?: number;
          selectedTurmaId?: string | null;
          metodo?: MetodoPagamento;
          detalhes?: typeof DETALHES_VAZIOS;
          notasLancarDepois?: boolean;
          decisaoResultado?: ResultadoDecisaoBalcao;
          decisaoFonte?: string;
          decisaoMotivo?: string;
          decisaoObservacao?: string;
          idempotencyKey?: string | null;
          responsavelContato?: string;
        };
        setStep(Number.isInteger(draft.step) && (draft.step ?? 1) >= 1 && (draft.step ?? 1) <= 3 ? draft.step! : 1);
        setSelectedTurmaId(draft.selectedTurmaId ?? null);
        if (draft.metodo) setMetodoState(draft.metodo);
        if (draft.detalhes) setDetalhesState({ ...DETALHES_VAZIOS, ...draft.detalhes });
        setNotasLancarDepois(Boolean(draft.notasLancarDepois));
        if (draft.decisaoResultado) setDecisaoResultado(draft.decisaoResultado);
        if (draft.decisaoFonte) setDecisaoFonte(draft.decisaoFonte);
        if (draft.decisaoMotivo) setDecisaoMotivo(draft.decisaoMotivo);
        if (draft.decisaoObservacao) setDecisaoObservacao(draft.decisaoObservacao);
        setIdempotencyKey(draft.idempotencyKey ?? null);
        if (draft.responsavelContato) setResponsavelContato(draft.responsavelContato);
      }
    } catch {
      // Storage indisponível (por exemplo, modo privado): o fluxo continua sem rascunho.
    }
  }, [draftKey, fetchStatus]);

  useEffect(() => {
    if (!opts.alunoId || !opts.matriculaId || result) return;
    try {
      sessionStorage.setItem(draftKey, JSON.stringify({
        step,
        selectedTurmaId,
        metodo,
        detalhes,
        notasLancarDepois,
        decisaoResultado,
        decisaoFonte,
        decisaoMotivo,
        decisaoObservacao,
        idempotencyKey,
        responsavelContato,
        savedAt: new Date().toISOString(),
      }));
    } catch {
      // A persistência é uma melhoria; nunca deve bloquear a operação.
    }
  }, [decisaoFonte, decisaoMotivo, decisaoObservacao, decisaoResultado, draftKey, detalhes, idempotencyKey, metodo, notasLancarDepois, opts.alunoId, opts.matriculaId, responsavelContato, result, selectedTurmaId, step]);

  useEffect(() => {
    if (!modalOpen) setResponsavelContato(opts.responsavelContato ?? "");
  }, [modalOpen, opts.responsavelContato]);

  useEffect(() => {
    if (!modalOpen || !selectedTurmaId) return;
    void fetchStatus(selectedTurmaId);
  }, [fetchStatus, modalOpen, selectedTurmaId]);

  // ────────────────────────────────────────────────────────────────────────
  // Lazy-fetch turmas when modal opens
  // ────────────────────────────────────────────────────────────────────────
  const fetchTurmas = useCallback(async (decision: ResultadoDecisaoBalcao = decisaoResultado) => {
    if (!anoLetivo?.id || !opts.alunoId) return;
    if (turmasFetchedFor === decision) return;

    setTurmasLoading(true);
    try {
      const params = new URLSearchParams({
        session_id: anoLetivo.id,
        aluno_id: opts.alunoId,
      });
      if (opts.matriculaId) params.set("matricula_id", opts.matriculaId);
      params.set("decisao_resultado", decision);
      const res = await fetch(
        `/api/secretaria/turmas-simples?${params.toString()}`,
      );
      const data = await res.json();
      setProgressao(data.progressao ?? null);
      if (data.items && Array.isArray(data.items)) {
        setTurmas(
          data.items.map((t: TurmaPayload) => ({
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
        setTurmasFetchedFor(decision);
      }
    } catch (e) {
      console.error("[useRematriculaBalcao] Error fetching turmas:", e);
    } finally {
      setTurmasLoading(false);
    }
  }, [anoLetivo?.id, decisaoResultado, opts.alunoId, opts.matriculaId, turmasFetchedFor]);

  useEffect(() => {
    if (!modalOpen) return;
    if (["RECONFIRMATION_REQUIRED", "DOCUMENT_PENDING"].includes(cardState ?? "")) {
      if (destinoTurmaId) {
        setSelectedTurmaId(destinoTurmaId);
        return;
      }
      // Pagamento validado sem turma destino ainda precisa de progressão.
      // Carregar as opções aqui evita deixar o modal sem escolha e o pedido
      // concedido sem matrícula no novo ano.
    }
    setSelectedTurmaId(null);
    void fetchTurmas(decisaoResultado);
  }, [cardState, decisaoResultado, destinoTurmaId, fetchTurmas, modalOpen]);

  // ────────────────────────────────────────────────────────────────────────
  // Modal controls
  // ────────────────────────────────────────────────────────────────────────
  const openModal = useCallback(() => {
    setReconciliationMode(false);
    setModalOpen(true);
    setResult(null);
    setApiError(null);
    if (!selectedTurmaId && ["RECONFIRMATION_REQUIRED", "DOCUMENT_PENDING"].includes(cardState ?? "")) {
      setSelectedTurmaId(destinoTurmaId);
    }
    if (["RECONFIRMATION_REQUIRED", "DOCUMENT_PENDING"].includes(cardState ?? "")) {
      setDecisaoResultado("aprovado");
      setDecisaoFonte("raa");
      setNotasLancarDepois(false);
    }
    if (!["RECONFIRMATION_REQUIRED", "DOCUMENT_PENDING"].includes(cardState ?? "")) void fetchTurmas();
  }, [cardState, destinoTurmaId, fetchTurmas, selectedTurmaId]);

  const openReconciliationModal = useCallback(() => {
    setReconciliationMode(true);
    setModalOpen(true);
    setStep(1);
    setSelectedTurmaId(null);
    setDecisaoFonte("declaracao_administrativa_escola");
    setDecisaoMotivo("");
    setNotasLancarDepois(true);
    setResult(null);
    setApiError(null);
    void fetchTurmas();
  }, [fetchTurmas]);

  const closeModal = useCallback(() => {
    if (submitting) return;
    setModalOpen(false);
    setReconciliationMode(false);
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

  const cancelPendingPedido = useCallback(async () => {
    if (!pedido?.id || cardState !== "PENDING_ORDER_REVIEW") return;
    if (!window.confirm("Cancelar o pedido pendente sem pagamento e iniciar a rematrícula correta?")) return;
    setReconciling(true);
    setApiError(null);
    try {
      const response = await fetch("/api/secretaria/balcao/rematriculas/reconcile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pedido_id: pedido.id, action: "cancel" }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data.ok) throw new Error(data.error || "Não foi possível cancelar o pedido pendente.");
      await fetchStatus();
    } catch (error) {
      setApiError(error instanceof Error ? error.message : "Não foi possível cancelar o pedido pendente.");
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
      (!selectedTurmaId && (decisaoResultado !== "concluido" || reconciliationMode))
    ) {
      return;
    }

    setSubmitting(true);
    setApiError(null);
    setResult(null);
    const requestKey = idempotencyKey ?? crypto.randomUUID();
    const decisaoAdministrativa = decisaoFonte === "declaracao_administrativa_escola";
    const pagamentoApenas = ["RECONFIRMATION_REQUIRED", "DOCUMENT_PENDING"].includes(cardState ?? "");
    setIdempotencyKey(requestKey);

    try {
      if (reconciliationMode) {
        const response = await fetch("/api/secretaria/balcao/rematriculas/reconcile", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            pedido_id: pedido?.id,
            action: "complete",
            ano_letivo_id: anoLetivo.id,
            destino_turma_id: selectedTurmaId,
            decisao_resultado: decisaoResultado,
            decisao_fonte: decisaoFonte || undefined,
            decisao_motivo: decisaoMotivo.trim() || undefined,
            decisao_observacao: decisaoObservacao.trim() || undefined,
          }),
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok && response.status !== 202) {
          throw new Error(data.error || "Não foi possível concluir a reconciliação.");
        }
        setResult(data);
        setStep(4);
        try { sessionStorage.removeItem(draftKey); } catch {}
        return;
      }
      const res = await fetch("/api/secretaria/balcao/rematriculas", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Idempotency-Key": requestKey,
        },
        body: JSON.stringify({
          aluno_id: opts.alunoId,
          matricula_id: opts.matriculaId,
          ano_letivo_id: anoLetivo.id,
          destino_turma_id: selectedTurmaId ?? undefined,
          metodo: decisaoResultado === "concluido" && !pagamentoApenas ? undefined : metodo,
          reference: detalhes.referencia.trim() || null,
          evidence_url: detalhes.evidencia_url.trim() || null,
          gateway_ref: detalhes.gateway_ref.trim() || null,
          contacto_encarregado: responsavelContato.trim() || undefined,
          notas_lancar_depois: notasLancarDepois || decisaoAdministrativa,
          decisao_resultado: decisaoResultado,
          decisao_fonte: decisaoFonte || undefined,
          decisao_motivo: decisaoMotivo.trim() || undefined,
          decisao_observacao: decisaoObservacao.trim() || undefined,
          itens: opts.itensPagamento?.map(({ id, tipo }) => ({ id, tipo })) ?? [],
        }),
      });

      const data = await res.json();

      if (data.ok || res.status === 202) {
        // Success or partial success (document pending)
        setResult(data);
        setStep(4); // → success view
        try { sessionStorage.removeItem(draftKey); } catch {}
      } else {
        // Map error code to human message, fall back to raw error
        const code = data.code as string | undefined;
        if (code === "REMATRICULA_RECONCILIATION_REQUIRED" && data.pedido_id) {
          // O pagamento já foi confirmado. Tenta concluir a matrícula no
          // mesmo atendimento; a fila manual fica apenas como fallback.
          const reconciliationResponse = await fetch("/api/secretaria/balcao/rematriculas/reconcile", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              pedido_id: data.pedido_id,
              action: "complete",
              ano_letivo_id: anoLetivo.id,
              destino_turma_id: selectedTurmaId,
            }),
          });
          const reconciliationData = await reconciliationResponse.json().catch(() => ({}));
          if (reconciliationResponse.ok || reconciliationResponse.status === 202) {
            setResult(reconciliationData);
            setStep(4);
            try { sessionStorage.removeItem(draftKey); } catch {}
            return;
          }
        }
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
    decisaoFonte,
    decisaoMotivo,
    decisaoObservacao,
    decisaoResultado,
    cardState,
    draftKey,
    idempotencyKey,
    opts.itensPagamento,
    responsavelContato,
    pedido?.id,
    reconciliationMode,
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
    destinoTurma,
    cohort,
    reconciling,
    resolveLegacyPedido,
    resolveReconciliation,
    openReconciliationModal,
    cancelPendingPedido,

    // Turmas
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

    // Modal
    modalOpen,
    reconciliationMode,
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
    responsavelContato,
    setResponsavelContato,

    // Submission
    submitting,
    result,
    apiError,
    submit,

    // Actions
    refreshStatus: fetchStatus,
  };
}
