"use client";

import { useCallback, useEffect, useState } from "react";
import { useBalcaoDraftForm } from "@/components/secretaria/command-center/BalcaoDraftState";
import { buildRaaBalcaoCases, raaBalcaoProgress } from "@/lib/rematricula/raa-balcao-cases";
import { buildRaaBalcaoRegimeGuidance, type RaaBalcaoAcademic } from "@/lib/rematricula/raa-balcao-regime-guidance";
import { CheckCircle2, Loader2, RefreshCw, ChevronLeft, ChevronRight, ClipboardList, FileText, GraduationCap, CalendarDays, Scale, CircleAlert, ShieldCheck } from "lucide-react";
import type { RematriculaCardState } from "@/hooks/useRematriculaBalcao";
import { raaBalcaoPlan } from "@/lib/rematricula/raa-balcao-resolution";

type PeticaoFalta = { id: string; data_falta: string; motivo: string; status: string };
type PedidoReapreciacao = {
  id: string; protocolo_publico: string; estado: string; disciplina_id: string;
  motivo: string; prazo_em: string; decisao_motivo?: string | null;
};
type EventoDisciplinar = {
  id: string; categoria: string; descricao: string; gravidade: string;
  estado: string; impacta_resultado: boolean;
};
type ExamContext = {
  source: { matricula_id: string; aluno_id: string; turma_id: string; ano_letivo_id: string; locked: boolean };
  disciplinas: Array<{ id: string; avaliacao_disciplina_id: string | null }>;
  sessoes: Array<{ id: string; tipo: "recurso" | "extraordinario"; estado: string; data_inicio: string; exame_componentes: Array<{ id: string; codigo: string; nota_max: number }> }>;
};

type Academic = RaaBalcaoAcademic | null;

type Props = {
  status: RematriculaCardState | "CHECKING" | null;
  matriculaId: string;
  alunoId: string;
  academic: Academic;
  onLancarNota: () => void;
  onDocumentos: () => void;
  onRecheck: () => Promise<unknown>;
};

async function readJson(url: string, init?: RequestInit) {
  const res = await fetch(url, { cache: "no-store", ...init });
  const json = await res.json().catch(() => ({}));
  if (!res.ok || json.ok !== true) throw new Error(json.error || "Não foi possível concluir a operação.");
  return json;
}

/**
 * Resolves the blocker inside the existing student workspace. All mutations
 * are delegated to authoritative endpoints with independent role/tenant checks.
 * A saved request/decision never becomes an implicit authorization to enroll.
 */
