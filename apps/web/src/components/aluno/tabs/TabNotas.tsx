"use client";

import { useEffect, useMemo, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { buildPortalHref, getEscolaParamFromPath } from "@/lib/navigation";
import { Lock as LockIcon, FileText, ChevronDown, Loader2, Download, ArrowRight } from "lucide-react";
import Link from "next/link";
import { AcademicCarryoversCard } from "@/components/aluno/academico/AcademicCarryoversCard";
import { BOLETIM_SERVICE_CODE } from "@/lib/aluno/boletimAccess";
import { accessPresentation, availablePeriods, chooseInitialPeriod, formatPublishedGrade, periodAssessments } from "@/lib/aluno/gradesPresentation";

type Disciplina = {
  id: string;
  nome: string;
  avaliacoes: Array<{ nome: string; tipo: string; trimestre: number; nota: number }>;
};

type BoletimResponse = {
  ok: boolean;
  is_liberado: boolean;
  nome_aluno?: string | null;
  matricula_encontrada?: boolean;
  error?: string;
  disciplinas: Disciplina[];
  context?: { anoLetivoLabel?: string | null; mode?: "CURRENT" | "HISTORICAL_READ" } | null;
};

type BoletimServico = { codigo: string; valor: number; status: string; pagamento_configurado?: boolean; reject_reason?: string | null; pedido_id?: string | null };

type MelhoriaSessao = { id: string; data_inicio: string; data_fim: string; estado: string; observacoes?: string | null };


export function TabNotas({ embedded = false, onOpenDocuments }: { embedded?: boolean; onOpenDocuments?: (serviceCode?: string | null) => void } = {}) {
  const searchParams = useSearchParams();
  const escolaSlug = getEscolaParamFromPath(usePathname());
  const studentId = useMemo(() => searchParams?.get("aluno") ?? null, [searchParams]);
  const academicYearId = searchParams?.get("ano_letivo_id") ?? null;
  const bulletinParams = new URLSearchParams();
  if (studentId) bulletinParams.set("studentId", studentId);
  if (academicYearId) bulletinParams.set("ano_letivo_id", academicYearId);
  const bulletinQuery = bulletinParams.toString() ? `?${bulletinParams.toString()}` : "";
  const [loading, setLoading] = useState(true);
  const [isLiberado, setIsLiberado] = useState(false);
  const [matriculaEncontrada, setMatriculaEncontrada] = useState(true);
  const [accessError, setAccessError] = useState<string | null>(null);
  const [boletimServico, setBoletimServico] = useState<BoletimServico | null>(null);
  const [refreshVersion, setRefreshVersion] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [downloadError, setDownloadError] = useState<string | null>(null);
  const [disciplinas, setDisciplinas] = useState<Disciplina[]>([]);
  const [selectedPeriod, setSelectedPeriod] = useState<number | null>(null);
  const [academicYear, setAcademicYear] = useState<string | null>(null);
  const [loadedScope, setLoadedScope] = useState<string | null>(null);
  const [historicalRead, setHistoricalRead] = useState(false);
  const [reapreciacaoDisc, setReapreciacaoDisc] = useState<Disciplina | null>(null);
  const [reapreciacaoMotivo, setReapreciacaoMotivo] = useState("");
  const [reapreciacaoSaving, setReapreciacaoSaving] = useState(false);
  const [reapreciacaoMessage, setReapreciacaoMessage] = useState<string | null>(null);
  const [melhoriaDisc, setMelhoriaDisc] = useState<Disciplina | null>(null);
  const [melhoriaSessoes, setMelhoriaSessoes] = useState<MelhoriaSessao[]>([]);
  const [melhoriaSessaoId, setMelhoriaSessaoId] = useState("");
  const [melhoriaMotivo, setMelhoriaMotivo] = useState("");
  const [melhoriaLoading, setMelhoriaLoading] = useState(false);
  const [melhoriaSaving, setMelhoriaSaving] = useState(false);
  const [melhoriaMessage, setMelhoriaMessage] = useState<string | null>(null);


  const solicitarReapreciacao = async () => {
    if (!reapreciacaoDisc || reapreciacaoMotivo.trim().length < 10) {
      setReapreciacaoMessage("Explique o pedido com pelo menos 10 caracteres.");
      return;
    }
    setReapreciacaoSaving(true);
    setReapreciacaoMessage(null);
    try {
      const response = await fetch("/api/aluno/raa/reapreciacao", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ disciplina_id: reapreciacaoDisc.id, motivo: reapreciacaoMotivo.trim(), idempotency_key: `aluno-raa-${reapreciacaoDisc.id}` }) });
      const json = await response.json().catch(() => null);
      if (!response.ok || !json?.ok) throw new Error(json?.error || "Não foi possível enviar o pedido.");
      setReapreciacaoMessage(`Pedido ${json.item?.protocolo_publico ?? "registado"}. Prazo: ${json.item?.prazo_em ? new Date(json.item.prazo_em).toLocaleString("pt-PT") : "48 horas"}.`);
      setReapreciacaoMotivo("");
    } catch (error) {
      setReapreciacaoMessage(error instanceof Error ? error.message : "Falha ao enviar o pedido.");
    } finally {
      setReapreciacaoSaving(false);
    }
  };

  const abrirMelhoria = async (disc: Disciplina) => {
    setMelhoriaDisc(disc);
    setMelhoriaSessaoId("");
    setMelhoriaMessage(null);
    setMelhoriaLoading(true);
    try {
      const response = await fetch("/api/aluno/raa/melhoria", { cache: "no-store" });
      const json = await response.json().catch(() => null);
      if (!response.ok || !json?.ok) throw new Error(json?.error || "Não foi possível carregar as sessões.");
      const sessoes = Array.isArray(json.sessoes) ? json.sessoes as MelhoriaSessao[] : [];
      setMelhoriaSessoes(sessoes);
      if (sessoes[0]?.id) setMelhoriaSessaoId(sessoes[0].id);
      if (sessoes.length === 0) setMelhoriaMessage("Não há sessões de recurso abertas para esta turma neste momento.");
    } catch (error) {
      setMelhoriaMessage(error instanceof Error ? error.message : "Falha ao carregar sessões.");
    } finally {
      setMelhoriaLoading(false);
    }
  };

  const solicitarMelhoria = async () => {
    if (!melhoriaDisc || !melhoriaSessaoId || melhoriaMotivo.trim().length < 10) {
      setMelhoriaMessage("Selecione uma sessão e explique o pedido com pelo menos 10 caracteres.");
      return;
    }
    setMelhoriaSaving(true);
    setMelhoriaMessage(null);
    try {
      const response = await fetch("/api/aluno/raa/melhoria", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ exame_sessao_id: melhoriaSessaoId, disciplina_id: melhoriaDisc.id, motivo: melhoriaMotivo.trim() }) });
      const json = await response.json().catch(() => null);
      if (!response.ok || !json?.ok) throw new Error(json?.error || "Não foi possível enviar o pedido.");
      setMelhoriaMessage("Pedido de melhoria registado. A secretaria fará a análise.");
      setMelhoriaMotivo("");
    } catch (error) {
      setMelhoriaMessage(error instanceof Error ? error.message : "Falha ao enviar o pedido.");
    } finally {
      setMelhoriaSaving(false);
    }
  };

  const descarregarBoletim = async () => {
    setDownloading(true);
    setDownloadError(null);
    try {
      const response = await fetch(`/api/aluno/boletim/pdf${bulletinQuery}`, { cache: "no-store" });
      if (!response.ok) {
        const json = await response.json().catch(() => null) as { error?: string } | null;
        throw new Error(json?.error || "Não foi possível gerar o boletim.");
      }
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = "boletim_de_notas.pdf";
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 3000);
    } catch (error: unknown) {
      setDownloadError(error instanceof Error ? error.message : "Falha ao descarregar o boletim.");
      setRefreshVersion((version) => version + 1);
    } finally {
      setDownloading(false);
    }
  };

  useEffect(() => {
    setLoading(true);
    setIsLiberado(false);
    setDisciplinas([]);
    setSelectedPeriod(null);
    setAcademicYear(null);
    setLoadedScope(null);
    setHistoricalRead(false);
    setReapreciacaoDisc(null);
    setMelhoriaDisc(null);
    setBoletimServico(null);
    setAccessError(null);
  }, [studentId, bulletinQuery]);

  // Pausa a aba oculta e limita consultas; após desbloqueio reduz o ritmo.
  useEffect(() => {
    let disposed = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const schedule = () => {
      if (disposed || document.hidden) return;
      timer = setTimeout(() => {
        timer = undefined;
        if (document.hidden || disposed) return;
        setRefreshVersion((current) => current + 1);
        schedule();
      }, isLiberado ? 120_000 : accessError ? 120_000 : 30_000);
    };
    const onVisible = () => {
      if (timer !== undefined) clearTimeout(timer);
      timer = undefined;
      if (!document.hidden) {
        setRefreshVersion((current) => current + 1);
        schedule();
      }
    };
    window.addEventListener("focus", onVisible);
    document.addEventListener("visibilitychange", onVisible);
    schedule();
    return () => {
      disposed = true;
      if (timer !== undefined) clearTimeout(timer);
      window.removeEventListener("focus", onVisible);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [isLiberado, studentId, accessError]);

  useEffect(() => {
    const ctrl = new AbortController();
    let active = true;
    if (refreshVersion === 0) setLoading(true);
    else setRefreshing(true);
    setAccessError(null);
    const load = async () => {
      try {
        const res = await fetch(`/api/aluno/boletim${bulletinQuery}`, { cache: "no-store", signal: ctrl.signal });
        const json = await res.json() as BoletimResponse;
        if (!res.ok || !json.ok) throw new Error(json.error || "Não foi possível consultar o boletim.");
        if (!active) return;
        setMatriculaEncontrada(json.matricula_encontrada !== false);
        setIsLiberado(json.is_liberado);
        setLoadedScope(bulletinQuery);
        setHistoricalRead(json.context?.mode === "HISTORICAL_READ");
        const published = json.is_liberado ? json.disciplinas ?? [] : [];
        setDisciplinas(published);
        setSelectedPeriod(chooseInitialPeriod(published));
        const label = json.context?.anoLetivoLabel?.trim() || null;
        setAcademicYear(label);
        if (!json.is_liberado && json.matricula_encontrada !== false) {
          const catalogResponse = await fetch(`/api/aluno/documentos/catalogo${bulletinQuery}`, { cache: "no-store", signal: ctrl.signal });
          const catalog = await catalogResponse.json() as { ok?: boolean; error?: string; documentos?: BoletimServico[] };
          if (!catalogResponse.ok || !catalog.ok) throw new Error(catalog.error || "Não foi possível consultar a taxa do boletim.");
          if (!active) return;
          const servicos = catalog.documentos ?? [];
          // Um único serviço pode iniciar um novo pagamento. A declaração de notas
          // antiga só é aceite como pagamento já concluído (na API), nunca cobrada de novo.
          const servico = servicos.find((item) => item.codigo === BOLETIM_SERVICE_CODE);
          setBoletimServico(servico ?? null);
        }
      } catch (error: unknown) {
        if (active && !(error instanceof DOMException && error.name === "AbortError")) {
          setAccessError(error instanceof Error ? error.message : "Não foi possível carregar o boletim.");
          setIsLiberado(false);
          setLoadedScope(null);
          setHistoricalRead(false);
          setDisciplinas([]);
          setSelectedPeriod(null);
        }
      } finally {
        if (active) {
          setLoading(false);
          setRefreshing(false);
        }
      }
    };
    void load();
    return () => { active = false; ctrl.abort(); };
  }, [studentId, bulletinQuery, refreshVersion]);

  // Fail closed synchronously on student/year change, before effects clear prior state.
  const safeIsLiberado = loadedScope === bulletinQuery && isLiberado;
  const safeDisciplinas = safeIsLiberado ? disciplinas : [];
  const visibleLoading = loading || (loadedScope !== bulletinQuery && !accessError);
  const periods = availablePeriods(safeDisciplinas);
  const period = selectedPeriod !== null && periods.includes(selectedPeriod) ? selectedPeriod : chooseInitialPeriod(safeDisciplinas);
  const moneyStatus = boletimServico?.status === "pending_payment" ? "available" : boletimServico?.status === "pending" || boletimServico?.status === "rejected" || boletimServico?.status === "granted" ? boletimServico.status : "available";
  // Não anunciar um pagamento impossível: a escola pode ter o serviço ativo,
  // mas ainda sem uma taxa positiva configurada para boletins.
  const paymentConfigured = boletimServico?.pagamento_configurado !== false && Number(boletimServico?.valor) > 0;
  const serviceUnconfigured = moneyStatus === "available" && !paymentConfigured;
  const access = serviceUnconfigured
    ? {
        title: "Boletim ainda indisponível",
        message: "A escola ainda não definiu a taxa deste serviço.",
        action: "Ver documentos",
      }
    : accessPresentation(moneyStatus, boletimServico?.reject_reason);
  const docsParams = new URLSearchParams();
  if (!serviceUnconfigured) docsParams.set("servico", BOLETIM_SERVICE_CODE);
  if (studentId) docsParams.set("aluno", studentId);
  if (academicYearId) docsParams.set("ano_letivo_id", academicYearId);
  const docsUrl = buildPortalHref(escolaSlug, `/aluno/documentos${docsParams.size ? `?${docsParams.toString()}` : ""}`);
  const navParams = new URLSearchParams();
  if (studentId) navParams.set("aluno", studentId);
  if (academicYearId) navParams.set("ano_letivo_id", academicYearId);
  const navQuery = navParams.size ? `?${navParams.toString()}` : "";
  const focus = "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2B6044] focus-visible:ring-offset-2";
  return (
    <div className={embedded ? "mx-auto min-w-0 max-w-4xl space-y-3 pb-3 text-foreground" : "mx-auto min-w-0 max-w-4xl space-y-6 pb-6 text-foreground"} data-testid="aluno-pauta-editorial">
      {!embedded && <header className="space-y-3">
        <p className="text-sm font-medium text-[#2B6044]">KLASSE / Portal do aluno</p>
        <h1 className="text-3xl font-semibold tracking-tight text-slate-900 sm:text-4xl">As tuas notas</h1>
        <p className="text-base leading-7 text-slate-600">Acompanha as avaliações que já foram lançadas.</p>
        {academicYear !== null && <p className="text-sm text-slate-500">Ano letivo {academicYear}</p>}
        <nav aria-label="Navegação académica" className="flex flex-wrap gap-x-5 gap-y-2 border-b border-slate-200 pt-2 text-sm">
          <Link aria-current="page" href={buildPortalHref(escolaSlug, `/aluno/academico${navQuery}`)} className={`inline-flex min-h-11 items-center border-b-2 border-[#2B6044] font-semibold text-[#2B6044] ${focus}`}>Notas</Link>
          <Link href={buildPortalHref(escolaSlug, `/aluno/disciplinas${navQuery}`)} className={`inline-flex min-h-11 items-center text-slate-700 ${focus}`}>Disciplinas</Link>
          <Link href={buildPortalHref(escolaSlug, `/aluno/documentos${navQuery}`)} className={`inline-flex min-h-11 items-center text-slate-700 ${focus}`}>Documentos</Link>
        </nav>
      </header>}
      {embedded && academicYear !== null && <p className="text-xs font-medium text-muted-foreground">Ano letivo {academicYear}</p>}
      {visibleLoading ? <section aria-label="A carregar as tuas notas" className="space-y-2 motion-safe:animate-pulse">
        <div className="h-5 w-36 rounded-lg bg-muted"/><div className="h-24 rounded-xl bg-muted"/>
      </section> : accessError ? <section role="alert" className="space-y-3 rounded-2xl border border-rose-200 bg-rose-50 p-5">
        <h2 className="text-lg font-semibold">Não foi possível consultar as tuas notas</h2>
        <p className="text-sm leading-6 text-slate-700">{accessError} Não precisas de fazer outro pagamento.</p>
        <button type="button" onClick={() => setRefreshVersion(v => v+1)} className={`min-h-11 rounded-xl bg-white px-4 text-sm font-semibold text-[#2B6044] ${focus}`}>Tentar novamente</button>
      </section> : !matriculaEncontrada ? <section className="rounded-2xl bg-slate-50 p-5">
        <h2 className="font-semibold">Sem matrícula neste ano letivo</h2><p className="mt-2 text-sm leading-6 text-slate-600">Contacta a secretaria para confirmar a tua matrícula antes de solicitar o boletim.</p>
      </section> : !safeIsLiberado ? <section aria-labelledby="boletim-locked" className="rounded-xl border border-border bg-card p-4 sm:p-5">
        <div className="flex min-w-0 items-start gap-3">
          <div aria-hidden="true" className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
            <LockIcon className="h-4.5 w-4.5"/>
          </div>
          <div className="min-w-0 flex-1 space-y-2">
            <h2 id="boletim-locked" className="text-base font-semibold leading-6 text-foreground">{access.title}</h2>
            <p className="text-sm leading-5 text-muted-foreground">{access.message}</p>
            {paymentConfigured && moneyStatus === "available" && (
              <p className="text-sm font-semibold text-foreground">Taxa: {new Intl.NumberFormat("pt-AO",{style:"currency",currency:"AOA"}).format(Number(boletimServico?.valor))}</p>
            )}
            {onOpenDocuments ? (
              <button type="button" onClick={() => onOpenDocuments(serviceUnconfigured ? null : BOLETIM_SERVICE_CODE)}
                className={focus + " inline-flex min-h-10 items-center gap-1.5 text-sm font-semibold text-emerald-800 hover:underline"}>
                {access.action}<ArrowRight aria-hidden="true" className="h-4 w-4"/>
              </button>
            ) : (
              <Link href={docsUrl} className={focus + " inline-flex min-h-10 items-center gap-1.5 text-sm font-semibold text-emerald-800 hover:underline"}>
                {access.action}<ArrowRight aria-hidden="true" className="h-4 w-4"/>
              </Link>
            )}
          </div>
        </div>
      </section> : <section aria-labelledby="pauta-title" className="space-y-6">
        <div className="space-y-4">
          <h2 id="pauta-title" className="text-xl font-semibold tracking-tight text-slate-900">Avaliações por período</h2>
          {periods.length>0 ? <div role="group" aria-label="Selecionar período das avaliações" className="flex flex-wrap gap-2">
            {periods.map(p => <button type="button" key={p} onClick={() => setSelectedPeriod(p)}
              aria-pressed={period === p} className={`min-h-11 rounded-xl border px-4 text-sm font-semibold transition-colors motion-reduce:transition-none ${period === p ? "border-[#2B6044] bg-[#2B6044] text-white" : "border-slate-200 bg-white text-slate-700 hover:border-[#2B6044]"} ${focus}`}>
              {p}.º trimestre
            </button>)}
          </div> : <p className="rounded-xl bg-slate-50 p-5 text-sm leading-6 text-slate-600">Ainda não há avaliações publicadas. Os períodos aparecem quando a escola lançar as notas.</p>}
        </div>
        {periods.length > 0 && <div className="divide-y divide-slate-200 rounded-2xl border border-slate-200 bg-white px-4 sm:px-6">
          {safeDisciplinas.map(disc => {
            const published = periodAssessments(disc,period);
            return <article key={disc.id} className="space-y-4 py-6">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <h3 className="min-w-0 flex-1 break-words text-base font-semibold text-slate-900">{disc.nome}</h3>
                {!historicalRead && disc.avaliacoes.length > 0 && <details className="group relative">
                  <summary className={`flex min-h-11 cursor-pointer list-none items-center gap-2 rounded-xl border border-slate-200 px-3 text-sm font-medium text-slate-700 ${focus}`}>
                    Opções <ChevronDown aria-hidden className="h-4 w-4"/>
                  </summary>
                  <div className="absolute right-0 z-20 mt-1 w-52 max-w-[80vw] rounded-xl border border-slate-200 bg-white p-2 shadow-lg">
                    <button type="button" onClick={() => { setReapreciacaoDisc(disc); setReapreciacaoMessage(null); }} className={`block min-h-11 w-full rounded-lg px-3 text-left text-sm hover:bg-slate-50 ${focus}`}>Pedir reapreciação</button>
                    <button type="button" onClick={() => void abrirMelhoria(disc)} className={`block min-h-11 w-full rounded-lg px-3 text-left text-sm hover:bg-slate-50 ${focus}`}>Solicitar melhoria</button>
                  </div>
                </details>}
              </div>
              {published.length ? <ul className="space-y-3">{published.map((avaliacao,index)=><li key={`${disc.id}-${avaliacao.nome}-${index}`} className="flex min-w-0 items-baseline justify-between gap-5 text-sm">
                <span className="min-w-0 break-words leading-6 text-slate-600">{avaliacao.nome}</span>
                <span className="shrink-0 font-semibold tabular-nums text-slate-900" aria-label={`Nota ${formatPublishedGrade(avaliacao.nota)}`}>{formatPublishedGrade(avaliacao.nota)}</span>
              </li>)}</ul> : <p className="text-sm leading-6 text-slate-500">Ainda não há avaliações lançadas de {disc.nome} neste período.</p>}
            </article>;
          })}
        </div>}
        <aside className="space-y-3 border-t border-slate-200 pt-6">
          <div className="flex items-center gap-3"><FileText aria-hidden className="h-5 w-5 text-[#2B6044]"/><h2 className="text-lg font-semibold text-slate-900">Precisas do boletim em PDF?</h2></div>
          <p className="text-sm leading-6 text-slate-600">Descarrega o boletim com as avaliações já publicadas.</p>
          {downloadError && <p role="alert" className="text-sm text-rose-800">{downloadError}</p>}
          <button type="button" onClick={() => void descarregarBoletim()} disabled={downloading} className={`inline-flex min-h-11 items-center gap-2 rounded-xl border border-[#2B6044] px-5 text-sm font-semibold text-[#2B6044] disabled:opacity-50 ${focus}`}>
            {downloading ? <Loader2 className="h-4 w-4 motion-safe:animate-spin"/> : <Download className="h-4 w-4"/>}{downloading ? "A preparar o PDF..." : "Descarregar boletim"}
          </button>
        </aside>
      </section>}
      {safeIsLiberado && refreshing && <p role="status" className="text-xs text-slate-500">A verificar novas avaliações…</p>}
      {safeIsLiberado && !historicalRead && <section aria-label="Situação académica" className="border-t border-slate-200 pt-6"><AcademicCarryoversCard studentId={studentId}/></section>}
      {safeIsLiberado && !historicalRead && reapreciacaoDisc && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4" role="dialog" aria-modal="true" aria-labelledby="aluno-raa-title">
          <div className="w-full max-w-lg rounded-2xl bg-white p-5 shadow-xl">
            <h2 id="aluno-raa-title" className="font-semibold text-slate-900">Solicitar reapreciação — {reapreciacaoDisc.nome}</h2>
            <p className="mt-1 text-xs text-slate-500">O pedido será vinculado ao seu ano letivo, turma e disciplina. O prazo de resposta é contado a partir do registo.</p>
            {reapreciacaoMessage && <p className="mt-3 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{reapreciacaoMessage}</p>}
            <textarea value={reapreciacaoMotivo} onChange={(event) => setReapreciacaoMotivo(event.target.value)} rows={5} className="mt-4 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" placeholder="Explique o motivo do pedido." />
            <div className="mt-4 flex justify-end gap-2"><button type="button" onClick={() => setReapreciacaoDisc(null)} className="rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-600">Fechar</button><button type="button" disabled={reapreciacaoSaving} onClick={() => void solicitarReapreciacao()} className="rounded-lg bg-emerald px-3 py-2 text-sm font-semibold text-white disabled:opacity-50">{reapreciacaoSaving ? "A enviar..." : "Enviar pedido"}</button></div>
          </div>
        </div>
      )}

      {safeIsLiberado && !historicalRead && melhoriaDisc && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4" role="dialog" aria-modal="true" aria-labelledby="aluno-melhoria-title">
          <div className="w-full max-w-lg rounded-2xl bg-white p-5 shadow-xl">
            <h2 id="aluno-melhoria-title" className="font-semibold text-slate-900">Solicitar melhoria — {melhoriaDisc.nome}</h2>
            <p className="mt-1 text-xs text-slate-500">A melhoria usa uma sessão oficial de recurso e preserva a maior nota entre a anterior e a obtida.</p>
            {melhoriaMessage && <p className="mt-3 rounded-lg bg-slate-100 px-3 py-2 text-sm text-slate-700">{melhoriaMessage}</p>}
            {melhoriaLoading ? <p className="mt-4 text-sm text-slate-500">A carregar sessões...</p> : melhoriaSessoes.length > 0 && <><label className="mt-4 block text-sm font-medium text-slate-700">Sessão de recurso</label><select value={melhoriaSessaoId} onChange={(event) => setMelhoriaSessaoId(event.target.value)} className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm">{melhoriaSessoes.map((sessao) => <option key={sessao.id} value={sessao.id}>{new Date(sessao.data_inicio).toLocaleDateString("pt-PT")} — {new Date(sessao.data_fim).toLocaleDateString("pt-PT")} ({sessao.estado})</option>)}</select><textarea value={melhoriaMotivo} onChange={(event) => setMelhoriaMotivo(event.target.value)} rows={4} className="mt-4 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" placeholder="Explique o motivo do pedido." /></>}
            <div className="mt-4 flex justify-end gap-2"><button type="button" onClick={() => setMelhoriaDisc(null)} className="rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-600">Fechar</button><button type="button" disabled={melhoriaSaving || melhoriaLoading || melhoriaSessoes.length === 0} onClick={() => void solicitarMelhoria()} className="rounded-lg bg-emerald px-3 py-2 text-sm font-semibold text-white disabled:opacity-50">{melhoriaSaving ? "A enviar..." : "Enviar pedido"}</button></div>
          </div>
        </div>
      )}
    </div>
  );
}
