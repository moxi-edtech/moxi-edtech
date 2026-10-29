"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import { AlertTriangle, CheckCircle2, FileCheck2, LockKeyhole, RefreshCw } from "lucide-react";

type Resultado = "aprovado" | "reprovado" | "concluido";
type Item = {
  matricula_id: string;
  aluno_id: string;
  aluno_nome: string;
  numero_processo: string | null;
  turma_nome: string | null;
  resultado_registado: Resultado | null;
  status_origem?: string | null;
  snapshot_status: string | null;
  ratificado: boolean;
  coorte_autorizada: boolean;
  coorte?: string | null;
  possui_notas?: boolean;
  destino_ativo?: boolean;
  destino_vinculado?: boolean;
  destino_ano?: number | null;
  proximo_passo: string;
};
type Tipo = "pendentes" | "historicos";
type Queue = {
  ok: boolean;
  tipo: Tipo;
  ano: number;
  pagina: number;
  total: number;
  permite_escrita: boolean;
  items: Item[];
  error?: string;
};

const resultadoLabel: Record<Resultado, string> = {
  aprovado: "Aprovado",
  reprovado: "Reprovado",
  concluido: "Concluído",
};

export default function ReconciliacaoAcademicaHistoricaPage() {
  const params = useParams<{ id?: string }>();
  const searchParams = useSearchParams();
  const escolaId = String(params?.id ?? "");
  const [ano, setAno] = useState(() => {
    const query = Number(searchParams?.get("ano"));
    return Number.isInteger(query) && query >= 2000 ? query : new Date().getFullYear() - 1;
  });
  const [tipo, setTipo] = useState<Tipo>(() => searchParams?.get("tipo") === "historicos" ? "historicos" : "pendentes");
  const [pagina, setPagina] = useState(1);
  const [reload, setReload] = useState(0);
  const [data, setData] = useState<Queue | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [resultado, setResultado] = useState<Resultado>("aprovado");
  const [referencia, setReferencia] = useState("");
  const [motivo, setMotivo] = useState("");
  const [confirmarFecho, setConfirmarFecho] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(async () => {
    if (!escolaId) return;
    setLoading(true);
    setError(null);
    try {
      const query = new URLSearchParams({ tipo, ano: String(ano), pagina: String(pagina) });
      const response = await fetch(`/api/secretaria/operacoes-academicas/reconciliacao-historica?${query.toString()}`, {
        cache: "no-store",
      });
      const result = await response.json() as Queue;
      if (!response.ok || !result.ok) throw new Error(result.error ?? "Não foi possível consultar as decisões.");
      setData(result);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Não foi possível carregar a reconciliação.");
    } finally {
      setLoading(false);
    }
  }, [escolaId, tipo, ano, pagina]);

  useEffect(() => { void load(); }, [load, reload]);

  const selected = useMemo(() => data?.items.find((item) => item.matricula_id === selectedId) ?? null, [data, selectedId]);
  const pending = tipo === "pendentes";
  const mayWrite = data?.permite_escrita === true;

  function selectItem(item: Item) {
    setSelectedId(item.matricula_id);
    setResultado(item.resultado_registado ?? "aprovado");
    setReferencia("");
    setMotivo("");
    setConfirmarFecho(false);
    setNotice(null);
    setError(null);
  }

  function changeTipo(next: Tipo) {
    setTipo(next);
    setPagina(1);
    setSelectedId(null);
    setError(null);
    setNotice(null);
  }

  async function submit(acao: "registar_decisao" | "ratificar" | "fechar_historico") {
    if (!selected || submitting) return;
    setSubmitting(true);
    setError(null);
    setNotice(null);
    const body = acao === "fechar_historico"
      ? {
          acao, matricula_id: selected.matricula_id, motivo,
          confirmacao: confirmarFecho ? "CONFIRMO_FECHO_LEGAL" : "",
        }
      : {
          acao, matricula_id: selected.matricula_id,
          resultado_confirmado: pending ? resultado : selected.resultado_registado,
          referencia_documental: referencia, motivo,
        };
    try {
      const response = await fetch("/api/secretaria/operacoes-academicas/reconciliacao-historica", {
        method: "POST", cache: "no-store",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const output = await response.json();
      if (!response.ok || !output.ok) throw new Error(output.error ?? "A decisão não foi registada.");
      setNotice(output.mensagem ?? "Operação registada com sucesso.");
      setReferencia("");
      setMotivo("");
      setConfirmarFecho(false);
      setSelectedId(null);
      if (acao === "registar_decisao") { setTipo("historicos"); setPagina(1); }
      setReload((value) => value + 1);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "A operação falhou; nada foi confirmado.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="space-y-6 bg-background p-4 text-foreground sm:p-6">
      <div className="space-y-2">
        <Link href={`/escola/${encodeURIComponent(escolaId)}/secretaria/operacoes-academicas`} className="text-sm font-medium text-emerald hover:underline">
          Voltar às Operações Académicas
        </Link>
        <h1 className="text-2xl font-bold">Reconciliação académica histórica</h1>
        <p className="max-w-3xl text-sm text-muted-foreground">
          Registe apenas resultados comprovados por decisões da escola. A matrícula no ano seguinte não prova aprovação.
          O histórico permanece aberto até à ratificação e ao fechamento oficial, sem criação de notas fictícias.
        </p>
      </div>

      <div className="rounded-xl border border-border bg-card p-4">
        <div className="flex flex-wrap items-end gap-3">
          <label className="space-y-1 text-sm font-medium">
            Ano de origem
            <input type="number" min={2000} max={2100} value={ano}
              onChange={(event) => { setAno(Number(event.target.value)); setPagina(1); setSelectedId(null); }}
              className="block w-28 rounded-lg border border-border bg-background p-2 text-sm" />
          </label>
          <div className="flex rounded-lg border border-border bg-background p-1">
            {([["pendentes", "Decisões pendentes"], ["historicos", "Históricos por fechar"]] as const).map(([key, label]) => (
              <button key={key} type="button" onClick={() => changeTipo(key)}
                aria-pressed={tipo === key}
                className={`rounded-md px-3 py-2 text-sm font-semibold ${tipo === key ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}>
                {label}
              </button>
            ))}
          </div>
          <button type="button" disabled={loading} onClick={() => setReload((value) => value + 1)}
            className="inline-flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm font-medium disabled:opacity-50">
            <RefreshCw className="h-4 w-4" /> Actualizar
          </button>
        </div>
        <p className="mt-3 text-sm text-muted-foreground">
          {loading ? "A consultar dados escolares…" : `${data?.total ?? 0} registos encontrados`}.
          {tipo === "historicos" ? " Resultados registados, mas ainda não oficialmente congelados." : " Nenhuma situação será alterada automaticamente."}
        </p>
      </div>

      {notice && <div role="status" className="flex gap-2 rounded-xl border border-emerald-300 bg-emerald-50 p-4 text-sm text-emerald-900"><CheckCircle2 className="h-5 w-5 shrink-0" /> {notice}</div>}
      {error && <div role="alert" className="flex gap-2 rounded-xl border border-rose-300 bg-rose-50 p-4 text-sm text-rose-900"><AlertTriangle className="h-5 w-5 shrink-0" /> {error}</div>}

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(320px,0.75fr)]">
        <section aria-label="Registos para reconciliação" className="overflow-hidden rounded-xl border border-border bg-card">
          {loading && <p className="p-8 text-sm text-muted-foreground">A carregar registos…</p>}
          {!loading && !error && !data?.items.length && (
            <p className="p-8 text-sm text-muted-foreground">Não há registos nesta página. Experimente outro ano ou categoria.</p>
          )}
          {!loading && data?.items.map((item) => (
            <button key={item.matricula_id} type="button" onClick={() => selectItem(item)}
              aria-pressed={item.matricula_id === selectedId}
              className={`w-full border-b border-border p-4 text-left transition-colors last:border-b-0 hover:bg-muted/30 ${item.matricula_id === selectedId ? "bg-muted/40" : ""}`}>
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <div className="font-semibold">{item.aluno_nome}</div>
                  <div className="mt-0.5 text-xs text-muted-foreground">
                    Proc. {item.numero_processo ?? "—"} · {item.turma_nome ?? "Histórico anual"}
                  </div>
                </div>
                <span className="rounded-full border border-border px-2 py-1 text-xs">
                  {pending ? (item.coorte_autorizada ? "Revisão da escola" : "Sem coorte autorizada")
                    : (item.ratificado ? "Ratificado" : "Ratificação pendente")}
                </span>
              </div>
              <p className="mt-2 text-xs text-muted-foreground">
                {item.resultado_registado
                  ? `Resultado registado: ${resultadoLabel[item.resultado_registado] ?? item.resultado_registado}. `
                  : (item.destino_ativo ? `Destino de ${item.destino_ano ?? "outro ano"} ativo; resultado não confirmado. ` : "")}
                {item.proximo_passo}
              </p>
            </button>
          ))}
          <div className="flex items-center justify-between border-t border-border p-3 text-sm">
            <button type="button" disabled={pagina <= 1 || loading} onClick={() => { setPagina((p) => p - 1); setSelectedId(null); }}
              className="rounded-lg border border-border px-3 py-2 disabled:opacity-40">Anterior</button>
            <span className="text-muted-foreground">Página {pagina}</span>
            <button type="button" disabled={loading || pagina * 30 >= (data?.total ?? 0)} onClick={() => { setPagina((p) => p + 1); setSelectedId(null); }}
              className="rounded-lg border border-border px-3 py-2 disabled:opacity-40">Seguinte</button>
          </div>
        </section>

        <section aria-label="Decisão e documentação" className="self-start rounded-xl border border-border bg-card p-5">
          {!selected ? (
            <div className="space-y-2 text-sm text-muted-foreground">
              <FileCheck2 className="h-7 w-7" />
              <p className="font-medium text-foreground">Seleccione um registo para tratar.</p>
              <p>As decisões permanecem pendentes enquanto não forem verificadas e documentadas pela escola.</p>
            </div>
          ) : (
            <div className="space-y-4">
              <div>
                <h2 className="text-lg font-bold">{selected.aluno_nome}</h2>
                <p className="mt-1 text-xs text-muted-foreground">{selected.proximo_passo}</p>
              </div>
              {pending && !selected.coorte_autorizada && (
                <div role="alert" className="rounded-lg border border-amber-300 p-3 text-sm text-amber-700">
                  Esta origem não possui coorte assistida válida. Deve ser tratada pelo RAA ou pela secretaria académica.
                </div>
              )}
              {pending ? (
                <label className="block space-y-1 text-sm font-medium">
                  Resultado académico confirmado pela escola
                  <select value={resultado} onChange={(event) => setResultado(event.target.value as Resultado)}
                    className="block w-full rounded-lg border border-border bg-background p-2">
                    {Object.entries(resultadoLabel).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
                  </select>
                </label>
              ) : (
                <div className="rounded-lg border border-border bg-background p-3 text-sm">
                  <span className="text-muted-foreground">Resultado já registado</span>
                  <div className="font-bold">{selected.resultado_registado ? resultadoLabel[selected.resultado_registado] : "Não identificado"}</div>
                  <p className="mt-1 text-xs text-muted-foreground">Não é possível substituir o resultado por esta operação. Divergências exigem retificação auditada.</p>
                </div>
              )}
              {(pending || !selected.ratificado) && (
                <label className="block space-y-1 text-sm font-medium">
                  Referência do documento da escola
                  <input value={referencia} maxLength={180} onChange={(event) => setReferencia(event.target.value)}
                    placeholder="Ex.: Ata da direção, lista confirmada, pauta assinada" className="block w-full rounded-lg border border-border bg-background p-2" />
                </label>
              )}
              <label className="block space-y-1 text-sm font-medium">
                {pending || !selected.ratificado ? "Motivo documentado" : "Motivo do fechamento legal"}
                <textarea value={motivo} maxLength={500} rows={3} onChange={(event) => setMotivo(event.target.value)}
                  placeholder="Descreva a verificação efetuada pela escola."
                  className="block w-full resize-y rounded-lg border border-border bg-background p-2" />
              </label>
              {!pending && selected.ratificado && (
                <label className="flex items-start gap-2 text-sm">
                  <input type="checkbox" className="mt-1" checked={confirmarFecho} onChange={(event) => setConfirmarFecho(event.target.checked)} />
                  <span>Confirmei o documento e as pautas aplicáveis. Compreendo que o histórico será congelado legalmente e só poderá ser reaberto por procedimento auditado.</span>
                </label>
              )}
              {!mayWrite ? (
                <p className="text-sm text-muted-foreground">Consulta disponível. Apenas a direção autorizada pode registar, ratificar ou fechar decisões históricas.</p>
              ) : (
                <button type="button" disabled={submitting || motivo.trim().length < 12
                  || ((pending || !selected.ratificado) && referencia.trim().length < 8)
                  || (pending && !selected.coorte_autorizada)
                  || (!pending && selected.ratificado && !confirmarFecho)}
                  onClick={() => void submit(pending ? "registar_decisao" : selected.ratificado ? "fechar_historico" : "ratificar")}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-emerald-700 px-4 py-3 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50">
                  {!pending && selected.ratificado ? <LockKeyhole className="h-4 w-4" /> : <FileCheck2 className="h-4 w-4" />}
                  {submitting ? "A registar…" : pending ? "Registar decisão documentada" : selected.ratificado ? "Fechar histórico oficialmente" : "Ratificar decisão escolar"}
                </button>
              )}
              <Link href={`/escola/${encodeURIComponent(escolaId)}/secretaria/alunos/${encodeURIComponent(selected.aluno_id)}`}
                className="block text-center text-sm font-medium text-emerald hover:underline">Abrir dossiê do aluno</Link>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
