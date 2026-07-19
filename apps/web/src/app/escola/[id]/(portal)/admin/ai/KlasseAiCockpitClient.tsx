"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { ArrowRight, BrainCircuit, Check, CheckCircle2, Clock3, MessageSquareText, RefreshCw, Search, Sparkles, X } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/Button";

type Insight = {
  id: string;
  title: string;
  severity: "info" | "low" | "medium" | "high" | "critical";
  module: "financeiro" | "secretaria" | "academico" | "direcao";
  explanation: string;
  evidence: Array<{ label: string; value: string }>;
  recommendation: string;
  suggested_action: { label?: string; href?: string } | null;
  status: "new" | "seen" | "in_progress" | "resolved" | "ignored";
  last_detected_at: string;
};

type WhatsAppRecipient = {
  id: string;
  name: string;
  studentName?: string;
  phoneMasked: string;
};

const severityClasses: Record<Insight["severity"], string> = {
  critical: "border-red-300 bg-red-50 text-red-900",
  high: "border-amber-300 bg-amber-50 text-amber-950",
  medium: "border-sky-300 bg-sky-50 text-sky-950",
  low: "border-emerald-300 bg-emerald-50 text-emerald-950",
  info: "border-slate-300 bg-slate-50 text-slate-900",
};

const statusLabels: Record<Insight["status"], string> = {
  new: "Novo",
  seen: "Visto",
  in_progress: "Em execução",
  resolved: "Resolvido",
  ignored: "Ignorado",
};

