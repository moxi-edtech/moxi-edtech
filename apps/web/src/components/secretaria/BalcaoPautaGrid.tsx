"use client";

import { useEffect, useRef, useState } from "react";
import { Check, RefreshCw } from "lucide-react";
import { useBalcaoDraftForm } from "@/components/secretaria/command-center/BalcaoDraftState";

const types = ["MAC", "NPP", "NPT"] as const;
type Kind = typeof types[number];
type Row = { id: string; disciplinaId: string; nome: string; max: number; active: Kind[];
  values: Partial<Record<Kind, number | null>>; blocked: boolean; error?: string };
type Props = { escolaId: string; alunoId: string; matriculaId: string; turmaId: string;
  anoLetivoId: string; ano: number; historical: boolean; onDirtyChange?: (busy: boolean) => void; onSaved: () => Promise<unknown> };

export function parsePautaValue(raw: string, max: number): number {
  if (!raw.trim()) throw new Error("Introduza a nota; apagar não elimina uma nota existente.");
  const value = Number(raw.trim().replace(",", "."));
  if (!Number.isFinite(value) || value < 0 || value > max) throw new Error(`Nota entre 0 e ${max}.`);
  return value;
}

async function read(url: string, signal: AbortSignal) {
  const response = await fetch(url, { cache: "no-store", signal });
  const data = await response.json();
  if (!response.ok || data.ok !== true) throw new Error(data.error || "Não foi possível carregar a pauta.");
  return data;
}

