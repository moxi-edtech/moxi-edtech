"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { 
  Loader2, 
  Search, 
  Filter, 
  UserPlus, 
  ArrowLeft,
  Users, 
  Mail, 
  Phone, 
  Shield,
  Calendar,
  Trash2,
  Eye,
  Edit,
  Archive
} from "lucide-react";

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

type ApiResponse = {
  ok: boolean;
  items: Aluno[];
  total: number;
  page: number;
  pageSize: number;
  error?: string;
};

export default function AlunosListClient() {
  const [q, setQ] = useState("");
  const [days, setDays] = useState("30");
  const [page, setPage] = useState(1);
  const [pageSize] = useState(20);
  const [items, setItems] = useState<Aluno[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // 🔥 estado para deleção
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteReason, setDeleteReason] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [alunoSelecionado, setAlunoSelecionado] = useState<Aluno | null>(null);

  const totalPages = useMemo(
    () => Math.max(1, Math.ceil(total / pageSize)),
    [total, pageSize]
  );

  async function load(p = page) {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        q,
        days,
        page: String(p),
        pageSize: String(pageSize),
      });

      const res = await fetch(`/api/secretaria/alunos?${params.toString()}`, {
        cache: "no-store",
      });
      const json: ApiResponse = await res.json();

      if (!res.ok || !json.ok) {
        throw new Error(json?.error || "Falha ao carregar alunos");
      }

      setItems(json.items || []);
      setTotal(json.total || 0);
      setPage(json.page || p);
    } catch (e) {
      console.error(e);
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, days]);

  useEffect(() => {
    load(page);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page]);

  // 🧨 abre modal
  const handleOpenDelete = (aluno: Aluno) => {
    setAlunoSelecionado(aluno);
    setDeleteReason("");
    setShowDeleteModal(true);
  };

  const handleCloseDelete = () => {
    setShowDeleteModal(false);
    setAlunoSelecionado(null);
    setDeleteReason("");
    setDeleting(false);
  };

  // 🔨 chama API de delete/arquivar
  const handleConfirmDelete = async () => {
    if (!alunoSelecionado) return;
    if (!deleteReason.trim()) {
      alert("Por favor, informe o motivo da exclusão.");
      return;
    }

    try {
      setDeleting(true);

      const res = await fetch(
        `/api/secretaria/alunos/${alunoSelecionado.id}/delete`,
        {
          method: "DELETE",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ reason: deleteReason.trim() }),
        }
      );

      const json = await res.json();
      if (!res.ok || !json?.ok) {
        throw new Error(json?.error || "Falha ao excluir aluno");
      }

      await load(1);
      handleCloseDelete();
    } catch (e) {
      console.error(e);
      alert(e instanceof Error ? e.message : String(e));
      setDeleting(false);
    }
  };

  // Calcular métricas
  const alunosAtivos = useMemo(() => 
    items.filter(a => a.status === 'ativo').length, 
    [items]
  );
  
  const alunosComEmail = useMemo(() => 
    items.filter(a => a.email).length, 
    [items]
  );
  
  const alunosComResponsavel = useMemo(() => 
    items.filter(a => a.responsavel).length, 
    [items]
  );

  const getStatusColor = (status: string | null) => {
    switch (status) {
      case 'ativo': return 'bg-emerald-100 text-emerald-700';
      case 'suspenso': return 'bg-amber-100 text-amber-700';
      case 'inativo': return 'bg-red-100 text-red-700';
      case 'pendente': return 'bg-blue-100 text-blue-700';
      default: return 'bg-slate-100 text-slate-700';
    }
  };

  const getStatusIcon = (status: string | null) => {
    switch (status) {
      case 'ativo': return '🟢';
      case 'suspenso': return '🟡';
      case 'inativo': return '🔴';
      case 'pendente': return '🔵';
      default: return '⚪';
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
            Total de Alunos
          </div>
        </div>
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
          <div className="text-2xl font-bold text-orange-600">
            {alunosAtivos}
          </div>
          <div className="text-sm text-slate-500 flex items-center gap-2">
            <Shield className="h-4 w-4" />
            Alunos Ativos
          </div>
        </div>
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
          <div className="text-2xl font-bold text-moxinexa-teal">
            {alunosComEmail}
          </div>
          <div className="text-sm text-slate-500 flex items-center gap-2">
            <Mail className="h-4 w-4" />
            Com E-mail
          </div>
        </div>
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
          <div className="text-2xl font-bold text-green-600">
            {alunosComResponsavel}
          </div>
          <div className="text-sm text-slate-500 flex items-center gap-2">
            <Users className="h-4 w-4" />
            Com Responsável
          </div>
        </div>
      </div>

      {/* --- HEADER DE AÇÃO --- */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
        <div>
          <h1 className="text-2xl font-bold text-moxinexa-navy flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-blue-500" />
            Gestão de Alunos
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            {total} alunos cadastrados • {alunosAtivos} ativos • {alunosComEmail} com e-mail
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Link
            href="/secretaria/alunos/novo"
            className="inline-flex items-center gap-2 rounded-lg bg-moxinexa-teal px-5 py-3 text-sm font-bold text-white hover:bg-teal-600 shadow-lg shadow-teal-900/20 transition-all active:scale-95 transform hover:-translate-y-0.5"
          >
            <UserPlus className="h-4 w-4" />
            Novo Aluno
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
              placeholder="Buscar por nome, responsável ou número..."
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
          {["1", "7", "30", "90"].map((d) => (
            <button
              key={d}
              onClick={() => setDays(d)}
              className={`inline-flex items-center gap-2 px-3 py-2 rounded-lg border transition-all ${
                days === d
                  ? "bg-moxinexa-teal text-white border-moxinexa-teal shadow-lg shadow-teal-900/20"
                  : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50"
              }`}
            >
              {d === "1" ? "1 dia" : `${d} dias`}
            </button>
          ))}
        </div>
      </div>

      {/* --- ERRO GLOBAL --- */}
      {error && (
        <div className="bg-red-50 p-4 rounded-xl border border-red-200 shadow-sm">
          <div className="text-red-700 text-sm font-medium">{error}</div>
        </div>
      )}

      {/* --- TABELA DE ALUNOS --- */}
      <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-4 py-4 text-left text-xs font-bold uppercase tracking-wide text-slate-500">
                  Aluno
                </th>
                <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wide text-slate-500">
                  Contato
                </th>
                <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wide text-slate-500">
                  Responsável
                </th>
                <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wide text-slate-500">
                  Status
                </th>
                <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wide text-slate-500">
                  Cadastrado em
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
                    Carregando alunos...
                  </td>
                </tr>
              ) : items.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-slate-500">
                    <Users className="h-12 w-12 mx-auto mb-3 text-slate-300" />
                    Nenhum aluno encontrado.
                    <div className="mt-2 text-sm">
                      {q ? 'Tente ajustar os filtros de busca.' : 'Comece cadastrando o primeiro aluno.'}
                    </div>
                  </td>
                </tr>
              ) : (
                items.map((aluno) => (
                  <tr key={aluno.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-4 py-4 text-slate-900">
                      <div className="font-bold text-moxinexa-navy">
                        {aluno.nome}
                      </div>
                      <div className="text-xs text-slate-500 space-y-1 mt-1">
                        {aluno.numero_login && (
                          <div className="font-mono bg-slate-100 px-2 py-1 rounded">
                            {aluno.numero_login}
                          </div>
                        )}
                        <div className="font-mono text-slate-400">
                          {aluno.id.slice(0, 8)}...
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      {aluno.email ? (
                        <div className="flex items-center gap-2 text-slate-700">
                          <Mail className="h-4 w-4 text-slate-400" />
                          {aluno.email}
                        </div>
                      ) : (
                        <span className="text-slate-400 text-xs">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="space-y-1">
                        {aluno.responsavel ? (
                          <div className="text-slate-700">{aluno.responsavel}</div>
                        ) : (
                          <span className="text-slate-400 text-xs">—</span>
                        )}
                        {aluno.telefone_responsavel && (
                          <div className="flex items-center gap-1 text-xs text-slate-500">
                            <Phone className="h-3 w-3" />
                            {aluno.telefone_responsavel}
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-bold ${getStatusColor(aluno.status)}`}>
                        {getStatusIcon(aluno.status)} {aluno.status || '—'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-600">
                      <div className="flex items-center gap-2">
                        <Calendar className="h-4 w-4 text-slate-400" />
                        {new Date(aluno.created_at).toLocaleDateString('pt-AO')}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <div className="flex justify-center gap-1">
                        <Link
                          href={`/secretaria/alunos/${aluno.id}`}
                          className="text-blue-600 hover:text-white hover:bg-blue-600 p-2 rounded-lg transition-all"
                          title="Ver detalhes"
                        >
                          <Eye className="w-4 h-4" />
                        </Link>
                        <Link
                          href={`/secretaria/alunos/${aluno.id}/editar`}
                          className="text-green-600 hover:text-white hover:bg-green-600 p-2 rounded-lg transition-all"
                          title="Editar aluno"
                        >
                          <Edit className="w-4 h-4" />
                        </Link>
                        <button
                          onClick={() => handleOpenDelete(aluno)}
                          className="text-red-600 hover:text-white hover:bg-red-600 p-2 rounded-lg transition-all"
                          title="Arquivar aluno"
                        >
                          <Archive className="w-4 h-4" />
                        </button>
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
          Mostrando <strong>{(page - 1) * pageSize + 1}-{Math.min(page * pageSize, total)}</strong> de <strong>{total}</strong> alunos
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

      {/* --- MODAL DE ARQUIVAMENTO --- */}
      {showDeleteModal && alunoSelecionado && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl">
            <h2 className="text-xl font-semibold text-moxinexa-navy mb-2">Arquivar Aluno</h2>
            <p className="text-slate-600 mb-4">
              Tem certeza que deseja arquivar o aluno{" "}
              <span className="font-bold text-slate-800">{alunoSelecionado.nome}</span>
              ? Ele deixará de aparecer nas listagens principais, mas permanecerá no histórico da escola.
            </p>

            <div className="mb-4">
              <label className="block text-sm font-semibold text-slate-700 mb-2">
                Motivo do arquivamento <span className="text-red-500">*</span>
              </label>
              <textarea
                value={deleteReason}
                onChange={(e) => setDeleteReason(e.target.value)}
                rows={3}
                className="w-full border border-slate-200 rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-moxinexa-teal focus:border-transparent"
                placeholder="Ex.: Aluno transferido para outra escola, cadastro duplicado, etc."
              />
            </div>

            <div className="flex justify-end gap-3">
              <button
                type="button"
                onClick={handleCloseDelete}
                disabled={deleting}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-slate-100 text-slate-700 hover:bg-slate-200 transition-all disabled:opacity-50"
              >
                <ArrowLeft className="h-4 w-4" />
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                disabled={deleting}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-red-600 text-white hover:bg-red-700 transition-all disabled:opacity-50"
              >
                {deleting ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Archive className="h-4 w-4" />
                )}
                {deleting ? "Arquivando..." : "Confirmar Arquivamento"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}