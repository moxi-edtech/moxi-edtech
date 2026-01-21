"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { 
  Loader2, 
  Search, 
  Filter, 
  Download, 
  UserPlus, 
  ArrowLeft,
  Users, 
  Mail, 
  Phone, 
  Briefcase,
  Calendar,
  Eye,
  Edit,
  IdCard
} from "lucide-react";
import { useVirtualizer } from "@tanstack/react-virtual";

type Professor = {
  id: string;
  user_id: string;
  nome: string;
  email: string | null;
  telefone: string | null;
  cargo: string | null;
  created_at: string;
  profiles?: { numero_login?: string | null } | Array<{ numero_login?: string | null }>;
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
  const scrollParentRef = useRef<HTMLDivElement | null>(null);

  const totalPages = useMemo(() => Math.max(1, Math.ceil(total / pageSize)), [total, pageSize]);
  const hasRows = !loading && items.length > 0;
  const rowVirtualizer = useVirtualizer({
    count: items.length,
    getScrollElement: () => scrollParentRef.current,
    estimateSize: () => 88,
    overscan: 6,
  });

  const load = useCallback(async (p: number) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ 
        q, 
        days, 
        cargo: cargoFilter,
        page: String(p), 
        pageSize: String(pageSize) 
      });
      
      const res = await fetch(`/api/secretaria/professores?${params.toString()}`, { cache: 'force-cache' });
      const json = await res.json();
      
      if (!res.ok || !json?.ok) throw new Error(json?.error || 'Falha ao carregar professores');
      setItems(json.items || []);
      setTotal(json.total || 0);
    } finally {
      setLoading(false);
    }
  }, [cargoFilter, days, pageSize, q]);

  useEffect(() => { load(1); setPage(1); }, [cargoFilter, days, load, q]);
  useEffect(() => { load(page); }, [load, page]);

  // Calcular métricas
  const professoresPorCargo = useMemo(() => {
    const cargos: Record<string, number> = {};
    items.forEach(prof => {
      const cargo = prof.cargo || 'professor';
      cargos[cargo] = (cargos[cargo] || 0) + 1;
    });
    return cargos;
  }, [items]);

  const professoresComEmail = useMemo(() => 
    items.filter(p => p.email).length, 
    [items]
  );

  const professoresComTelefone = useMemo(() => 
    items.filter(p => p.telefone).length, 
    [items]
  );

  const getCargoColor = (cargo: string | null) => {
    switch (cargo) {
      case 'diretor': return 'bg-purple-100 text-purple-700';
      case 'coordenador': return 'bg-blue-100 text-blue-700';
      case 'assistente': return 'bg-green-100 text-green-700';
      default: return 'bg-slate-100 text-slate-700';
    }
  };

  const getCargoIcon = (cargo: string | null) => {
    switch (cargo) {
      case 'diretor': return '👑';
      case 'coordenador': return '📋';
      case 'assistente': return '👨‍💼';
      default: return '👨‍🏫';
    }
  };

  return (
    <div className="w-full max-w-6xl mx-auto space-y-6 p-6 bg-slate-50 rounded-xl">
      {/* --- BOTÃO VOLTAR --- */}
      <div className="flex items-center gap-3">
        <button 
          onClick={() => window.history.back()}
          className="inline-flex items-center gap-2 rounded-lg bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 border border-slate-200 transition-all"
        >
          <ArrowLeft className="h-4 w-4" />
          Voltar
        </button>
      </div>

      {/* --- HEADER COM MÉTRICAS --- */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
          <div className="text-2xl font-bold text-moxinexa-navy">{total}</div>
          <div className="text-sm text-slate-500 flex items-center gap-2">
            <Users className="h-4 w-4" />
            Total de Professores
          </div>
        </div>
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
          <div className="text-2xl font-bold text-orange-600">
            {Object.keys(professoresPorCargo).length}
          </div>
          <div className="text-sm text-slate-500 flex items-center gap-2">
            <Briefcase className="h-4 w-4" />
            Cargos Diferentes
          </div>
        </div>
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
          <div className="text-2xl font-bold text-moxinexa-teal">
            {professoresComEmail}
          </div>
          <div className="text-sm text-slate-500 flex items-center gap-2">
            <Mail className="h-4 w-4" />
            Com E-mail
          </div>
        </div>
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
          <div className="text-2xl font-bold text-green-600">
            {professoresComTelefone}
          </div>
          <div className="text-sm text-slate-500 flex items-center gap-2">
            <Phone className="h-4 w-4" />
            Com Telefone
          </div>
        </div>
      </div>

      {/* --- HEADER DE AÇÃO --- */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
        <div>
          <h1 className="text-2xl font-bold text-moxinexa-navy flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-blue-500" />
            Gestão de Professores
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            {total} professores cadastrados • {Object.keys(professoresPorCargo).length} cargos • {professoresComEmail} com e-mail
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Link
            href="/secretaria/professores/novo"
            className="inline-flex items-center gap-2 rounded-lg bg-moxinexa-teal px-5 py-3 text-sm font-bold text-white hover:bg-teal-600 shadow-lg shadow-teal-900/20 transition-all active:scale-95 transform hover:-translate-y-0.5"
          >
            <UserPlus className="h-4 w-4" />
            Novo Professor
          </Link>
        </div>
      </div>

      {/* --- FILTROS E PESQUISA --- */}
      <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-4">
        <div className="flex gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input 
              type="text" 
              placeholder="Buscar por nome, e-mail ou telefone..." 
              value={q} 
              onChange={(e) => setQ(e.target.value)} 
              className="w-full pl-10 pr-4 py-3 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-moxinexa-teal"
            />
          </div>
          <button 
            onClick={() => load(1)} 
            className="inline-flex items-center gap-2 px-4 py-3 bg-moxinexa-teal text-white rounded-lg hover:bg-teal-600 transition-all"
          >
            <Filter className="h-4 w-4" />
            Filtrar
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <span className="text-sm text-slate-600 font-medium">Período:</span>
          {['1','7','30','90'].map((d) => (
            <button 
              key={d} 
              onClick={() => setDays(d)} 
              className={`inline-flex items-center gap-2 px-3 py-2 rounded-lg border transition-all ${
                days === d 
                  ? 'bg-moxinexa-teal text-white border-moxinexa-teal shadow-lg shadow-teal-900/20' 
                  : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
              }`}
            >
              {d === '1' ? '1 dia' : `${d} dias`}
            </button>
          ))}
          
          <span className="mx-2 h-4 w-px bg-slate-200" />
          
          <span className="text-sm text-slate-600 font-medium">Cargo:</span>
          <select 
            value={cargoFilter} 
            onChange={(e) => setCargoFilter(e.target.value)}
            className="border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-moxinexa-teal"
          >
            <option value="">Todos os cargos</option>
            <option value="professor">Professor</option>
            <option value="diretor">Diretor</option>
            <option value="coordenador">Coordenador</option>
            <option value="assistente">Assistente</option>
          </select>
          
          <span className="mx-2 h-4 w-px bg-slate-200" />
          
          <a 
            href={`/secretaria/professores/export?format=csv&days=${encodeURIComponent(days)}&q=${encodeURIComponent(q)}&cargo=${encodeURIComponent(cargoFilter)}`} 
            className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 transition-all"
            target="_blank"
            rel="noreferrer"
          >
            <Download className="h-4 w-4" />
            Exportar CSV
          </a>
          <a 
            href={`/secretaria/professores/export?format=json&days=${encodeURIComponent(days)}&q=${encodeURIComponent(q)}&cargo=${encodeURIComponent(cargoFilter)}`} 
            className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 transition-all"
            target="_blank"
            rel="noreferrer"
          >
            <Download className="h-4 w-4" />
            Exportar JSON
          </a>
        </div>
      </div>

      {/* --- TABELA DE PROFESSORES --- */}
      <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <div ref={scrollParentRef} className="max-h-[560px] overflow-y-auto">
          <table className="min-w-full table-fixed divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50 sticky top-0 z-10" style={{ display: "table", width: "100%", tableLayout: "fixed" }}>
              <tr>
                <th className="px-4 py-4 text-left text-xs font-bold uppercase tracking-wide text-slate-500">
                  Professor
                </th>
                <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wide text-slate-500">
                  Contato
                </th>
                <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wide text-slate-500">
                  Cargo
                </th>
                <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wide text-slate-500">
                  Cadastrado em
                </th>
                <th className="px-4 py-3 text-center text-xs font-bold uppercase tracking-wide text-slate-500">
                  Ações
                </th>
              </tr>
            </thead>

            <tbody
              className="divide-y divide-slate-100"
              style={
                hasRows
                  ? {
                      position: "relative",
                      display: "block",
                      height: rowVirtualizer.getTotalSize(),
                    }
                  : undefined
              }
            >
              {loading ? (
                <tr style={{ display: "table", width: "100%", tableLayout: "fixed" }}>
                  <td colSpan={5} className="p-8 text-center text-slate-500">
                    <Loader2 className="h-6 w-6 animate-spin mx-auto mb-2" />
                    Carregando professores...
                  </td>
                </tr>
              ) : items.length === 0 ? (
                <tr style={{ display: "table", width: "100%", tableLayout: "fixed" }}>
                  <td colSpan={5} className="p-8 text-center text-slate-500">
                    <Users className="h-12 w-12 mx-auto mb-3 text-slate-300" />
                    Nenhum professor encontrado.
                    <div className="mt-2 text-sm">
                      {q || cargoFilter ? 'Tente ajustar os filtros de busca.' : 'Comece cadastrando o primeiro professor.'}
                    </div>
                  </td>
                </tr>
              ) : (
                rowVirtualizer.getVirtualItems().map((virtualRow) => {
                  const professor = items[virtualRow.index];
                  const numeroLogin = Array.isArray(professor.profiles)
                    ? (professor.profiles?.[0]?.numero_login ?? null)
                    : (professor.profiles?.numero_login ?? null);

                  return (
                    <tr
                      key={professor.user_id || professor.id}
                      className="hover:bg-slate-50 transition-colors"
                      style={{
                        position: "absolute",
                        top: 0,
                        left: 0,
                        transform: `translateY(${virtualRow.start}px)`,
                        width: "100%",
                        display: "table",
                        tableLayout: "fixed",
                      }}
                    >
                      <td className="px-4 py-4 text-slate-900">
                        <div className="font-bold text-moxinexa-navy">
                          {professor.nome}
                        </div>
                        <div className="text-xs text-slate-500 space-y-1 mt-1">
                          {numeroLogin && (
                            <div className="flex items-center gap-1">
                              <IdCard className="h-3 w-3" />
                              <span className="font-mono bg-slate-100 px-2 py-1 rounded">
                                {numeroLogin}
                              </span>
                            </div>
                          )}
                          <div className="font-mono text-slate-400">
                            {(professor.user_id || professor.id).slice(0, 8)}...
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="space-y-2">
                          {professor.email ? (
                            <div className="flex items-center gap-2 text-slate-700">
                              <Mail className="h-4 w-4 text-slate-400" />
                              {professor.email}
                            </div>
                          ) : (
                            <span className="text-slate-400 text-xs">—</span>
                          )}
                          {professor.telefone ? (
                            <div className="flex items-center gap-2 text-slate-700">
                              <Phone className="h-4 w-4 text-slate-400" />
                              {professor.telefone}
                            </div>
                          ) : (
                            <span className="text-slate-400 text-xs">—</span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-bold ${getCargoColor(professor.cargo)}`}>
                          {getCargoIcon(professor.cargo)} {professor.cargo || 'professor'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-slate-600">
                        <div className="flex items-center gap-2">
                          <Calendar className="h-4 w-4 text-slate-400" />
                          {new Date(professor.created_at).toLocaleDateString('pt-AO')}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <div className="flex justify-center gap-1">
                          <Link
                            href={`/secretaria/professores/${professor.user_id || professor.id}`}
                            className="text-blue-600 hover:text-white hover:bg-blue-600 p-2 rounded-lg transition-all"
                            title="Ver detalhes"
                          >
                            <Eye className="w-4 h-4" />
                          </Link>
                          <Link
                            href={`/secretaria/professores/${professor.user_id || professor.id}/editar`}
                            className="text-green-600 hover:text-white hover:bg-green-600 p-2 rounded-lg transition-all"
                            title="Editar professor"
                          >
                            <Edit className="w-4 h-4" />
                          </Link>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
          </div>
        </div>
      </section>

      {/* --- PAGINAÇÃO --- */}
      <div className="flex items-center justify-between bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
        <div className="text-sm text-slate-600">
          Mostrando <strong>{(page - 1) * pageSize + 1}-{Math.min(page * pageSize, total)}</strong> de <strong>{total}</strong> professores
        </div>
        <div className="flex gap-2">
          <button 
            disabled={page <= 1} 
            onClick={() => setPage((p) => Math.max(1, p - 1))} 
            className={`inline-flex items-center gap-2 px-3 py-2 border border-slate-200 rounded-lg text-sm ${
              page <= 1 
                ? 'pointer-events-none opacity-50 text-slate-400' 
                : 'text-slate-700 hover:bg-slate-50'
            }`}
          >
            ← Anterior
          </button>
          
          <span className="px-3 py-2 text-sm text-slate-600">
            Página <strong>{page}</strong> de <strong>{totalPages}</strong>
          </span>
          
          <button 
            disabled={page >= totalPages} 
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))} 
            className={`inline-flex items-center gap-2 px-3 py-2 border border-slate-200 rounded-lg text-sm ${
              page >= totalPages 
                ? 'pointer-events-none opacity-50 text-slate-400' 
                : 'text-slate-700 hover:bg-slate-50'
            }`}
          >
            Próxima →
          </button>
        </div>
      </div>
    </div>
  );
}
