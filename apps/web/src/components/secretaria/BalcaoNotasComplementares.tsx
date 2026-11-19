"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { BookOpen, Check, Loader2 } from "lucide-react";
import { useBalcaoDraftForm } from "@/components/secretaria/command-center/BalcaoDraftState";

type Kind = "MAC" | "NPP" | "NPT";
const kinds: Kind[] = ["MAC", "NPP", "NPT"];
type Grade = { trimestre: number; tipo: string; valor: number; fonte: "operacional" | "complementacao" };
type Subject = {
  disciplina_id: string; nome: string; nota_final: number | null; media_final: number | null;
  referencia: string | null; notas: Grade[];
};
type Snapshot = {
  ok: true; matricula_id: string; ano: number; resultado_oficial: string;
  historico_fechado: boolean; pode_complementar: boolean; nota_maxima: number | null;
  disciplinas: Subject[];
};
const endpoint = "/api/secretaria/operacoes-academicas/notas-complementares";
const gradeKey = (id: string, trimestre: number, kind: string) => [id, trimestre, kind].join(":");

async function readSnapshot(matriculaId: string, signal?: AbortSignal): Promise<Snapshot> {
  const res = await fetch(endpoint + "?" + new URLSearchParams({ matricula_id: matriculaId }),
    { cache: "no-store", signal });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || data.ok !== true || data.matricula_id !== matriculaId) {
    throw new Error(data.error || "Não foi possível consultar as notas históricas.");
  }
  return data as Snapshot;
}

