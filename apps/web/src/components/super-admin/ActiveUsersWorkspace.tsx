"use client";

import { useEffect, useMemo, useState } from "react";
import { RefreshCw, Search } from "lucide-react";
import { createClient } from "@/lib/supabaseClient";

type Item = { user_id: string; nome: string | null; role: string; escola: string | null; last_seen_at: string };
type Snapshot = { total: number; as_of: string; items: Item[] };
const PAGE_SIZE = 50;
const timestamp = (value: string) => new Intl.DateTimeFormat("pt-AO", { timeZone: "Africa/Luanda", hour: "2-digit", minute: "2-digit", second: "2-digit" }).format(new Date(value));

export default function ActiveUsersWorkspace() {
  const supabase = useMemo(() => createClient(), []);
  const [input, setInput] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(0);
  const [revision, setRevision] = useState(0);
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true); setError(false); setSnapshot(null);
    void (async () => {
      try {
        const { data, error } = await supabase.rpc("klasse_admin_active_users", { p_limit: PAGE_SIZE, p_offset: page * PAGE_SIZE, p_search: search }).abortSignal(controller.signal);
        if (controller.signal.aborted) return;
        if (error || !data || typeof data !== "object" || Array.isArray(data)) throw new Error("Presence unavailable");
        const value = data as unknown as Snapshot;
        if (!Number.isSafeInteger(value.total) || !Array.isArray(value.items)) throw new Error("Invalid presence response");
        setSnapshot(value);
      } catch { if (!controller.signal.aborted) setError(true); }
      finally { if (!controller.signal.aborted) setLoading(false); }
    })();
    return () => controller.abort();
  }, [supabase, page, search, revision]);

  return <section className="min-w-0 space-y-4">
    <p className="text-sm text-muted-foreground">Utilizadores com actividade sinalizada nos últimos 5 minutos. Não representa sessões ligadas em tempo real.</p>
    <form className="flex flex-wrap items-center gap-2" onSubmit={event => { event.preventDefault(); setPage(0); setSearch(input.trim()); setRevision(v => v + 1); }}>
      <label className="sr-only" htmlFor="active-users-search">Pesquisar nome, escola ou perfil</label>
      <input id="active-users-search" value={input} onChange={e => setInput(e.target.value)} maxLength={100} placeholder="Nome, escola ou perfil" className="min-w-0 flex-1 rounded-xl border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-4 focus:ring-ring/20" />
      <button type="submit" className="inline-flex items-center gap-2 rounded-xl border border-border px-3 py-2 text-sm"><Search className="h-4 w-4" />Pesquisar</button>
      <button type="button" disabled={loading} onClick={() => setRevision(v => v + 1)} className="inline-flex items-center gap-2 rounded-xl border border-border px-3 py-2 text-sm disabled:opacity-50"><RefreshCw className="h-4 w-4" />Actualizar</button>
    </form>
    {loading ? <div role="status" aria-label="A carregar utilizadores activos" className="h-32 rounded-xl bg-muted motion-safe:animate-pulse" /> : error || !snapshot ? <p role="alert" className="rounded-xl border border-border p-4 text-sm text-foreground">Não foi possível consultar a actividade. Tente novamente.</p> : <>
      <div className="flex flex-wrap items-center justify-between gap-2 text-sm"><span className="font-semibold text-foreground">{snapshot.total.toLocaleString("pt-AO")} {search ? "resultados" : "utilizadores activos"}</span><span className="text-muted-foreground">Actualizado às {timestamp(snapshot.as_of)}</span></div>
      {snapshot.items.length === 0 ? <p className="rounded-xl border border-border p-4 text-sm text-muted-foreground">Nenhum utilizador encontrado nesta janela de actividade.</p> : <div role="region" aria-label="Utilizadores activos" tabIndex={0} className="overflow-x-auto rounded-xl border border-border">
        <table className="w-full text-left text-sm"><thead className="bg-muted text-muted-foreground"><tr>{["Utilizador","Escola","Perfil","Última actividade"].map(label => <th key={label} scope="col" className="px-3 py-3 font-medium">{label}</th>)}</tr></thead>
          <tbody className="divide-y divide-border">{snapshot.items.map(item => <tr key={item.user_id} className="text-foreground"><td className="px-3 py-3 font-medium">{item.nome || "Sem nome"}</td><td className="px-3 py-3">{item.escola || "Sem escola associada"}</td><td className="px-3 py-3">{item.role.replaceAll("_", " ")}</td><td className="whitespace-nowrap px-3 py-3 tabular-nums">{timestamp(item.last_seen_at)}</td></tr>)}</tbody>
        </table></div>}
      <div className="flex items-center justify-end gap-2"><button type="button" disabled={page === 0} onClick={() => setPage(v => v - 1)} className="rounded-xl border border-border px-3 py-2 text-sm disabled:opacity-50">Anterior</button><button type="button" disabled={(page + 1) * PAGE_SIZE >= snapshot.total} onClick={() => setPage(v => v + 1)} className="rounded-xl border border-border px-3 py-2 text-sm disabled:opacity-50">Seguinte</button></div>
    </>}
  </section>;
}
