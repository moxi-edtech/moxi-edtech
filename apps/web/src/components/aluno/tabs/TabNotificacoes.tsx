"use client";
import { PortalPullToRefresh } from "@/components/portal/ui/PortalPullToRefresh";


import { useEffect, useState } from "react";
import { Bell, ChevronRight } from "lucide-react";
import { PortalSheet } from "@/components/portal/ui/PortalSheet";
import { usePortalDrawerNavigation } from "@/components/portal/ui/PortalDrawerNavigator";

type Aviso = { id: string; titulo: string; resumo: string; origem: string; data: string };

export function TabNotificacoes() {
  const navigation = usePortalDrawerNavigation();
  const read = navigation?.read;
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [items, setItems] = useState<Aviso[]>([]);
  const [retry, setRetry] = useState(0);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = items.find(item => item.id === selectedId);

  useEffect(() => {
    const ctrl = new AbortController();
    setLoading(true);
    setFailed(false);
    void (async () => {
      try {
        const res = await (read ? read("/api/aluno/avisos", { signal: ctrl.signal, fresh: retry > 0 }) : fetch("/api/aluno/avisos", { cache: "no-store", signal: ctrl.signal }));
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
  }, [retry, read]);

  const openNotice = (notice: Aviso) => {
    if (!navigation) { setSelectedId(notice.id); return; }
    navigation.push({ id: `notice:${notice.id}`, title: notice.titulo || "Aviso", description: notice.origem || "Comunicação da escola", content: <>
      <p className="whitespace-pre-wrap break-words text-sm leading-relaxed">{notice.resumo || "Sem informação adicional."}</p>
      {notice.data && !Number.isNaN(Date.parse(notice.data)) && <p className="text-xs text-muted-foreground">{new Date(notice.data).toLocaleDateString("pt-AO")}</p>}
    </> });
  };

  return (
    <PortalPullToRefresh as="section" onRefresh={() => { setLoading(true); setRetry(value => value + 1); }} busy={loading} disabled={Boolean(selectedId)} className="space-y-6" aria-label="Avisos">
      {!navigation && <div className="space-y-1">
        <h1 id="aluno-avisos-title" className="text-2xl font-semibold tracking-tight text-primary">Avisos</h1>
      </div>}
      {loading ? (
        <p role="status" className="rounded-xl bg-muted p-4 text-sm text-muted-foreground">A carregar avisos…</p>
      ) : failed ? (
        <div role="alert" className="rounded-xl border border-border bg-card p-4">
          <p className="text-sm font-semibold text-foreground">Não foi possível consultar os avisos.</p>
          <button type="button" onClick={() => setRetry(v => v + 1)}
            className="mt-3 min-h-11 rounded-xl border border-border bg-card px-4 text-sm font-semibold text-primary hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring">
            Tentar novamente
          </button>
        </div>
      ) : items.length === 0 ? (
        <div className="flex items-center gap-3 rounded-xl border border-border bg-card p-4">
          <Bell aria-hidden="true" className="h-5 w-5 text-primary" />
          <p className="text-sm text-muted-foreground">Ainda não há avisos publicados.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {items.map(a => (
            <button type="button" key={a.id} onClick={()=>openNotice(a)} aria-haspopup="dialog" className="klasse-portal-press flex w-full min-w-0 items-start gap-3 rounded-xl border border-border bg-card p-3 text-left sm:p-4">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-emerald/10 text-emerald dark:text-emerald-300"><Bell className="h-4 w-4" aria-hidden="true" /></span>
              <div className="min-w-0 flex-1 break-words">
              <h2 className="text-sm font-semibold text-foreground">{a.titulo}</h2>
              {a.resumo && <p className="mt-2 line-clamp-2 text-sm text-muted-foreground">{a.resumo}</p>}
              <p className="mt-2 text-xs text-muted-foreground">
                {[a.origem, a.data && !Number.isNaN(Date.parse(a.data)) ? new Date(a.data).toLocaleDateString("pt-AO") : ""].filter(Boolean).join(" · ")}
              </p>
              </div>
              <ChevronRight className="mt-1 size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
            </button>
          ))}
        </div>
      )}
      {!navigation && <PortalSheet open={Boolean(selected)&&!failed&&!loading} onClose={()=>setSelectedId(null)} title={selected?.titulo || "Aviso"} description={selected?.origem || "Comunicação da escola"} size="expanded">
        <p className="whitespace-pre-wrap break-words text-sm leading-relaxed">{selected?.resumo || "Sem informação adicional."}</p>
        {selected?.data && !Number.isNaN(Date.parse(selected.data)) && <p className="text-xs text-muted-foreground">{new Date(selected.data).toLocaleDateString("pt-AO")}</p>}
      </PortalSheet>}
    </PortalPullToRefresh>
  );
}
