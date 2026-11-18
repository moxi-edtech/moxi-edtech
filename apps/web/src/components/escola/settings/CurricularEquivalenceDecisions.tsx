"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Check, AlertCircle } from "lucide-react";
import type { SuspectedEquivalence } from "@/lib/academico/discipline-equivalences";

type Decision = {
  id: string;
  classe_id: string;
  nome_normalizado: string;
  disciplina_oficial_id: string;
  candidatos_ids: string[];
  motivo: string;
  decidido_em: string;
};
type Props = {
  courseId: string;
  yearId: string | null;
  groups: SuspectedEquivalence[];
  classNameById: ReadonlyMap<string, string>;
};
const keyFor = (g: Pick<SuspectedEquivalence, "classId" | "normalizedName">) =>
  `${g.classId}:${g.normalizedName}`;

export default function CurricularEquivalenceDecisions({ courseId, yearId, groups, classNameById }: Props) {
  const [items, setItems] = useState<Decision[]>([]);
  const [canDecide, setCanDecide] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState<string | null>(null);
  const [selection, setSelection] = useState<Record<string, string>>({});
  const [reasons, setReasons] = useState<Record<string, string>>({});
  const byKey = useMemo(() => new Map(items.map((item) =>
    [`${item.classe_id}:${item.nome_normalizado}`, item])), [items]);

  const refresh = useCallback(async (signal?: AbortSignal) => {
    if (!yearId) { setItems([]); setCanDecide(false); setLoading(false); return; }
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams({ curso_id: courseId, ano_letivo_id: yearId });
      const response = await fetch(`/api/academico/equivalencias?${params}`, {
        cache: "no-store", signal,
      });
      const json = await response.json();
      if (!response.ok || !json.ok) throw new Error(json.error ?? "Falha ao consultar decisões.");
      if (!signal?.aborted) {
        setItems(json.items);
        setCanDecide(Boolean(json.can_decide));
      }
    } catch (cause) {
      if (!signal?.aborted) setError(cause instanceof Error ? cause.message : "Falha ao consultar decisões.");
    } finally {
      if (!signal?.aborted) setLoading(false);
    }
  }, [courseId, yearId]);

  useEffect(() => {
    const controller = new AbortController();
    void refresh(controller.signal);
    return () => controller.abort();
  }, [refresh]);

  const decide = async (group: SuspectedEquivalence) => {
    if (!yearId || !canDecide) return;
    const key = keyFor(group);
    const official = selection[key];
    const reason = (reasons[key] ?? "").trim();
    if (!group.candidates.some((candidate) => candidate.id === official) || reason.length < 5) {
      setError("Escolhe a disciplina oficial e indica um motivo com pelo menos 5 caracteres.");
      return;
    }
    setSaving(key);
    setError("");
    try {
      const response = await fetch("/api/academico/equivalencias", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          curso_id: courseId, ano_letivo_id: yearId, classe_id: group.classId,
          nome_normalizado: group.normalizedName, disciplina_oficial_id: official, motivo: reason,
        }),
      });
      const json = await response.json();
      if (!response.ok || !json.ok) throw new Error(json.error ?? "Não foi possível guardar a decisão.");
      setItems((current) => [...current, json.item]);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Não foi possível guardar a decisão.");
    } finally {
      setSaving(null);
    }
  };

  if (groups.length === 0) return null;
  return (
    <section aria-label="Equivalências curriculares" className="rounded-xl border border-border bg-card p-4">
      <h3 className="text-sm font-semibold text-klasse-green">Disciplinas com nomes equivalentes</h3>
      <p className="mt-1 text-xs text-muted-foreground">
        A Direção escolhe qual disciplina apresentar como oficial em cada classe e ano.
        A decisão fica registada; não funde disciplinas nem altera notas ou matrizes.
      </p>
      {!yearId && <p role="alert" className="mt-2 text-sm text-destructive">Selecciona um ano letivo antes de decidir.</p>}
      {loading && <p className="mt-2 text-xs text-muted-foreground">A consultar decisões...</p>}
      {error && <p role="alert" className="mt-2 text-sm text-destructive">{error} <button type="button" className="underline" onClick={() => void refresh()}>Tentar novamente</button></p>}
      <ul className="mt-3 space-y-2">
        {groups.map((group) => {
          const key = keyFor(group);
          const existing = byKey.get(key);
          const stale = existing && (existing.candidatos_ids.length !== group.candidates.length ||
            group.candidates.some((candidate) => !existing.candidatos_ids.includes(candidate.id)));
          const officialName = group.candidates.find((candidate) =>
            candidate.id === existing?.disciplina_oficial_id)?.nome;
          return (
            <li key={key} className="rounded-xl border border-border p-3 text-sm">
              <p className="font-semibold text-foreground">{classNameById.get(group.classId) ?? "Classe"}</p>
              <p className="mt-1 text-xs text-muted-foreground">{group.candidates.map((candidate) => candidate.nome).join(" / ")}</p>
              {existing ? (
                <div className="mt-2 space-y-1">
                  <p className="flex items-center gap-2 font-semibold text-klasse-green">
                    <Check className="h-4 w-4" aria-hidden="true" />
                    {stale ? "Currículo alterado — requer revisão" : `Oficial: ${officialName ?? "Disciplina não identificada"}`}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Decidido em {new Intl.DateTimeFormat("pt-AO", { dateStyle: "short", timeZone: "Africa/Luanda" }).format(new Date(existing.decidido_em))}.
                    Motivo: {existing.motivo}
                  </p>
                  {stale && <p className="text-xs text-destructive">A decisão anterior foi preservada, mas não se aplica automaticamente ao currículo alterado.</p>}
                </div>
              ) : (
                <div className="mt-2 flex flex-col gap-2">
                  <label className="text-xs font-medium text-foreground" htmlFor={`official-${key}`}>Disciplina oficial</label>
                  <select id={`official-${key}`} value={selection[key] ?? ""} disabled={!yearId || !canDecide || loading || Boolean(saving)}
                    onChange={(event) => setSelection((current) => ({ ...current, [key]: event.target.value }))}
                    className="w-full rounded-xl border border-border bg-background p-2 text-sm text-foreground">
                    <option value="">Seleccionar disciplina</option>
                    {group.candidates.map((candidate) => <option key={candidate.id} value={candidate.id}>{candidate.nome}</option>)}
                  </select>
                  <label className="text-xs font-medium text-foreground" htmlFor={`reason-${key}`}>Motivo da decisão</label>
                  <textarea id={`reason-${key}`} value={reasons[key] ?? ""} maxLength={1000}
                    disabled={!yearId || !canDecide || loading || Boolean(saving)}
                    onChange={(event) => setReasons((current) => ({ ...current, [key]: event.target.value }))}
                    rows={2} className="w-full rounded-xl border border-border bg-background p-2 text-sm text-foreground"
                    placeholder="Ex.: grafia oficial adoptada pela Direção" />
                  {canDecide && yearId ? (
                    <button type="button" onClick={() => void decide(group)}
                      disabled={loading || Boolean(saving) || !selection[key] || (reasons[key] ?? "").trim().length < 5}
                      className="self-start rounded-xl bg-klasse-gold px-4 py-2 text-sm font-semibold text-slate-950 disabled:opacity-50">
                      {saving === key ? "A guardar..." : "Registar decisão"}
                    </button>
                  ) : <p className="flex items-center gap-1 text-xs text-muted-foreground">
                    <AlertCircle className="h-3.5 w-3.5" aria-hidden="true" /> Apenas a Direção pode decidir.
                  </p>}
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
