"use client";
import { PortalPullToRefresh } from "@/components/portal/ui/PortalPullToRefresh";


import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { usePortalDrawerGuard, usePortalDrawerNavigation } from "@/components/portal/ui/PortalDrawerNavigator";
import { PortalSheet } from "@/components/portal/ui/PortalSheet";
import { useSearchParams } from "next/navigation";
import AcaoRapidaCard from "@/components/shared/AcaoRapidaCard";
import { CalendarClock, CheckCircle2, AlertTriangle, RefreshCw } from "lucide-react";

type Petition = {
  id: string; motivo: string; status: "pending" | "approved" | "rejected";
  decision_reason: string | null; created_at: string;
};
type Absence = {
  id: string; data: string; disciplina_nome?: string | null;
  periodo_letivo_id: string | null; justificacao: Petition | null;
};
type ResponseData = {
  ok: boolean; error?: string;
  can_submit: boolean;
  resumo: { faltas: number; presencas: number; atrasos: number };
  items: Absence[];
  has_more: boolean;
  context?: { anoLetivoLabel?: string | null; mode?: string };
  taxa: null;
};
const displayDate = (date: string) => new Date(date + "T12:00:00").toLocaleDateString("pt-AO", { day: "2-digit", month: "short", year: "numeric" });
const statusLabel = (status?: Petition["status"]) => status === "approved"
  ? "Justificada" : status === "pending" ? "Em análise" : status === "rejected" ? "Justificação não aceite" : "Por justificar";

