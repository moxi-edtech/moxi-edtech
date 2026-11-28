"use client";
import { PortalPullToRefresh } from "@/components/portal/ui/PortalPullToRefresh";


import Link from "next/link";
import { useEffect, useState } from "react";
import { estados, provaDisplayTitle, type ProvaResumo } from "@/lib/provas/schema";

export function ProfessorExamList({ school, yearId, editor }: { school: string; yearId: string; editor: string }) {
  return <ExamPages key={JSON.stringify([school, yearId])} school={school} yearId={yearId} editor={editor} />;
}

function ExamPages({ school, yearId, editor }: { school: string; yearId: string; editor: string }) {
  const [pages, setPages] = useState(() => new Map<number, ProvaResumo[]>());
  const [offset, setOffset] = useState(0);
  const [retry, setRetry] = useState(0);
  const rows = pages.get(offset);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    setFailed(false);
    if (rows) return;
    const controller = new AbortController();
    const query = new URLSearchParams({ offset: String(offset) });
    if (yearId) query.set("ano_letivo_id", yearId);
    async function load() {
      try {
        const response = await fetch(`/api/escola/${encodeURIComponent(school)}/provas?${query}`, { cache: "no-store", signal: controller.signal });
        const data = await response.json();
        if (controller.signal.aborted) return;
        if (response.status === 401 || response.status === 403 || !data.permissions?.author) setPages(new Map());
        if (!response.ok || !data.permissions?.author || !Array.isArray(data.provas)) throw new Error();
        setPages(current => new Map(current).set(offset, data.provas));
      } catch {
        if (!controller.signal.aborted) setFailed(true);
      }
    }
    void load();
    return () => controller.abort();
  }, [school, yearId, offset, retry, rows]);

  return <PortalPullToRefresh as="section" onRefresh={() => { setPages(new Map()); setRetry(value => value + 1); }} busy={!rows && !failed} className="space-y-4">
    <Link href={editor} className="inline-flex min-h-11 items-center rounded-xl bg-klasse-gold px-4 text-sm font-semibold text-white">Elaborar ou editar prova</Link>
    {failed ? <p role="alert">Não foi possível consultar as provas. <button onClick={() => setRetry(value => value + 1)} className="min-h-11 underline">Tentar novamente</button></p>
      : !rows ? <p role="status">A carregar provas…</p>
      : !rows.length ? <p>Sem provas nesta página.</p>
      : <ul className="space-y-2">{rows.map(row => <li key={row.id} className="rounded-xl border border-border p-3">
        <p className="font-semibold">{provaDisplayTitle(row)}</p>
        <p className="text-sm text-muted-foreground">{row.classe} · {row.trimestre}.º trimestre · {estados[row.estado]}</p>
      </li>)}</ul>}
    {(offset > 0 || rows?.length === 30) && <div className="flex gap-3">
      <button className="min-h-11" disabled={!offset || !rows} onClick={() => setOffset(value => value - 30)}>Anterior</button>
      <button className="min-h-11" disabled={rows?.length !== 30 || offset >= 9990} onClick={() => setOffset(value => value + 30)}>Seguinte</button>
    </div>}
  </PortalPullToRefresh>;
}
