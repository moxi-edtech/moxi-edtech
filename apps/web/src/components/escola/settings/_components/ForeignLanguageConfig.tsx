"use client";

import { useEffect, useId, useRef, useState } from "react";
import { Languages, Check } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { IDIOMAS, idiomaSchema, type Idioma, type IdiomaConfig } from "@/lib/academico/lingua-estrangeira";

export function ForeignLanguageConfig({ escolaId }: { escolaId: string }) {
  const labelId = useId();
  const endpoint = `/api/escolas/${encodeURIComponent(escolaId)}/disciplinas/lingua-estrangeira`;
  const [saved, setSaved] = useState<IdiomaConfig | null>(null);
  const [idioma, setIdioma] = useState<Idioma | "">("");
  const [outro, setOutro] = useState("");
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [feedback, setFeedback] = useState("");
  const [retry, setRetry] = useState(0);
  const request = useRef<AbortController | null>(null);
  const pending = useRef(false);

  useEffect(() => {
    const controller = new AbortController();
    request.current = controller;
    setLoading(true);
    setError("");
    setFeedback("");
    setSaved(null);
    setIdioma("");
    setOutro("");
    fetch(endpoint, { cache: "no-store", signal: controller.signal })
      .then(async (res) => {
        const json = await res.json();
        if (!res.ok || !json?.ok || !json.data) throw new Error(json?.error ?? "Não foi possível carregar o idioma.");
        if (!controller.signal.aborted) {
          setSaved(json.data);
          setIdioma(json.data.idioma ?? "");
          setOutro(json.data.outro ?? "");
        }
      })
      .catch((e: unknown) => {
        if (!controller.signal.aborted) setError(e instanceof Error ? e.message : "Erro ao carregar.");
      })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => { request.current?.abort(); controller.abort(); };
  }, [endpoint, retry]);

  const payload = idiomaSchema.safeParse({ idioma, outro: idioma === "other" ? outro.trim() : null });
  const changed = Boolean(saved && (saved.idioma !== idioma || (saved.outro ?? "") !== (idioma === "other" ? outro.trim() : "")));

  const save = async () => {
    if (!payload.success || !changed || loading || pending.current) return;
    pending.current = true;
    setBusy(true);
    setError("");
    setFeedback("");
    const controller = new AbortController();
    request.current = controller;
    try {
      const res = await fetch(endpoint, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload.data),
        signal: controller.signal,
      });
      const json = await res.json();
      if (!res.ok || !json?.ok || !json.data) throw new Error(json?.error ?? "Não foi possível guardar o idioma.");
      if (!controller.signal.aborted) {
        setSaved(json.data);
        setIdioma(json.data.idioma ?? "");
        setOutro(json.data.outro ?? "");
        setFeedback("Idioma guardado.");
      }
    } catch (e) {
      if (!controller.signal.aborted) setError(e instanceof Error ? e.message : "Erro ao guardar.");
    } finally {
      pending.current = false;
      if (!controller.signal.aborted) setBusy(false);
    }
  };

  return (
    <section className="rounded-xl border border-border bg-card p-4 space-y-3" aria-labelledby={labelId}>
      <div className="flex items-center gap-2 text-sm font-semibold text-foreground" id={labelId}>
        <Languages size={18} className="text-klasse-green" /> Idioma leccionado
      </div>
      <p className="text-xs text-muted-foreground">Aplica-se a todas as classes desta escola. A disciplina mantém o nome Língua Estrangeira.</p>
      {loading ? <p role="status" className="text-sm text-muted-foreground">A carregar…</p> : saved ? (
        <>
          <label className="block text-xs font-medium text-foreground" htmlFor={labelId + "-select"}>Idioma</label>
          <select id={labelId + "-select"} value={idioma} disabled={busy} onChange={(e) => { setIdioma(e.target.value as Idioma); setFeedback(""); }}
            className="w-full rounded-xl border border-input bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-4 focus:ring-klasse-gold/20">
            <option value="" disabled>Por definir</option>
            {IDIOMAS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
          </select>
          {idioma === "other" && (
            <div className="space-y-1">
              <label className="block text-xs font-medium" htmlFor={labelId + "-other"}>Qual idioma?</label>
              <input id={labelId + "-other"} value={outro} maxLength={80} disabled={busy} onChange={(e) => { setOutro(e.target.value); setFeedback(""); }} placeholder="Ex.: Alemão" className="w-full rounded-xl border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-4 focus:ring-klasse-gold/20" />
            </div>
          )}
          <Button type="button" tone="gold" size="sm" loading={busy} disabled={!changed || !payload.success} onClick={() => void save()}>
            <Check size={16} /> {busy ? "A guardar…" : "Guardar idioma"}
          </Button>
          {feedback && <p role="status" className="text-xs text-muted-foreground">{feedback}</p>}
        </>
      ) : <Button type="button" variant="outline" size="sm" onClick={() => setRetry((n) => n + 1)}>Tentar novamente</Button>}
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
    </section>
  );
}