/** A projection of existing pauta-grid reads; writes remain in /secretaria/notas. */
export function BalcaoPautaGrid(props: Props) {
  const { escolaId, alunoId, matriculaId, turmaId, anoLetivoId, ano, historical, onSaved, onDirtyChange } = props;
  const [term, setTerm] = useState(1);
  const [terms, setTerms] = useState<Record<number, Row[]>>({});
  const rows = terms[term] ?? [];
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [retry, setRetry] = useState(0);
  const alive = useRef(true);
  const savingRef = useRef(false);
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
  const baseline = Object.fromEntries(Object.entries(terms).flatMap(([n, rows]) => rows.flatMap(row => types.map(type =>
    [n + ":" + row.id + ":" + type, row.values[type] == null ? "" : String(row.values[type])]))));
  const dirty = Object.keys(draft).some(key => draft[key] !== baseline[key]);
  useEffect(() => { onDirtyChange?.(dirty || saving);
    return () => onDirtyChange?.(false);
  }, [dirty, saving, onDirtyChange]);
  useBalcaoDraftForm("pauta-inline", { ...baseline, ...draft }, baseline, { submitting: saving, enabled: true });

  useEffect(() => {
    setTerm(1); setTerms({}); setDraft({}); setErrors({}); setError(""); setNotice("");
  }, [escolaId, alunoId, matriculaId, turmaId, anoLetivoId, historical, retry]);

  useEffect(() => {
    if (terms[term]) { setLoading(false); return; }
    const controller = new AbortController();
    setLoading(true); setError("");
    const load = async () => {
      const scope = new URLSearchParams({ aluno_id: alunoId, ano_letivo_id: anoLetivoId });
      const catalog = await read(`/api/secretaria/turmas/${turmaId}/disciplinas?${scope}`, controller.signal);
      if (!Array.isArray(catalog.items) || catalog.items.length > 100) throw new Error("Disciplinas indisponíveis.");
      const items = catalog.items;
      const result: Row[] = new Array(items.length);
      let next = 0;
      // Bound the existing per-discipline readers instead of firing an unbounded fan-out.
      await Promise.all(Array.from({ length: Math.min(3, items.length) }, async () => {
        while (next < items.length && !controller.signal.aborted) {
          const index = next++;
          const item = items[index];
          const row: Row = { id: item.id, disciplinaId: item.disciplina?.id, nome: item.disciplina?.nome ?? "Disciplina",
            max: 0, active: [], values: {}, blocked: true };
          try {
            if (!row.id || !row.disciplinaId) throw new Error("Disciplina não atribuída.");
            const [periods, grid] = await Promise.all([
              read("/api/secretaria/notas/periodos?" + new URLSearchParams({
                ano_letivo_id: anoLetivoId, turma_id: turmaId, turma_disciplina_id: row.id,
              }), controller.signal),
              read(`/api/secretaria/turmas/${turmaId}/pauta-grid?` + new URLSearchParams({
                disciplinaId: row.disciplinaId, turmaDisciplinaId: row.id, trimestre: String(term),
                anoLetivoId, alunoId,
              }), controller.signal),
            ]);
            const period = periods.items?.find((p: { numero: number }) => p.numero === term);
            row.blocked = !period?.disciplina_ativa || ["future", "unconfigured"].includes(period?.estado) ||
              (periods.read_only === true && !historical);
            const pupil = grid.items?.find((p: { aluno_id: string }) => p.aluno_id === alunoId);
            if (!pupil) throw new Error("Aluno não encontrado nesta pauta.");
            row.max = grid.meta?.nota_maxima;
            if (grid.meta?.entrada_numerica_permitida === false || !Number.isFinite(row.max) || row.max <= 0) throw new Error("Avaliação não numérica.");
            const configured = grid.meta?.componentes_ativos;
            if (!Array.isArray(configured) || !configured.length) throw new Error("Tipos de avaliação não configurados.");
            row.active = types.filter(type => configured.includes(type) || (type === "NPT" && configured.includes("PT")));
            for (const type of row.active) row.values[type] = pupil.componentes?.[type] ??
              (type === "NPT" ? pupil.componentes?.PT : undefined) ?? pupil[type.toLowerCase()] ?? null;
            if (pupil.is_isento) { row.blocked = true; row.error = "Isento"; }
            else if (row.blocked) row.error = "Trimestre indisponível";
          } catch (cause) { row.error = cause instanceof Error ? cause.message : "Falha ao carregar"; row.blocked = true; }
          result[index] = row;
        }
      }));
      if (!controller.signal.aborted) setTerms(previous => ({ ...previous, [term]: result }));
    };
    void load().catch(cause => { if (!controller.signal.aborted) setError(cause.message); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  // Cache each visited trimester; drafts belong to the whole pupil/year.
  }, [escolaId, alunoId, matriculaId, turmaId, anoLetivoId, historical, term, retry, terms]);

  const save = async () => {
    if (savingRef.current || loading) return;
    const invalid: Record<string, string> = {};
    const changes: Array<{ row: Row; term: number; type: Kind; key: string; value: number }> = [];
    for (const [number, entries] of Object.entries(terms)) for (const row of entries) for (const type of row.active) {
      const key = number + ":" + row.id + ":" + type;
      if (row.blocked || draft[key] === undefined || draft[key] === baseline[key]) continue;
      try { const value = parsePautaValue(draft[key], row.max);
        if (value !== row.values[type]) changes.push({ row, term: Number(number), type, key, value });
        else setDraft(previous => { const copy = { ...previous }; delete copy[key]; return copy; });
      } catch (cause) { invalid[key] = (cause as Error).message; }
    }
    setErrors(invalid);
    if (Object.keys(invalid).length) {
      setTerm(Number(Object.keys(invalid)[0].split(":")[0]));
      setError("Reveja as notas assinaladas."); return;
    }
    if (!changes.length) return;
    setError("");
    savingRef.current = true; setSaving(true); setNotice("");
    let saved = 0;
    try {
      const committed = (cells: typeof changes) => {
        saved += cells.length;
        if (!alive.current) return;
        setTerms(previous => {
          const next = { ...previous };
          for (const cell of cells) next[cell.term] = next[cell.term].map(row => row.id === cell.row.id
            ? { ...row, values: { ...row.values, [cell.type]: cell.value } } : row);
          return next;
        });
        setDraft(previous => { const next = { ...previous }; for (const cell of cells) delete next[cell.key]; return next; });
      };
      if (historical) {
        // One authenticated request and one transaction, reusing the audited writer.
        try {
          const response = await fetch("/api/secretaria/notas/historicas", {
            method: "POST", headers: { "Content-Type": "application/json", "Idempotency-Key": crypto.randomUUID() },
            body: JSON.stringify({ turma_id: turmaId, ano_letivo_id: anoLetivoId, matricula_id: matriculaId,
              motivo: "Transcrição de nota conforme pauta física escolar",
              notas: changes.map(cell => ({ turma_disciplina_id: cell.row.id, trimestre: cell.term,
                tipo_avaliacao: cell.type, valor: cell.value })),
            }),
          });
          const data = await response.json();
          if (!response.ok || data.ok !== true) throw new Error(data.error || "Não foi possível guardar.");
          committed(changes);
        } catch (cause) { for (const cell of changes) invalid[cell.key] = (cause as Error).message; }
      } else {
        // Current-year marks retain the existing writer; bound parallel requests.
        let next = 0;
        await Promise.all(Array.from({ length: Math.min(3, changes.length) }, async () => {
          while (next < changes.length && alive.current) {
            const cell = changes[next++];
            try {
              const response = await fetch("/api/secretaria/notas", {
                method: "POST", headers: { "Content-Type": "application/json", "Idempotency-Key": crypto.randomUUID() },
                body: JSON.stringify({ turma_id: turmaId, ano_letivo_id: anoLetivoId,
                  disciplina_id: cell.row.disciplinaId, turma_disciplina_id: cell.row.id,
                  trimestre: cell.term, tipo_avaliacao: cell.type, notas: [{ aluno_id: alunoId, valor: cell.value }],
                }),
              });
              const data = await response.json();
              if (!response.ok || data.ok !== true) throw new Error(data.error || "Não foi possível guardar.");
              committed([cell]);
            } catch (cause) { invalid[cell.key] = (cause as Error).message; }
          }
        }));
      }
      if (alive.current) {
        setErrors(invalid);
        setNotice(`${saved === 1 ? "1 nota guardada" : `${saved} notas guardadas`}.${Object.keys(invalid).length ? " Reveja as células assinaladas." : ""}`);
        if (saved && !Object.keys(invalid).length) { try { await onSaved(); } catch { setError("Notas guardadas. Atualize a situação académica."); } }
      }
    } finally { savingRef.current = false; if (alive.current) setSaving(false); }
  };

  return <section aria-label={`Pauta de ${ano}`} className="mt-4 space-y-3">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <h4 className="font-sora text-sm font-semibold text-emerald">Pauta de {ano}</h4>
      <div className="flex gap-2" role="group" aria-label="Trimestre">
        {[1, 2, 3].map(n => <button key={n} type="button" aria-pressed={term === n}
          disabled={saving} onClick={() => setTerm(n)}
          className={`rounded-xl border px-3 py-2 text-sm ${term === n ? "border-amber bg-amber/10" : "border-border"}`}>{n}.º</button>)}
      </div>
    </div>
    {loading ? <p role="status" className="text-sm">A carregar pauta…</p> : <>
      {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
      {!rows.length && !error && <p className="text-sm">Nenhuma disciplina atribuída à turma.</p>}
      <div className="overflow-x-auto rounded-xl border border-border">
        <table className="w-full text-left text-sm"><thead><tr className="border-b border-border">
          <th scope="col" className="p-3">Disciplina</th>{types.map(type => <th scope="col" key={type} className="p-3">{type}</th>)}
        </tr></thead><tbody>{rows.map(row => <tr key={row.id} className="border-b border-border last:border-0">
          <th scope="row" className="p-3 font-medium">{row.nome}{row.error && <span className="block text-xs text-red-600">{row.error}</span>}</th>
          {types.map(type => { const key = term + ":" + row.id + ":" + type; return <td key={type} className="p-2">
            {row.active.includes(type) ? <><input aria-label={`${row.nome} · ${type} · ${term}.º trimestre`}
              aria-invalid={Boolean(errors[key])}
              aria-describedby={errors[key] ? `${matriculaId}-${key}-${term}-error` : undefined} disabled={saving || row.blocked} inputMode="decimal"
              value={draft[key] ?? baseline[key] ?? ""} placeholder="—"
              onChange={event => { setDraft(previous => ({ ...previous, [key]: event.target.value }));
                setErrors(previous => { const copy = { ...previous }; delete copy[key]; return copy; }); setNotice(""); }}
              className={`w-20 rounded-xl border p-2 focus:border-amber focus:outline-none focus:ring-4 focus:ring-amber/20 ${errors[key] ? "border-red-500" : "border-border"}`} />
              {errors[key] && <span id={`${matriculaId}-${key}-${term}-error`} role="alert" className="block max-w-48 text-xs text-red-600">{errors[key]}</span>}</> : <span aria-label="Não aplicável">—</span>}
          </td>; })}
        </tr>)}</tbody></table>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <button type="button" disabled={saving || !dirty} onClick={() => void save()}
          className="inline-flex items-center gap-2 rounded-xl bg-amber px-4 py-2 text-sm font-semibold text-white hover:brightness-95 disabled:opacity-50"><Check size={16} />{saving ? "A guardar…" : "Guardar notas"}</button>
        <button type="button" disabled={saving} onClick={() => { if (!dirty || window.confirm("Descartar notas por guardar?")) setRetry(n => n + 1); }}
          className="inline-flex items-center gap-2 rounded-xl border border-border px-3 py-2 text-sm"><RefreshCw size={16} />Atualizar pauta</button>
        {dirty && <span className="text-sm text-slate-500">Alterações dos três trimestres por guardar</span>}
        {notice && <p role="status" className="text-sm">{notice}</p>}
      </div>
    </>}
  </section>;
}