export function RaaBalcaoResolutionPanel({
  status, matriculaId, alunoId, academic, onLancarNota, onDocumentos, onRecheck,
}: Props) {
  const plan = raaBalcaoPlan(status);
  const action = plan?.acao;
  const regimeGuidance = buildRaaBalcaoRegimeGuidance(academic);
  const conditionalReady = status === "READY" && academic?.eligible === true &&
    regimeGuidance?.estado === "condicional_autorizada" && regimeGuidance.podeEfetivar;
  const [phase, setPhase] = useState<"summary" | "detail" | "confirm" | "feedback">("summary");
  const [caseId, setCaseId] = useState<string | null>(null);
  const [confirmKind, setConfirmKind] = useState<"decisao" | "pedido" | "exame" | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [faltas, setFaltas] = useState<PeticaoFalta[]>([]);
  const [pedidos, setPedidos] = useState<PedidoReapreciacao[]>([]);
  const [eventos, setEventos] = useState<EventoDisciplinar[]>([]);
  const [selected, setSelected] = useState("");
  const [decision, setDecision] = useState("");
  const [motivo, setMotivo] = useState("");
  const [disciplinaId, setDisciplinaId] = useState("");
  const [examContext, setExamContext] = useState<ExamContext | null>(null);
  const [examSessionId, setExamSessionId] = useState("");
  const [examComponentId, setExamComponentId] = useState("");
  const [examTurmaDisciplinaId, setExamTurmaDisciplinaId] = useState("");
  const [examNote, setExamNote] = useState("");


  const load = useCallback(async () => {
    if (!action || !matriculaId || !["justificacao", "reapreciacao", "disciplina"].includes(action)) return;
    setLoading(true);
    setError(null);
    try {
      const query = new URLSearchParams({ matricula_id: matriculaId }).toString();
      if (action === "justificacao") {
        const response = await readJson("/api/secretaria/faltas/justificacoes?" + query);
        setFaltas(Array.isArray(response.items) ? response.items : []);
      } else if (action === "reapreciacao") {
        const response = await readJson("/api/academico/raa/reapreciacao?" + query);
        setPedidos(Array.isArray(response.items) ? response.items : []);
        // The exam is different from a reapreciação petition. Read only official
        // open sessions from the source enrolment's year, never the destination.
        const context = await readJson("/api/secretaria/balcao/raa/exam-context?" + query);
        setExamContext({ source: context.source, disciplinas: context.disciplinas ?? [], sessoes: context.sessoes ?? [] });

      } else if (action === "disciplina") {
        const response = await readJson("/api/academico/raa/indisciplina?" + query);
        setEventos(Array.isArray(response.items) ? response.items : []);
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Não foi possível consultar a análise.");
    } finally {
      setLoading(false);
    }
  }, [action, matriculaId]);

  useEffect(() => { void load(); }, [load]);

  const cases = buildRaaBalcaoCases({
    action: action ?? "rever_resultado",
    title: plan?.titulo ?? "Revisão académica",
    disciplinaIds: academic?.disciplina_ids_pendentes,
    faltas, pedidos, eventos, sessoes: examContext?.sessoes,
  });
  const progress = raaBalcaoProgress(cases);
  const activeCase = cases.find((item) => item.id === caseId) ?? null;
  const hasEvidence = cases.some((item) => item.kind !== "orientacao");
  const canDecide = Boolean(selected) && !saving;
  useBalcaoDraftForm("raa-resolucao:" + matriculaId, {
    motivo, disciplinaId, examSessionId, examComponentId, examTurmaDisciplinaId, examNote,
  }, {
    motivo: "", disciplinaId: "", examSessionId: "", examComponentId: "", examTurmaDisciplinaId: "", examNote: "",
  }, { submitting: saving, enabled: phase === "detail" || phase === "confirm" });

  const hasUnsavedForm = Boolean(motivo.trim() || disciplinaId || examNote.trim());
  function goToSummary() {
    if (saving) return;
    if (hasUnsavedForm && !window.confirm("Existem alterações ainda não guardadas. Deseja voltar e descartá-las?")) return;
    setMotivo("");
    setDisciplinaId("");
    setExamNote("");
    setExamSessionId("");
    setExamComponentId("");
    setExamTurmaDisciplinaId("");
    setPhase("summary");
  }

  function chooseCase(item: (typeof cases)[number]) {
    if (saving) return;
    if (action === "documentos") {
      onDocumentos();
      return;
    }
    // Moving between cases must not silently discard an unfinished decision.
    if (phase === "detail" && hasUnsavedForm &&
        !window.confirm("Existem alterações ainda não guardadas. Deseja mudar de pendência e descartá-las?")) return;
    setCaseId(item.id);
    setSelected("");
    setDecision("");
    setMotivo("");
    setDisciplinaId("");
    setError(null);
    setNotice(null);
    if (["justificacao", "pedido", "disciplina"].includes(item.kind) && item.estado !== "registado") {
      setSelected(item.referenceId ?? "");
      setDecision(item.kind === "justificacao" ? "approved"
        : item.kind === "pedido" ? (item.estado === "em_analise" ? "deferido" : "em_analise")
        : item.estado === "em_analise" ? "resolvido" : "em_analise");
    }
    if (item.kind === "exame") {
      setExamSessionId(item.referenceId ?? "");
      setExamComponentId("");
      setExamNote("");
    }
    setPhase("detail");
  }

  function prepareConfirmation(kind: "decisao" | "pedido" | "exame") {
    setError(null);
    if (kind === "decisao") {
      const minLength = action === "disciplina" ? 15
        : action === "reapreciacao" ? 5 : decision === "rejected" ? 8 : 0;
      if (!canDecide || motivo.trim().length < minLength) {
        setError("Selecione o registo e introduza a fundamentação exigida."); return;
      }
    }
    if (kind === "pedido" && (!disciplinaId || motivo.trim().length < 10)) {
      setError("Selecione uma disciplina e descreva a reapreciação com pelo menos 10 caracteres."); return;
    }
    if (kind === "exame") {
      const session = examContext?.sessoes.find((item) => item.id === examSessionId);
      const component = session?.exame_componentes?.find((item) => item.id === examComponentId);
      const note = Number(examNote.replace(",", "."));
      if (examContext?.source.locked || !session || !component || !examTurmaDisciplinaId ||
          !examNote.trim() || !Number.isFinite(note) || note < 0 || note > Number(component.nota_max)) {
        setError("Confirme a sessão, disciplina, componente e nota dentro da escala autorizada."); return;
      }
    }
    setConfirmKind(kind);
    setPhase("confirm");
  }

  async function confirmOperation() {
    if (saving) return;
    if (confirmKind === "decisao") await submit();
    else if (confirmKind === "pedido") await submitPedido();
    else if (confirmKind === "exame") await submitExam();
  }

  // For the 7th and 10th grades the canonical RAA may authorize conditional
  // progression immediately. Do not display the blocked-case wizard or create
  // a new CTA; the existing rematrícula action remains the sole entry point.
  if (!plan && conditionalReady && matriculaId && regimeGuidance) {
    return (
      <section aria-label="Inscrição condicional autorizada" className="mb-4 rounded-2xl border border-emerald/30 bg-emerald/5 p-4">
        <p className="text-xs font-semibold text-emerald">{regimeGuidance.regime}</p>
        <h3 className="mt-1 text-sm font-semibold text-foreground">{regimeGuidance.titulo}</h3>
        <p className="mt-1 text-sm text-muted-foreground">Pode continuar a rematrícula. As disciplinas pendentes ficam registadas.</p>
        <details className="mt-2 text-xs text-muted-foreground">
          <summary className="cursor-pointer font-medium">Ver detalhes</summary>
          <p className="mt-2">{regimeGuidance.descricao}</p>
          {regimeGuidance.baseLegal && <p className="mt-1">Referência: {regimeGuidance.baseLegal}</p>}
        </details>
      </section>
    );
  }
  if (!plan || !matriculaId) return null;

  const submit = async () => {
    if (saving || !selected || motivo.trim().length < (action === "disciplina" ? 15 : action === "reapreciacao" ? 5 : decision === "rejected" ? 8 : 0)) return;
    setSaving(true);
    setError(null);
    setNotice(null);
    try {
      if (action === "justificacao") {
        if (!["approved", "rejected"].includes(decision)) {
          throw new Error("Selecione aprovar ou rejeitar a justificação.");
        }
        if (decision === "rejected" && motivo.trim().length < 8) {
          throw new Error("Explique a rejeição com pelo menos 8 caracteres.");
        }
        const json = await readJson("/api/secretaria/faltas/justificacoes", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: selected, decision, motivo: motivo.trim() }),
        });
        setNotice(json.message || "Decisão registada. Reavalie a frequência e o RAA.");
      } else if (action === "reapreciacao") {
        if (!["em_analise", "deferido", "indeferido"].includes(decision)) {
          throw new Error("Selecione uma decisão válida.");
        }
        const json = await readJson("/api/academico/raa/reapreciacao/decisao", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: selected, estado: decision, decisao_motivo: motivo.trim() }),
        });
        setNotice("Pedido " + (json.item?.protocolo_publico || "RAA") +
          " atualizado. A nota e a progressão oficial devem ser recalculadas antes da matrícula.");
      } else if (action === "disciplina") {
        if (!["em_analise", "resolvido", "cancelado"].includes(decision)) {
          throw new Error("Selecione o estado da revisão disciplinar.");
        }
        if (motivo.trim().length < 15) {
          throw new Error("Fundamente a decisão com pelo menos 15 caracteres.");
        }
        await readJson("/api/academico/raa/indisciplina", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            id: selected, estado: decision, motivo: motivo.trim(),
            confirmar_decisao: decision !== "em_analise",
          }),
        });
        setNotice("Revisão disciplinar registada. Revalide o resultado oficial antes de continuar.");
      }
      setSelected("");
      setDecision("");
      setMotivo("");
      await load();
      setPhase("feedback");
      await onRecheck();
    } catch (cause) {
      setPhase("detail");
      setError(cause instanceof Error ? cause.message : "A decisão não foi confirmada.");
    } finally {
      setSaving(false);
    }
  };

  const submitPedido = async () => {
    if (!disciplinaId || motivo.trim().length < 10 || saving) {
      setError("Selecione a disciplina e descreva a reapreciação com pelo menos 10 caracteres.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const json = await readJson("/api/academico/raa/reapreciacao", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          matricula_id: matriculaId,
          disciplina_id: disciplinaId,
          motivo: motivo.trim(),
          idempotency_key: crypto.randomUUID(),
        }),
      });
      setNotice(json.duplicate
        ? "Já existe um pedido. Consulte o estado abaixo."
        : "Solicitação realizada. Aguardando análise da autoridade competente.");
      setDisciplinaId("");
      setMotivo("");
      await load();
      setPhase("feedback");
      await onRecheck();
    } catch (cause) {
      setPhase("detail");
      setError(cause instanceof Error ? cause.message : "Não foi possível enviar o pedido.");
    } finally {
      setSaving(false);
    }
  };

  const submitExam = async () => {
    if (!examContext || examContext.source.locked || saving) return;
    const session = examContext.sessoes.find((item) => item.id === examSessionId);
    const component = session?.exame_componentes?.find((item) => item.id === examComponentId);
    const disciplina = examContext.disciplinas.find((item) => item.id === examTurmaDisciplinaId);
    const value = Number(examNote.replace(",", "."));
    if (!session || !component || !disciplina || !examNote.trim() ||
        !Number.isFinite(value) || value < 0 || value > Number(component.nota_max)) {
      setError("Selecione a sessão, disciplina, componente e nota dentro da escala autorizada.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await readJson("/api/academico/exames/resultados", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          exame_sessao_id: session.id,
          exame_componente_id: component.id,
          matricula_id: examContext.source.matricula_id,
          aluno_id: examContext.source.aluno_id,
          turma_disciplina_id: disciplina.id,
          nota: value,
        }),
      });
      setExamNote("");
      setNotice("Nota do exame guardada. Verifique o resultado antes de avançar.");
      setPhase("feedback");
      await onRecheck();
    } catch (cause) {
      setPhase("detail");
      setError(cause instanceof Error ? cause.message : "Não foi possível guardar a nota do exame.");
    } finally {
      setSaving(false);
    }
  };

  const flowIndex = phase === "summary" ? 0 : phase === "detail" ? 1 : 2;
  const iconForCase = (kind: (typeof cases)[number]["kind"]) => {
    if (kind === "nota") return <GraduationCap className="h-5 w-5" aria-hidden="true" />;
    if (kind === "justificacao") return <CalendarDays className="h-5 w-5" aria-hidden="true" />;
    if (kind === "pedido" || kind === "exame") return <ClipboardList className="h-5 w-5" aria-hidden="true" />;
    if (kind === "disciplina") return <Scale className="h-5 w-5" aria-hidden="true" />;
    if (kind === "orientacao" && action === "documentos") return <FileText className="h-5 w-5" aria-hidden="true" />;
    return <CircleAlert className="h-5 w-5" aria-hidden="true" />;
  };

  return (
    <section key={alunoId + ":" + matriculaId} className="mb-4 overflow-hidden rounded-2xl border border-border bg-card shadow-sm" aria-label="Resolução RAA no Balcão">
      <header className="border-b border-border bg-muted/30 p-4 sm:p-5">
        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-400/40 bg-amber-500/10 px-2.5 py-1 text-[11px] font-semibold text-amber-700 dark:text-amber-300">
            <CircleAlert className="h-3.5 w-3.5" aria-hidden="true" /> Pendência académica
          </span>
          <span className="ml-auto inline-flex items-center gap-1 text-xs text-muted-foreground">
            <ShieldCheck className="h-4 w-4" aria-hidden="true" /> Decisão oficial RAA
          </span>
        </div>
        {regimeGuidance && <p className="mt-3 text-xs font-semibold text-foreground">{regimeGuidance.regime}</p>}
        <h3 className="mt-1 text-base font-semibold tracking-tight text-foreground sm:text-lg">{regimeGuidance?.titulo ?? plan.titulo}</h3>
        <p className="mt-1 text-sm leading-6 text-muted-foreground">{academic?.reason || plan.detalhe}</p>
        <div className="mt-4 grid grid-cols-3 gap-1.5" aria-label="Etapas do tratamento RAA">
          {(["Identificar", "Resolver", "Revalidar"] as const).map((name, index) => (
            <div key={name} className="min-w-0 space-y-1.5">
              <div className={"h-1.5 rounded-full " + (index <= flowIndex ? "bg-emerald" : "bg-border")} aria-hidden="true" />
              <span className={"block text-[11px] font-medium " + (index === flowIndex ? "text-foreground" : "text-muted-foreground")}>
                {index + 1}. {name}
              </span>
            </div>
          ))}
        </div>
      </header>
      <div className="space-y-4 p-4 sm:p-5" aria-live="polite">
        {regimeGuidance && (
          <div className="rounded-xl border border-border bg-muted/30 p-3 sm:p-4" aria-label="Orientação da classe">
            <p className="text-sm font-medium text-foreground">{regimeGuidance.instrucao}</p>
            <details className="mt-2 text-xs text-muted-foreground">
              <summary className="cursor-pointer font-medium">Ver detalhes</summary>
              <p className="mt-2 leading-5">{regimeGuidance.descricao}</p>
              {regimeGuidance.baseLegal && <p className="mt-1">Referência: {regimeGuidance.baseLegal}</p>}
              {regimeGuidance.origem === "sem_apuramento" && <p className="mt-1">Aguardando confirmação da regra desta classe.</p>}
            </details>
          </div>
        )}
        {phase === "summary" && (
          <div className="space-y-4">
            <div className="flex flex-wrap items-end justify-between gap-2">
              <div>
                <h4 className="text-sm font-semibold text-foreground">Pendências deste processo</h4>
                <p className="mt-1 text-xs text-muted-foreground">
                  {loading ? "A consultar evidências oficiais..." : hasEvidence
                    ? "Registos existentes para a decisão RAA atual."
                    : "Há uma pendência antes da rematrícula."}
                </p>
              </div>
              {hasEvidence && !loading && (
                <span className="rounded-lg bg-muted px-2.5 py-1.5 text-xs font-medium text-foreground">
                  {progress.registados} de {progress.total} registos decididos
                </span>
              )}
            </div>
            {loading && <p role="status" className="flex items-center gap-2 rounded-xl border border-border bg-muted/20 p-3 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> A carregar as pendências...
            </p>}
            <div className="space-y-2">
              {cases.map(item => (
                <button type="button" key={item.id} onClick={() => chooseCase(item)}
                  disabled={saving || loading}
                  className="group flex w-full min-w-0 items-center gap-3 rounded-xl border border-border bg-background p-3 text-left transition-colors hover:border-emerald/40 hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald disabled:opacity-60 sm:p-4"
                  aria-label={"Abrir " + item.titulo}>
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-muted text-muted-foreground">
                    {iconForCase(item.kind)}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold text-foreground">{item.titulo}</span>
                    <span className="mt-1 block line-clamp-2 text-xs leading-5 text-muted-foreground">{item.resumo}</span>
                  </span>
                  <span className="flex shrink-0 flex-col items-end gap-1.5">
                    <span className={"rounded-md px-1.5 py-0.5 text-[10px] font-semibold " +
                      (item.estado === "registado" ? "bg-emerald/10 text-emerald" :
                        item.estado === "em_analise" ? "bg-sky-500/10 text-sky-700 dark:text-sky-300" :
                          "bg-amber-500/10 text-amber-700 dark:text-amber-300")}>
                      {item.estado === "registado" ? "Decidido" : item.estado === "em_analise" ? "Em análise" : "Pendente"}
                    </span>
                    {item.estado === "registado"
                      ? <CheckCircle2 className="h-4 w-4 text-emerald" aria-label="Decisão registada" />
                      : <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-foreground" aria-hidden="true" />}
                  </span>
                </button>
              ))}
            </div>
            {error && <p role="alert" className="rounded-xl border border-rose-400/40 bg-rose-500/10 p-3 text-sm text-rose-700 dark:text-rose-300">{error}</p>}
            <div className="flex flex-wrap gap-2 border-t border-border pt-3">
              {action === "documentos" ? (
                <button type="button" onClick={onDocumentos} className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-emerald px-4 py-2.5 text-sm font-semibold text-white sm:w-auto">
                  <FileText className="h-4 w-4" aria-hidden="true" /> Emitir documentos <ChevronRight className="h-4 w-4" aria-hidden="true" />
                </button>
              ) : (
                <button type="button" onClick={() => chooseCase(cases[0])} disabled={loading || saving}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-emerald px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50 sm:w-auto">
                  Analisar pendência <ChevronRight className="h-4 w-4" aria-hidden="true" />
                </button>
              )}
              <button type="button" onClick={() => void load()} disabled={loading || saving}
                className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-border bg-card px-4 py-2.5 text-sm font-medium text-foreground disabled:opacity-50 sm:w-auto">
                <RefreshCw className={"h-4 w-4 " + (loading ? "animate-spin" : "")} aria-hidden="true" /> Atualizar lista
              </button>
            </div>
          </div>
        )}
        {phase === "detail" && (
          <div className="space-y-4">
            <button type="button" onClick={goToSummary} disabled={saving}
              className="inline-flex items-center gap-1 rounded-lg text-xs font-semibold text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald">
              <ChevronLeft className="h-4 w-4" aria-hidden="true" /> Todas as pendências
            </button>
            <div className="rounded-xl border border-border bg-muted/30 p-3 sm:p-4">
              <div className="flex items-center gap-2">
                <span className="text-muted-foreground">{iconForCase(activeCase?.kind ?? "orientacao")}</span>
                <h4 className="text-sm font-semibold text-foreground">{activeCase?.titulo ?? plan.titulo}</h4>
              </div>
              <p className="mt-1 text-sm leading-5 text-muted-foreground">{activeCase?.resumo ?? plan.detalhe}</p>
              {activeCase?.estado === "registado" && <p className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-emerald">
                <CheckCircle2 className="h-4 w-4" aria-hidden="true" /> A decisão deste registo já foi guardada.
              </p>}
            </div>
            <div className="space-y-3">
              {loading && <p role="status" className="flex items-center gap-2 text-xs text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> A consultar...</p>}
          {action === "nota" && (
            <div className="rounded-lg border border-border bg-card p-3">
              <p className="text-xs text-foreground">
                {academic?.disciplina_ids_pendentes?.length
                  ? String(academic.disciplina_ids_pendentes.length) + " disciplinas com elementos pendentes."
                  : "Conclua notas, fórmula e frequência no período académico autorizado."}
              </p>
              {academic?.regime?.escala === "qualitativa" ? (
                <p role="status" className="mt-2 rounded-lg bg-amber-500/10 p-3 text-sm text-amber-700 dark:text-amber-300">
                  Esta turma usa Suficiente/Não suficiente. Complete a pauta qualitativa.
                </p>
              ) : (
                <button type="button" onClick={onLancarNota}
                  className="mt-2 rounded-lg border border-border px-3 py-2 text-xs font-bold text-foreground">
                  Lançar nota nesta ficha
                </button>
              )}
              <p className="mt-2 text-xs text-muted-foreground">Período encerrado? Solicite a reabertura à direção.</p>
            </div>
          )}
          {action === "rever_resultado" && (
            <p className="rounded-lg border border-border bg-muted/30 p-3 text-sm text-muted-foreground">
              O resultado precisa de revisão pela direção;
              não há botão para substituir a decisão. Consulte novamente após a publicação ou retificação formal.
            </p>
          )}
          {action === "justificacao" && (
            <p className="rounded-xl border border-border bg-muted/40 p-3 text-sm text-muted-foreground">
              {selected ? "Confirme a decisão sobre a justificação." :
                "Nenhuma justificação por decidir."}
            </p>
          )}
          {action === "reapreciacao" && examContext && activeCase?.kind !== "pedido" && (
            <div className="space-y-3 rounded-xl border border-border bg-card p-3" aria-label="Resultado do exame no Balcão">
              <h4 className="text-sm font-bold text-foreground">Exames de recurso e extraordinários</h4>
              <p className="text-xs text-muted-foreground">
                Guardar a nota não conclui o exame.
              </p>
              {examContext.source.locked ? (
                <p role="status" className="text-xs font-bold text-rose-700">Matrícula encerrada: só uma reabertura académica formal permite corrigir resultados.</p>
              ) : examContext.sessoes.length === 0 ? (
                <p className="text-xs text-muted-foreground">Sem sessão de exame disponível. Solicite a abertura à direção.</p>
              ) : (
                <div className="grid gap-2">
                  <label htmlFor="raa-exam-session" className="text-xs font-bold text-foreground">Sessão oficial</label>
                  <select id="raa-exam-session" value={examSessionId} onChange={(event) => {
                    setExamSessionId(event.target.value); setExamComponentId("");
                  }} className="rounded-lg border border-border bg-background p-2 text-sm">
                    <option value="">Selecionar sessão</option>
                    {examContext.sessoes.map((session) => (
                      <option key={session.id} value={session.id}>{session.tipo} · {session.data_inicio}</option>
                    ))}
                  </select>
                  <label htmlFor="raa-exam-curricular" className="text-xs font-bold text-foreground">Disciplina da turma</label>
                  <select id="raa-exam-curricular" value={examTurmaDisciplinaId} onChange={(event) => setExamTurmaDisciplinaId(event.target.value)}
                    className="rounded-lg border border-border bg-background p-2 text-sm">
                    <option value="">Selecionar disciplina</option>
                    {examContext.disciplinas
                      .filter((d) => !academic?.disciplina_ids_pendentes?.length || academic.disciplina_ids_pendentes.includes(d.avaliacao_disciplina_id ?? ""))
                      .map((d) => <option key={d.id} value={d.id}>{d.avaliacao_disciplina_id ?? d.id}</option>)}
                  </select>
                  <label htmlFor="raa-exam-component" className="text-xs font-bold text-foreground">Componente do exame</label>
                  <select id="raa-exam-component" value={examComponentId} onChange={(event) => setExamComponentId(event.target.value)}
                    className="rounded-lg border border-border bg-background p-2 text-sm">
                    <option value="">Selecionar componente</option>
                    {(examContext.sessoes.find((session) => session.id === examSessionId)?.exame_componentes ?? [])
                      .map((component) => <option key={component.id} value={component.id}>{component.codigo} · máximo {component.nota_max}</option>)}
                  </select>
                  <label htmlFor="raa-exam-note" className="text-xs font-bold text-foreground">Nota do componente</label>
                  <input id="raa-exam-note" type="number" min="0" step="0.1" value={examNote} onChange={(event) => setExamNote(event.target.value)}
                    className="rounded-lg border border-border bg-background p-2 text-sm" />
                  <button type="button" disabled={saving || !examSessionId || !examComponentId || !examTurmaDisciplinaId || !examNote.trim()}
                    onClick={() => prepareConfirmation("exame")} className="rounded-lg bg-emerald px-3 py-2 text-xs font-bold text-white disabled:opacity-60">
                    {saving ? "A guardar..." : "Rever resultado do exame"}
                  </button>
                </div>
              )}
            </div>
          )}
          {action === "reapreciacao" && activeCase?.kind !== "exame" && (
            <div className="space-y-2">
              {activeCase?.kind === "pedido" && <p className="text-sm text-muted-foreground">Decisão sobre o pedido selecionado. O deferimento não publica automaticamente um resultado de exame.</p>}
              {(!selected && activeCase?.estado !== "registado" && (academic?.disciplina_ids_pendentes?.length || 0) > 0) && (
                <div className="rounded-lg border border-border bg-card p-3">
                  <label className="block text-xs font-bold text-foreground" htmlFor="raa-balcao-disciplina">Disciplina para reapreciação</label>
                  <select id="raa-balcao-disciplina" className="mt-1 w-full rounded-lg border border-border bg-background p-2 text-sm"
                    value={disciplinaId} onChange={(event) => setDisciplinaId(event.target.value)}>
                    <option value="">Selecionar disciplina</option>
                    {(academic?.disciplina_ids_pendentes || []).map((id) => <option key={id} value={id}>{id}</option>)}
                  </select>
                  <label className="mt-2 block text-xs font-bold text-foreground" htmlFor="raa-balcao-pedido-motivo">Fundamento do pedido</label>
                  <textarea id="raa-balcao-pedido-motivo" rows={2} className="mt-1 w-full rounded-lg border border-border bg-background p-2 text-sm"
                    value={motivo} onChange={(event) => setMotivo(event.target.value)} />
                  <button type="button" disabled={saving} onClick={() => prepareConfirmation("pedido")} className="mt-2 rounded-lg border border-border px-3 py-2 text-xs font-bold text-foreground">
                    Rever pedido de reapreciação
                  </button>
                </div>
              )}
            </div>
          )}
          {action === "disciplina" && (
            <p className="rounded-xl border border-border bg-muted/40 p-3 text-sm text-muted-foreground">
              {selected ? "A direção deve confirmar esta revisão." :
                "Nenhum evento ativo foi selecionado. Só a direção pode encerrar ou cancelar uma ocorrência."}
            </p>
          )}
          {!!selected && activeCase?.estado !== "registado" && (action === "justificacao" || action === "reapreciacao" || action === "disciplina") && (
            <div className="space-y-2 rounded-lg border border-amber-200 bg-card p-3">
              <label htmlFor="raa-balcao-decisao" className="block text-xs font-bold text-foreground">Decisão autorizada</label>
              <select id="raa-balcao-decisao" value={decision} onChange={(event) => setDecision(event.target.value)}
                className="w-full rounded-lg border border-border bg-background p-2 text-sm">
                {action === "justificacao" ? (
                  <><option value="approved">Aprovar justificação</option><option value="rejected">Rejeitar</option></>
                ) : action === "reapreciacao" ? (
                  <><option value="em_analise">Em análise</option><option value="deferido">Deferir pedido</option><option value="indeferido">Indeferir pedido</option></>
                ) : (
                  <><option value="em_analise">Colocar em análise</option><option value="resolvido">Concluir revisão</option><option value="cancelado">Cancelar ocorrência incorreta</option></>
                )}
              </select>
              <label htmlFor="raa-balcao-fundamento" className="block text-xs font-bold text-foreground">Fundamentação da decisão</label>
              <textarea id="raa-balcao-fundamento" rows={3} value={motivo}
                onChange={(event) => setMotivo(event.target.value)}
                className="w-full rounded-lg border border-border bg-background p-2 text-sm" />
              <div className="flex flex-wrap gap-2">
                <button type="button" disabled={saving || motivo.trim().length < (action === "disciplina" ? 15 : action === "reapreciacao" ? 5 : decision === "rejected" ? 8 : 0)}
                  onClick={() => prepareConfirmation("decisao")}
                  className="rounded-lg bg-emerald px-3 py-2 text-xs font-bold text-white disabled:opacity-60">
                  {saving ? "A guardar..." : "Rever e confirmar decisão"}
                </button>
                <button type="button" onClick={goToSummary} className="rounded-lg border border-border px-3 py-2 text-xs font-bold">Voltar</button>
              </div>
            </div>
          )}
            </div>
            {error && <p role="alert" className="rounded-xl border border-rose-400/40 bg-rose-500/10 p-3 text-sm text-rose-700 dark:text-rose-300">{error}</p>}
            <div className="flex flex-wrap gap-2 border-t border-border pt-3">
              <button type="button" onClick={() => void onRecheck()} disabled={saving}
                className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-border bg-card px-4 py-2.5 text-sm font-semibold text-foreground disabled:opacity-50 sm:w-auto">
                <RefreshCw className="h-4 w-4" aria-hidden="true" /> Verificar situação
              </button>
              <button type="button" onClick={goToSummary} disabled={saving}
                className="w-full rounded-xl px-4 py-2.5 text-sm font-medium text-muted-foreground hover:bg-muted disabled:opacity-50 sm:w-auto">
                Voltar às pendências
              </button>
            </div>
          </div>
        )}

        {phase === "confirm" && (
          <div className="space-y-4" role="group" aria-label="Confirmar decisão RAA">
            <button type="button" onClick={() => setPhase("detail")} disabled={saving}
              className="inline-flex items-center gap-1 text-xs font-semibold text-muted-foreground hover:text-foreground">
              <ChevronLeft className="h-4 w-4" aria-hidden="true" /> Rever formulário
            </button>
            <div className="rounded-xl border border-amber-400/40 bg-amber-500/10 p-4">
              <h4 className="text-sm font-semibold text-foreground">Confirmar a operação</h4>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                {confirmKind === "exame" ? "Guardar a nota do componente do exame oficial" :
                  confirmKind === "pedido" ? "Enviar o pedido de reapreciação" : "Registar decisão administrativa"}.
                Confirme os dados antes de guardar.
              </p>
              {confirmKind === "exame" && <p className="mt-2 text-sm font-medium text-foreground">Nota: {examNote} · sessão {examSessionId.slice(0, 8)}</p>}
              {confirmKind === "decisao" && <p className="mt-2 text-sm font-medium text-foreground">Decisão: {decision}</p>}
              {motivo.trim() && <p className="mt-2 whitespace-pre-wrap text-xs text-muted-foreground">Fundamentação: {motivo.trim()}</p>}
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              <button type="button" disabled={saving} onClick={() => setPhase("detail")}
                className="rounded-xl border border-border px-4 py-2.5 text-sm font-medium text-foreground disabled:opacity-50">Voltar e corrigir</button>
              <button type="button" disabled={saving} onClick={() => void confirmOperation()}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50">
                {saving ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <ShieldCheck className="h-4 w-4" aria-hidden="true" />}
                {saving ? "A guardar..." : "Confirmar e guardar"}
              </button>
            </div>
            {error && <p role="alert" className="text-sm text-rose-700 dark:text-rose-300">{error}</p>}
          </div>
        )}

        {phase === "feedback" && (
          <div className="space-y-4" role="status">
            <div className="flex items-start gap-3 rounded-xl border border-emerald/30 bg-emerald/5 p-4">
              <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald" aria-hidden="true" />
              <div>
                <h4 className="text-sm font-semibold text-foreground">Operação registada</h4>
                <p className="mt-1 text-sm leading-6 text-muted-foreground">{notice || "Registo guardado. Verifique se já pode avançar."}</p>
              </div>
            </div>
            <p className="text-xs leading-5 text-muted-foreground">
              Pode continuar neste atendimento.
            </p>
            <div className="grid gap-2 sm:grid-cols-2">
              <button type="button" onClick={() => { setCaseId(null); setPhase("summary"); void load(); }}
                className="rounded-xl border border-border px-4 py-2.5 text-sm font-semibold text-foreground">
                Próxima pendência
              </button>
              <button type="button" onClick={() => void onRecheck()}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald px-4 py-2.5 text-sm font-semibold text-white">
                <RefreshCw className="h-4 w-4" aria-hidden="true" /> Verificar situação
              </button>
            </div>
          </div>
        )}

        <p className="text-xs text-muted-foreground">A rematrícula fica disponível quando a pendência for resolvida.</p>
      </div>
    </section>
  );
}
