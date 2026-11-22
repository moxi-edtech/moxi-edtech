"use client";

import { useEffect, useState } from "react";
import { BookOpen, CalendarCheck, ClipboardCheck, Clock3, FileText, RefreshCw } from "lucide-react";

type Tipo = "pautas" | "horarios" | "frequencia" | "curriculo";
type Periodo = { id: string; numero: number | null; tipo: string | null };
type Pauta = { id: string; periodo_letivo_id: string; tipo: string | null; status: string | null; generated_at: string | null; tem_pdf: boolean };
type Horario = { id: string; status: string; publicado_em: string | null; created_at: string | null };
type HorarioItem = { id: string; disciplina: string; slot: { dia_semana: number; inicio: string; fim: string; ordem: number } | null };
type Frequencia = { periodo_letivo_id: string; registos: number; faltas: number; presencas: number; aulas_previstas: number; abaixo_minimo: number };
type Curriculo = { id: string; version: number; status: string; disciplinas: Array<{ id: string; nome: string; carga_horaria_semanal: number | null; ativo: boolean }> };
type ArchiveResponse = {
  ok?: boolean;
  error?: string;
  context?: { ano_letivo_id: string; turma_id: string; tipo: Tipo; periodos: Periodo[] };
  items?: Pauta[] | Frequencia[];
  versoes?: Horario[] | Curriculo[];
  versao_id?: string;
  itens?: HorarioItem[];
};

const TABS: Array<{ id: Tipo; label: string; icon: typeof FileText }> = [
  { id: "pautas", label: "Pautas", icon: FileText },
  { id: "horarios", label: "Horários", icon: Clock3 },
  { id: "frequencia", label: "Frequência", icon: CalendarCheck },
  { id: "curriculo", label: "Currículo", icon: BookOpen },
];

function dateLabel(value: string | null | undefined) {
  return value ? new Date(value).toLocaleDateString("pt-PT") : "Sem data registada";
}

const WEEKDAYS = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];
function weekday(value: number | undefined) {
  if (value === undefined) return "Dia desconhecido";
  return value >= 1 && value <= 7 ? WEEKDAYS[value % 7] : "Dia " + String(value);
}

