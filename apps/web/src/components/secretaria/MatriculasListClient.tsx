"use client";

import { useEffect, useMemo, useState } from "react";

type Item = { id: string; aluno_id: string; turma_id: string; status: string; created_at: string };

export default function MatriculasListClient() {
  const [q, setQ] = useState("");
  const [days, setDays] = useState("30");
  const [page, setPage] = useState(1);
  const [pageSize] = useState(20);
  const [items, setItems] = useState<Item[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);

  const totalPages = useMemo(() => Math.max(1, Math.ceil(total / pageSize)), [total, pageSize]);

  async function load(p = page) {
    setLoading(true);
    try {
      const params = new URLSearchParams({ q, days, page: String(p), pageSize: String(pageSize) });
      const res = await fetch(`/api/secretaria/matriculas?${params.toString()}`, { cache: 'no-store' });
      const json = await res.json();
      if (!res.ok || !json?.ok) throw new Error(json?.error || 'Falha ao carregar matrículas');
      setItems(json.items || []);
      setTotal(json.total || 0);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(1); setPage(1); }, [q, days]);
  useEffect(() => { load(page); }, [page]);

  return (
    <div className="bg-white rounded-xl shadow border p-5">
      <div className="flex items-end justify-between gap-4 mb-4">
        <div>
          <h1 className="text-lg font-semibold">Matrículas</h1>
          <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
            <span className="text-gray-500">Período:</span>
            {['1','7','30','90'].map((d) => (
              <button key={d} onClick={()=>setDays(d)} className={`px-2.5 py-1 rounded border ${days === d ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-100'}`}>{d === '1' ? '1 dia' : `${d} dias`}</button>
            ))}
            <span className="mx-2 h-4 w-px bg-gray-200" />
            <a href={`/secretaria/matriculas/export?format=csv&days=${encodeURIComponent(days)}&q=${encodeURIComponent(q)}`} className="px-2.5 py-1 rounded border bg-white text-gray-700 hover:bg-gray-100" target="_blank">Exportar CSV</a>
            <a href={`/secretaria/matriculas/export?format=json&days=${encodeURIComponent(days)}&q=${encodeURIComponent(q)}`} className="px-2.5 py-1 rounded border bg-white text-gray-700 hover:bg-gray-100" target="_blank">Exportar JSON</a>
          </div>
        </div>
        <div className="flex gap-2 text-sm">
          <input type="text" placeholder="Buscar (status/UUID)" value={q} onChange={(e)=>setQ(e.target.value)} className="border rounded px-2 py-1" />
          <button onClick={()=>load(1)} className="px-3 py-1.5 rounded bg-blue-600 text-white">Filtrar</button>
        </div>
      </div>

      {loading ? (
        <div>Carregando…</div>
      ) : (
        <>
          <table className="min-w-full text-sm">
            <thead>
              <tr className="text-left text-gray-500 border-b">
                <th className="py-2 pr-4">ID</th>
                <th className="py-2 pr-4">Aluno</th>
                <th className="py-2 pr-4">Turma</th>
                <th className="py-2 pr-4">Status</th>
                <th className="py-2 pr-4">Criado em</th>
              </tr>
            </thead>
            <tbody>
              {items.map((m) => (
                <tr key={m.id} className="border-b last:border-b-0">
                  <td className="py-2 pr-4">{m.id}</td>
                  <td className="py-2 pr-4">{m.aluno_id}</td>
                  <td className="py-2 pr-4">{m.turma_id}</td>
                  <td className="py-2 pr-4">{m.status}</td>
                  <td className="py-2 pr-4">{new Date(m.created_at).toLocaleString()}</td>
                </tr>
              ))}
              {items.length === 0 && (
                <tr><td colSpan={5} className="py-6 text-center text-gray-500">Nenhuma matrícula encontrada.</td></tr>
              )}
            </tbody>
          </table>
          <div className="mt-4 flex items-center justify-between text-sm">
            <div className="text-gray-600">Total: {total}</div>
            <div className="flex gap-2">
              <button disabled={page<=1} onClick={()=>setPage((p)=>Math.max(1, p-1))} className="px-2 py-1 border rounded disabled:opacity-50">Anterior</button>
              <span>Página {page} de {totalPages}</span>
              <button disabled={page>=totalPages} onClick={()=>setPage((p)=>Math.min(totalPages, p+1))} className="px-2 py-1 border rounded disabled:opacity-50">Próxima</button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

