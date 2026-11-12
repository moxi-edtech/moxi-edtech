"use client";

import { useCallback, useEffect, useState } from "react";
import { CheckCircle2, FileCheck2, Loader2, RefreshCw, ShieldCheck } from "lucide-react";

type HistoricStage = "decisao" | "notas" | "ratificacao" | "fecho" | "concluido" | "indisponivel";
type HistoricalResult = "aprovado" | "reprovado" | "concluido";
type Snapshot = {
  ok: true;
  matricula_id: string;
  origem_ano: number;
  origem_status: string;
  estado: HistoricStage;
  permite_escrita: boolean;
  tem_notas_reais: boolean;
  permite_conclusao_ciclo: boolean;
  resultado_confirmado: HistoricalResult | null;
  permite_notas_historicas: boolean;
  permite_pedir_intervencao: boolean;
  pedido_regularizacao: { id: string; criado_em: string; motivo: string } | null;
  coorte: string | null;
  mensagem: string | null;
};

const url = "/api/secretaria/operacoes-academicas/reconciliacao-historica";
const labels: Record<HistoricalResult, string> = {
  aprovado: "Aprovado · próxima classe",
  reprovado: "Retido · mesma classe",
  concluido: "Concluiu · fim do ciclo",
};

async function readResponse(response: Response) {
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || payload?.ok !== true) {
    throw new Error(payload?.error || "Não foi possível confirmar o histórico escolar.");
  }
  return payload;
}

/** Exceptional, student-scoped documentary path. Never opens the old school year
 * or writes synthetic marks. The school must choose and sign its real outcome.
 */
