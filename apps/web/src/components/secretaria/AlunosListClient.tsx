"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { 
  Loader2, Search, Filter, UserPlus, ArrowLeft, 
  Users, Mail, Phone, Shield, Calendar, 
  Archive, Eye, Edit, AlertCircle, MoreVertical 
} from "lucide-react";

// --- TIPOS ---
type Aluno = {
  id: string;
  nome: string;
  email?: string | null;
  responsavel?: string | null;
  telefone_responsavel?: string | null;
  status?: string | null;
  created_at: string;
  numero_login?: string | null;
};

// --- MICRO-COMPONENTES ---
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

function StatusBadge({ status }: { status?: string | null }) {
  const st = status || 'pendente';
  const styles: Record<string, string> = {
    ativo: "bg-emerald-50 text-emerald-700 border-emerald-200",
    suspenso: "bg-amber-50 text-amber-700 border-amber-200",
    inativo: "bg-red-50 text-red-700 border-red-200",
    pendente: "bg-blue-50 text-blue-700 border-blue-200",
  };
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold border capitalize ${styles[st] || styles.pendente}`}>
      {st}
    </span>
  );
}

// --- COMPONENTE PRINCIPAL ---
export default function AlunosListClient() {
  // Estados de Filtro
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("ativo");
  const [page, setPage] = useState(1);
  const [pageSize] = useState(20);
  
  // Estados de Dados
  const [items, setItems] = useState<Aluno[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Estados de Ação (Modal)
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteReason, setDeleteReason] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [alunoSelecionado, setAlunoSelecionado] = useState<Aluno | null>(null);

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  // --- DATA FETCHING ---
  async function load(p = page) {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ q, status, page: String(p), pageSize: String(pageSize) });
      const res = await fetch(`/api/secretaria/alunos?${params.toString()}`, { cache: "no-store" });
      const json = await res.json();

      if (!res.ok || !json.ok) throw new Error(json?.error || "Falha ao carregar");

      setItems(json.items || []);
      setTotal(json.total || 0);
      if (p !== json.page) setPage(json.page); // Sync page se API ajustar
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  // Reload triggers
  useEffect(() => { load(1); }, [q, status]); // Reset page on filter change
  useEffect(() => { load(page); }, [page]); // Load on page change

  // --- AÇÕES ---
  const handleOpenDelete = (aluno: Aluno) => {
    setAlunoSelecionado(aluno);
    setDeleteReason("");
    setShowDeleteModal(true);
  };

  const handleConfirmDelete = async () => {
    if (!alunoSelecionado || !deleteReason.trim()) return alert("Motivo obrigatório.");
    setDeleting(true);
    try {
      const res = await fetch(`/api/secretaria/alunos/${alunoSelecionado.id}/delete`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: deleteReason.trim() }),
      });
      const json = await res.json();
      if (!res.ok || !json.ok) throw new Error(json.error);
      
      await load(1);
      setShowDeleteModal(false);
    } catch (e: any) {
      alert(e.message);
    } finally {
      setDeleting(false);
    }
  };

  // --- MÉTRICAS ---
  const stats = useMemo(() => ({
    ativos: items.filter(a => a.status === 'ativo').length,
    comEmail: items.filter(a => a.email).length,
    comResp: items.filter(a => a.responsavel).length
  }), [items]);

  return (
    <div className="w-full max-w-7xl mx-auto p-6 space-y-8 pb-20">
      
      {/* 1. HEADER & AÇÕES */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <button 
            onClick={() => window.history.back()}
            className="flex items-center gap-2 text-xs font-bold text-slate-400 hover:text-slate-600 transition-colors mb-2"
          >
            <ArrowLeft size={14}/> Voltar
          </button>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">Gestão de Alunos</h1>
          <p className="text-sm font-medium text-slate-500">Administre o corpo discente e matrículas.</p>
        </div>
        
        <Link 
          href="/secretaria/alunos/novo"
          className="flex items-center gap-2 px-5 py-2.5 bg-slate-900 text-white rounded-xl text-sm font-bold hover:bg-slate-800 shadow-lg shadow-slate-900/20 transition hover:-translate-y-0.5"
        >
          <UserPlus size={18} />
          Novo Aluno
        </Link>
      </div>

      {/* 2. KPIS */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard title="Total Alunos" value={total} icon={Users} colorClass="text-blue-600" bgClass="bg-blue-50" />
        <KpiCard title="Ativos" value={stats.ativos} icon={Shield} colorClass="text-emerald-600" bgClass="bg-emerald-50" />
        <KpiCard title="Com E-mail" value={stats.comEmail} icon={Mail} colorClass="text-purple-600" bgClass="bg-purple-50" />
        <KpiCard title="Com Responsável" value={stats.comResp} icon={Users} colorClass="text-orange-600" bgClass="bg-orange-50" />
      </div>

      {/* 3. TABELA PRINCIPAL */}
      <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
        
        {/* Toolbar */}
        <div className="p-5 border-b border-slate-100 bg-slate-50/50 flex flex-col sm:flex-row gap-4 justify-between items-center">
          
          <div className="relative w-full sm:max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input 
              type="text" 
              placeholder="Buscar por nome, responsável ou número..." 
              value={q} 
              onChange={(e) => setQ(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-white border border-slate-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500 transition-shadow"
            />
          </div>

          <div className="flex gap-2 w-full sm:w-auto overflow-x-auto">
            {[
              { label: 'Ativos', value: 'ativo' },
              { label: 'Inativos', value: 'inativo' },
              { label: 'Potenciais', value: 'pendente' },
              { label: 'Todos', value: 'todos' },
            ].map((s) => (
              <button 
                key={s.value} 
                onClick={() => setStatus(s.value)}
                className={`whitespace-nowrap px-4 py-2 rounded-lg text-sm font-bold border-b-4 transition-all ${
                  status === s.value
                  ? 'border-teal-500 bg-white text-teal-600' 
                  : 'border-transparent text-slate-500 hover:bg-white hover:text-slate-700'
                }`}
              >
                {s.label}
              </button>
            ))}
          </div>
        </div>

        {/* Lista */}
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-100">
            <thead className="bg-white">
              <tr>
                <th className="px-6 py-4 text-left text-xs font-bold text-slate-400 uppercase tracking-wider">Aluno</th>
                <th className="px-6 py-4 text-left text-xs font-bold text-slate-400 uppercase tracking-wider">Contato</th>
                <th className="px-6 py-4 text-left text-xs font-bold text-slate-400 uppercase tracking-wider">Responsável</th>
                <th className="px-6 py-4 text-center text-xs font-bold text-slate-400 uppercase tracking-wider">Status</th>
                <th className="px-6 py-4 text-right text-xs font-bold text-slate-400 uppercase tracking-wider">Ações</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-slate-50">
              {loading ? (
                 <tr><td colSpan={5} className="p-12 text-center text-slate-500"><Loader2 className="h-8 w-8 animate-spin mx-auto mb-2 text-teal-600"/>Carregando...</td></tr>
              ) : items.length === 0 ? (
                 <tr><td colSpan={5} className="p-12 text-center text-slate-500">Nenhum aluno encontrado.</td></tr>
              ) : (
                items.map((aluno) => (
                  <tr key={aluno.id} className="hover:bg-slate-50/80 transition-colors group">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                         <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 font-bold text-xs border border-slate-200">
                            {aluno.nome.substring(0,2).toUpperCase()}
                         </div>
                         <div>
                            <p className="font-bold text-sm text-slate-800">{aluno.nome}</p>
                            <p className="text-xs text-slate-400 font-mono">{aluno.numero_login || "—"}</p>
                         </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm text-slate-600">
                        {aluno.email ? <div className="flex items-center gap-1"><Mail className="w-3 h-3"/> {aluno.email}</div> : <span className="text-slate-300 text-xs">—</span>}
                    </td>
                    <td className="px-6 py-4 text-sm text-slate-600">
                        {aluno.responsavel ? (
                            <div>
                                <p className="font-medium">{aluno.responsavel}</p>
                                <p className="text-xs text-slate-400 flex items-center gap-1"><Phone className="w-3 h-3"/> {aluno.telefone_responsavel}</p>
                            </div>
                        ) : <span className="text-slate-300 text-xs">—</span>}
                    </td>
                    <td className="px-6 py-4 text-center">
                        <StatusBadge status={aluno.status} />
                    </td>
                    <td className="px-6 py-4 text-right">
                        <div className="flex justify-end gap-1 opacity-60 group-hover:opacity-100 transition-opacity">
                            {aluno.status !== 'ativo' && (
                              <Link href={`/secretaria/matriculas/nova?alunoId=${aluno.id}`} className="p-2 text-slate-400 hover:text-green-600 hover:bg-green-50 rounded-lg transition" title="Matricular Aluno">
                                <UserPlus className="w-4 h-4"/>
                              </Link>
                            )}
                            <Link href={`/secretaria/alunos/${aluno.id}`} className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition"><Eye className="w-4 h-4"/></Link>
                            <Link href={`/secretaria/alunos/${aluno.id}/editar`} className="p-2 text-slate-400 hover:text-teal-600 hover:bg-teal-50 rounded-lg transition"><Edit className="w-4 h-4"/></Link>
                            <button onClick={() => handleOpenDelete(aluno)} className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition"><Archive className="w-4 h-4"/></button>
                        </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Paginacao */}
        <div className="bg-slate-50 px-6 py-4 border-t border-slate-200 flex items-center justify-between text-xs text-slate-500">
            <span>Página {page} de {totalPages}</span>
            <div className="flex gap-2">
                <button disabled={page<=1} onClick={() => setPage(p => p-1)} className="px-3 py-1 bg-white border rounded-md disabled:opacity-50">Anterior</button>
                <button disabled={page>=totalPages} onClick={() => setPage(p => p+1)} className="px-3 py-1 bg-white border rounded-md disabled:opacity-50">Próximo</button>
            </div>
        </div>
      </div>

      {/* MODAL DELETE */}
      {showDeleteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm animate-in fade-in">
            <div className="bg-white p-6 rounded-2xl shadow-2xl w-full max-w-md scale-100 animate-in zoom-in-95">
                <h3 className="text-lg font-bold text-slate-900 mb-2">Arquivar Aluno</h3>
                <p className="text-sm text-slate-500 mb-4">Tem a certeza que deseja arquivar <strong>{alunoSelecionado?.nome}</strong>? Esta ação não apaga o histórico financeiro.</p>
                <textarea 
                    value={deleteReason}
                    onChange={e => setDeleteReason(e.target.value)}
                    placeholder="Motivo do arquivamento..."
                    className="w-full p-3 border border-slate-200 rounded-lg text-sm mb-4 outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-500"
                    rows={3}
                />
                <div className="flex justify-end gap-3">
                    <button onClick={() => setShowDeleteModal(false)} className="px-4 py-2 text-sm font-bold text-slate-500 hover:bg-slate-100 rounded-lg">Cancelar</button>
                    <button onClick={handleConfirmDelete} disabled={deleting} className="px-4 py-2 text-sm font-bold text-white bg-red-600 hover:bg-red-700 rounded-lg shadow-sm">
                        {deleting ? "Arquivando..." : "Confirmar Arquivo"}
                    </button>
                </div>
            </div>
        </div>
      )}
    </div>
  );
}