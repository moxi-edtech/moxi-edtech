"use client";

import { useEffect, useMemo, useState } from "react";

type Professor = {
  id: string;
  user_id: string;
  nome: string;
  email: string | null;
  telefone: string | null;
  cargo: string | null;
  created_at: string;
  // Para compatibilidade com a estrutura existente
  profiles?: { numero_login?: string } | Array<{ numero_login?: string }>;
};

export default function ProfessoresListClient() {
  const [q, setQ] = useState("");
  const [days, setDays] = useState("30");
  const [cargoFilter, setCargoFilter] = useState<string>("");
  const [page, setPage] = useState(1);
  const [pageSize] = useState(20);
  const [items, setItems] = useState<Professor[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);

  const totalPages = useMemo(() => Math.max(1, Math.ceil(total / pageSize)), [total, pageSize]);

  async function load(p = page) {
    setLoading(true);
    try {
      const params = new URLSearchParams({ 
        q, 
        days, 
        cargo: cargoFilter,
        page: String(p), 
        pageSize: String(pageSize) 
      });
      
      const res = await fetch(`/api/secretaria/professores?${params.toString()}`, { cache: 'no-store' });
      const json = await res.json();
      
      if (!res.ok || !json?.ok) throw new Error(json?.error || 'Falha ao carregar professores');
      setItems(json.items || []);
      setTotal(json.total || 0);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(1); setPage(1); }, [q, days, cargoFilter]);
  useEffect(() => { load(page); }, [page]);

  return (
    <div className="bg-white rounded-xl shadow border p-5">
      <div className="flex items-end justify-between gap-4 mb-4">
        <div>
          <h1 className="text-lg font-semibold">Professores</h1>
          <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
            <span className="text-gray-500">Período:</span>
            {['1','7','30','90'].map((d) => (
              <button 
                key={d} 
                onClick={()=>setDays(d)} 
                className={`px-2.5 py-1 rounded border ${
                  days === d ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-100'
                }`}
              >
                {d === '1' ? '1 dia' : `${d} dias`}
              </button>
            ))}
            
            <span className="mx-2 h-4 w-px bg-gray-200" />
            
            <span className="text-gray-500">Cargo:</span>
            <select 
              value={cargoFilter} 
              onChange={(e) => setCargoFilter(e.target.value)}
              className="px-2.5 py-1 rounded border border-gray-200 bg-white text-gray-700"
            >
              <option value="">Todos</option>
              <option value="professor">Professor</option>
              <option value="diretor">Diretor</option>
              <option value="coordenador">Coordenador</option>
              <option value="assistente">Assistente</option>
            </select>
            
            <span className="mx-2 h-4 w-px bg-gray-200" />
            
            <a 
              href={`/secretaria/professores/export?format=csv&days=${encodeURIComponent(days)}&q=${encodeURIComponent(q)}&cargo=${encodeURIComponent(cargoFilter)}`} 
              className="px-2.5 py-1 rounded border bg-white text-gray-700 hover:bg-gray-100" 
              target="_blank"
            >
              Exportar CSV
            </a>
            <a 
              href={`/secretaria/professores/export?format=json&days=${encodeURIComponent(days)}&q=${encodeURIComponent(q)}&cargo=${encodeURIComponent(cargoFilter)}`} 
              className="px-2.5 py-1 rounded border bg-white text-gray-700 hover:bg-gray-100" 
              target="_blank"
            >
              Exportar JSON
            </a>
          </div>
        </div>
        <div className="flex gap-2 text-sm">
          <input 
            type="text" 
            placeholder="Buscar (nome/e-mail/telefone)" 
            value={q} 
            onChange={(e)=>setQ(e.target.value)} 
            className="border rounded px-2 py-1 w-64" 
          />
          <button 
            onClick={()=>load(1)} 
            className="px-3 py-1.5 rounded bg-blue-600 text-white hover:bg-blue-700"
          >
            Filtrar
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center items-center py-8">
          <div className="text-center">
            <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-2"></div>
            <p className="text-sm text-gray-600">Carregando professores...</p>
          </div>
        </div>
      ) : (
        <>
          <table className="min-w-full text-sm">
            <thead>
              <tr className="text-left text-gray-500 border-b">
                <th className="py-2 pr-4">Nº Login</th>
                <th className="py-2 pr-4">Nome</th>
                <th className="py-2 pr-4">E-mail</th>
                <th className="py-2 pr-4">Telefone</th>
                <th className="py-2 pr-4">Cargo</th>
                <th className="py-2 pr-4">Criado em</th>
                <th className="py-2 pr-4">Ações</th>
              </tr>
            </thead>
            <tbody>
              {items.map((professor) => (
                <tr key={professor.user_id || professor.id} className="border-b last:border-b-0 hover:bg-gray-50">
                  <td className="py-2 pr-4 font-mono text-xs">
                    {Array.isArray(professor.profiles)
                      ? (professor.profiles?.[0]?.numero_login ?? '—')
                      : (professor.profiles as any)?.numero_login ?? '—'
                    }
                  </td>
                  <td className="py-2 pr-4 font-medium">{professor.nome}</td>
                  <td className="py-2 pr-4">{professor.email ?? '—'}</td>
                  <td className="py-2 pr-4">{professor.telefone ?? '—'}</td>
                  <td className="py-2 pr-4">
                    <span className={`px-2 py-1 rounded-full text-xs capitalize ${
                      professor.cargo === 'diretor' ? 'bg-purple-100 text-purple-800' :
                      professor.cargo === 'coordenador' ? 'bg-blue-100 text-blue-800' :
                      professor.cargo === 'assistente' ? 'bg-green-100 text-green-800' :
                      'bg-gray-100 text-gray-800'
                    }`}>
                      {professor.cargo ?? 'professor'}
                    </span>
                  </td>
                  <td className="py-2 pr-4 text-gray-500">
                    {new Date(professor.created_at).toLocaleDateString('pt-AO')}
                  </td>
                  <td className="py-2 pr-4">
                    <div className="flex gap-2">
                      <a
                        href={`/secretaria/professores/${professor.user_id || professor.id}`}
                        className="inline-flex items-center px-2.5 py-1 border border-gray-300 text-gray-700 rounded hover:bg-gray-50 text-xs"
                      >
                        Ver
                      </a>
                      <a
                        href={`/secretaria/professores/${professor.user_id || professor.id}/editar`}
                        className="inline-flex items-center px-2.5 py-1 border border-blue-600 text-blue-700 rounded hover:bg-blue-50 text-xs"
                      >
                        Editar
                      </a>
                    </div>
                  </td>
                </tr>
              ))}
              {items.length === 0 && (
                <tr>
                  <td colSpan={7} className="py-6 text-center text-gray-500">
                    Nenhum professor encontrado.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
          
          <div className="mt-4 flex items-center justify-between text-sm">
            <div className="text-gray-600">
              Total: {total} professor{total !== 1 ? 'es' : ''}
            </div>
            <div className="flex gap-2">
              <button 
                disabled={page <= 1} 
                onClick={() => setPage((p) => Math.max(1, p - 1))} 
                className="px-3 py-1 border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Anterior
              </button>
              <span className="px-3 py-1 text-gray-700">
                Página {page} de {totalPages}
              </span>
              <button 
                disabled={page >= totalPages} 
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))} 
                className="px-3 py-1 border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Próxima
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}