export function BalcaoHistoricalAcademicRecovery({
  matriculaId, turmaId, disciplinasPendentes, onRecheck, onLancarNotaHistorica,
}: {
  matriculaId: string;
  turmaId: string | null;
  disciplinasPendentes: string[];
  onRecheck: () => Promise<unknown>;
  onLancarNotaHistorica: (disciplinaId?: string | null) => void;
}) {
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [result, setResult] = useState<HistoricalResult | "">("");
  const [reference, setReference] = useState("");
  const [reason, setReason] = useState("");
  const [acknowledged, setAcknowledged] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [requestReason, setRequestReason] = useState("");
  const [disciplines, setDisciplines] = useState<Array<{ id: string; nome: string }>>([]);

  const load = useCallback(async (signal?: AbortSignal) => {
    const data = await readResponse(await fetch(
      url + "?" + new URLSearchParams({ matricula_id: matriculaId }),
      { cache: "no-store", signal },
    )) as Snapshot;
    if (data.matricula_id !== matriculaId) throw new Error("A matrícula consultada não corresponde ao aluno selecionado.");
    if (!signal?.aborted) setSnapshot(data);
  }, [matriculaId]);

  useEffect(() => {
    const controller = new AbortController();
    setSnapshot(null);
    setError("");
    setNotice("");
    setResult("");
    setReference("");
    setReason("");
    setAcknowledged(false);
    setRequestReason("");
    setDisciplines([]);
    setLoading(true);
    void load(controller.signal)
      .catch((cause) => {
        if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : "Falha na consulta do histórico.");
      })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [load]);

  useEffect(() => {
    const onGradeSaved = (event: Event) => {
      const detail = (event as CustomEvent<{ matriculaId: string }>).detail;
      if (detail?.matriculaId !== matriculaId) return;
      setLoading(true);
      setError("");
      void load()
        .catch((cause) => {
          setSnapshot(null);
          setError(cause instanceof Error ? cause.message : "Não foi possível atualizar o histórico.");
        })
        .finally(() => setLoading(false));
    };
    window.addEventListener("klasse:historic-grade-saved", onGradeSaved);
    return () => window.removeEventListener("klasse:historic-grade-saved", onGradeSaved);
  }, [load, matriculaId]);

  // Only consult class disciplines for an operator who can really enter
  // historical grades. IDs come from the source class's authorized endpoint.
  useEffect(() => {
    if (!snapshot?.permite_notas_historicas || !turmaId ||
        !["decisao", "notas"].includes(snapshot.estado)) {
      setDisciplines([]);
      return;
    }
    const controller = new AbortController();
    void fetch(`/api/secretaria/turmas/${encodeURIComponent(turmaId)}/disciplinas`,
      { cache: "no-store", signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error("Disciplinas indisponíveis");
        return response.json();
      })
      .then((data) => {
        if (controller.signal.aborted) return;
        const list = (Array.isArray(data?.items) ? data.items : [])
          .filter((entry: any) => typeof entry.disciplina?.id === "string" &&
            typeof entry.disciplina?.nome === "string")
          .map((entry: any) => ({ id: String(entry.disciplina.id), nome: String(entry.disciplina.nome) }));
        setDisciplines(list.filter((item: { id: string }) =>
          !disciplinasPendentes.length || disciplinasPendentes.includes(item.id)));
      })
      .catch(() => { if (!controller.signal.aborted) setDisciplines([]); });
    return () => controller.abort();
  }, [snapshot?.permite_notas_historicas, snapshot?.estado, turmaId, disciplinasPendentes.join("|")]);

  const refresh = async () => {
    setLoading(true);
    setError("");
    try { await load(); }
    catch (cause) {
      setSnapshot(null); // Stale permissions must never remain actionable.
      setError(cause instanceof Error ? cause.message : "Falha na consulta do histórico.");
    } finally { setLoading(false); }
  };

  const stage = snapshot?.estado;
  const canAct = Boolean(snapshot?.permite_escrita && stage && !["indisponivel", "concluido", "notas"].includes(stage));
  const selectedResult = stage === "decisao" ? result : snapshot?.resultado_confirmado;
  const needsIntervention = Boolean(snapshot?.permite_pedir_intervencao &&
    ((stage === "notas" && !snapshot?.permite_notas_historicas) ||
     (stage !== "notas" && stage !== "concluido" && !snapshot?.permite_escrita)));
  const documentReady = stage === "fecho"
    ? reason.trim().length >= 12
    : reference.trim().length >= 8 && reason.trim().length >= 12;
  const canSubmit = canAct && !saving && !loading && acknowledged &&
    documentReady && Boolean(selectedResult);

  const requestIntervention = async () => {
    if (!snapshot?.permite_pedir_intervencao || snapshot.pedido_regularizacao ||
        requestReason.trim().length < 12 || saving || loading) return;
    setSaving(true);
    setError("");
    setNotice("");
    try {
      const saved = await readResponse(await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          acao: "solicitar_intervencao",
          matricula_id: matriculaId,
          motivo: requestReason.trim(),
        }),
      }));
      setRequestReason("");
      setNotice(saved.mensagem || "Solicitação registada para a direção.");
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Falha ao solicitar a intervenção.");
      try { await load(); } catch { setSnapshot(null); }
    } finally { setSaving(false); }
  };

  const submit = async () => {
    if (!canSubmit || !stage || !snapshot || !selectedResult) return;
    const operation = stage === "decisao" ? "registar_decisao"
      : stage === "ratificacao" ? "ratificar" : "fechar_historico";
    const instruction = operation === "registar_decisao"
      ? `Registar a decisão escolar: ${labels[selectedResult]}?`
      : operation === "ratificar"
        ? `Ratificar a decisão: ${labels[selectedResult]}?`
        : "Fechar legalmente o histórico deste aluno?";
    if (!window.confirm(instruction)) return;
    setSaving(true);
    setError("");
    setNotice("");
    try {
      const body = operation === "fechar_historico"
        ? { acao: operation, matricula_id: matriculaId,
            motivo: reason.trim(), confirmacao: "CONFIRMO_FECHO_LEGAL" }
        : { acao: operation, matricula_id: matriculaId,
            resultado_confirmado: selectedResult,
            referencia_documental: reference.trim(), motivo: reason.trim() };
      const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const saved = await readResponse(response);
      setReference("");
      setReason("");
      setResult("");
      setAcknowledged(false);
      setNotice(saved.mensagem || "Operação académica registada.");
      await load();
      try { await onRecheck(); }
      catch { setNotice("Operação registada. Atualize a verificação de rematrícula antes de continuar."); }
    } catch (cause) {
      // A lost response may hide a successful commit. Re-read before retry.
      setError(cause instanceof Error ? cause.message : "Falha ao registar a decisão.");
      try { await load(); } catch { setSnapshot(null); }
    } finally { setSaving(false); }
  };

  const step = ["decisao", "notas"].includes(stage ?? "") ? 1 : stage === "ratificacao" ? 2 : stage === "fecho" ? 3 : 4;
  return (
    <section aria-label="Regularização académica histórica" className="mb-4 space-y-3 rounded-xl border border-border bg-card p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <FileCheck2 className="h-5 w-5 text-emerald" aria-hidden="true" />
          <h3 className="font-sora text-sm font-semibold text-foreground">Validar resultado de {snapshot?.origem_ano ?? "origem"}</h3>
        </div>
        <button type="button" onClick={() => void refresh()} disabled={saving || loading}
          className="inline-flex items-center gap-2 rounded-xl border border-border px-3 py-2 text-xs font-semibold disabled:opacity-50">
          <RefreshCw className="h-4 w-4" aria-hidden="true" /> Verificar
        </button>
      </div>
      {loading && <p role="status" className="flex items-center gap-2 text-xs text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" /> A confirmar o histórico...
      </p>}
      {snapshot && (
        <>
          {snapshot.permite_notas_historicas && (stage === "decisao" || stage === "notas") && (
            <button type="button" onClick={() => onLancarNotaHistorica()}
              className="inline-flex min-h-10 items-center gap-2 rounded-xl bg-amber px-4 py-2.5 text-sm font-semibold text-white">
              Abrir pauta de {snapshot.origem_ano}
            </button>
          )}
          {stage === "decisao" && (
            <p role="status" className="text-xs text-muted-foreground">
              {snapshot.tem_notas_reais === false ? "Sem notas registadas." : "Confirme a ata ou pauta antes de decidir."}
            </p>
          )}
          {snapshot.permite_notas_historicas && disciplines.length > 0 &&
            (stage === "decisao" || stage === "notas") && (
              <details className="rounded-xl border border-border bg-background/60 p-3">
                <summary className="cursor-pointer text-sm font-semibold text-foreground">
                  Disciplinas da origem ({disciplines.length})
                </summary>
                <ul className="mt-3 space-y-2">
                  {disciplines.map((item) => (
                    <li key={item.id} className="flex items-center justify-between gap-3 rounded-xl border border-border bg-card px-3 py-2">
                      <span className="min-w-0 text-xs font-medium text-foreground">{item.nome}</span>
                      <button type="button" onClick={() => onLancarNotaHistorica(item.id)}
                        className="shrink-0 rounded-xl border border-border px-3 py-2 text-xs font-semibold hover:bg-muted">
                        Lançar nota
                      </button>
                    </li>
                  ))}
                </ul>
              </details>
            )}
          {snapshot.pedido_regularizacao && snapshot.permite_escrita && stage !== "concluido" && (
            <div role="status" className="space-y-1 rounded-xl border border-amber/40 bg-amber/5 p-3">
              <p className="text-xs font-semibold text-foreground">Pedido de revisão recebido</p>
            </div>
          )}
          {needsIntervention && (
            <div className="space-y-2 rounded-xl border border-border bg-muted/20 p-3">
              <p className="text-sm font-semibold text-foreground">Pedir ajuda</p>
              {snapshot.pedido_regularizacao ? (
                <p role="status" className="text-xs text-muted-foreground">
                  Solicitação registada neste processo em {new Date(snapshot.pedido_regularizacao.criado_em).toLocaleDateString("pt-AO")}.
                  Use a pauta ou decisão comprovada para continuar.
                </p>
              ) : (
                <>
                  <label className="block space-y-1 text-xs font-medium text-foreground">
                    Motivo do encaminhamento
                    <textarea rows={2} maxLength={500} value={requestReason}
                      onChange={(event) => setRequestReason(event.target.value)}
                      placeholder="Indique as disciplinas ou a decisão escolar que precisam de regularização"
                      className="w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm" />
                  </label>
                  <button type="button" onClick={() => void requestIntervention()}
                    disabled={saving || loading || requestReason.trim().length < 12}
                    className="inline-flex min-h-10 items-center gap-2 rounded-xl bg-amber px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50">
                    {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
                    Registar pedido
                  </button>
                </>
              )}
            </div>
          )}
          {stage === "concluido" ? (
            <div role="status" className="space-y-2">
              <p className="flex items-center gap-2 text-sm font-medium text-emerald">
                <CheckCircle2 className="h-4 w-4" /> Histórico concluído · {snapshot.resultado_confirmado ? labels[snapshot.resultado_confirmado] : "Resultado por confirmar"}.
              </p>

            </div>
          ) : stage === "notas" ? (
            <p role="status" className="text-sm text-foreground">
              {snapshot.permite_notas_historicas ? "Continue na pauta." : "Notas pendentes. Peça a revisão de um operador autorizado."}
            </p>
          ) : stage === "indisponivel" ? (
            <p role="status" className="text-sm text-muted-foreground">
              {snapshot.mensagem ?? "Esta matrícula requer revisão académica individual pela direção."}
            </p>
          ) : (
            <>
              <div aria-label="Progresso da regularização" className="flex flex-wrap gap-2 text-xs">
                <span className={step === 1 ? "font-semibold text-foreground" : "text-muted-foreground"}>1. Resultado</span>
                <span aria-hidden="true">·</span>
                <span className={step === 2 ? "font-semibold text-foreground" : "text-muted-foreground"}>2. Confirmar</span>
                <span aria-hidden="true">·</span>
                <span className={step === 3 ? "font-semibold text-foreground" : "text-muted-foreground"}>3. Concluir</span>
              </div>
              {!snapshot.permite_escrita ? (
                <p role="status" className="text-sm text-muted-foreground">
                  "Sem permissão para esta ação."
                </p>
              ) : (
                <div className="space-y-3">
                  {stage === "decisao" ? (
                    <label className="block space-y-1 text-xs font-medium text-foreground">
                      Resultado comprovado pela escola
                      <select value={result} onChange={(e) => { setResult(e.target.value as HistoricalResult | ""); setAcknowledged(false); }}
                        className="w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm">
                        <option value="">Selecionar resultado</option>
                        <option value="aprovado">{labels.aprovado}</option>
                        <option value="reprovado">{labels.reprovado}</option>
                        {snapshot.permite_conclusao_ciclo && (
                          <option value="concluido">{labels.concluido}</option>
                        )}
                      </select>
                    </label>
                  ) : <p className="text-sm font-medium text-foreground">
                    Resultado registado: {snapshot.resultado_confirmado ? labels[snapshot.resultado_confirmado] : "Resultado por confirmar"}
                  </p>}
                  {stage !== "fecho" && (
                    <label className="block space-y-1 text-xs font-medium text-foreground">
                      Referência da ata ou pauta
                      <input type="text" maxLength={180} value={reference} onChange={(e) => setReference(e.target.value)}
                        placeholder="Ex.: Ata n.º 2025/..." className="w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm" />
                    </label>
                  )}
                  <label className="block space-y-1 text-xs font-medium text-foreground">
                    {stage === "fecho" ? "Fundamentação do fecho legal" : "Fundamentação da decisão"}
                    <textarea rows={2} maxLength={500} value={reason} onChange={(e) => setReason(e.target.value)}
                      className="w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm" />
                  </label>
                  <label className="flex items-start gap-2 text-xs text-muted-foreground">
                    <input type="checkbox" checked={acknowledged} onChange={(e) => setAcknowledged(e.target.checked)}
                      className="mt-0.5 accent-amber" />
                    {stage === "fecho"
                      ? "Confirmo o fecho do histórico."
                      : "Confirmei a ata ou pauta escolar."}
                  </label>
                  <button type="button" disabled={!canSubmit} onClick={() => void submit()}
                    className="inline-flex min-h-10 items-center gap-2 rounded-xl bg-amber px-4 py-2.5 text-sm font-semibold text-white hover:brightness-95 disabled:opacity-50">
                    {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
                    {stage === "decisao" ? "Guardar resultado" : stage === "ratificacao" ? "Confirmar resultado" : "Concluir histórico"}
                  </button>
                </div>
              )}
            </>
          )}
        </>
      )}
      {notice && <p role="status" className="text-xs text-emerald">{notice}</p>}
      {error && <p role="alert" className="text-xs text-red-600">{error}</p>}
    </section>
  );
}
