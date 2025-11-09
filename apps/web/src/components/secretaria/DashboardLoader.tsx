"use client";

import { useEffect, useState } from "react";

type DashboardData = {
  ok: boolean;
  counts: { alunos: number; matriculas: number };
  avisos_recentes: Array<{ id: string; titulo: string; resumo: string; origem: string; data: string }>;
};

export default function SecretariaDashboardLoader() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        setLoading(true);
        setError(null);
        const res = await fetch('/api/secretaria/dashboard', { cache: 'no-store' });
        const json = (await res.json()) as DashboardData;
        if (!res.ok || !json?.ok) throw new Error((json as any)?.error || 'Falha ao carregar dashboard');
        if (mounted) setData(json);
      } catch (e) {
        if (mounted) setError(e instanceof Error ? e.message : String(e));
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => { mounted = false };
  }, []);

  if (loading) return <div>Carregando painel…</div>;
  if (error) return <div className="text-red-600">Erro: {error}</div>;

  return (
    <div className="space-y-6">
      <div className="grid md:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-xl shadow border">
          <h2 className="text-gray-600 text-sm font-medium">Alunos</h2>
          <p className="text-3xl font-bold text-indigo-600 mt-2">{data?.counts.alunos ?? 0}</p>
          <p className="text-gray-400 text-sm">Total cadastrados</p>
        </div>
        <div className="bg-white p-6 rounded-xl shadow border">
          <h2 className="text-gray-600 text-sm font-medium">Matrículas</h2>
          <p className="text-3xl font-bold text-indigo-600 mt-2">{data?.counts.matriculas ?? 0}</p>
          <p className="text-gray-400 text-sm">Ativas e históricas</p>
        </div>
        <div className="bg-white p-6 rounded-xl shadow border">
          <h2 className="text-gray-600 text-sm font-medium">Avisos recentes</h2>
          {data?.avisos_recentes?.length ? (
            <ul className="mt-2 space-y-1 text-sm">
              {data!.avisos_recentes.map((a) => (
                <li key={a.id} className="text-gray-700">
                  <span className="text-gray-500 mr-2">{new Date(a.data).toLocaleDateString()}:</span>
                  <span className="font-medium">{a.titulo}</span>
                </li>
              ))}
            </ul>
          ) : (
            <div className="text-sm text-gray-600 mt-2">Nenhum aviso.</div>
          )}
        </div>
      </div>
    </div>
  );
}