export default function ArchiveTurmaRecordsPanel({
  academicYearId, turmaId, escolaParam,
}: {
  academicYearId: string;
  turmaId: string;
  escolaParam: string | null;
}) {
  const [type, setType] = useState<Tipo>("pautas");
  const [versionId, setVersionId] = useState("");
  const [result, setResult] = useState<ArchiveResponse | null>(null);
  const [loadedKey, setLoadedKey] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);
  const scopeKey = [academicYearId, turmaId, escolaParam ?? "", type, versionId].join(":");

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setResult(null);
    setError("");
    const params = new URLSearchParams({
      ano_letivo_id: academicYearId, turma_id: turmaId, tipo: type,
    });
    if (escolaParam) params.set("escola_id", escolaParam);
    if (type === "horarios" && versionId) params.set("versao_id", versionId);
    void fetch("/api/secretaria/operacoes-academicas/arquivo/registos?" + params.toString(), {
      cache: "no-store", signal: controller.signal,
    })
      .then(async (res) => {
        const data = await res.json().catch(() => ({})) as ArchiveResponse;
        if (!res.ok || !data.ok || data.context?.ano_letivo_id !== academicYearId ||
            data.context?.turma_id !== turmaId || data.context?.tipo !== type) {
          throw new Error(data.error || "Não foi possível validar o contexto da consulta.");
        }
        return data;
      })
      .then((data) => {
        if (!controller.signal.aborted) { setResult(data); setLoadedKey(scopeKey); }
      })
      .catch((cause) => {
        if (!controller.signal.aborted) { setError(cause instanceof Error ? cause.message : "Consulta indisponível."); setLoadedKey(scopeKey); }
      })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [academicYearId, turmaId, escolaParam, type, versionId, retry, scopeKey]);

  const data = loadedKey === scopeKey ? result : null;
  const periodos = new Map((data?.context?.periodos ?? []).map((p) => [p.id, p]));
  const periodName = (id: string) => {
    const period = periodos.get(id);
    return period ? (period.numero ? String(period.numero) + "º trimestre" : (period.tipo || "Período")) : "Período não identificado";
  };
  const pautas = type === "pautas" ? (data?.items ?? []) as Pauta[] : [];
  const horarios = type === "horarios" ? (data?.versoes ?? []) as Horario[] : [];
  const frequencias = type === "frequencia" ? (data?.items ?? []) as Frequencia[] : [];
  const curriculos = type === "curriculo" ? (data?.versoes ?? []) as Curriculo[] : [];
  const aulas = type === "horarios" ? data?.itens ?? [] : [];

  return (
    <section aria-label="Registos históricos da turma" className="space-y-3 border-t border-border bg-muted/20 p-3 sm:p-4">
      <div className="flex flex-wrap gap-2" role="group" aria-label="Tipo de registo">
        {TABS.map(({ id, label, icon: Icon }) => (
          <button key={id} type="button"
            aria-pressed={type === id}
            onClick={() => { setType(id); setVersionId(""); }}
            className={"inline-flex min-h-10 items-center gap-2 rounded-xl border px-3 py-2 text-xs font-semibold transition " +
              (type === id ? "border-klasse-gold bg-card text-foreground ring-2 ring-klasse-gold/20" : "border-border bg-card text-muted-foreground hover:text-foreground")}>
            <Icon aria-hidden="true" className="h-4 w-4" /> {label}
          </button>
        ))}
      </div>
      {loading || loadedKey !== scopeKey ? <p role="status" className="text-sm text-muted-foreground">A consultar registos da turma…</p> : null}
      {!loading && error && loadedKey === scopeKey && (
        <div role="alert" className="flex flex-wrap items-center gap-2 text-sm text-destructive">
          {error}
          <button type="button" onClick={() => setRetry((v) => v + 1)}
            className="inline-flex items-center gap-1 rounded-xl border border-border px-3 py-2 font-medium text-foreground">
            <RefreshCw className="h-4 w-4" /> Tentar novamente
          </button>
        </div>
      )}
      {!loading && !error && data && type === "pautas" && (
        <div className="space-y-2">
          <p className="text-xs text-muted-foreground">Somente pautas já emitidas. A consulta não gera nem altera documentos.</p>
          {!pautas.length && <p className="text-sm text-muted-foreground">Sem pautas oficiais registadas para esta turma e ano.</p>}
          {pautas.map((p) => {
            const params = new URLSearchParams({ ano_letivo_id: academicYearId, turma_id: turmaId });
            if (escolaParam) params.set("escola_id", escolaParam);
            return (
              <div key={p.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border bg-card p-3 text-sm">
                <div>
                  <p className="font-semibold text-foreground">{p.tipo === "anual" ? "Pauta anual" : "Pauta " + periodName(p.periodo_letivo_id)}</p>
                  <p className="text-xs text-muted-foreground">{dateLabel(p.generated_at)} · {p.status || "Sem estado"}</p>
                </div>
                {p.tem_pdf
                  ? <a className="inline-flex items-center gap-2 rounded-xl border border-border px-3 py-2 text-xs font-semibold text-foreground hover:border-klasse-gold"
                      href={"/api/secretaria/operacoes-academicas/arquivo/pauta/" + encodeURIComponent(p.id) + "?" + params.toString()}
                      target="_blank" rel="noopener noreferrer">
                      <FileText className="h-4 w-4" /> Consultar PDF
                    </a>
                  : <span className="text-xs text-muted-foreground">PDF não publicado</span>}
              </div>
            );
          })}
        </div>
      )}
      {!loading && !error && data && type === "horarios" && (
        <div className="space-y-3">
          {!horarios.length && <p className="text-sm text-muted-foreground">Sem versões de horário publicadas/arquivadas nesta turma.</p>}
          {horarios.length > 0 && (
            <>
              <label className="block text-xs font-medium text-muted-foreground" htmlFor={"archive-version-" + turmaId}>Versão publicada</label>
              <select id={"archive-version-" + turmaId}
                className="w-full max-w-md rounded-xl border border-border bg-card px-3 py-2 text-sm text-foreground"
                value={data.versao_id || ""} onChange={(event) => setVersionId(event.target.value)}>
                {horarios.map((v) => <option key={v.id} value={v.id}>{dateLabel(v.publicado_em || v.created_at)} · {v.status}</option>)}
              </select>
              {!aulas.length && <p className="text-sm text-muted-foreground">A versão selecionada não tem aulas persistidas.</p>}
              <div className="grid gap-2 sm:grid-cols-2">
                {aulas.map((a) => <div key={a.id} className="rounded-xl border border-border bg-card p-3">
                  <p className="text-sm font-semibold text-foreground">{a.disciplina}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {weekday(a.slot?.dia_semana)} · {a.slot?.inicio?.slice(0, 5) || "—"}–{a.slot?.fim?.slice(0, 5) || "—"}
                  </p>
                </div>)}
              </div>
            </>
          )}
        </div>
      )}
      {!loading && !error && data && type === "frequencia" && (
        <div className="space-y-2">
          <p className="text-xs text-muted-foreground">Resumo de snapshots de frequência do período. Não se presume presença quando não existem registos.</p>
          {!frequencias.some((f) => f.registos > 0) && <p className="text-sm text-muted-foreground">Não existem mapas consolidados de frequência deste ano.</p>}
          {frequencias.filter((f) => f.registos > 0).map((f) => (
            <div key={f.periodo_letivo_id} className="rounded-xl border border-border bg-card p-3">
              <p className="text-sm font-semibold text-foreground">{periodName(f.periodo_letivo_id)}</p>
              <p className="mt-1 text-xs text-muted-foreground">
                {f.registos} registos · {f.presencas} presenças · {f.faltas} faltas · {f.aulas_previstas} aulas previstas · {f.abaixo_minimo} abaixo do mínimo
              </p>
            </div>
          ))}
        </div>
      )}
      {!loading && !error && data && type === "curriculo" && (
        <div className="space-y-3">
          {!curriculos.length && <p className="text-sm text-muted-foreground">Não existe currículo versionado para esta classe e ano.</p>}
          {curriculos.map((c) => (
            <div key={c.id} className="rounded-xl border border-border bg-card p-3">
              <p className="text-sm font-semibold text-foreground">Versão {c.version} · {c.status}</p>
              <ul className="mt-2 grid list-inside list-disc gap-1 text-xs text-muted-foreground sm:grid-cols-2">
                {c.disciplinas.map((d) => (
                  <li key={d.id}>{d.nome}{d.carga_horaria_semanal != null ? " · " + d.carga_horaria_semanal + " aulas/semana" : ""}</li>
                ))}
              </ul>
              {!c.disciplinas.length && <p className="mt-2 text-xs text-muted-foreground">Sem disciplinas associadas a esta versão.</p>}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
