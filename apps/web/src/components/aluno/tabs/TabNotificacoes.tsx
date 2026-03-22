"use client";

import { useEffect, useState } from "react";

type Aviso = { id: string; titulo: string; resumo: string; origem: string; data: string };

export function TabNotificacoes() {
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<Aviso[]>([]);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        setLoading(true);
        const res = await fetch('/api/aluno/avisos', { cache: 'no-store' });
        const json = await res.json();
        if (!res.ok || !json?.ok) throw new Error(json?.error || 'Falha ao carregar avisos');
        if (mounted) setItems(json.avisos || []);
      } catch {
        if (mounted) setItems([]);
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => { mounted = false };
  }, []);

  if (loading) return <div className="h-20 sm:h-24 animate-pulse rounded-2xl bg-slate-100" />;
  if (!items.length) return <div className="text-sm text-slate-500">Nenhum aviso encontrado.</div>;

  return (
    <div className="space-y-3">
      {items.map((a) => (
        <div key={a.id} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="text-xs text-slate-400">
            {a.origem} • {new Date(a.data).toLocaleDateString("pt-PT")}
          </div>
          <div className="mt-1 text-sm font-semibold text-slate-900">{a.titulo}</div>
          <div className="mt-2 text-sm text-slate-600">{a.resumo}</div>
        </div>
      ))}
    </div>
  );
}
