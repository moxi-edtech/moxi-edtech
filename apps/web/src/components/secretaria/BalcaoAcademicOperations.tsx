"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Loader2, ShieldCheck } from "lucide-react";
import { useBalcaoDraftForm } from "@/components/secretaria/command-center/BalcaoDraftState";
import type { BalcaoAcademicOperation } from "@/lib/rematricula/balcao-academic-operation";
import { nextBalcaoEjaStep, nextBalcaoExamStep, type BalcaoAcademicContext as Context } from "@/lib/rematricula/balcao-academic-journey";

type Action = BalcaoAcademicOperation["acao"];
const labels: Record<Action, string> = {
  abrir_exame: "Abrir sessão de exame", lancar_exame: "Lançar componente do exame", validar_exame: "Validar componente do exame",
  publicar_exame: "Encerrar e publicar resultados do exame", reabrir_periodo: "Autorizar correção de período",
  publicar_pauta: "Publicar pauta oficial", registar_eja: "Registar avaliação EJA", registar_frequencia_eja: "Conferir frequência EJA",
};
const examActions = new Set<Action>(["abrir_exame", "lancar_exame", "validar_exame", "publicar_exame"]);
const inputClass = "w-full rounded-xl border border-border bg-background px-3 py-2 text-sm text-foreground";
async function request(url: string, init?: RequestInit) {
  const response = await fetch(url, { cache: "no-store", ...init });
  const data = await response.json().catch(() => null);
  if (!response.ok || data?.ok !== true) throw Object.assign(new Error(data?.error ?? "Não foi possível concluir a operação."), { code: data?.code });
  return data;
}
export function BalcaoAcademicOperations({ matriculaId, preferredDisciplineId, preferredSessionId, initiallyEligible = false, autoOpen = false, visible = true, allowParticipantResolution = true, onRecheck, onLancarNota }: {
  matriculaId: string; preferredDisciplineId?: string; preferredSessionId?: string; initiallyEligible?: boolean; autoOpen?: boolean; visible?: boolean; allowParticipantResolution?: boolean; onRecheck: () => Promise<unknown>;
  onLancarNota: (trimestre?: 1 | 2 | 3 | null, disciplinaId?: string | null) => void;
}) {
  const [open, setOpen] = useState(autoOpen);
  const [peers, setPeers] = useState<Array<{ matricula_id: string; disciplina_id: string; nome: string; sessao_id: string }>>([]);
  const [activePeer, setActivePeer] = useState("");
  const [ctx, setCtx] = useState<Context | null>(null);
  const [action, setAction] = useState<Action>("reabrir_periodo");
  const [discipline, setDiscipline] = useState("");
  const [period, setPeriod] = useState("");
  const [resultId, setResultId] = useState("");
  const [sessionId, setSessionId] = useState("");
  const [componentId, setComponentId] = useState("");
  const [note, setNote] = useState("");
  const [total, setTotal] = useState("");
  const [present, setPresent] = useState("");
  const [reason, setReason] = useState("");
  const [document, setDocument] = useState("");
  const [classification, setClassification] = useState("");
  const [examType, setExamType] = useState<"recurso" | "extraordinario">("extraordinario");
  const [mode, setMode] = useState<"simples" | "escrita_oral" | "oral_pratica">("simples");
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [pautaType, setPautaType] = useState<"anual" | "trimestral">("anual");
  const [correction, setCorrection] = useState<{ trimester: 1 | 2 | 3; discipline: string } | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [edited, setEdited] = useState(false);
  const [review, setReview] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [academicReady, setAcademicReady] = useState(initiallyEligible);
  const [documentUrl, setDocumentUrl] = useState("");
  const [recheckPending, setRecheckPending] = useState(false);
  const alive = useRef(true);
  const focusTarget = useRef<HTMLHeadingElement>(null);
  const initialized = useRef(false);
  const retry = useRef<{ fingerprint: string; key: string; requestBody: string } | null>(null);
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
  const formData = { action, discipline, period, resultId, sessionId, componentId, note, total, present, reason, document, classification, examType, mode, start, end, pautaType };
  useBalcaoDraftForm("raa-operacoes:" + matriculaId + ":" + (preferredSessionId ?? "") + ":" + (preferredDisciplineId ?? ""), formData, null, { enabled: edited || saving, submitting: saving });

  const load = useCallback(async (signal?: AbortSignal): Promise<Context | null> => {
    setLoading(true);
    try {
      const data: Context = await request("/api/secretaria/balcao/raa/operacoes?" + new URLSearchParams({ matricula_id: matriculaId }), { signal });
      if (signal?.aborted || !alive.current) return null;
      setCtx(data);
      if (!initialized.current) {
        initialized.current = true;
        setDiscipline(data.disciplinas.find((d) => d.id === preferredDisciplineId)?.id ?? data.disciplinas[0]?.id ?? "");
        setPeriod(data.periodos[0]?.id ?? "");
        const initialSession = data.sessoes.find((session) => session.id === preferredSessionId) ?? data.sessoes[0];
        setSessionId(initialSession?.id ?? "");
        setStart(data.hoje_angola); setEnd(data.hoje_angola);
        setExamType(data.regime.eh_classe_exame ? "recurso" : "extraordinario");
        if (data.regime.escala !== "qualitativa" && initialSession) {
          const next = nextBalcaoExamStep(data, initialSession.id, data.disciplinas.find((d) => d.id === preferredDisciplineId)?.id ?? data.disciplinas[0]?.id ?? "");
          setAction(next.action); setComponentId(next.componenteId ?? ""); setResultId(next.resultadoId ?? "");
        }
        if (data.regime.escala === "qualitativa") {
          const next = nextBalcaoEjaStep(data);
          setAction(next?.action ?? "registar_eja");
          if (next?.periodId) { const f = data.frequencias.find((row) => row.periodo_id === next.periodId); setTotal(f?.aulas_previstas == null ? "" : String(f.aulas_previstas)); setPresent(f?.presencas == null ? "" : String(f.presencas)); }
          if (next?.disciplineId) setDiscipline(next.disciplineId);
          if (next?.periodId) setPeriod(next.periodId);
        }
      }
      return data;
    } catch (e) {
      if (!signal?.aborted && alive.current) { setCtx(null); setError((e as Error).message); }
      return null;
    } finally { if (!signal?.aborted && alive.current) setLoading(false); }
  }, [matriculaId, preferredDisciplineId, preferredSessionId]);
  useEffect(() => {
    if (!open || !visible) return;
    const controller = new AbortController(); void load(controller.signal);
    return () => controller.abort();
  }, [open, load, visible]);
  useEffect(() => { if (open && visible) focusTarget.current?.focus(); }, [open, action, review, visible]);

  async function recheck() {
    try {
      const result = await onRecheck() as { ok?: boolean; academic?: { eligible: boolean; reason?: string } | null } | undefined;
      if (result?.ok !== true) throw new Error("Revalidação pendente");
      if (alive.current) { setRecheckPending(false); setAcademicReady(result.academic?.eligible === true); setNotice(result.academic?.eligible === true
        ? "Situação académica regularizada. Continue a rematrícula nesta ficha; outras pendências aparecem no atendimento."
        : "Operação guardada. " + (result.academic?.reason || "A elegibilidade ainda não foi confirmada; continue na próxima etapa indicada.")); }
    } catch { if (alive.current) { setRecheckPending(true); setNotice("Operação guardada. A verificação da rematrícula está pendente; não repita a gravação."); } }
  }
  const previous = ctx?.evidencias.find((e) => e.disciplina_id === discipline);
  const frequency = ctx?.frequencias.find((f) => f.periodo_id === period);
  const selectedSession = ctx?.sessoes.find((s) => s.id === sessionId);
  const selectedResult = ctx?.resultados.find((r) => r.id === resultId);
  const selectedComponent = selectedSession?.componentes.find((c) => c.id === componentId);
  const turmaDiscipline = ctx?.turma_disciplinas.find((d) => d.avaliacao_disciplina_id === discipline);
  const examStep = ctx ? nextBalcaoExamStep(ctx, sessionId, discipline) : null;
  const ejaStep = ctx?.regime.escala === "qualitativa" ? nextBalcaoEjaStep(ctx) : null;
  const alreadyRecorded = ctx?.resultados.some((r) => r.exame_sessao_id === sessionId && r.exame_componente_id === componentId && r.turma_disciplina_id === turmaDiscipline?.id && r.estado !== "anulado");

  function selectPeriod(id: string) {
    setPeriod(id);
    const f = ctx?.frequencias.find((row) => row.periodo_id === id);
    setTotal(f?.aulas_previstas == null ? "" : String(f.aulas_previstas));
    setPresent(f?.presencas == null ? "" : String(f.presencas));
    if (f?.documento_fonte) setDocument(f.documento_fonte);
  }
  function chooseExamStep(context = ctx, id = sessionId, subject = discipline) {
    if (!context) return;
    const next = nextBalcaoExamStep(context, id, subject);
    setSessionId(id); setAction(next.action); setComponentId(next.componenteId ?? ""); setResultId(next.resultadoId ?? "");
    setNote(""); setReview(false); setError("");
  }
  function chooseEjaStep(context = ctx) {
    if (!context) return;
    const next = nextBalcaoEjaStep(context);
    if (!next) return;
    setAction(next.action); if (next.disciplineId) setDiscipline(next.disciplineId);
    if (next.periodId) {
      setPeriod(next.periodId);
      const f = context.frequencias.find((row) => row.periodo_id === next.periodId);
      setTotal(f?.aulas_previstas == null ? "" : String(f.aulas_previstas)); setPresent(f?.presencas == null ? "" : String(f.presencas));
    }
    setClassification(""); setReview(false); setError("");
  }
  function selectAction(next: Action) {
    setAction(next); setReview(false); setError("");
    if (next === "lancar_exame") setComponentId(examStep?.componenteId ?? selectedSession?.componentes[0]?.id ?? "");
    if (next === "validar_exame") setResultId(ctx?.resultados.find((r) => r.exame_sessao_id === sessionId && r.estado === "submetido")?.id ?? "");
    if (next === "registar_frequencia_eja") selectPeriod(period);
  }
  function payload(): BalcaoAcademicOperation {
    const base = { matricula_id: matriculaId, motivo: reason.trim() };
    if (action === "registar_eja") return { ...base, acao: action, disciplina_id: discipline, suficiente: classification === "suficiente", documento_fonte: document.trim(), expected_id: previous?.id ?? null };
    if (action === "registar_frequencia_eja") return { ...base, acao: action, periodo_id: period, aulas_previstas: Number(total), presencas: Number(present), documento_fonte: document.trim(), expected_version: frequency?.version ?? "" };
    if (action === "reabrir_periodo") return { ...base, acao: action, disciplina_id: discipline, periodo_id: period };
    if (action === "lancar_exame") return { ...base, acao: action, sessao_id: sessionId, componente_id: componentId, turma_disciplina_id: turmaDiscipline?.id ?? "", nota: Number(note) };
    if (action === "publicar_exame") return { ...base, acao: action, sessao_id: sessionId };
    if (action === "validar_exame") return { ...base, acao: action, resultado_id: resultId };
    if (action === "publicar_pauta") return { ...base, acao: action, periodo_id: period, tipo: pautaType };
    const codes = mode === "simples" ? ["escrita"] : mode === "escrita_oral" ? ["escrita", "oral"] : ["oral", "pratica"];
    return { ...base, acao: "abrir_exame", tipo: examType, modalidade: mode, data_inicio: start, data_fim: end,
      componentes: codes.map((codigo) => ({ codigo: codigo as "escrita" | "oral" | "pratica", peso: 1 })) };
  }
  async function save() {
    if (saving || loading || !review || !ctx?.can_manage) return;
    const body = payload();
    const requestBody = JSON.stringify(body);
    // A refreshed version must not turn a lost-response retry into a new write.
    // Preserve the exact original request until receipt or a definitive rejection.
    const fingerprint = JSON.stringify(body, (key, value) => ["expected_version", "expected_id"].includes(key) ? undefined : value);
    if (retry.current?.fingerprint !== fingerprint) retry.current = { fingerprint, key: crypto.randomUUID(), requestBody };
    setSaving(true); setError("");
    try {
      const saved = await request("/api/secretaria/balcao/raa/operacoes", { method: "POST", headers: { "Content-Type": "application/json", "Idempotency-Key": retry.current.key }, body: retry.current.requestBody });
      if (!alive.current) return;
      if (typeof saved.download_url === "string" && saved.download_url.startsWith("https://")) setDocumentUrl(saved.download_url);
      if (body.acao === "reabrir_periodo") {
        const trimester = ctx.periodos.find((p) => p.id === body.periodo_id)?.numero;
        if (trimester === 1 || trimester === 2 || trimester === 3) setCorrection({ trimester, discipline: body.disciplina_id });
      }
      setNotice("Operação guardada. A verificar a rematrícula neste atendimento…");
      setReview(false); setEdited(false); retry.current = null;
      const fresh = await load();
      if (fresh && alive.current) {
        if (body.acao === "abrir_exame") chooseExamStep(fresh, saved.id, discipline);
        else if (body.acao === "lancar_exame" || body.acao === "validar_exame") chooseExamStep(fresh);
        else if (body.acao === "registar_eja" || body.acao === "registar_frequencia_eja") { setClassification(""); chooseEjaStep(fresh); }
      }
      await recheck();
    } catch (e) {
      if ((e as { code?: string }).code === "EJA_VERSION_CONFLICT") retry.current = null;
      if (alive.current) setError((e as Error).message);
    }
    finally { if (alive.current) setSaving(false); }
  }
  const editable = ctx?.can_manage && ctx.ano_ativo && ctx.source.status === "ativo" && ctx.source.ativo;
  const reasonValid = reason.trim().length >= 15;
  const valid = reasonValid && (action === "abrir_exame" ? start && end && start <= end
    : action === "registar_eja" ? discipline && classification && document.trim().length >= 5
    : action === "registar_frequencia_eja" ? frequency?.pode_corrigir && total.trim() && present.trim() && Number.isInteger(Number(total)) && Number(total) > 0 && Number(total) <= 10000 && Number.isInteger(Number(present)) && Number(present) >= 0 && Number(present) <= Number(total) && document.trim().length >= 5 && (!frequency.evidence_id || edited)
    : action === "lancar_exame" ? selectedSession && selectedSession.data_inicio <= (ctx?.hoje_angola ?? "") && selectedComponent && turmaDiscipline && !alreadyRecorded && note.trim() && Number.isFinite(Number(note)) && Number(note) >= 0 && Number(note) <= selectedComponent.nota_max
    : action === "publicar_exame" ? selectedSession && selectedSession.pendencias_publicacao === 0 && ctx?.resultados.some((r) => r.exame_sessao_id === sessionId && r.estado === "validado")
    : action === "validar_exame" ? selectedResult?.estado === "submetido" : action === "reabrir_periodo" ? discipline && period : period);
  const examIndex = ["abrir_exame", "lancar_exame", "validar_exame", "publicar_exame"].indexOf(action);
  return <section aria-label="Operações académicas excecionais" className="mb-4 rounded-xl border border-border bg-card p-4">
    <button type="button" disabled={saving} aria-expanded={open} onClick={() => setOpen(!open)} className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-border px-3 py-2 text-sm font-semibold text-foreground">
      <ShieldCheck className="h-4 w-4" aria-hidden="true" /> Resolver operação académica aqui
    </button>
    {open && <div className="mt-4 space-y-3" aria-busy={saving || loading}>
      <h4 ref={focusTarget} tabIndex={-1} className="text-sm font-semibold">{review ? "Conferir e guardar" : labels[action]}</h4>
      {loading && <p role="status" className="flex items-center gap-2 text-sm"><Loader2 className="h-4 w-4 animate-spin" /> A confirmar permissões e contexto…</p>}
      {error && <div><p role="alert" className="text-sm text-destructive">{error}</p><button type="button" disabled={saving || loading} onClick={() => { setReview(false); setError(""); void load(); }} className={inputClass}>Atualizar contexto e rever dados</button></div>}
      {!ctx && !loading && !error && <button type="button" onClick={() => void load()} className={inputClass}>Tentar consultar novamente</button>}
      {notice && <p role="status" className="text-sm text-foreground">{notice}</p>}
      {documentUrl && <a href={documentUrl} target="_blank" rel="noopener noreferrer" className={inputClass}>Abrir pauta publicada</a>}
      {correction && allowParticipantResolution && <button type="button" disabled={saving} onClick={() => onLancarNota(correction.trimester, correction.discipline)} className={inputClass}>Corrigir notas agora</button>}
      {recheckPending && <button type="button" disabled={saving} onClick={() => void recheck()} className={inputClass}>Verificar rematrícula sem repetir a operação</button>}
      {ctx && !ctx.can_manage && <p className="text-sm text-muted-foreground">A confirmação exige um perfil autorizado da secretaria ou direção.</p>}
      {ctx?.can_manage && !editable && <p className="text-sm text-muted-foreground">O fecho legal da matrícula ou do ano exige um processo de reabertura próprio. A autorização de período preserva esse fecho.</p>}
      {editable && ctx && !review && <>
        <nav aria-label="Como resolver a pendência" className="flex flex-wrap gap-2">
          {!academicReady && ctx.regime.escala === "qualitativa" && ejaStep ? <button type="button" disabled={saving || loading} onClick={() => chooseEjaStep()} className={inputClass}>Continuar avaliação e frequência EJA</button>
            : !academicReady && ctx.regime.escala !== "qualitativa" ? <button type="button" disabled={saving || loading} onClick={() => chooseExamStep()} className={inputClass}>Continuar resolução por exame</button> : null}
        </nav>
        {examActions.has(action) && <div className="space-y-2 rounded-xl border border-border p-3">
          <ol aria-label="Etapas do exame" className="flex flex-wrap gap-3 text-xs">{["Abrir sessão", "Lançar notas", "Validar componentes", "Publicar resultados"].map((step, index) => <li key={step} aria-current={index === examIndex ? "step" : undefined} className={index === examIndex ? "font-bold" : "text-muted-foreground"}>{index + 1}. {step}</li>)}</ol>
          <p className="text-sm">{examStep?.detail}</p>
          {examStep && action !== examStep.action && <button type="button" disabled={saving || loading || examStep.disabled} onClick={() => chooseExamStep()} className={inputClass}>{examStep.title}</button>}
        </div>}
        {ctx.regime.escala === "qualitativa" && <div className="rounded-xl border border-border p-3 text-sm">
          <p>{ejaStep ? `Próxima etapa: ${ejaStep.title}.` : "Avaliações e frequência registadas. A elegibilidade depende dos resultados oficiais; confira a situação atual na ficha."}</p>
          <ul>{ctx.frequencias.map((f) => <li key={f.periodo_id}>{f.numero}.º trimestre: {f.aulas_previstas == null || f.presencas == null ? "frequência por conferir" : `${f.presencas} presenças em ${f.aulas_previstas} aulas`}{!f.pode_corrigir ? " · trimestre ainda em curso" : ""}</li>)}</ul>
        </div>}
        {allowParticipantResolution && selectedSession && selectedSession.participantes_pendentes.length > 0 && <div className="space-y-2 rounded-xl border border-border p-3">
          <h5 className="text-sm font-semibold">Completar a mesma sessão sem sair desta ficha</h5>
          {selectedSession.participantes_pendentes.map((participant) => <button key={participant.matricula_id + participant.disciplina_id} type="button" disabled={saving || loading} className={inputClass} onClick={() => { setPeers((current) => current.some((p) => p.matricula_id === participant.matricula_id && p.disciplina_id === participant.disciplina_id && p.sessao_id === selectedSession.id) ? current : [...current, { ...participant, sessao_id: selectedSession.id }]); setActivePeer(participant.matricula_id + participant.disciplina_id + selectedSession.id); }}>Resolver {participant.nome} · {participant.disciplina_nome}</button>)}
        </div>}
        <form onChange={() => setEdited(true)} onSubmit={(e) => { e.preventDefault(); if (valid && !loading && !saving) setReview(true); }}>
          <fieldset disabled={saving || loading} className="space-y-3">
            <label className="block space-y-1 text-xs font-semibold">Operação<select className={inputClass} value={action} onChange={(e) => selectAction(e.target.value as Action)}>{Object.entries(labels).filter(([value]) => (allowParticipantResolution || examActions.has(value as Action)) && (ctx.regime.escala === "qualitativa" ? ["registar_eja", "registar_frequencia_eja", "publicar_pauta"].includes(value) : !["registar_eja", "registar_frequencia_eja"].includes(value))).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
            {(["reabrir_periodo", "registar_eja", "lancar_exame"].includes(action) || examActions.has(action)) && <label className="block space-y-1 text-xs font-semibold">Disciplina de origem<select required className={inputClass} value={discipline} onChange={(e) => { setDiscipline(e.target.value); if (examActions.has(action) && action !== "abrir_exame") chooseExamStep(ctx, sessionId, e.target.value); }}><option value="">Selecionar</option>{ctx.disciplinas.map((d) => <option key={d.id} value={d.id}>{d.nome}</option>)}</select></label>}
            {["reabrir_periodo", "publicar_pauta", "registar_frequencia_eja"].includes(action) && <label className="block space-y-1 text-xs font-semibold">Período de origem<select required className={inputClass} value={period} onChange={(e) => selectPeriod(e.target.value)}><option value="">Selecionar</option>{ctx.periodos.map((p) => <option key={p.id} value={p.id}>{p.numero}.º trimestre · {p.data_inicio} a {p.data_fim}</option>)}</select></label>}
            {action === "reabrir_periodo" && <p className="text-sm text-muted-foreground">Autoriza a correção desta disciplina e trimestre durante 24 horas. Depois, use «Corrigir notas agora» nesta ficha. A autorização não altera a nota.</p>}
            {action === "registar_eja" && <>
              {previous && <p className="text-sm text-muted-foreground">Avaliação atual: {previous.suficiente ? "Suficiente" : "Não suficiente"}. A retificação preserva o registo anterior.</p>}
              <label className="block space-y-1 text-xs font-semibold">Avaliação oficial<select required className={inputClass} value={classification} onChange={(e) => setClassification(e.target.value)}><option value="">Selecionar</option><option value="suficiente">Suficiente</option><option value="nao_suficiente">Não suficiente</option></select></label>
            </>}
            {action === "registar_frequencia_eja" && <>
              <p className="text-sm text-muted-foreground">Confira o resumo deste aluno com o registo oficial do trimestre. A retificação preserva o histórico e será usada na reavaliação EJA.</p>
              {frequency && !frequency.pode_corrigir && <p role="status" className="text-sm">O trimestre termina em {frequency.data_fim}. A frequência completa poderá ser conferida depois dessa data.</p>}
              <label className="block space-y-1 text-xs font-semibold">Aulas previstas no registo oficial<input required type="number" min={1} max={10000} step={1} className={inputClass} value={total} onChange={(e) => setTotal(e.target.value)} /></label>
              <label className="block space-y-1 text-xs font-semibold">Presenças confirmadas<input required type="number" min={0} max={Number(total) || 10000} step={1} className={inputClass} value={present} onChange={(e) => setPresent(e.target.value)} /></label>
              {present.trim() && total.trim() && Number(present) > Number(total) && <p role="alert" className="text-sm text-destructive">As presenças não podem exceder o total de aulas.</p>}
            </>}
            {["registar_eja", "registar_frequencia_eja"].includes(action) && <label className="block space-y-1 text-xs font-semibold">Referência do documento ou ata oficial<input required minLength={5} maxLength={1000} className={inputClass} value={document} onChange={(e) => setDocument(e.target.value)} /></label>}
            {examActions.has(action) && action !== "abrir_exame" && <label className="block space-y-1 text-xs font-semibold">Sessão do exame<select required className={inputClass} value={sessionId} onChange={(e) => chooseExamStep(ctx, e.target.value)}><option value="">Selecionar</option>{ctx.sessoes.map((s) => <option key={s.id} value={s.id}>{s.tipo} · {s.data_inicio}</option>)}</select></label>}
            {action === "lancar_exame" && <>
              <label className="block space-y-1 text-xs font-semibold">Componente do exame<select required className={inputClass} value={componentId} onChange={(e) => { setComponentId(e.target.value); setNote(""); }}><option value="">Selecionar</option>{selectedSession?.componentes.map((c) => <option key={c.id} value={c.id}>{c.codigo} · máximo {c.nota_max}</option>)}</select></label>
              <label className="block space-y-1 text-xs font-semibold">Nota do componente<input required type="number" min={0} max={selectedComponent?.nota_max ?? 100} step="0.1" className={inputClass} value={note} onChange={(e) => setNote(e.target.value)} /></label>
              {alreadyRecorded && <p role="status" className="text-sm">Este componente já foi registado. Continue na etapa de validação; alterações exigem retificação formal.</p>}
            </>}
            {action === "validar_exame" && <label className="block space-y-1 text-xs font-semibold">Resultado submetido<select required className={inputClass} value={resultId} onChange={(e) => setResultId(e.target.value)}><option value="">Selecionar</option>{ctx.resultados.filter((r) => r.estado === "submetido" && r.exame_sessao_id === sessionId).map((r) => <option key={r.id} value={r.id}>{r.disciplina_nome || "Disciplina"} · {selectedSession?.componentes.find((c) => c.id === r.exame_componente_id)?.codigo} · nota {r.nota}</option>)}</select></label>}
            {action === "publicar_exame" && <p className="text-sm text-muted-foreground">Esta confirmação encerra a sessão inteira. Todos os componentes dos participantes devem estar validados. O resultado passa a ser usado pelo RAA.</p>}
            {action === "abrir_exame" && <>
              <label className="block space-y-1 text-xs font-semibold">Tipo<select className={inputClass} value={examType} onChange={(e) => setExamType(e.target.value as typeof examType)}><option value="recurso">Recurso</option><option value="extraordinario">Extraordinário</option></select></label>
              <label className="block space-y-1 text-xs font-semibold">Componentes<select className={inputClass} value={mode} onChange={(e) => setMode(e.target.value as typeof mode)}><option value="simples">Escrita</option><option value="escrita_oral">Escrita e oral (pesos iguais)</option><option value="oral_pratica">Oral e prática (pesos iguais)</option></select></label>
              <div className="grid gap-3 sm:grid-cols-2"><label className="space-y-1 text-xs font-semibold">Início<input required type="date" className={inputClass} value={start} onChange={(e) => setStart(e.target.value)} /></label><label className="space-y-1 text-xs font-semibold">Fim<input required type="date" className={inputClass} value={end} min={start} onChange={(e) => setEnd(e.target.value)} /></label></div>
            </>}
            {action === "publicar_pauta" && <><p className="text-sm text-muted-foreground">Publica o documento de toda a turma e preserva a versão anterior. O PDF não altera notas nem substitui a publicação dos resultados do exame.</p><label className="block space-y-1 text-xs font-semibold">Tipo de pauta<select className={inputClass} value={pautaType} onChange={(e) => setPautaType(e.target.value as typeof pautaType)}><option value="anual">Anual</option>{ctx.regime.escala !== "qualitativa" && <option value="trimestral">Trimestral</option>}</select></label></>}
            <label className="block space-y-1 text-xs font-semibold">Fundamentação<textarea required minLength={15} maxLength={1000} rows={3} className={inputClass} value={reason} onChange={(e) => setReason(e.target.value)} /></label>
            {!reasonValid && <p className="text-xs text-muted-foreground">Explique o motivo com pelo menos 15 caracteres para registar a decisão.</p>}
            <button type="submit" disabled={!valid || saving || loading} className="min-h-10 rounded-xl bg-amber px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">Rever e confirmar</button>
          </fieldset>
        </form>
      </>}
      {editable && review && <div className="space-y-3 rounded-xl border border-amber/40 bg-amber/10 p-3">
        <h5 className="text-sm font-semibold">Confirmar: {labels[action]}</h5>
        <dl className="space-y-1 text-sm">
          {discipline && <div><dt className="font-semibold">Disciplina</dt><dd>{ctx?.disciplinas.find((d) => d.id === discipline)?.nome}</dd></div>}
          {["reabrir_periodo", "publicar_pauta", "registar_frequencia_eja"].includes(action) && <div><dt className="font-semibold">Período</dt><dd>{ctx?.periodos.find((p) => p.id === period)?.numero}.º trimestre{action === "publicar_pauta" ? ` · pauta ${pautaType}` : ""}</dd></div>}
          {action === "registar_eja" && <div><dt className="font-semibold">Avaliação e fonte</dt><dd>{classification === "suficiente" ? "Suficiente" : "Não suficiente"} · {document}</dd></div>}
          {action === "registar_frequencia_eja" && <div><dt className="font-semibold">Frequência e fonte</dt><dd>{present} presenças em {total} aulas · {document}</dd></div>}
          {action === "abrir_exame" && <div><dt className="font-semibold">Sessão</dt><dd>{examType} · {mode} · {start} a {end}</dd></div>}
          {action === "lancar_exame" && <div><dt className="font-semibold">Resultado a lançar</dt><dd>{selectedComponent?.codigo} · nota {note} · {selectedSession?.tipo} · {selectedSession?.data_inicio}</dd></div>}
          {action === "validar_exame" && <div><dt className="font-semibold">Resultado a validar</dt><dd>{selectedResult?.disciplina_nome} · {selectedSession?.componentes.find((c) => c.id === selectedResult?.exame_componente_id)?.codigo} · nota {selectedResult?.nota}</dd></div>}
          {action === "publicar_exame" && <div><dt className="font-semibold">Sessão inteira</dt><dd>{selectedSession?.tipo} · {selectedSession?.data_inicio}</dd></div>}
          <div><dt className="font-semibold">Fundamentação</dt><dd>{reason}</dd></div>
        </dl>
        <p className="text-xs">A decisão fica auditada e a rematrícula será verificada automaticamente. O pagamento existente é preservado.</p>
        <div className="flex flex-wrap gap-2"><button type="button" disabled={saving} onClick={() => setReview(false)} className="min-h-10 rounded-xl border border-border px-4 py-2 text-sm">Voltar e corrigir</button><button type="button" disabled={saving || loading} onClick={() => void save()} className="min-h-10 rounded-xl bg-amber px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">{saving ? "A guardar…" : "Confirmar e guardar"}</button></div>
      </div>}
      {peers.map((peer) => <div key={peer.matricula_id + peer.disciplina_id + peer.sessao_id} hidden={activePeer !== peer.matricula_id + peer.disciplina_id + peer.sessao_id} role="region" className="space-y-2 rounded-xl border border-amber/40 p-3" aria-label={`Participante da sessão: ${peer.nome}`}>
        <h5 className="text-sm font-semibold">A resolver: {peer.nome}. O aluno em atendimento permanece nesta ficha.</h5>
        <button type="button" className={inputClass} onClick={() => { setActivePeer(""); focusTarget.current?.focus(); }}>Recolher participante e voltar ao aluno em atendimento</button>
        <BalcaoAcademicOperations matriculaId={peer.matricula_id} preferredDisciplineId={peer.disciplina_id} preferredSessionId={peer.sessao_id} allowParticipantResolution={false} autoOpen visible={activePeer === peer.matricula_id + peer.disciplina_id + peer.sessao_id}
          onLancarNota={() => undefined} onRecheck={async () => { await load(); return onRecheck(); }} />
      </div>)}
    </div>}
  </section>;
}
