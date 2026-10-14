"use client";

import { useEffect, useMemo, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { buildPortalHref, getEscolaParamFromPath } from "@/lib/navigation";
import { AlunoCard } from "@/components/aluno/shared/AlunoCard";
import { SectionTitle } from "@/components/aluno/shared/SectionTitle";
import { Lock as LockIcon, FileText, ChevronRight, Loader2, Download } from "lucide-react";
import Link from "next/link";
import { AcademicCarryoversCard } from "@/components/aluno/academico/AcademicCarryoversCard";
import { BOLETIM_SERVICE_CODE } from "@/lib/aluno/boletimAccess";

type Disciplina = {
  id: string;
  nome: string;
  nota_t1?: number | null;
  nota_t2?: number | null;
  nota_t3?: number | null;
  avaliacoes: Array<{ nome: string; tipo: string; trimestre: number; nota: number }>;
};

type BoletimResponse = {
  ok: boolean;
  is_liberado: boolean;
  nome_aluno?: string | null;
  matricula_encontrada?: boolean;
  error?: string;
  disciplinas: Disciplina[];
};

type BoletimServico = { codigo: string; valor: number; status: string };

type ListaDisciplina = { id: string; nome: string };
type MelhoriaSessao = { id: string; data_inicio: string; data_fim: string; estado: string; observacoes?: string | null };

function fmtNota(v?: number | null) {
  return typeof v === "number" ? v.toFixed(1) : "—";
}

export function TabNotas() {
  const searchParams = useSearchParams();
  const escolaSlug = getEscolaParamFromPath(usePathname());
  const studentId = useMemo(() => searchParams?.get("aluno") ?? null, [searchParams]);
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
  const [listaDisciplinas, setListaDisciplinas] = useState<ListaDisciplina[]>([]);
  const [loadingLista, setLoadingLista] = useState(true);
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
      const response = await fetch(`/api/aluno/boletim/pdf${studentId ? `?studentId=${encodeURIComponent(studentId)}` : ""}`, { cache: "no-store" });
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
    setBoletimServico(null);
    setAccessError(null);
  }, [studentId]);

  // Actualizar em primeiro plano: pagamento validado pela secretaria desbloqueia sem relogin.
  useEffect(() => {
    const refresh = () => {
      if (document.visibilityState === "visible") setRefreshVersion((current) => current + 1);
    };
    const interval = window.setInterval(refresh, isLiberado ? 60000 : 20000);
    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      window.clearInterval(interval);
      window.removeEventListener("focus", refresh);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, [isLiberado, studentId]);

  useEffect(() => {
    const ctrl = new AbortController();
    let active = true;
    if (refreshVersion === 0) setLoading(true);
    else setRefreshing(true);
    setAccessError(null);
    const load = async () => {
      try {
        const res = await fetch(`/api/aluno/boletim${studentId ? `?studentId=${encodeURIComponent(studentId)}` : ""}`, { cache: "no-store", signal: ctrl.signal });
        const json = await res.json() as BoletimResponse;
        if (!res.ok || !json.ok) throw new Error(json.error || "Não foi possível consultar o boletim.");
        if (!active) return;
        setMatriculaEncontrada(json.matricula_encontrada !== false);
        setIsLiberado(json.is_liberado);
        setDisciplinas(json.is_liberado ? json.disciplinas ?? [] : []);
        if (!json.is_liberado && json.matricula_encontrada !== false) {
          const catalogResponse = await fetch(`/api/aluno/documentos/catalogo${studentId ? `?studentId=${encodeURIComponent(studentId)}` : ""}`, { cache: "no-store", signal: ctrl.signal });
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
          setDisciplinas([]);
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
  }, [studentId, refreshVersion]);

  useEffect(() => {
    const ctrl = new AbortController();
    setLoadingLista(true);
    fetch("/api/aluno/disciplinas", { cache: "no-store", signal: ctrl.signal })
      .then((r) => r.json() as Promise<{ disciplinas?: ListaDisciplina[] }>)
      .then((json) => setListaDisciplinas(json.disciplinas ?? []))
      .catch((error) => {
        if (error?.name !== "AbortError") {
          setListaDisciplinas([]);
        }
      })
      .finally(() => setLoadingLista(false));
    return () => ctrl.abort();
  }, []);

  return (
    <div className="space-y-6 pb-8">
      <AcademicCarryoversCard studentId={studentId} />

      <div className="space-y-4">
        <header className="flex flex-wrap items-center justify-between gap-2 px-1">
            <SectionTitle>Meu Boletim</SectionTitle>
            <div className="flex items-center gap-2">
              {!loading && !accessError && matriculaEncontrada && !isLiberado && (
                  <span className="flex items-center gap-1.5 px-3 py-1 bg-amber-50 text-amber-700 rounded-full text-[10px] font-black uppercase tracking-tight border border-amber-100">
                      <LockIcon size={12} /> Acesso Restrito
                  </span>
              )}
            </div>
        </header>

        {loading ? (
          <div className="h-48 animate-pulse rounded-[2.5rem] bg-slate-100" />
        ) : (
          <section className="space-y-3">
            {accessError ? (
              <div role="alert" className="rounded-2xl border border-rose-200 bg-rose-50 p-5 text-sm text-rose-800">
                <p className="font-bold">Não foi possível verificar o boletim.</p>
                <p className="mt-1">{accessError} Nenhum novo pagamento é necessário até confirmar o estado com a secretaria.</p>
                <button type="button" onClick={() => setRefreshVersion((current) => current + 1)} className="mt-3 rounded-xl border border-rose-300 bg-white px-4 py-2 text-xs font-bold">Tentar novamente</button>
              </div>
            ) : !matriculaEncontrada ? (
              <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-900">
                Não foi encontrada uma matrícula neste ano letivo. Contacte a secretaria antes de solicitar o boletim.
              </div>
            ) : !isLiberado ? (
              <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5 sm:p-6">
                <div className="flex flex-wrap items-start gap-3">
                  <LockIcon size={22} className="mt-1 shrink-0 text-amber-700" />
                  <div className="min-w-0 flex-1 space-y-2">
                    <h3 className="text-base font-bold text-slate-900">Notas disponíveis após pagamento do boletim</h3>
                    <p className="text-sm text-slate-700">
                      Depois de a secretaria confirmar o pagamento, poderá consultar as notas já lançadas e descarregar o PDF actualizado.
                    </p>
                    {boletimServico?.valor && boletimServico.valor > 0 ? (
                      <p className="text-sm font-bold text-slate-900">Taxa: {new Intl.NumberFormat("pt-AO", { style: "currency", currency: "AOA", maximumFractionDigits: 0 }).format(boletimServico.valor)}</p>
                    ) : (
                      <p className="text-sm font-semibold text-amber-900">A escola ainda não configurou a taxa do boletim. Contacte a secretaria.</p>
                    )}
                    {boletimServico?.status === "pending" ? (
                      <p role="status" className="text-sm font-semibold text-blue-800">Comprovativo recebido. Aguarde a validação da secretaria. Não volte a pagar.</p>
                    ) : boletimServico?.status === "granted" ? (
                      <p role="status" className="text-sm font-semibold text-blue-800">Pagamento em reconciliação. Contacte a secretaria se o acesso não for liberado.</p>
                    ) : boletimServico?.status === "rejected" || boletimServico?.status === "canceled" ? (
                      <p role="status" className="text-sm text-rose-800">Comprovativo rejeitado. Consulte o motivo na Secretaria Digital antes de reenviar.</p>
                    ) : null}
                    {boletimServico && boletimServico.valor > 0 ? (
                      <Link href={buildPortalHref(escolaSlug, `/aluno/documentos?servico=${BOLETIM_SERVICE_CODE}${studentId ? `&aluno=${encodeURIComponent(studentId)}` : ""}`)} className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-bold text-white">
                        {boletimServico.status === "pending" || boletimServico.status === "granted" ? "Acompanhar pagamento" : boletimServico.status === "pending_payment" ? "Enviar comprovativo" : "Pagar boletim"}
                        <ChevronRight size={16} />
                      </Link>
                    ) : null}
                    <button type="button" onClick={() => setRefreshVersion((current) => current + 1)} className="ml-2 inline-flex min-h-11 items-center gap-2 text-sm font-bold text-slate-700 underline">
                      {refreshing ? "A verificar..." : "Actualizar estado"}
                    </button>
                  </div>
                </div>
              </div>
            ) : null}

            <div className="grid gap-3">
              {isLiberado && disciplinas.map((disc) => (
                <details key={disc.id} className="group rounded-[1.5rem] border border-slate-200 bg-white p-4 shadow-sm open:ring-2 open:ring-emerald/10">
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-3 text-sm font-bold text-slate-900">
                    <span className="inline-flex items-center gap-2"><FileText size={16} className="text-slate-500" />{disc.nome}</span>
                    <ChevronRight size={16} className="shrink-0 text-slate-400 transition-transform group-open:rotate-90" />
                  </summary>
                  <div className="mt-4 grid gap-3 sm:grid-cols-3">
                    {[1, 2, 3].map((trimestre) => {
                      const notas = disc.avaliacoes.filter((avaliacao) => avaliacao.trimestre === trimestre);
                      return (
                        <div key={trimestre} className="rounded-xl border border-slate-100 bg-slate-50 p-3">
                          <p className="mb-2 text-xs font-bold text-slate-600">{trimestre}º trimestre</p>
                          {notas.length ? notas.map((avaliacao, index) => (
                            <div key={`${avaliacao.nome}-${index}`} className="flex justify-between gap-3 py-1 text-xs text-slate-700">
                              <span>{avaliacao.nome}</span><span className="font-bold tabular-nums">{fmtNota(avaliacao.nota)}</span>
                            </div>
                          )) : <p className="text-xs text-slate-500">Ainda sem notas lançadas.</p>}
                        </div>
                      );
                    })}
                  </div>
                  {disc.avaliacoes.length > 0 ? (
                    <div className="mt-4 flex flex-wrap gap-3 border-t border-slate-100 pt-3">
                      <button type="button" onClick={() => { setReapreciacaoDisc(disc); setReapreciacaoMessage(null); }} className="text-xs font-semibold text-emerald-800 underline">Pedir reapreciação</button>
                      <button type="button" onClick={() => void abrirMelhoria(disc)} className="text-xs font-semibold text-slate-700 underline">Solicitar melhoria</button>
                    </div>
                  ) : null}
                </details>
              ))}

              {isLiberado && disciplinas.length === 0 && <p className="text-sm text-slate-500 text-center py-8">Ainda não há notas lançadas no boletim.</p>}
            </div>
          </section>
        )}
      </div>

      <div className="space-y-4">
        <SectionTitle>Minhas Disciplinas</SectionTitle>
        {loadingLista ? (
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="h-20 animate-pulse rounded-2xl bg-slate-100" />
            <div className="h-20 animate-pulse rounded-2xl bg-slate-100" />
          </div>
        ) : listaDisciplinas.length === 0 ? (
          <AlunoCard>
            <p className="text-sm text-slate-500">Nenhuma disciplina encontrada.</p>
          </AlunoCard>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {listaDisciplinas.map((disc) => (
              <AlunoCard key={disc.id} className="border-slate-100">
                <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-xl bg-slate-50 flex items-center justify-center text-slate-400">
                        <FileText size={20} />
                    </div>
                    <div>
                        <p className="text-sm font-bold text-slate-900">{disc.nome}</p>
                        <p className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Disciplina Activa</p>
                    </div>
                </div>
              </AlunoCard>
            ))}
          </div>
        )}
      </div>

      {isLiberado && (
        <div className="flex flex-col items-end gap-2 pt-2">
          {downloadError && <p role="alert" className="w-full rounded-xl bg-rose-50 p-3 text-sm text-rose-800">{downloadError} Pode tentar novamente.</p>}
          <button type="button" onClick={() => void descarregarBoletim()} disabled={downloading} className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-emerald-700 px-5 text-sm font-bold text-white disabled:opacity-60 sm:w-auto">
            {downloading ? <Loader2 size={16} className="animate-spin" /> : <Download size={16} />}
            {downloading ? "A preparar boletim..." : "Descarregar boletim actualizado (PDF)"}
          </button>
          <p className="text-xs text-slate-500">O PDF inclui as notas que já foram lançadas. Pode descarregar novamente quando houver novas avaliações.</p>
        </div>
      )}

      {reapreciacaoDisc && (
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

      {melhoriaDisc && (
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
