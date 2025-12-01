"use client";

import { useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import Link from "next/link";
import { 
  Loader2, Search, Filter, Download, UserPlus, ArrowLeft, 
  Users, BookOpen, BarChart3, RefreshCw, ArrowUpDown, FileText,
  UserCheck, MoreVertical, CheckCircle2, XCircle
} from "lucide-react";

// Importa os modais (Assumindo que estão na mesma pasta)
import StatusForm from "./StatusForm";
import TransferForm from "./TransferForm";

// --- TIPOS ---
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

// --- MICRO-COMPONENTES UI ---
function KpiCard({ title, value, icon: Icon, colorClass, bgClass }: any) {
  return (
    <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-start justify-between hover:shadow-md transition-all">
      <div>
        <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">{title}</p>
        <p className="text-2xl font-black text-slate-800 mt-1">{value}</p>
      </div>
      <div className={`p-3 rounded-xl ${bgClass} ${colorClass}`}>
        <Icon className="h-5 w-5" />
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    ativa: "bg-emerald-50 text-emerald-700 border-emerald-200",
    pendente: "bg-amber-50 text-amber-700 border-amber-200",
    cancelada: "bg-rose-50 text-rose-700 border-rose-200",
    transferida: "bg-blue-50 text-blue-700 border-blue-200",
  };
  
  const style = styles[status.toLowerCase()] || "bg-slate-50 text-slate-600 border-slate-200";

  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold border ${style} capitalize`}>
      {status === 'ativa' && <CheckCircle2 className="w-3 h-3 mr-1"/>}
      {status === 'cancelada' && <XCircle className="w-3 h-3 mr-1"/>}
      {status}
    </span>
  );
}

// --- COMPONENTE PRINCIPAL ---

export default function MatriculasListClient() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  
  // Filtros URL
  const turmaIdFromQuery = searchParams.get('turma_id');
  const statusFromQuery = searchParams.get('status');
  const statusInFromQuery = searchParams.get('status_in');
  const statusFilters = useMemo(() => {
    if (statusInFromQuery) return statusInFromQuery.split(',').map(s => s.trim()).filter(Boolean);
    if (statusFromQuery) return [statusFromQuery];
    return [] as string[];
  }, [statusFromQuery, statusInFromQuery]);

  // Estados Locais
  const [q, setQ] = useState("");
  const [days, setDays] = useState("30");
  const [page, setPage] = useState(1);
  const [pageSize] = useState(20);
  const [items, setItems] = useState<Item[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  
  // Modais
  const [showStatusForm, setShowStatusForm] = useState(false);
  const [showTransferForm, setShowTransferForm] = useState(false);
  const [selectedMatricula, setSelectedMatricula] = useState<Item | null>(null);

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  // --- LÓGICA ---
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

  async function load(p = page) {
    setLoading(true);
    try {
      const params = new URLSearchParams({ q, days, page: String(p), pageSize: String(pageSize) });
      if (turmaIdFromQuery) params.set('turma_id', turmaIdFromQuery);
      if (statusFromQuery) params.set('status', statusFromQuery);
      if (statusInFromQuery) params.set('status_in', statusInFromQuery);
      
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

  // Métricas
  const statusCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    items.forEach(item => { counts[item.status] = (counts[item.status] || 0) + 1; });
    return counts;
  }, [items]);

  const turmasUnicas = useMemo(() => new Set(items.map(item => item.turma_nome).filter(Boolean)), [items]);

  // --- RENDER ---
  return (
    <div className="w-full max-w-7xl mx-auto p-6 space-y-8 pb-20">
      
      {/* 1. HEADER & AÇÕES */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <button 
            onClick={() => router.back()}
            className="flex items-center gap-2 text-xs font-bold text-slate-400 hover:text-slate-600 transition-colors mb-2"
          >
            <ArrowLeft size={14}/> Voltar
          </button>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">Gestão de Matrículas</h1>
          <p className="text-sm font-medium text-slate-500">Administre o estado e turmas dos alunos.</p>
        </div>
        
        <Link 
          href="/secretaria/matriculas/nova"
          className="flex items-center gap-2 px-5 py-2.5 bg-slate-900 text-white rounded-xl text-sm font-bold hover:bg-slate-800 shadow-lg shadow-slate-900/20 transition hover:-translate-y-0.5"
        >
          <UserPlus size={18} />
          Nova Matrícula
        </Link>
      </div>

      {/* 2. KPIS */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard title="Total Matrículas" value={total} icon={Users} colorClass="text-blue-600" bgClass="bg-blue-50" />
        <KpiCard title="Matrículas Ativas" value={statusCounts['ativa'] || 0} icon={UserCheck} colorClass="text-emerald-600" bgClass="bg-emerald-50" />
        <KpiCard title="Turmas Envolvidas" value={turmasUnicas.size} icon={BookOpen} colorClass="text-purple-600" bgClass="bg-purple-50" />
        <KpiCard title="Status Diferentes" value={Object.keys(statusCounts).length} icon={BarChart3} colorClass="text-orange-600" bgClass="bg-orange-50" />
      </div>

      {/* 3. CONTEÚDO PRINCIPAL */}
      <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
        
        {/* Toolbar */}
        <div className="p-5 border-b border-slate-100 bg-slate-50/50 flex flex-col xl:flex-row gap-4 justify-between items-start xl:items-center">
          
          {/* Search & Filters */}
          <div className="flex flex-col sm:flex-row gap-3 w-full xl:w-auto">
            <div className="relative w-full sm:max-w-xs">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <input 
                type="text" 
                placeholder="Buscar por nome, BI..." 
                value={q} 
                onChange={(e) => setQ(e.target.value)}
                className="w-full pl-10 pr-4 py-2 bg-white border border-slate-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500 transition-shadow"
              />
            </div>
            
            <div className="flex gap-2 overflow-x-auto pb-2 sm:pb-0">
                {['1','7','30','90'].map((d) => (
                    <button 
                    key={d} 
                    onClick={() => setDays(d)}
                    className={`whitespace-nowrap px-3 py-2 rounded-lg text-xs font-bold border transition-all ${
                        days === d 
                        ? 'bg-slate-800 text-white border-slate-800' 
                        : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                    }`}
                    >
                    {d === '1' ? 'Hoje' : `${d} dias`}
                    </button>
                ))}
            </div>
          </div>

          {/* Export Actions */}
          <div className="flex gap-2">
            <a href={`/secretaria/matriculas/export?format=csv&days=${days}&q=${q}`} target="_blank" className="flex items-center gap-2 px-3 py-2 bg-white border border-slate-200 text-slate-600 rounded-lg text-xs font-bold hover:bg-slate-50 transition">
              <Download className="h-3 w-3" /> CSV
            </a>
            <a href={`/secretaria/matriculas/export?format=json&days=${days}&q=${q}`} target="_blank" className="flex items-center gap-2 px-3 py-2 bg-white border border-slate-200 text-slate-600 rounded-lg text-xs font-bold hover:bg-slate-50 transition">
              <Download className="h-3 w-3" /> JSON
            </a>
          </div>
        </div>

        {/* Tags de Filtros Ativos */}
        {(statusFilters.length > 0 || turmaIdFromQuery) && (
          <div className="px-5 py-3 border-b border-slate-100 flex flex-wrap items-center gap-2">
            <span className="text-xs font-bold text-slate-400 uppercase mr-2">Filtros:</span>
            {turmaIdFromQuery && (
              <span className="inline-flex items-center gap-1 px-2 py-1 rounded bg-violet-50 text-violet-700 text-xs font-bold border border-violet-100">
                Turma: {items[0]?.turma_nome || turmaIdFromQuery}
                <button onClick={() => replaceParams(p => { p.delete('turma_id'); p.delete('page'); })} className="hover:text-violet-900 ml-1">×</button>
              </span>
            )}
            {statusFilters.map((s) => (
              <span key={s} className="inline-flex items-center gap-1 px-2 py-1 rounded bg-blue-50 text-blue-700 text-xs font-bold border border-blue-100">
                Status: {s}
                <button onClick={() => handleRemoveStatus(s)} className="hover:text-blue-900 ml-1">×</button>
              </span>
            ))}
            <button onClick={handleClearStatuses} className="text-xs text-slate-400 hover:text-red-500 hover:underline ml-2">Limpar tudo</button>
          </div>
        )}

        {/* Tabela */}
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-100">
            <thead className="bg-white">
              <tr>
                <th className="px-6 py-4 text-left text-xs font-bold text-slate-400 uppercase tracking-wider">Matrícula</th>
                <th className="px-6 py-4 text-left text-xs font-bold text-slate-400 uppercase tracking-wider">Aluno</th>
                <th className="px-6 py-4 text-left text-xs font-bold text-slate-400 uppercase tracking-wider">Turma</th>
                <th className="px-6 py-4 text-center text-xs font-bold text-slate-400 uppercase tracking-wider">Status</th>
                <th className="px-6 py-4 text-right text-xs font-bold text-slate-400 uppercase tracking-wider">Ações</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-slate-50">
              {loading ? (
                <tr>
                  <td colSpan={5} className="p-12 text-center text-slate-500">
                    <Loader2 className="h-8 w-8 animate-spin mx-auto mb-3 text-teal-600" />
                    A carregar registos...
                  </td>
                </tr>
              ) : items.length === 0 ? (
                <tr>
                  <td colSpan={5} className="p-12 text-center text-slate-500">
                    <Users className="h-10 w-10 mx-auto mb-3 text-slate-300" />
                    Nenhuma matrícula encontrada com estes filtros.
                  </td>
                </tr>
              ) : (
                items.map((m) => (
                  <tr key={m.id} className="hover:bg-slate-50/80 transition-colors group">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="font-mono text-xs font-bold text-slate-600 bg-slate-100 px-2 py-1 rounded w-fit border border-slate-200">
                        {m.numero_matricula || "PENDENTE"}
                      </div>
                      <div className="text-[10px] text-slate-400 mt-1">ID: {m.id.slice(0, 6)}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-xs font-bold text-slate-500 border border-slate-200">
                          {m.aluno_nome ? m.aluno_nome.substring(0, 2).toUpperCase() : '?'}
                        </div>
                        <div className="font-bold text-sm text-slate-800">{m.aluno_nome || "Aluno Desconhecido"}</div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {m.turma_nome ? (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-indigo-50 text-indigo-700 text-xs font-bold border border-indigo-100">
                          <BookOpen className="w-3 h-3" />
                          {m.turma_nome}
                        </span>
                      ) : <span className="text-slate-300 text-xs italic">Sem turma</span>}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-center">
                      <StatusBadge status={m.status} />
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right">
                      <div className="flex justify-end gap-1 opacity-60 group-hover:opacity-100 transition-opacity">
                        <button onClick={() => handleOpenStatusForm(m)} title="Alterar Status" className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition"><RefreshCw className="w-4 h-4"/></button>
                        <button onClick={() => handleOpenTransferForm(m)} title="Transferir" className="p-2 text-slate-400 hover:text-orange-600 hover:bg-orange-50 rounded-lg transition"><ArrowUpDown className="w-4 h-4"/></button>
                        <Link href={`/api/secretaria/matriculas/${m.id}/declaracao`} target="_blank" title="Declaração" className="p-2 text-slate-400 hover:text-teal-600 hover:bg-teal-50 rounded-lg transition"><FileText className="w-4 h-4"/></Link>
                        <button className="p-2 text-slate-400 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition"><MoreVertical className="w-4 h-4"/></button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Footer Paginação */}
        <div className="bg-slate-50 px-6 py-4 border-t border-slate-200 flex items-center justify-between">
            <p className="text-xs text-slate-500 font-medium">
                Página {page} de {totalPages} • Total: {total}
            </p>
            <div className="flex gap-2">
                <button 
                    disabled={page <= 1} 
                    onClick={() => setPage(p => Math.max(1, p - 1))}
                    className="px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-bold text-slate-600 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition"
                >
                    Anterior
                </button>
                <button 
                    disabled={page >= totalPages} 
                    onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                    className="px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-bold text-slate-600 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition"
                >
                    Próxima
                </button>
            </div>
        </div>
      </div>

      {/* Modais flutuantes */}
      {showStatusForm && selectedMatricula && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm animate-in fade-in">
          <div className="w-full max-w-lg rounded-2xl bg-white p-8 shadow-2xl scale-100 animate-in zoom-in-95">
            <div className="flex justify-between items-center mb-6">
                <h2 className="text-xl font-bold text-slate-900">Alterar Status</h2>
                <button onClick={() => setShowStatusForm(false)} className="p-2 hover:bg-slate-100 rounded-full"><XCircle className="w-5 h-5 text-slate-400"/></button>
            </div>
            <StatusForm
              matriculaId={selectedMatricula.id}
              currentStatus={selectedMatricula.status}
              onSuccess={() => { setShowStatusForm(false); load(); }}
            />
          </div>
        </div>
      )}

      {showTransferForm && selectedMatricula && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm animate-in fade-in">
          <div className="w-full max-w-lg rounded-2xl bg-white p-8 shadow-2xl scale-100 animate-in zoom-in-95">
            <div className="flex justify-between items-center mb-6">
                <h2 className="text-xl font-bold text-slate-900">Transferir Aluno</h2>
                <button onClick={() => setShowTransferForm(false)} className="p-2 hover:bg-slate-100 rounded-full"><XCircle className="w-5 h-5 text-slate-400"/></button>
            </div>
            <TransferForm
              matriculaId={selectedMatricula.id}
              onSuccess={() => { setShowTransferForm(false); load(); }}
            />
          </div>
        </div>
      )}

    </div>
  );
}