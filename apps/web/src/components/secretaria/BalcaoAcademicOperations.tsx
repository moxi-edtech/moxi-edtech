"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Loader2, ShieldCheck } from "lucide-react";
import { useBalcaoDraftForm } from "@/components/secretaria/command-center/BalcaoDraftState";
import type { BalcaoAcademicOperation } from "@/lib/rematricula/balcao-academic-operation";

type Action = BalcaoAcademicOperation["acao"];
type Context = {
  can_manage: boolean; ano_ativo: boolean;
  source: { id: string; turma_id: string; status: string; ativo: boolean };
  regime: { escala: string; eh_classe_exame: boolean; exames_aplicaveis: string[] };
  disciplinas: Array<{ id: string; nome: string }>;
  periodos: Array<{ id: string; numero: number; data_inicio: string; data_fim: string }>;
  resultados: Array<{ id: string; nota: number; turma_disciplina_id: string }>;
  evidencias: Array<{ id: string; disciplina_id: string; suficiente: boolean }>;
};
const labels: Record<Action, string> = {
  abrir_exame: "Abrir sessão de exame", validar_exame: "Validar resultado de exame",
  reabrir_periodo: "Autorizar correção de período", publicar_pauta: "Publicar pauta oficial", registar_eja: "Registar avaliação EJA",
};
async function request(url: string, init?: RequestInit) {
  const response = await fetch(url, { cache: "no-store", ...init });
  const data = await response.json().catch(() => null);
  if (!response.ok || data?.ok !== true) throw new Error(data?.error ?? "Não foi possível concluir a operação.");
  return data;
}
export function BalcaoAcademicOperations({ matriculaId, onRecheck, onLancarNota }: {
  matriculaId: string; onRecheck: () => Promise<unknown>;
  onLancarNota: (trimestre?: 1 | 2 | 3 | null, disciplinaId?: string | null) => void;
}) {
  const [open, setOpen] = useState(false);
  const [ctx, setCtx] = useState<Context | null>(null);
  const [action, setAction] = useState<Action>("reabrir_periodo");
  const [discipline, setDiscipline] = useState("");
  const [period, setPeriod] = useState("");
  const [resultId, setResultId] = useState("");
  const [reason, setReason] = useState("");
  const [document, setDocument] = useState("");
  const [classification, setClassification] = useState("");
  const [examType, setExamType] = useState<"recurso" | "extraordinario">("recurso");
  const [mode, setMode] = useState<"simples" | "escrita_oral" | "oral_pratica">("simples");
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [pautaType, setPautaType] = useState<"anual" | "trimestral">("anual");
  const [correction, setCorrection] = useState<{ trimester: 1 | 2 | 3; discipline: string } | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [review, setReview] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [documentUrl, setDocumentUrl] = useState("");
  const [recheckPending, setRecheckPending] = useState(false);
  const alive = useRef(true);
  const retry = useRef<{ fingerprint: string; key: string } | null>(null);
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
  const formData = { action, discipline, period, resultId, reason, document, classification, examType, mode, start, end, pautaType };
  const [baseline, setBaseline] = useState(formData);
  useBalcaoDraftForm("raa-operacoes:" + matriculaId, formData, baseline, { enabled: open || reason.trim().length > 0, submitting: saving });

  const load = useCallback(async (signal?: AbortSignal) => {
    setLoading(true);
    try {
      const data = await request("/api/secretaria/balcao/raa/operacoes?" + new URLSearchParams({ matricula_id: matriculaId }), { signal });
      if (!signal?.aborted && alive.current) setCtx(data);
    } catch (e) {
      if (!signal?.aborted && alive.current) { setCtx(null); setError((e as Error).message); }
    } finally { if (!signal?.aborted && alive.current) setLoading(false); }
  }, [matriculaId]);
  useEffect(() => {
    if (!open) return;
    const controller = new AbortController(); void load(controller.signal);
    return () => controller.abort();
  }, [open, load]);

  async function recheck() {
    try {
      const result = await onRecheck() as { ok?: boolean } | undefined;
      if (result?.ok !== true) throw new Error("Revalidação pendente");
      if (alive.current) { setRecheckPending(false); setNotice("Operação guardada e situação atualizada. Continue pela próxima ação apresentada na ficha."); }
    }
    catch { if (alive.current) { setRecheckPending(true); setNotice("Operação guardada. A verificação da rematrícula está pendente; não repita a gravação."); } }
  }
  const previous = ctx?.evidencias.find((e) => e.disciplina_id === discipline);
  function payload(): BalcaoAcademicOperation {
    const base = { acao: action, matricula_id: matriculaId, motivo: reason.trim() };
    if (action === "registar_eja") return { ...base, acao: action, disciplina_id: discipline, suficiente: classification === "suficiente", documento_fonte: document.trim(), expected_id: previous?.id ?? null };
    if (action === "reabrir_periodo") return { ...base, acao: action, disciplina_id: discipline, periodo_id: period };
    if (action === "validar_exame") return { ...base, acao: action, resultado_id: resultId };
    if (action === "publicar_pauta") return { ...base, acao: action, periodo_id: period, tipo: pautaType };
    const codes = mode === "simples" ? ["escrita"] : mode === "escrita_oral" ? ["escrita", "oral"] : ["oral", "pratica"];
    return { ...base, acao: "abrir_exame", tipo: examType, modalidade: mode, data_inicio: start, data_fim: end,
      componentes: codes.map((codigo) => ({ codigo: codigo as "escrita" | "oral" | "pratica", peso: 1 })) };
  }
  async function save() {
    if (saving || loading || !review || !ctx?.can_manage) return;
    const body = payload();
    const fingerprint = JSON.stringify(body);
    if (retry.current?.fingerprint !== fingerprint) retry.current = { fingerprint, key: crypto.randomUUID() };
    setSaving(true); setError("");
    try {
      const saved = await request("/api/secretaria/balcao/raa/operacoes", { method: "POST", headers: {
        "Content-Type": "application/json", "Idempotency-Key": retry.current.key,
      }, body: fingerprint });
      if (!alive.current) return;
      if (typeof saved.download_url === "string" && saved.download_url.startsWith("https://")) setDocumentUrl(saved.download_url);
      if (body.acao === "reabrir_periodo") {
        const trimester = ctx.periodos.find((p) => p.id === body.periodo_id)?.numero;
        if (trimester === 1 || trimester === 2 || trimester === 3) setCorrection({ trimester, discipline: body.disciplina_id });
      }
      setNotice("Operação guardada. A verificar a rematrícula neste atendimento…");
      setReview(false); setReason(""); setDocument(""); setClassification(""); retry.current = null;
      if (body.acao === "validar_exame") setResultId("");
      setBaseline({ ...formData, reason: "", document: "", classification: "", resultId: body.acao === "validar_exame" ? "" : resultId });
      await load();
      await recheck();
    } catch (e) { if (alive.current) setError((e as Error).message); }
    finally { if (alive.current) setSaving(false); }
  }
  const editable = ctx?.can_manage && ctx.ano_ativo && ctx.source.status === "ativo" && ctx.source.ativo;
  const valid = reason.trim().length >= 15 && (action === "abrir_exame" ? start && end && start <= end
    : action === "registar_eja" ? discipline && classification && document.trim().length >= 5
    : action === "validar_exame" ? resultId : action === "reabrir_periodo" ? discipline && period : period);
  const inputClass = "w-full rounded-xl border border-border bg-background px-3 py-2 text-sm text-foreground";
  return <section aria-label="Operações académicas excecionais" className="mb-4 rounded-xl border border-border bg-card p-4">
    <button type="button" disabled={saving} aria-expanded={open} onClick={() => { setReview(false); setOpen(!open); }}
      className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-border px-3 py-2 text-sm font-semibold text-foreground">
      <ShieldCheck className="h-4 w-4" aria-hidden="true" /> Resolver operação académica aqui
    </button>
    {open && <div className="mt-4 space-y-3">
      {loading && <p role="status" className="flex items-center gap-2 text-sm"><Loader2 className="h-4 w-4 animate-spin" /> A confirmar permissões e contexto…</p>}
      {error && <div><p role="alert" className="text-sm text-destructive">{error}</p>{ctx && <button type="button" disabled={saving || loading} onClick={() => { setReview(false); setError(""); void load(); }} className="mt-2 rounded-xl border border-border px-3 py-2 text-sm">Atualizar contexto e rever dados</button>}</div>}
      {!ctx && !loading && <button type="button" onClick={() => { setError(""); void load(); }} className={inputClass}>Tentar consultar novamente</button>}
      {notice && <p role="status" className="text-sm text-foreground">{notice}</p>}
      {documentUrl && <a href={documentUrl} target="_blank" rel="noopener noreferrer" className="inline-flex rounded-xl border border-border px-3 py-2 text-sm font-semibold">Abrir pauta publicada</a>}
      {correction && <button type="button" onClick={() => onLancarNota(correction.trimester, correction.discipline)} className={inputClass}>Corrigir notas agora</button>}
      {recheckPending && <button type="button" onClick={() => void recheck()} className={inputClass}>Verificar rematrícula sem repetir a operação</button>}
      {ctx && !ctx.can_manage && <p className="text-sm text-muted-foreground">A confirmação exige um perfil de direção ou administração académica.</p>}
      {ctx?.can_manage && !editable && <p className="text-sm text-muted-foreground">O fecho legal da matrícula ou do ano exige um processo de reabertura próprio. A autorização de período preserva esse fecho.</p>}
      {editable && !review && <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); if (valid) setReview(true); }}>
        <label className="block space-y-1 text-xs font-semibold">Operação
          <select className={inputClass} value={action} disabled={saving} onChange={(e) => { setAction(e.target.value as Action); setError(""); }}>
            {Object.entries(labels).filter(([value]) => value !== "registar_eja" || ctx.regime.escala === "qualitativa")
              .map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
        </label>
        {(action === "reabrir_periodo" || action === "registar_eja") && <label className="block space-y-1 text-xs font-semibold">Disciplina de origem
          <select required className={inputClass} value={discipline} onChange={(e) => setDiscipline(e.target.value)}><option value="">Selecionar</option>{ctx.disciplinas.map((d) => <option key={d.id} value={d.id}>{d.nome}</option>)}</select>
        </label>}
        {(action === "reabrir_periodo" || action === "publicar_pauta") && <label className="block space-y-1 text-xs font-semibold">Período de origem
          <select required className={inputClass} value={period} onChange={(e) => setPeriod(e.target.value)}><option value="">Selecionar</option>{ctx.periodos.map((p) => <option key={p.id} value={p.id}>{p.numero}.º trimestre · {p.data_inicio} a {p.data_fim}</option>)}</select>
        </label>}
        {action === "reabrir_periodo" && <p className="text-sm text-muted-foreground">Autoriza este utilizador a corrigir esta disciplina e trimestre durante 24 horas. Não muda as datas do calendário nem autoriza trimestres futuros.</p>}
        {action === "registar_eja" && <>
          {previous && <p className="text-sm text-muted-foreground">Avaliação atual: {previous.suficiente ? "Suficiente" : "Não suficiente"}. A retificação preserva o registo anterior.</p>}
          <label className="block space-y-1 text-xs font-semibold">Avaliação oficial<select required className={inputClass} value={classification} onChange={(e) => setClassification(e.target.value)}><option value="">Selecionar</option><option value="suficiente">Suficiente</option><option value="nao_suficiente">Não suficiente</option></select></label>
          <label className="block space-y-1 text-xs font-semibold">Referência do documento ou ata oficial<input required minLength={5} maxLength={1000} className={inputClass} value={document} onChange={(e) => setDocument(e.target.value)} /></label>
          <p className="text-sm text-muted-foreground">A frequência anual vem dos registos oficiais. Esta avaliação não cria presenças nem transforma notas numéricas.</p>
        </>}
        {action === "validar_exame" && <label className="block space-y-1 text-xs font-semibold">Resultado submetido
          <select required className={inputClass} value={resultId} onChange={(e) => setResultId(e.target.value)}><option value="">Selecionar</option>{ctx.resultados.map((r) => <option key={r.id} value={r.id}>Nota {r.nota} · registo {r.id.slice(0, 8)}</option>)}</select>
        </label>}
        {action === "abrir_exame" && <>
          <label className="block space-y-1 text-xs font-semibold">Tipo<select className={inputClass} value={examType} onChange={(e) => setExamType(e.target.value as typeof examType)}><option value="recurso">Recurso</option><option value="extraordinario">Extraordinário</option></select></label>
          <label className="block space-y-1 text-xs font-semibold">Componentes<select className={inputClass} value={mode} onChange={(e) => setMode(e.target.value as typeof mode)}><option value="simples">Escrita</option><option value="escrita_oral">Escrita e oral (pesos iguais)</option><option value="oral_pratica">Oral e prática (pesos iguais)</option></select></label>
          <div className="grid gap-3 sm:grid-cols-2"><label className="space-y-1 text-xs font-semibold">Início<input required type="date" className={inputClass} value={start} onChange={(e) => setStart(e.target.value)} /></label><label className="space-y-1 text-xs font-semibold">Fim<input required type="date" className={inputClass} value={end} onChange={(e) => setEnd(e.target.value)} /></label></div>
        </>}
        {action === "publicar_pauta" && <label className="block space-y-1 text-xs font-semibold">Tipo de pauta<select className={inputClass} value={pautaType} onChange={(e) => setPautaType(e.target.value as typeof pautaType)}><option value="anual">Anual</option>{ctx.regime.escala !== "qualitativa" && <option value="trimestral">Trimestral</option>}</select></label>}
        <label className="block space-y-1 text-xs font-semibold">Fundamentação<textarea required minLength={15} maxLength={1000} rows={3} className={inputClass} value={reason} onChange={(e) => setReason(e.target.value)} /></label>
        <button type="submit" disabled={!valid || saving} className="min-h-10 rounded-xl bg-amber px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">Rever e confirmar</button>
      </form>}
      {editable && review && <div className="space-y-3 rounded-xl border border-amber/40 bg-amber/10 p-3">
        <h4 className="text-sm font-semibold">Confirmar: {labels[action]}</h4>
        <dl className="space-y-1 text-sm">
          {(action === "reabrir_periodo" || action === "registar_eja") && <div><dt className="font-semibold">Disciplina</dt><dd>{ctx.disciplinas.find((d) => d.id === discipline)?.nome}</dd></div>}
          {(action === "reabrir_periodo" || action === "publicar_pauta") && <div><dt className="font-semibold">Período</dt><dd>{ctx.periodos.find((p) => p.id === period)?.numero}.º trimestre{action === "publicar_pauta" ? ` · pauta ${pautaType}` : ""}</dd></div>}
          {action === "registar_eja" && <div><dt className="font-semibold">Avaliação e fonte</dt><dd>{classification === "suficiente" ? "Suficiente" : "Não suficiente"} · {document}</dd></div>}
          {action === "abrir_exame" && <div><dt className="font-semibold">Sessão</dt><dd>{examType} · {mode} · {start} a {end}</dd></div>}
          {action === "validar_exame" && <div><dt className="font-semibold">Resultado</dt><dd>Nota {ctx.resultados.find((r) => r.id === resultId)?.nota} · registo {resultId.slice(0, 8)}</dd></div>}
          <div><dt className="font-semibold">Fundamentação</dt><dd>{reason}</dd></div>
        </dl>
        <p className="text-sm">{action === "abrir_exame" || action === "publicar_pauta" ? "Esta operação abrange toda a turma de origem. Uma republicação preserva o PDF anterior na auditoria." : action === "reabrir_periodo" ? "A exceção abrange a disciplina e o trimestre da turma, por 24 horas, para o utilizador atual." : "A operação aplica-se à matrícula de origem selecionada."}</p>
        <p className="text-xs text-muted-foreground">Depois de guardar, a situação será verificada automaticamente. Um pagamento existente é preservado.</p>
        <div className="flex flex-wrap gap-2"><button type="button" disabled={saving} onClick={() => setReview(false)} className="rounded-xl border border-border px-4 py-2 text-sm">Voltar e corrigir</button><button type="button" disabled={saving || loading} onClick={() => void save()} className="inline-flex items-center gap-2 rounded-xl bg-amber px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">{saving && <Loader2 className="h-4 w-4 animate-spin" />}{saving ? "A guardar…" : "Confirmar e guardar"}</button></div>
      </div>}
    </div>}
  </section>;
}