/** Complementa apenas componentes em falta; nunca reescreve a pauta ou o fecho legal. */
export function BalcaoNotasComplementares({ matriculaId, ano, onSaved }: {
  matriculaId: string; ano: number; onSaved: () => Promise<unknown>;
}) {
  const [open, setOpen] = useState(false);
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [trimestre, setTrimestre] = useState(1);
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [retry, setRetry] = useState(0);
  const savingRef = useRef(false);
  const mounted = useRef(true);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  useEffect(() => {
    if (!open) return;
    const controller = new AbortController();
    setLoading(true); setError(""); setSnapshot(null); setDraft({});
    void readSnapshot(matriculaId, controller.signal)
      .then(data => { if (!controller.signal.aborted) setSnapshot(data); })
      .catch(cause => { if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : "Falha na consulta."); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [open, matriculaId, retry]);

  useBalcaoDraftForm("complementar-notas:" + matriculaId, draft, {}, {
    submitting: saving, enabled: open,
  });

  const save = useCallback(async () => {
    if (!snapshot?.pode_complementar || !snapshot.nota_maxima || savingRef.current || loading) return;
    const items = snapshot.disciplinas.flatMap(subject => kinds.flatMap(kind =>
      [1, 2, 3].flatMap(term => {
        const key = gradeKey(subject.disciplina_id, term, kind);
        const raw = draft[key]?.trim();
        if (!raw) return [];
        const current = subject.notas.find(item => item.trimestre === term && item.tipo === kind);
        if (current) return [];
        const valor = Number(raw.replace(",", "."));
        if (!Number.isFinite(valor) || valor < 0 || valor > snapshot.nota_maxima!) {
          throw new Error(`Nota inválida em ${subject.nome}, ${term}.º trimestre. Use 0–${snapshot.nota_maxima}.`);
        }
        return [{ disciplina_id: subject.disciplina_id, trimestre: term, tipo_avaliacao: kind, valor }];
      })));
    if (!items.length) { setError("Preencha pelo menos uma nota em falta."); return; }
    savingRef.current = true; setSaving(true); setError(""); setNotice("");
    try {
      const response = await fetch(endpoint, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ matricula_id: matriculaId, notas: items }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok || result?.ok !== true) throw new Error(result?.error || "Não foi possível guardar.");
      const updated = await readSnapshot(matriculaId);
      if (mounted.current) {
        setSnapshot(updated); setDraft({});
        setNotice(`${result.inseridas ?? items.length} nota(s) acrescentada(s). Resultado oficial preservado.`);
      }
      try { await onSaved(); } catch { if (mounted.current) setNotice("Notas guardadas. Atualize a situação do aluno."); }
    } catch (cause) {
      if (mounted.current) {
        setError(cause instanceof Error ? cause.message : "Erro ao guardar notas.");
        // Uma resposta perdida não significa que a gravação falhou: reconsultar.
        try {
          const latest = await readSnapshot(matriculaId);
          if (mounted.current) setSnapshot(latest);
        } catch { /* manter rascunho se a rede estiver indisponível */ }
      }
    } finally {
      savingRef.current = false; if (mounted.current) setSaving(false);
    }
  }, [snapshot, draft, matriculaId, onSaved, loading]);

  const pending = Object.values(draft).filter(v => v.trim() !== "").length;
  return (
    <div className="space-y-3 rounded-xl border border-border bg-background p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="font-sora text-sm font-semibold text-emerald">Notas de {ano}</p>
          <p className="text-xs text-muted-foreground">As notas finais homologadas não são alteradas.</p>
        </div>
        <button type="button" onClick={() => setOpen(value => !value)} disabled={saving}
          aria-expanded={open}
          className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-border px-3 py-2 text-sm font-semibold hover:bg-muted disabled:opacity-50">
          <BookOpen size={16} /> {open ? "Fechar pauta" : "Completar notas"}
        </button>
      </div>
      {open && (
        <>
          {loading && <p role="status" className="flex items-center gap-2 text-xs"><Loader2 size={16} className="animate-spin" />A carregar notas…</p>}
          {snapshot && (
            <>
              {snapshot.resultado_oficial && <p className="text-xs text-muted-foreground">
                Resultado oficial: <span className="font-semibold text-foreground">{snapshot.resultado_oficial}</span>
              </p>}
              <div className="flex flex-wrap gap-2" role="group" aria-label="Trimestre do histórico">
                {[1, 2, 3].map(term => <button key={term} type="button"
                  aria-pressed={trimestre === term} disabled={saving} onClick={() => setTrimestre(term)}
                  className={`rounded-xl border px-3 py-2 text-sm ${trimestre === term ? "border-amber bg-amber/10 font-semibold" : "border-border"}`}>
                  {term}.º trimestre
                </button>)}
              </div>
              <div className="overflow-x-auto rounded-xl border border-border">
                <table className="w-full text-left text-sm">
                  <thead><tr className="border-b border-border">
                    <th scope="col" className="p-3">Disciplina</th>
                    <th scope="col" className="p-3">Final</th>
                    {kinds.map(kind => <th key={kind} scope="col" className="p-3">{kind}</th>)}
                  </tr></thead>
                  <tbody>{snapshot.disciplinas.map(subject => (
                    <tr key={subject.disciplina_id} className="border-b border-border last:border-0">
                      <th scope="row" className="min-w-36 p-3 font-medium">
                        {subject.nome}
                        {subject.referencia && <span className="block max-w-56 truncate text-xs font-normal text-muted-foreground" title={subject.referencia}>Fonte: {subject.referencia}</span>}
                      </th>
                      <td className="p-3 tabular-nums">{subject.nota_final ?? "—"}</td>
                      {kinds.map(kind => {
                        const key = gradeKey(subject.disciplina_id, trimestre, kind);
                        const saved = subject.notas.find(g => g.trimestre === trimestre && g.tipo === kind);
                        return <td key={kind} className="p-2">
                          {saved
                            ? <span className="inline-flex items-center gap-1 whitespace-nowrap tabular-nums text-emerald"><Check size={14} />{saved.valor}</span>
                            : <input aria-label={`${subject.nome} · ${kind} · ${trimestre}.º trimestre`}
                              inputMode="decimal" placeholder="—"
                              disabled={saving || !snapshot.pode_complementar}
                              value={draft[key] ?? ""} onChange={e => setDraft(previous => ({ ...previous, [key]: e.target.value }))}
                              className="w-16 rounded-xl border border-border bg-background px-2 py-2 text-sm focus:border-amber focus:outline-none focus:ring-4 focus:ring-amber/20 disabled:opacity-50" />}
                        </td>;
                      })}
                    </tr>))}
                    {!snapshot.disciplinas.length && <tr><td colSpan={5} className="p-3 text-sm text-muted-foreground">
                      Ainda não existem disciplinas registadas no histórico oficial. Regularize primeiro as disciplinas da origem.
                    </td></tr>}
                  </tbody>
                </table>
              </div>
              {snapshot.pode_complementar && snapshot.disciplinas.length > 0 && (
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-xs text-muted-foreground">Preencha apenas notas da pauta original. Guarde os três trimestres de uma vez.</p>
                  <button type="button" onClick={() => void save()} disabled={saving || loading || pending === 0}
                    className="inline-flex min-h-10 items-center gap-2 rounded-xl bg-amber px-4 py-2 text-sm font-semibold text-white hover:brightness-95 disabled:opacity-50">
                    {saving ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}
                    Guardar {pending ? `${pending} nota(s)` : "notas"}
                  </button>
                </div>
              )}
              {!snapshot.pode_complementar && <p role="status" className="text-xs text-muted-foreground">Este histórico não permite complementação numérica; consulte as notas oficiais acima.</p>}
            </>
          )}
          {error && <div role="alert" className="flex flex-wrap items-center gap-2 text-xs text-red-600">
            {error} {!snapshot && <button type="button" onClick={() => setRetry(n => n+1)} className="rounded-xl border border-border px-2 py-1">Tentar novamente</button>}
          </div>}
          {notice && <p role="status" className="text-xs text-emerald">{notice}</p>}
        </>
      )}
    </div>
  );
}
