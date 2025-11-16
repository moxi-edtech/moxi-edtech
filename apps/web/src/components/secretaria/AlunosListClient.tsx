"use client";

import { useEffect, useMemo, useState } from "react";

type Item = {
  id: string;
  nome: string;
  email: string | null;
  created_at: string;
  // Supabase may return one-to-one as object or array; type as any to be safe
  profiles?: { numero_login?: string } | Array<{ numero_login?: string }>;
};

export default function AlunosListClient() {
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
      const res = await fetch(`/api/secretaria/alunos?${params.toString()}`, { cache: 'no-store' });
      const json = await res.json();
      if (!res.ok || !json?.ok) throw new Error(json?.error || 'Falha ao carregar alunos');
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
          <h1 className="text-lg font-semibold">Alunos</h1>
          <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
            <span className="text-gray-500">Período:</span>
            {['1','7','30','90'].map((d) => (
              <button key={d} onClick={()=>setDays(d)} className={`px-2.5 py-1 rounded border ${days === d ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-100'}`}>{d === '1' ? '1 dia' : `${d} dias`}</button>
            ))}
            <span className="mx-2 h-4 w-px bg-gray-200" />
            <a href={`/secretaria/alunos/export?format=csv&days=${encodeURIComponent(days)}&q=${encodeURIComponent(q)}`} className="px-2.5 py-1 rounded border bg-white text-gray-700 hover:bg-gray-100" target="_blank">Exportar CSV</a>
            <a href={`/secretaria/alunos/export?format=json&days=${encodeURIComponent(days)}&q=${encodeURIComponent(q)}`} className="px-2.5 py-1 rounded border bg-white text-gray-700 hover:bg-gray-100" target="_blank">Exportar JSON</a>
          </div>
        </div>
        <div className="flex gap-2 text-sm">
          <input type="text" placeholder="Buscar (nome/e-mail/UUID)" value={q} onChange={(e)=>setQ(e.target.value)} className="border rounded px-2 py-1" />
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
                <th className="py-2 pr-4">Matrícula</th>
                <th className="py-2 pr-4">Nome</th>
                <th className="py-2 pr-4">E-mail</th>
                <th className="py-2 pr-4">Criado em</th>
                <th className="py-2 pr-4">Ações</th>
              </tr>
            </thead>
            <tbody>
              {items.map((a) => (
                <tr key={a.id} className="border-b last:border-b-0">
                  <td className="py-2 pr-4">{
                    Array.isArray(a.profiles)
                      ? (a.profiles?.[0]?.numero_login ?? '—')
                      : (a.profiles as any)?.numero_login ?? '—'
                  }</td>
                  <td className="py-2 pr-4">{a.nome}</td>
                  <td className="py-2 pr-4">{a.email ?? '—'}</td>
                  <td className="py-2 pr-4">{new Date(a.created_at).toLocaleString()}</td>
                  <td className="py-2 pr-4">
                    <a
                      href={`/secretaria/matriculas/nova?alunoId=${encodeURIComponent(a.id)}`}
                      className="inline-flex items-center px-2.5 py-1 border border-emerald-600 text-emerald-700 rounded hover:bg-emerald-50 text-xs"
                    >
                      Matricular
                    </a>
                  </td>
                </tr>
              ))}
              {items.length === 0 && (
                <tr><td colSpan={4} className="py-6 text-center text-gray-500">Nenhum aluno encontrado.</td></tr>
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