export function TabFaltas() {
  const searchParams = useSearchParams();
  const studentId = searchParams?.get("aluno") ?? null;
  const yearId = searchParams?.get("ano_letivo_id") ?? null;
  const params = new URLSearchParams();
  if (studentId) params.set("studentId", studentId);
  if (yearId) params.set("ano_letivo_id", yearId);
  const query = params.toString();
  const [data, setData] = useState<ResponseData | null>(null);
  const [scope, setScope] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [retry, setRetry] = useState(0);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [detailScope, setDetailScope] = useState<string | null>(null);
  const inFlight = useRef(false);
  const currentScope = useRef(query);
  useLayoutEffect(() => { currentScope.current = query; }, [query]);
  const [reason, setReason] = useState("");
  const [sending, setSending] = useState(false);
  const navigation = usePortalDrawerNavigation();
  usePortalDrawerGuard(detailOpen && Boolean(reason.trim()), sending);
  const closeDetail = () => {
    if (sending || (reason.trim() && !window.confirm("Descartar a justificação não enviada?"))) return;
    setDetailOpen(false); setReason("");
  };
  const [feedback, setFeedback] = useState<string | null>(null);

  const load = useCallback(async (signal: AbortSignal) => {
    const response = await fetch(`/api/aluno/faltas?${query}`, { cache: "no-store", signal });
    const json = await response.json() as ResponseData;
    if (!response.ok || !json.ok) throw new Error(json.error || "Não foi possível consultar as faltas.");
    return json;
  }, [query]);

  useEffect(() => {
    const controller = new AbortController();
    let mounted = true;
    setLoading(true); setError(null);
    void load(controller.signal).then((result) => {
      if (mounted) { setData(result); setScope(query); }
    }).catch((err: unknown) => {
      if (mounted && !controller.signal.aborted) {
        setData(null); setScope(null);
        setError(err instanceof Error ? err.message : "Não foi possível carregar as faltas.");
      }
    }).finally(() => { if (mounted) setLoading(false); });
    return () => { mounted = false; controller.abort(); };
  }, [load, query, retry]);

  // A manual refresh never discards an unfinished justification draft.
  useEffect(() => { setFeedback(null); setEditingId(null); setDetailOpen(false); setReason(""); }, [query]);

  const safeData = scope === query ? data : null;
  const selected = detailScope === query ? safeData?.items.find(item => item.id === editingId) ?? null : null;
  const canJustify = Boolean(safeData?.can_submit && selected && !loading && !error && selected.justificacao?.status !== "pending" && selected.justificacao?.status !== "approved");
  const submit = async (item: Absence) => {
    if (!canJustify || selected?.id !== item.id || inFlight.current || reason.trim().length < 15) {
      setFeedback("Explica o motivo com pelo menos 15 caracteres.");
      return;
    }
    inFlight.current = true; setSending(true); setFeedback(null);
    try {
      const response = await fetch(`/api/aluno/faltas?${query}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ frequencia_id: item.id, motivo: reason.trim() }),
      });
      const json = await response.json().catch(() => null);
      if (!response.ok || !json?.ok) throw new Error(json?.error || "Não foi possível enviar o pedido.");
      if (currentScope.current !== query) return;
      navigation?.notifyChanged();
      setFeedback(json.message || "Solicitação realizada. Aguardando análise da secretaria.");
      setLoading(true); setDetailOpen(false); setReason("");
      setRetry((current) => current + 1);
    } catch (err) {
      if (currentScope.current === query) setFeedback(err instanceof Error ? err.message : "O pedido não foi confirmado. Tenta novamente.");
    } finally { inFlight.current = false; setSending(false); }
  };

  return (
    <PortalPullToRefresh as="section" onRefresh={() => { setLoading(true); setRetry(value => value + 1); }} busy={loading} disabled={detailOpen || sending || Boolean(reason.trim())} className="space-y-6" aria-labelledby="aluno-faltas-heading" data-testid="aluno-faltas">
      <header className="space-y-1">
        <h2 id="aluno-faltas-heading" className="text-xl font-semibold text-foreground">As minhas faltas</h2>
        {safeData?.context?.anoLetivoLabel && <p className="text-xs text-muted-foreground">Ano letivo {safeData.context.anoLetivoLabel}</p>}
      </header>
      {loading && <p role="status" className="rounded-lg bg-muted p-4 text-sm text-muted-foreground">A carregar a assiduidade…</p>}
      {error && <div role="alert" className="space-y-2 rounded-xl border border-destructive/30 p-4">
        <p className="text-sm text-foreground">{error}</p>
        <button type="button" className="min-h-11 rounded-lg border border-border px-4 text-sm" onClick={() => setRetry((n) => n + 1)}>Tentar novamente</button>
      </div>}
      <PortalSheet open={detailOpen && Boolean(selected)} busy={sending} inline={Boolean(navigation)} onClose={closeDetail} title={selected?.disciplina_nome || "Detalhes da falta"} description={selected ? displayDate(selected.data) : "Assiduidade"} size="expanded">
        {selected && <div className="space-y-3">
          <p className="font-semibold">{statusLabel(selected.justificacao?.status)}</p>
          {selected.justificacao && <><p className="text-xs text-muted-foreground">Motivo apresentado</p><p className="whitespace-pre-wrap break-words text-sm">{selected.justificacao.motivo}</p>{selected.justificacao.decision_reason && <p className="break-words text-sm">Decisão: {selected.justificacao.decision_reason}</p>}</>}
          {canJustify && <><label htmlFor={`falta-motivo-${selected.id}`} className="block text-sm font-medium">Motivo da ausência</label><textarea id={`falta-motivo-${selected.id}`} rows={4} maxLength={2000} minLength={15} value={reason} disabled={sending} onChange={event => setReason(event.target.value)} className="w-full rounded-xl border border-input bg-background p-3 text-base focus-visible:ring-2 focus-visible:ring-ring" /><p className="text-xs text-muted-foreground">A escola analisará o pedido. A falta continua registada.</p><button type="button" disabled={sending || reason.trim().length < 15} onClick={() => void submit(selected)} className="min-h-11 w-full rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground disabled:opacity-50">{sending ? "A enviar…" : "Enviar justificação"}</button></>}
          {feedback && <p role="status" className="text-sm text-foreground">{feedback}</p>}
        </div>}
      </PortalSheet>
      {safeData && (
        <>
          <div className="grid gap-3 md:grid-cols-3" aria-label="Resumo de assiduidade">
            <AcaoRapidaCard dashboardCompact mobileCompact emphasizeSublabel label="Faltas" icon={<CalendarClock />} sublabel={String(safeData.resumo.faltas)} needsAttention={safeData.resumo.faltas > 0} />
            <AcaoRapidaCard dashboardCompact mobileCompact emphasizeSublabel label="Presenças" icon={<CheckCircle2 />} sublabel={String(safeData.resumo.presencas)} />
            <AcaoRapidaCard dashboardCompact mobileCompact emphasizeSublabel label="Atrasos" icon={<AlertTriangle />} sublabel={String(safeData.resumo.atrasos)} needsAttention={safeData.resumo.atrasos > 0} />
          </div>
          {!safeData.can_submit && safeData.resumo.faltas > 0 && <p role="status" className="rounded-lg border border-border bg-muted/40 p-3 text-sm text-muted-foreground">
            {safeData.context?.mode === "HISTORICAL_READ"
              ? "Este ano letivo está disponível apenas para consulta. Contacta a secretaria para pedidos históricos."
              : "A justificação deve ser enviada pelo encarregado de educação ou pelo aluno maior de idade. Contacta a secretaria se precisares de ajuda."}
          </p>}
          {feedback && <p role="status" aria-live="polite" className="rounded-lg border border-border bg-muted p-3 text-sm text-foreground">{feedback}</p>}
          {safeData.items.length === 0 ? <div className="rounded-xl border border-border bg-card p-5">
            <CheckCircle2 className="mb-2 h-5 w-5 text-primary" aria-hidden="true" />
            <p className="font-semibold">Nenhuma falta registada</p>
            <p className="mt-1 text-sm text-muted-foreground">Não existem faltas para a matrícula e o ano letivo selecionados.</p>
          </div> : <div className="space-y-2">
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-base font-semibold">Histórico de faltas</h3>
              <button type="button" onClick={() => setRetry((n) => n + 1)}
                className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-border px-3 text-xs font-semibold focus-visible:ring-2 focus-visible:ring-ring">
                <RefreshCw className="h-4 w-4" aria-hidden="true" /> Atualizar
              </button>
            </div>
            {safeData.items.map((item) => {
              const status = item.justificacao?.status;
              const active = detailOpen && detailScope === query && editingId === item.id;
              return <article key={item.id} className="space-y-2 rounded-xl border border-border bg-card p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="flex items-start gap-2">
                    <CalendarClock className="mt-1 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                    <div>
                      {item.disciplina_nome && <p className="text-sm font-semibold text-foreground">{item.disciplina_nome}</p>}
                      <p className="font-semibold text-foreground">{displayDate(item.data)}</p>
                      <p className="text-xs text-muted-foreground">Falta registada pela escola</p>
                    </div>
                  </div>
                  <span className="rounded-full border border-border bg-muted px-2.5 py-1 text-xs font-medium text-foreground">{statusLabel(status)}</span>
                </div>
                {status === "pending" && <p role="status" className="text-sm text-muted-foreground">
                  Solicitação realizada. Aguardando análise da secretaria.
                </p>}
                {status === "approved" && <p className="text-sm text-muted-foreground">A justificação foi aceite. A falta continua registada no histórico.</p>}
                {status === "rejected" && <div className="flex items-start gap-2 text-sm text-foreground">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                  <p>A justificação não foi aceite.{item.justificacao?.decision_reason ? ` Motivo: ${item.justificacao.decision_reason}` : " Podes apresentar um novo pedido."}</p>
                </div>}
                <button type="button" aria-haspopup="dialog" aria-expanded={active} disabled={sending} className="min-h-11 rounded-xl border border-border px-4 text-sm font-semibold text-foreground hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring"
                  onClick={() => { if (detailOpen && reason.trim() && !window.confirm("Descartar a justificação não enviada?")) return; setEditingId(item.id); setDetailScope(query); setReason(""); setFeedback(null); setDetailOpen(true); }}>
                  {safeData.can_submit && status !== "pending" && status !== "approved" ? (status === "rejected" ? "Enviar nova justificação" : "Solicitar justificação") : "Ver detalhes"}
                </button>
              </article>;
            })}
            {safeData.has_more && <p className="text-xs text-muted-foreground">A mostrar as 100 faltas mais recentes. Para consultar o histórico completo, contacta a secretaria.</p>}
          </div>}
          <p className="text-xs leading-5 text-muted-foreground">
            As faltas e justificações fazem parte do registo académico. Não há pagamento automático de faltas nem alteração do registo de assiduidade pela submissão ou aprovação de um pedido.
          </p>
        </>
      )}
    </PortalPullToRefresh>
  );
}