export default function KlasseAiCockpitClient({ schoolId }: { schoolId: string }) {
  const [insights, setInsights] = useState<Insight[]>([]);
  const [pendingActions, setPendingActions] = useState(0);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [mutatingId, setMutatingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [whatsappInsight, setWhatsappInsight] = useState<Insight | null>(null);
  const [recipientSearch, setRecipientSearch] = useState("");
  const [recipientResults, setRecipientResults] = useState<WhatsAppRecipient[]>([]);
  const [selectedRecipients, setSelectedRecipients] = useState<WhatsAppRecipient[]>([]);
  const [selectionReason, setSelectionReason] = useState("");
  const [draftTitle, setDraftTitle] = useState("");
  const [draftBody, setDraftBody] = useState("");
  const [searchingRecipients, setSearchingRecipients] = useState(false);
  const [savingDraft, setSavingDraft] = useState(false);
  const [drawerError, setDrawerError] = useState<string | null>(null);
  const [draftSuccess, setDraftSuccess] = useState<string | null>(null);

  const summary = useMemo(() => ({
    newCount: insights.filter((item) => item.status === "new").length,
    activeCount: insights.filter((item) => item.status === "in_progress").length,
    resolvedCount: insights.filter((item) => item.status === "resolved").length,
  }), [insights]);

  async function loadCockpit() {
    setLoading(true);
    setError(null);
    try {
      const [insightsResponse, actionsResponse] = await Promise.all([
        fetch(`/api/admin/ai/insights?schoolId=${encodeURIComponent(schoolId)}&limit=30`, { cache: "no-store" }),
        fetch(`/api/admin/ai/actions?schoolId=${encodeURIComponent(schoolId)}&status=review_required`, { cache: "no-store" }),
      ]);
      const [insightsJson, actionsJson] = await Promise.all([
        insightsResponse.json(),
        actionsResponse.json(),
      ]);
      if (!insightsResponse.ok || !insightsJson.ok) throw new Error(insightsJson.error || "Erro ao carregar insights.");
      setInsights(insightsJson.insights ?? []);
      setPendingActions(actionsResponse.ok && actionsJson.ok ? Number(actionsJson.summary?.total ?? 0) : 0);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Erro ao carregar o cockpit.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadCockpit();
  }, [schoolId]);

  useEffect(() => {
    if (!whatsappInsight) return;
    const searchTimer = window.setTimeout(async () => {
      setSearchingRecipients(true);
      setDrawerError(null);
      try {
        const query = new URLSearchParams({ type: "aluno", q: recipientSearch.trim(), limit: "30" });
        const response = await fetch(`/api/escola/${schoolId}/admin/comunicacao/whatsapp/recipients?${query.toString()}`, { cache: "no-store" });
        const json = await response.json();
        if (!response.ok || !json.ok) throw new Error(json.error || "Erro ao pesquisar destinatários.");
        setRecipientResults(Array.isArray(json.data) ? json.data : []);
      } catch (reason) {
        setDrawerError(reason instanceof Error ? reason.message : "Erro ao pesquisar destinatários.");
      } finally {
        setSearchingRecipients(false);
      }
    }, 300);
    return () => window.clearTimeout(searchTimer);
  }, [recipientSearch, schoolId, whatsappInsight]);

  async function generateBriefing() {
    setGenerating(true);
    setError(null);
    try {
      const response = await fetch("/api/admin/ai/insights", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ schoolId }),
      });
      const json = await response.json();
      if (!response.ok || !json.ok) throw new Error(json.error || "Erro ao gerar briefing.");
      setInsights((current) => [json.insight, ...current.filter((item) => item.id !== json.insight.id)]);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Erro ao gerar briefing.");
    } finally {
      setGenerating(false);
    }
  }

  async function transition(insight: Insight, status: "seen" | "in_progress" | "resolved" | "ignored") {
    setMutatingId(insight.id);
    try {
      const response = await fetch(`/api/admin/ai/insights/${insight.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ schoolId, status }),
      });
      const json = await response.json();
      if (!response.ok || !json.ok) throw new Error(json.error || "Erro ao atualizar insight.");
      setInsights((current) => current.map((item) => item.id === insight.id ? json.insight : item));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Erro ao atualizar insight.");
    } finally {
      setMutatingId(null);
    }
  }

  function openWhatsappDrawer(insight: Insight) {
    setWhatsappInsight(insight);
    setRecipientSearch("");
    setRecipientResults([]);
    setSelectedRecipients([]);
    setSelectionReason(`${insight.title}: ${insight.recommendation}`);
    setDraftTitle(insight.title);
    setDraftBody(insight.recommendation);
    setDrawerError(null);
    setDraftSuccess(null);
  }

  function closeWhatsappDrawer() {
    if (savingDraft) return;
    setWhatsappInsight(null);
    setDrawerError(null);
    setDraftSuccess(null);
  }

  function toggleRecipient(recipient: WhatsAppRecipient) {
    setSelectedRecipients((current) => current.some((item) => item.id === recipient.id)
      ? current.filter((item) => item.id !== recipient.id)
      : current.length < 50 ? [...current, recipient] : current);
  }

  async function createWhatsappDraft() {
    if (!whatsappInsight) return;
    if (selectedRecipients.length === 0) {
      setDrawerError("Selecione pelo menos um destinatário.");
      return;
    }
    if (selectionReason.trim().length < 3 || !draftTitle.trim() || !draftBody.trim()) {
      setDrawerError("Preencha o motivo, o título e a mensagem antes de continuar.");
      return;
    }

    setSavingDraft(true);
    setDrawerError(null);
    try {
      const messageType = whatsappInsight.module === "financeiro" ? "finance_charge" : "school_notice";
      const response = await fetch(`/api/escola/${schoolId}/admin/comunicacao/whatsapp/bulk`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          aiInsightId: whatsappInsight.id,
          selectionReason: selectionReason.trim(),
          messageType,
          title: draftTitle.trim(),
          body: draftBody.trim(),
          noticeBody: messageType === "school_notice" ? draftBody.trim() : null,
          filters: { alunoIds: selectedRecipients.map((recipient) => recipient.id) },
          expectedCount: selectedRecipients.length,
        }),
      });
      const json = await response.json();
      if (!response.ok || !json.ok) throw new Error(json.error || "Erro ao criar rascunho WhatsApp.");
      setDraftSuccess(`${Number(json.created ?? selectedRecipients.length)} mensagens preparadas e aguardando aprovação.`);
      if (whatsappInsight.status !== "in_progress") await transition(whatsappInsight, "in_progress");
    } catch (reason) {
      setDrawerError(reason instanceof Error ? reason.message : "Erro ao criar rascunho WhatsApp.");
    } finally {
      setSavingDraft(false);
    }
  }

  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-6">
      <header className="flex flex-col gap-4 border-b border-slate-200 pb-6 md:flex-row md:items-end md:justify-between">
        <div>
          <div className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.18em] text-emerald-700">
            <BrainCircuit className="h-4 w-4" /> KLASSE IA · Copiloto operacional
          </div>
          <h1 className="mt-2 text-3xl font-black tracking-tight text-slate-950">O que merece atenção hoje?</h1>
          <p className="mt-2 max-w-2xl text-sm text-slate-600">Sinais reais da escola, recomendações priorizadas e ações sempre sob controlo humano.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" tone="slate" onClick={loadCockpit} disabled={loading}><RefreshCw className="h-4 w-4" /> Atualizar</Button>
          <Button onClick={generateBriefing} disabled={generating}><Sparkles className="h-4 w-4" /> {generating ? "Analisando..." : "Gerar briefing"}</Button>
        </div>
      </header>

      {error ? <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm font-semibold text-red-700">{error}</div> : null}

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {([
          ["Insights novos", summary.newCount, Sparkles],
          ["Em execução", summary.activeCount, Clock3],
          ["Resolvidos", summary.resolvedCount, CheckCircle2],
          ["Ações para aprovação", pendingActions, BrainCircuit],
        ] satisfies Array<[string, number, LucideIcon]>).map(([label, value, Icon]) => (
          <div key={String(label)} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <Icon className="h-4 w-4 text-emerald-700" />
            <p className="mt-3 text-xs font-bold uppercase tracking-wide text-slate-500">{String(label)}</p>
            <p className="mt-1 text-3xl font-black text-slate-950">{String(value)}</p>
          </div>
        ))}
      </section>

      <div className="flex items-center justify-between">
        <h2 className="text-lg font-black text-slate-950">Insights operacionais</h2>
        <Link href={`/escola/${schoolId}/admin/ai/actions`} className="flex items-center gap-1 text-sm font-bold text-emerald-700">Central de Ações <ArrowRight className="h-4 w-4" /></Link>
      </div>

      <section className="grid gap-4 lg:grid-cols-2">
        {loading ? <p className="text-sm text-slate-500">A ler os sinais da escola...</p> : null}
        {!loading && insights.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-300 bg-white p-8 text-center text-sm text-slate-600">Gere o primeiro briefing para transformar os dados atuais em prioridades.</div>
        ) : null}
        {insights.map((insight) => (
          <article key={insight.id} className={`rounded-xl border p-5 shadow-sm ${severityClasses[insight.severity]}`}>
            <div className="flex items-start justify-between gap-3">
              <div><p className="text-[10px] font-black uppercase tracking-[0.16em] opacity-70">{insight.module} · {insight.severity}</p><h3 className="mt-1 text-lg font-black">{insight.title}</h3></div>
              <span className="rounded-full border border-current/20 px-2 py-1 text-[10px] font-bold">{statusLabels[insight.status]}</span>
            </div>
            <p className="mt-4 whitespace-pre-wrap text-sm leading-6">{insight.explanation}</p>
            <div className="mt-4 grid gap-2 sm:grid-cols-3">{(insight.evidence ?? []).slice(0, 3).map((item) => <div key={item.label} className="rounded-lg bg-white/70 p-3"><p className="text-[10px] font-bold uppercase opacity-60">{item.label}</p><p className="mt-1 text-sm font-black">{item.value}</p></div>)}</div>
            <div className="mt-4 rounded-lg bg-white/70 p-3"><p className="text-[10px] font-bold uppercase opacity-60">Próximo passo recomendado</p><p className="mt-1 text-sm font-semibold">{insight.recommendation}</p></div>
            <div className="mt-4 flex flex-wrap gap-2">
              {insight.status === "new" ? <button onClick={() => transition(insight, "seen")} disabled={mutatingId === insight.id} className="rounded-md border border-current/20 bg-white px-3 py-2 text-xs font-bold">Marcar como visto</button> : null}
              {!['resolved', 'ignored'].includes(insight.status) ? <button onClick={() => transition(insight, "in_progress")} disabled={mutatingId === insight.id} className="rounded-md bg-slate-950 px-3 py-2 text-xs font-bold text-white">Iniciar ação</button> : null}
              {insight.status === "in_progress" ? <button onClick={() => transition(insight, "resolved")} disabled={mutatingId === insight.id} className="rounded-md bg-emerald-700 px-3 py-2 text-xs font-bold text-white">Resolver</button> : null}
              {!['resolved', 'ignored'].includes(insight.status) ? <button onClick={() => transition(insight, "ignored")} disabled={mutatingId === insight.id} className="px-3 py-2 text-xs font-bold opacity-70">Ignorar</button> : null}
              {!['resolved', 'ignored'].includes(insight.status) ? <button type="button" onClick={() => openWhatsappDrawer(insight)} className="rounded-md border border-emerald-300 bg-emerald-50 px-3 py-2 text-xs font-bold text-emerald-800">Preparar WhatsApp</button> : null}
              {insight.suggested_action?.href ? <Link href={insight.suggested_action.href} className="ml-auto rounded-md border border-current/20 bg-white px-3 py-2 text-xs font-bold">{insight.suggested_action.label ?? "Abrir ação"}</Link> : null}
            </div>
          </article>
        ))}
      </section>

      {whatsappInsight ? (
        <div className="fixed inset-0 z-50 flex justify-end" role="dialog" aria-modal="true" aria-labelledby="whatsapp-drawer-title">
          <button type="button" aria-label="Fechar preparação de WhatsApp" className="absolute inset-0 bg-slate-950/45 backdrop-blur-[1px]" onClick={closeWhatsappDrawer} />
          <aside className="relative flex h-full w-full max-w-xl flex-col overflow-hidden bg-white shadow-2xl">
            <header className="flex items-start justify-between gap-4 border-b border-slate-200 px-5 py-4">
              <div>
                <p className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.16em] text-emerald-700"><MessageSquareText className="h-4 w-4" /> Ação assistida · WhatsApp</p>
                <h2 id="whatsapp-drawer-title" className="mt-1 text-xl font-black text-slate-950">Preparar comunicação</h2>
                <p className="mt-1 text-xs text-slate-500">Revise tudo sem sair do cockpit. Nenhuma mensagem será enviada agora.</p>
              </div>
              <button type="button" aria-label="Fechar" onClick={closeWhatsappDrawer} disabled={savingDraft} className="rounded-lg p-2 text-slate-500 hover:bg-slate-100"><X className="h-5 w-5" /></button>
            </header>

            <div className="flex-1 space-y-5 overflow-y-auto p-5">
              <section className="rounded-xl border border-emerald-200 bg-emerald-50 p-4">
                <p className="text-[10px] font-black uppercase tracking-[0.14em] text-emerald-700">Origem · Insight IA</p>
                <h3 className="mt-1 font-black text-slate-950">{whatsappInsight.title}</h3>
                <p className="mt-2 text-sm leading-5 text-slate-700">{whatsappInsight.explanation}</p>
                <div className="mt-3 grid grid-cols-2 gap-2">{whatsappInsight.evidence.slice(0, 4).map((item) => <div key={item.label} className="rounded-lg bg-white p-2"><p className="text-[9px] font-bold uppercase text-slate-500">{item.label}</p><p className="text-xs font-black text-slate-900">{item.value}</p></div>)}</div>
              </section>

              <label className="block text-xs font-bold text-slate-700">Motivo da seleção
                <textarea value={selectionReason} onChange={(event) => setSelectionReason(event.target.value)} maxLength={500} rows={2} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-normal text-slate-900 outline-none focus:border-emerald-500" />
              </label>

              <section className="space-y-3">
                <div><p className="text-sm font-black text-slate-950">Mensagem</p><p className="text-xs text-slate-500">A IA preparou o ponto de partida. A equipa mantém a palavra final.</p></div>
                <label className="block text-xs font-bold text-slate-700">Título
                  <input value={draftTitle} onChange={(event) => setDraftTitle(event.target.value)} maxLength={160} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-normal text-slate-900 outline-none focus:border-emerald-500" />
                </label>
                <label className="block text-xs font-bold text-slate-700">Texto para revisão
                  <textarea value={draftBody} onChange={(event) => setDraftBody(event.target.value)} maxLength={1600} rows={5} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-normal text-slate-900 outline-none focus:border-emerald-500" />
                </label>
              </section>

              <section className="space-y-3">
                <div className="flex items-end justify-between"><div><p className="text-sm font-black text-slate-950">Destinatários</p><p className="text-xs text-slate-500">Mostramos o encarregado, o aluno e o contacto protegido.</p></div><span className="text-xs font-bold text-emerald-700">{selectedRecipients.length}/50 selecionados</span></div>
                <label className="relative block"><Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" /><span className="sr-only">Pesquisar aluno</span><input value={recipientSearch} onChange={(event) => setRecipientSearch(event.target.value)} placeholder="Pesquisar pelo nome do aluno" className="w-full rounded-lg border border-slate-300 py-2 pl-9 pr-3 text-sm outline-none focus:border-emerald-500" /></label>
                <div className="max-h-56 divide-y divide-slate-100 overflow-y-auto rounded-xl border border-slate-200">
                  {searchingRecipients ? <p className="p-4 text-center text-xs text-slate-500">A pesquisar contactos elegíveis...</p> : null}
                  {!searchingRecipients && recipientResults.length === 0 ? <p className="p-4 text-center text-xs text-slate-500">Nenhum contacto elegível encontrado.</p> : null}
                  {!searchingRecipients && recipientResults.map((recipient) => {
                    const selected = selectedRecipients.some((item) => item.id === recipient.id);
                    return <button type="button" key={recipient.id} onClick={() => toggleRecipient(recipient)} className="flex w-full items-center justify-between gap-3 p-3 text-left hover:bg-slate-50"><div><p className="text-sm font-bold text-slate-900">{recipient.name}</p><p className="text-xs text-slate-500">{recipient.studentName ?? "Aluno"} · {recipient.phoneMasked}</p></div><span className={`flex h-5 w-5 items-center justify-center rounded border ${selected ? "border-emerald-600 bg-emerald-600 text-white" : "border-slate-300"}`}>{selected ? <Check className="h-3.5 w-3.5" /> : null}</span></button>;
                  })}
                </div>
              </section>

              {drawerError ? <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm font-semibold text-red-700">{drawerError}</div> : null}
              {draftSuccess ? <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4"><p className="flex items-center gap-2 font-black text-emerald-900"><CheckCircle2 className="h-5 w-5" /> Rascunho criado</p><p className="mt-1 text-sm text-emerald-800">{draftSuccess}</p></div> : null}
            </div>

            <footer className="border-t border-slate-200 bg-slate-50 p-4">
              <div className="mb-3 flex items-center gap-2 text-xs font-semibold text-slate-600"><CheckCircle2 className="h-4 w-4 text-emerald-700" /> Aprovação humana obrigatória antes de qualquer envio.</div>
              <div className="flex gap-2">
                <button type="button" onClick={closeWhatsappDrawer} disabled={savingDraft} className="flex-1 rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-bold text-slate-700">{draftSuccess ? "Continuar no cockpit" : "Cancelar"}</button>
                {draftSuccess ? <Link href={`/escola/${schoolId}/admin/comunicacao/whatsapp`} className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-slate-950 px-4 py-2.5 text-sm font-bold text-white">Abrir caixa de revisão <ArrowRight className="h-4 w-4" /></Link> : <button type="button" onClick={createWhatsappDraft} disabled={savingDraft || selectedRecipients.length === 0} className="flex-1 rounded-lg bg-emerald-700 px-4 py-2.5 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-50">{savingDraft ? "A preparar..." : `Criar rascunho (${selectedRecipients.length})`}</button>}
              </div>
            </footer>
          </aside>
        </div>
      ) : null}
    </div>
  );
}
