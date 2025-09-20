'use client';

import { useEffect, useState } from 'react';

type ApiResponse = {
  ok: boolean;
  env: { hasUrl: boolean; hasAnonKey: boolean };
  cookies: { names: string[] };
  session: { expires_at?: number | null; expires_in?: number | null } | null;
  user:
    | { id: string; email: string | null; role: string | null; escola_id: string | null }
    | null;
  errors: { sessionError: string | null; userError: string | null };
  note?: string;
};

export default function DebugSessionPage() {
  const [data, setData] = useState<ApiResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/debug/session?verbose=1', { cache: 'no-store' });
      const json = (await res.json()) as ApiResponse;
      if (!res.ok || !json.ok) {
        throw new Error('Falha ao buscar sessão.');
      }
      setData(json);
    } catch (e: any) {
      setError(e?.message || 'Erro inesperado');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  return (
    <main className="min-h-screen bg-slate-50 p-6">
      <div className="mx-auto max-w-3xl space-y-4">
        <header className="flex items-center justify-between">
          <h1 className="text-xl font-semibold text-slate-900">Debug da Sessão</h1>
          <div className="flex items-center gap-2">
            <a
              href="/api/debug/session?verbose=1"
              target="_blank"
              className="text-sm text-sky-700 hover:underline"
            >
              Ver JSON
            </a>
            <button
              onClick={() => load()}
              className="rounded-md bg-slate-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-slate-700"
            >
              Recarregar
            </button>
          </div>
        </header>

        {loading && (
          <div className="rounded-lg border border-slate-200 bg-white p-4">Carregando…</div>
        )}

        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-red-700">
            {error}
          </div>
        )}

        {data && (
          <div className="grid gap-4 md:grid-cols-2">
            <section className="rounded-lg border border-slate-200 bg-white p-4">
              <h2 className="mb-2 text-sm font-semibold text-slate-600">Ambiente</h2>
              <ul className="text-sm text-slate-800">
                <li>URL configurada: {String(data.env.hasUrl)}</li>
                <li>Anon key configurada: {String(data.env.hasAnonKey)}</li>
              </ul>
            </section>

            <section className="rounded-lg border border-slate-200 bg-white p-4">
              <h2 className="mb-2 text-sm font-semibold text-slate-600">Cookies</h2>
              <div className="text-sm text-slate-800 break-words">
                {data.cookies.names.length === 0 ? (
                  <span>Nenhum cookie encontrado.</span>
                ) : (
                  <ul className="list-disc pl-5">
                    {data.cookies.names.map((n) => (
                      <li key={n}>{n}</li>
                    ))}
                  </ul>
                )}
              </div>
            </section>

            <section className="rounded-lg border border-slate-200 bg-white p-4">
              <h2 className="mb-2 text-sm font-semibold text-slate-600">Sessão</h2>
              <div className="text-sm text-slate-800">
                {data.session ? (
                  <ul className="space-y-1">
                    <li>expires_at: {String(data.session.expires_at ?? '—')}</li>
                    <li>expires_in: {String(data.session.expires_in ?? '—')}</li>
                  </ul>
                ) : (
                  <span>Nenhuma sessão ativa.</span>
                )}
              </div>
            </section>

            <section className="rounded-lg border border-slate-200 bg-white p-4">
              <h2 className="mb-2 text-sm font-semibold text-slate-600">Usuário</h2>
              <div className="text-sm text-slate-800">
                {data.user ? (
                  <ul className="space-y-1">
                    <li>id: {data.user.id}</li>
                    <li>email: {data.user.email}</li>
                    <li>role: {String(data.user.role)}</li>
                    <li>escola_id: {String(data.user.escola_id)}</li>
                  </ul>
                ) : (
                  <span>Nenhum usuário logado.</span>
                )}
              </div>
            </section>

            {(data.errors.sessionError || data.errors.userError) && (
              <section className="rounded-lg border border-yellow-200 bg-yellow-50 p-4 md:col-span-2">
                <h2 className="mb-2 text-sm font-semibold text-yellow-800">Erros</h2>
                <ul className="text-sm text-yellow-900 space-y-1">
                  {data.errors.sessionError && <li>sessionError: {data.errors.sessionError}</li>}
                  {data.errors.userError && <li>userError: {data.errors.userError}</li>}
                </ul>
              </section>
            )}
          </div>
        )}
      </div>
    </main>
  );
}

