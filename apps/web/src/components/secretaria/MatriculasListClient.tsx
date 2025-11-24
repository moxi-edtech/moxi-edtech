"use client";

import { useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import StatusForm from "./StatusForm";
import TransferForm from "./TransferForm";
import Link from "next/link";
import { 
  Loader2, 
  Search, 
  Filter, 
  Download, 
  UserPlus, 
  ArrowLeft,
  Users, 
  BookOpen, 
  BarChart3,
  RefreshCw,
  ArrowUpDown,
  FileText
} from "lucide-react";

type Item = {
  id: string;
  numero_matricula?: string | null;
  aluno_id: string;
  turma_id: string;
  aluno_nome?: string | null;
  turma_nome?: string | null;
  status: string;
  created_at: string;
};

export default function MatriculasListClient() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const turmaIdFromQuery = searchParams.get('turma_id');
  const statusFromQuery = searchParams.get('status');
  const statusInFromQuery = searchParams.get('status_in');
  const statusFilters = useMemo(() => {
    if (statusInFromQuery) return statusInFromQuery.split(',').map(s => s.trim()).filter(Boolean);
    if (statusFromQuery) return [statusFromQuery];
    return [] as string[];
  }, [statusFromQuery, statusInFromQuery]);

  const replaceParams = (fn: (p: URLSearchParams) => void) => {
    const p = new URLSearchParams(Array.from(searchParams.entries()));
    fn(p);
    const q = p.toString();
    router.replace(q ? `${pathname}?${q}` : pathname);
  };

  const handleRemoveStatus = (s: string) => {
    replaceParams((p) => {
      const currentIn = p.get('status_in');
      const current = p.get('status');
      if (currentIn) {
        const arr = currentIn.split(',').map(v => v.trim()).filter(Boolean).filter(v => v !== s);
        if (arr.length > 0) p.set('status_in', arr.join(','));
        else p.delete('status_in');
      } else if (current === s) {
        p.delete('status');
      }
      p.delete('page');
    });
  };

  const handleClearStatuses = () => {
    replaceParams((p) => {
      p.delete('status');
      p.delete('status_in');
      p.delete('page');
    });
  };

  const [q, setQ] = useState("");
  const [days, setDays] = useState("30");
  const [page, setPage] = useState(1);
  const [pageSize] = useState(20);
  const [items, setItems] = useState<Item[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [showStatusForm, setShowStatusForm] = useState(false);
  const [showTransferForm, setShowTransferForm] = useState(false);
  const [selectedMatricula, setSelectedMatricula] = useState<Item | null>(null);

  const totalPages = useMemo(() => Math.max(1, Math.ceil(total / pageSize)), [total, pageSize]);

  async function load(p = page) {
    setLoading(true);
    try {
      const params = new URLSearchParams({ q, days, page: String(p), pageSize: String(pageSize) });
      if (turmaIdFromQuery) {
        params.set('turma_id', turmaIdFromQuery);
      }
      if (statusFromQuery) {
        params.set('status', statusFromQuery);
      }
      if (statusInFromQuery) {
        params.set('status_in', statusInFromQuery);
      }
      const res = await fetch(`/api/secretaria/matriculas?${params.toString()}`, { cache: 'no-store' });
      const json = await res.json();
      if (!res.ok || !json?.ok) throw new Error(json?.error || 'Falha ao carregar matrículas');
      setItems(json.items || []);
      setTotal(json.total || 0);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(1); setPage(1); }, [q, days, turmaIdFromQuery, statusFromQuery, statusInFromQuery]);
  useEffect(() => { load(page); }, [page]);

  const handleOpenStatusForm = (matricula: Item) => {
    setSelectedMatricula(matricula);
    setShowStatusForm(true);
  };

  const handleOpenTransferForm = (matricula: Item) => {
    setSelectedMatricula(matricula);
    setShowTransferForm(true);
  };

  // Calcular métricas
  const statusCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    items.forEach(item => {
      counts[item.status] = (counts[item.status] || 0) + 1;
    });
    return counts;
  }, [items]);

  const turmasUnicas = useMemo(() => {
    return new Set(items.map(item => item.turma_nome).filter(Boolean));
  }, [items]);

  return (
    <div className="w-full max-w-6xl mx-auto space-y-6 p-6 bg-slate-50 rounded-xl">
      {/* --- BOTÃO VOLTAR --- */}
      <div className="flex items-center gap-3">
        <button 
          onClick={() => router.back()}
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
            Total de Matrículas
          </div>
        </div>
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
          <div className="text-2xl font-bold text-orange-600">
            {Object.keys(statusCounts).length}
          </div>
          <div className="text-sm text-slate-500 flex items-center gap-2">
            <BarChart3 className="h-4 w-4" />
            Status Diferentes
          </div>
        </div>
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
          <div className="text-2xl font-bold text-moxinexa-teal">
            {turmasUnicas.size}
          </div>
          <div className="text-sm text-slate-500 flex items-center gap-2">
            <BookOpen className="h-4 w-4" />
            Turmas
          </div>
        </div>
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
          <div className="text-2xl font-bold text-green-600">
            {statusCounts['ativa'] || 0}
          </div>
          <div className="text-sm text-slate-500 flex items-center gap-2">
            <UserPlus className="h-4 w-4" />
            Matrículas Ativas
          </div>
        </div>
      </div>

      {/* --- HEADER DE AÇÃO --- */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
        <div>
          <h1 className="text-2xl font-bold text-moxinexa-navy flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-blue-500" />
            Gestão de Matrículas
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            {total} matrículas encontradas • {Object.keys(statusCounts).length} status • {turmasUnicas.size} turmas
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Link 
            href="/secretaria/matriculas/nova"
            className="inline-flex items-center gap-2 rounded-lg bg-moxinexa-teal px-5 py-3 text-sm font-bold text-white hover:bg-teal-600 shadow-lg shadow-teal-900/20 transition-all active:scale-95 transform hover:-translate-y-0.5"
          >
            <UserPlus className="h-4 w-4" />
            Nova Matrícula
          </Link>
        </div>
      </div>

      {/* --- FILTROS E CONTROLES --- */}
      <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-4">
        <div className="flex gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input 
              type="text" 
              placeholder="Buscar por status ou UUID..." 
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
          
          <a 
            href={`/secretaria/matriculas/export?format=csv&days=${encodeURIComponent(days)}&q=${encodeURIComponent(q)}`} 
            className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 transition-all"
            target="_blank"
          >
            <Download className="h-4 w-4" />
            Exportar CSV
          </a>
          <a 
            href={`/secretaria/matriculas/export?format=json&days=${encodeURIComponent(days)}&q=${encodeURIComponent(q)}`} 
            className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 transition-all"
            target="_blank"
          >
            <Download className="h-4 w-4" />
            Exportar JSON
          </a>
        </div>

        {/* FILTROS ATIVOS */}
        {(statusFilters.length > 0 || turmaIdFromQuery) && (
          <div className="flex flex-wrap items-center gap-2 pt-3 border-t border-slate-100">
            <span className="text-sm text-slate-600">Filtros ativos:</span>
            {turmaIdFromQuery && (
              <button 
                onClick={() => replaceParams(p => { p.delete('turma_id'); p.delete('page'); })} 
                className="inline-flex items-center gap-1 px-3 py-1 rounded-full border border-violet-200 bg-violet-50 text-violet-700 hover:bg-violet-100 transition-all"
              >
                <span>Turma: {items[0]?.turma_nome ? items[0]?.turma_nome : turmaIdFromQuery}</span>
                <span className="ml-1">×</span>
              </button>
            )}
            {statusFilters.map((s) => (
              <button 
                key={s} 
                onClick={() => handleRemoveStatus(s)}
                className="inline-flex items-center gap-1 px-3 py-1 rounded-full border border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100 transition-all"
              >
                <span>{s}</span>
                <span className="ml-1">×</span>
              </button>
            ))}
            <button 
              onClick={handleClearStatuses}
              className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-slate-200 bg-slate-100 text-slate-700 hover:bg-slate-200 transition-all"
            >
              <RefreshCw className="h-3 w-3" />
              Limpar todos
            </button>
          </div>
        )}
      </div>

      {/* MODAIS */}
      {showStatusForm && selectedMatricula && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl">
            <h2 className="text-xl font-semibold text-moxinexa-navy">Alterar Status da Matrícula</h2>
            <div className="mt-4">
              <StatusForm
                matriculaId={selectedMatricula.id}
                currentStatus={selectedMatricula.status}
                onSuccess={() => {
                  setShowStatusForm(false);
                  load();
                }}
              />
            </div>
          </div>
        </div>
      )}

      {showTransferForm && selectedMatricula && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl">
            <h2 className="text-xl font-semibold text-moxinexa-navy">Transferir Aluno</h2>
            <div className="mt-4">
              <TransferForm
                matriculaId={selectedMatricula.id}
                onSuccess={() => {
                  setShowTransferForm(false);
                  load();
                }}
              />
            </div>
          </div>
        </div>
      )}

      {/* --- TABELA DE MATRÍCULAS --- */}
      <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-4 py-4 text-left text-xs font-bold uppercase tracking-wide text-slate-500">
                  Matrícula
                </th>
                <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wide text-slate-500">
                  Aluno
                </th>
                <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wide text-slate-500">
                  Turma
                </th>
                <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wide text-slate-500">
                  Status
                </th>
                <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wide text-slate-500">
                  Data de Criação
                </th>
                <th className="px-4 py-3 text-center text-xs font-bold uppercase tracking-wide text-slate-500">
                  Ações
                </th>
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-slate-500">
                    <Loader2 className="h-6 w-6 animate-spin mx-auto mb-2" />
                    Carregando matrículas...
                  </td>
                </tr>
              ) : items.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-slate-500">
                    <Users className="h-12 w-12 mx-auto mb-3 text-slate-300" />
                    Nenhuma matrícula encontrada.
                    <div className="mt-2 text-sm">
                      {q || statusFilters.length > 0 || turmaIdFromQuery 
                        ? 'Tente ajustar os filtros de busca.' 
                        : 'Comece criando a primeira matrícula.'
                      }
                    </div>
                  </td>
                </tr>
              ) : (
                items.map((matricula) => (
                  <tr key={matricula.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-4 py-4 text-slate-900">
                      <div className="font-bold text-moxinexa-navy">
                        {matricula.numero_matricula || (
                          <span className="text-slate-400 text-sm">Sem número</span>
                        )}
                      </div>
                      <div className="text-xs text-slate-500 font-mono">
                        {matricula.id.slice(0, 8)}...
                      </div>
                    </td>
                    <td className="px-4 py-3 text-slate-700">
                      {matricula.aluno_nome || (
                        <span className="text-slate-400 text-sm">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {matricula.turma_nome ? (
                        <span className="inline-flex items-center rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-bold text-blue-700">
                          <BookOpen className="w-3 h-3 mr-1" />
                          {matricula.turma_nome}
                        </span>
                      ) : (
                        <span className="text-slate-400 text-sm">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-bold text-emerald-700">
                        {matricula.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-600">
                      {new Date(matricula.created_at).toLocaleDateString('pt-AO')}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <div className="flex justify-center gap-1">
                        <button
                          onClick={() => handleOpenStatusForm(matricula)}
                          className="text-blue-600 hover:text-white hover:bg-blue-600 p-2 rounded-lg transition-all"
                          title="Alterar status"
                        >
                          <RefreshCw className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleOpenTransferForm(matricula)}
                          className="text-orange-600 hover:text-white hover:bg-orange-600 p-2 rounded-lg transition-all"
                          title="Transferir"
                        >
                          <ArrowUpDown className="w-4 h-4" />
                        </button>
                        <Link
                          href={`/api/secretaria/matriculas/${matricula.id}/declaracao`}
                          target="_blank"
                          className="text-green-600 hover:text-white hover:bg-green-600 p-2 rounded-lg transition-all"
                          title="Gerar Declaração"
                        >
                          <FileText className="w-4 h-4" />
                        </Link>
                        <Link
                          href={`/api/secretaria/matriculas/${matricula.id}/frequencia`}
                          target="_blank"
                          className="text-purple-600 hover:text-white hover:bg-purple-600 p-2 rounded-lg transition-all"
                          title="Gerar Frequência"
                        >
                          <FileText className="w-4 h-4" />
                        </Link>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* --- PAGINAÇÃO --- */}
      <div className="flex items-center justify-between bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
        <div className="text-sm text-slate-600">
          Mostrando <strong>{(page - 1) * pageSize + 1}-{Math.min(page * pageSize, total)}</strong> de <strong>{total}</strong> matrículas
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