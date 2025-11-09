"use client";

import { useEffect, useState } from "react";

type Aviso = { id: string; titulo: string; resumo: string; origem: string; data: string };

export function AvisosList() {
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

  if (loading) return <div>Carregando avisos…</div>;
  if (!items.length) return <div className="text-sm text-gray-600">Nenhum aviso encontrado.</div>;

  return (
    <div className="space-y-3">
      {items.map((a) => (
        <div key={a.id} className="p-4 rounded border bg-white">
          <div className="text-sm text-gray-500">{a.origem} • {new Date(a.data).toLocaleDateString()}</div>
          <div className="font-medium">{a.titulo}</div>
          <div className="text-sm text-gray-600">{a.resumo}</div>
        </div>
      ))}
    </div>
  );
}
