"use client";

import { useEffect, useState } from "react";
import { Bell } from "lucide-react";

type Aviso = { id: string; titulo: string; resumo: string; origem: string; data: string };

export function TabNotificacoes() {
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [items, setItems] = useState<Aviso[]>([]);
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    const ctrl = new AbortController();
    setLoading(true);
    setFailed(false);
    void (async () => {
      try {
        const res = await fetch("/api/aluno/avisos", { cache: "no-store", signal: ctrl.signal });
        const json = await res.json().catch(() => null);
        if (!res.ok || json?.ok !== true || !Array.isArray(json.avisos)) throw new Error("Falha ao carregar avisos");
        if (!ctrl.signal.aborted) setItems(json.avisos as Aviso[]);
      } catch {
        if (!ctrl.signal.aborted) setFailed(true);
      } finally {
        if (!ctrl.signal.aborted) setLoading(false);
      }
    })();
    return () => ctrl.abort();
  }, [retry]);

  return (
    <section className="space-y-4" aria-labelledby="aluno-avisos-title">
      <div className="space-y-1">
        <h1 id="aluno-avisos-title" className="text-xl font-semibold text-primary">Avisos</h1>
        <p className="text-sm text-muted-foreground">Mensagens e novidades da tua escola.</p>
      </div>
      {loading ? (
        <p role="status" className="rounded-xl bg-muted p-4 text-sm text-muted-foreground">A carregar avisos…</p>
      ) : failed ? (
        <div role="alert" className="rounded-xl border border-border bg-card p-4">
          <p className="text-sm font-semibold text-foreground">Não foi possível consultar os avisos.</p>
          <button type="button" onClick={() => setRetry(v => v + 1)}
            className="mt-3 min-h-11 rounded-xl border border-border bg-card px-4 text-sm font-semibold text-primary hover:bg-muted">
            Tentar novamente
          </button>
        </div>
      ) : items.length === 0 ? (
        <div className="flex items-center gap-3 rounded-xl border border-border bg-card p-4">
          <Bell aria-hidden="true" className="h-5 w-5 text-primary" />
          <p className="text-sm text-muted-foreground">Ainda não há avisos publicados.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {items.map(a => (
            <article key={a.id} className="rounded-xl border border-border bg-card p-4">
              <h2 className="text-sm font-semibold text-foreground">{a.titulo}</h2>
              {a.resumo && <p className="mt-2 text-sm text-muted-foreground">{a.resumo}</p>}
              <p className="mt-2 text-xs text-muted-foreground">
                {[a.origem, a.data && !Number.isNaN(Date.parse(a.data)) ? new Date(a.data).toLocaleDateString("pt-AO") : ""].filter(Boolean).join(" · ")}
              </p>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
