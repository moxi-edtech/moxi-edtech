"use client";

import { useEffect, useMemo, useState, Fragment } from "react";
import TurmaForm from "./TurmaForm";
import AtribuirProfessorForm from "./AtribuirProfessorForm";
import Link from "next/link";
import { 
  Loader2, 
  Search, 
  Filter, 
  UserPlus, 
  ArrowLeft,
  Users, 
  BookOpen, 
  BarChart3,
  Building,
  Calendar,
  Gauge,
  Edit,
  Link as LinkIcon,
  Trash2,
  Eye
} from "lucide-react";

interface TurmaItem {
  id: string;
  nome: string;
  turno: string;
  ano_letivo: string | null;
  session_id?: string;
  sala?: string;
  capacidade_maxima?: number;
  ocupacao_atual?: number;
  ultima_matricula: string | null;
}

interface TurmasResponse {
  ok: boolean;
  items: TurmaItem[];
  total: number;
  stats: {
    totalTurmas: number;
    totalAlunos: number;
    porTurno: Array<{ turno: string; total: number }>;
  };
  error?: string;
}

const TURNO_LABELS: Record<string, string> = {
  manha: "Manhã",
  tarde: "Tarde", 
  noite: "Noite",
  integral: "Integral",
  sem_turno: "Sem turno",
};

export default function TurmasListClient() {
  const [turno, setTurno] = useState<string>("todos");
  const [busca, setBusca] = useState("");
  const [data, setData] = useState<TurmasResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCreateForm, setShowCreateForm] = useState(false);

  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const params = new URLSearchParams();
      if (turno !== "todos") {
        params.set('turno', turno);
      }
      
      const url = `/api/secretaria/turmas?${params.toString()}`;
      console.log("🔄 Fetching URL:", url);
      
      const res = await fetch(url, { 
        cache: 'no-store'
      });
      
      console.log("📊 Response status:", res.status, res.statusText);
      
      if (!res.ok) {
        let errorDetails = `Erro ${res.status}: ${res.statusText}`;
        try {
          const errorJson = await res.json();
          console.error("📋 Error details:", errorJson);
          errorDetails = errorJson?.error || errorJson?.message || errorDetails;
        } catch (e) {
          console.error("❌ Could not parse error response:", e);
        }
        throw new Error(errorDetails);
      }
      
      const json = await res.json() as TurmasResponse;
      console.log("✅ API Response:", json);
      
      if (!json?.ok) {
        throw new Error(json?.error || 'Falha ao carregar turmas');
      }
      
      setData(json);
      
    } catch (e) {
      console.error('💥 Erro ao carregar turmas:', e);
      setError(e instanceof Error ? e.message : 'Erro desconhecido ao carregar turmas');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let mounted = true;
    if (mounted) {
      fetchData();
    }
    return () => { mounted = false };
  }, [turno]);

  const handleCloseForms = () => {
    setShowCreateForm(false);
  };

  const handleSuccess = () => {
    handleCloseForms();
    fetchData();
  };

  const filtrosTurno = useMemo(() => {
    const porTurno = data?.stats?.porTurno ?? [];
    const base = porTurno.map((item) => ({
      id: item.turno,
      label: TURNO_LABELS[item.turno] || item.turno,
      total: item.total,
    }));
    
    return [
      { 
        id: "todos", 
        label: "Todos", 
        total: data?.stats?.totalTurmas ?? 0 
      }, 
      ...base
    ];
  }, [data?.stats?.porTurno, data?.stats?.totalTurmas]);

  const itensFiltrados = useMemo(() => {
    const itens = data?.items ?? [];
    const lowerBusca = busca.trim().toLowerCase();
    
    return itens.filter((item) => {
      if (turno !== "todos" && (item.turno ?? 'sem_turno') !== turno) {
        return false;
      }
      
      if (!lowerBusca) return true;
      
      return (
        item.nome.toLowerCase().includes(lowerBusca) ||
        (item.sala || '').toLowerCase().includes(lowerBusca) ||
        (item.ano_letivo || '').toLowerCase().includes(lowerBusca)
      );
    });
  }, [data?.items, turno, busca]);

  const getOcupacaoPercentual = (turma: TurmaItem) => {
    if (!turma.capacidade_maxima || !turma.ocupacao_atual) return 0;
    return Math.round((turma.ocupacao_atual / turma.capacidade_maxima) * 100);
  };

  const getOcupacaoColor = (percentual: number) => {
    if (percentual >= 90) return 'bg-red-500';
    if (percentual >= 70) return 'bg-yellow-500';
    return 'bg-green-500';
  };

  const getStatusColor = (percentual: number) => {
    if (percentual >= 90) return 'text-red-600';
    if (percentual >= 70) return 'text-amber-600';
    return 'text-green-600';
  };

  // Gerir atribuições por turma
  const [manageTurmaId, setManageTurmaId] = useState<string | null>(null);
  const [assignments, setAssignments] = useState<any[] | null>(null);
  const [loadingAssignments, setLoadingAssignments] = useState(false);
  const [showAtribuirForm, setShowAtribuirForm] = useState(false);
  const loadAssignments = async (turmaId: string) => {
    setLoadingAssignments(true);
    setAssignments(null);
    try {
      const res = await fetch(`/api/secretaria/turmas/${turmaId}/disciplinas`, { cache: 'no-store' });
      const json = await res.json();
      if (!res.ok || !json?.ok) throw new Error(json?.error || 'Falha ao carregar atribuições');
      setAssignments(json.items || []);
    } catch (e) {
      setAssignments([]);
    } finally {
      setLoadingAssignments(false);
    }
  };

  // ✅ Loading state
  if (loading && !data) {
    return (
      <div className="w-full max-w-6xl mx-auto space-y-6 p-6 bg-slate-50 rounded-xl">
        <div className="bg-white p-8 rounded-xl border border-slate-200 shadow-sm text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4 text-moxinexa-teal" />
          <div className="text-slate-600">Carregando turmas...</div>
        </div>
      </div>
    );
  }

  // ✅ Error state
  if (error && !data) {
    return (
      <div className="w-full max-w-6xl mx-auto space-y-6 p-6 bg-slate-50 rounded-xl">
        <div className="bg-white p-6 rounded-xl border border-red-200 shadow-sm">
          <h3 className="text-red-800 font-medium text-lg mb-2">Erro ao carregar turmas</h3>
          <p className="text-red-600 mb-4">{error}</p>
          <div className="flex gap-3">
            <button 
              onClick={fetchData}
              className="inline-flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-all"
            >
              <Loader2 className="h-4 w-4" />
              Tentar novamente
            </button>
            <button 
              onClick={() => setShowCreateForm(true)}
              className="inline-flex items-center gap-2 px-4 py-2 bg-moxinexa-teal text-white rounded-lg hover:bg-teal-600 transition-all"
            >
              <UserPlus className="h-4 w-4" />
              Criar primeira turma
            </button>
          </div>
        </div>
      </div>
    );
  }

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
          <div className="text-2xl font-bold text-moxinexa-navy">{data?.stats?.totalTurmas || 0}</div>
          <div className="text-sm text-slate-500 flex items-center gap-2">
            <Building className="h-4 w-4" />
            Total de Turmas
          </div>
        </div>
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
          <div className="text-2xl font-bold text-orange-600">
            {data?.stats?.totalAlunos || 0}
          </div>
          <div className="text-sm text-slate-500 flex items-center gap-2">
            <Users className="h-4 w-4" />
            Alunos Alocados
          </div>
        </div>
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
          <div className="text-2xl font-bold text-moxinexa-teal">
            {filtrosTurno.length - 1}
          </div>
          <div className="text-sm text-slate-500 flex items-center gap-2">
            <Calendar className="h-4 w-4" />
            Turnos Diferentes
          </div>
        </div>
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
          <div className="text-2xl font-bold text-green-600">
            {Math.round((data?.stats?.totalAlunos || 0) / Math.max(data?.stats?.totalTurmas || 1, 1))}
          </div>
          <div className="text-sm text-slate-500 flex items-center gap-2">
            <BarChart3 className="h-4 w-4" />
            Média por Turma
          </div>
        </div>
      </div>

      {/* --- HEADER DE AÇÃO --- */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
        <div>
          <h1 className="text-2xl font-bold text-moxinexa-navy flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-blue-500" />
            Gestão de Turmas
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            {data?.stats?.totalTurmas || 0} turmas ativas • {data?.stats?.totalAlunos || 0} alunos alocados • {filtrosTurno.length - 1} turnos
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button 
            onClick={() => setShowCreateForm(true)}
            className="inline-flex items-center gap-2 rounded-lg bg-moxinexa-teal px-5 py-3 text-sm font-bold text-white hover:bg-teal-600 shadow-lg shadow-teal-900/20 transition-all active:scale-95 transform hover:-translate-y-0.5"
          >
            <UserPlus className="h-4 w-4" />
            Nova Turma
          </button>
        </div>
      </div>

      {/* --- CARTA INFORMATIVA --- */}
      <div className="bg-blue-50 p-6 rounded-xl border border-blue-200 shadow-sm">
        <h3 className="text-lg font-bold text-blue-800 mb-2 flex items-center gap-2">
          <BookOpen className="h-5 w-5" />
          Sobre as Turmas
        </h3>
        <p className="text-blue-700 text-sm">
          <strong>Turmas = Agrupamentos Físicos/Horários</strong><br/>
          Cada turma é um container onde alunos de diferentes classes e cursos podem compartilhar o mesmo espaço/tempo.
          O contexto acadêmico (classe, curso, equipe pedagógica) é definido na matrícula.
        </p>
      </div>

      {/* --- FILTROS E PESQUISA --- */}
      <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-4">
        <div className="flex gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input 
              type="search"
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Pesquisar turma, sala, ano letivo..."
              className="w-full pl-10 pr-4 py-3 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-moxinexa-teal"
            />
          </div>
          <button className="inline-flex items-center gap-2 px-4 py-3 bg-white border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-50 text-sm font-medium">
            <Filter className="h-4 w-4" />
            Filtros
          </button>
        </div>

        <div className="flex flex-wrap gap-2">
          {filtrosTurno.map((item) => {
            const isActive = turno === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setTurno(item.id)}
                className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg border transition-all ${
                  isActive
                    ? 'bg-moxinexa-teal text-white border-moxinexa-teal shadow-lg shadow-teal-900/20'
                    : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                }`}
              >
                <span className="text-sm">{item.label}</span>
                <span className={`rounded-full px-2 py-1 text-xs font-medium ${
                  isActive ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-600'
                }`}>
                  {item.total}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* --- MODAL DE CRIAÇÃO --- */}
      {showCreateForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold text-gray-900">Nova Turma</h2>
              <button
                onClick={handleCloseForms}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                ✕
              </button>
            </div>
            <TurmaForm onSuccess={handleSuccess} />
          </div>
        </div>
      )}

      {/* --- ESTADO VAZIO --- */}
      {data?.items?.length === 0 && !loading && (
        <div className="bg-white p-8 rounded-xl border border-slate-200 shadow-sm text-center">
          <Building className="h-16 w-16 mx-auto mb-4 text-slate-300" />
          <h3 className="text-lg font-semibold text-slate-800 mb-2">Nenhuma turma cadastrada</h3>
          <p className="text-slate-600 mb-6">Comece criando a primeira turma para organizar os espaços físicos e horários.</p>
          <button 
            onClick={() => setShowCreateForm(true)}
            className="inline-flex items-center gap-2 rounded-lg bg-moxinexa-teal px-6 py-3 text-sm font-bold text-white hover:bg-teal-600 shadow-lg shadow-teal-900/20 transition-all"
          >
            <UserPlus className="h-4 w-4" />
            Criar Primeira Turma
          </button>
        </div>
      )}

      {/* --- TABELA DE TURMAS --- */}
      {data && data.items && data.items.length > 0 && (
        <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 text-sm">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-4 py-4 text-left text-xs font-bold uppercase tracking-wide text-slate-500">
                    Turma
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wide text-slate-500">
                    Local / Turno
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wide text-slate-500">
                    Capacidade
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wide text-slate-500">
                    Ocupação
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wide text-slate-500">
                    Última Movimentação
                  </th>
                  <th className="px-4 py-3 text-center text-xs font-bold uppercase tracking-wide text-slate-500">
                    Ações
                  </th>
                </tr>
              </thead>

              <tbody className="divide-y divide-slate-100">
                {itensFiltrados.map((item) => {
                  const ocupacaoPercentual = getOcupacaoPercentual(item);
                  const ocupacaoColor = getOcupacaoColor(ocupacaoPercentual);
                  const statusColor = getStatusColor(ocupacaoPercentual);
                  
                  return (
                    <Fragment key={item.id}>
                      <tr className="hover:bg-slate-50 transition-colors">
                        <td className="px-4 py-4 text-slate-900">
                          <div className="font-bold text-moxinexa-navy">
                            {item.nome}
                          </div>
                          <div className="text-xs text-slate-500">
                            {item.ano_letivo || 'Ano letivo não informado'}
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <div className="space-y-1">
                            <div className="text-slate-700">
                              {item.sala || 'Sem local definido'}
                            </div>
                            <span className="inline-flex items-center rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-bold text-blue-700">
                              <Calendar className="w-3 h-3 mr-1" />
                              {TURNO_LABELS[item.turno] || item.turno}
                            </span>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <div className="text-slate-700 font-medium">
                            {item.ocupacao_atual || 0} / {item.capacidade_maxima || 'N/A'}
                          </div>
                          <div className="text-xs text-slate-500">alunos</div>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-3">
                            <div className="w-20 bg-slate-200 rounded-full h-2">
                              <div 
                                className={`h-2 rounded-full ${ocupacaoColor} transition-all`}
                                style={{ width: `${Math.min(ocupacaoPercentual, 100)}%` }}
                              ></div>
                            </div>
                            <span className={`text-sm font-bold ${statusColor}`}>
                              {ocupacaoPercentual}%
                            </span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-slate-600">
                          {item.ultima_matricula 
                            ? new Date(item.ultima_matricula).toLocaleDateString('pt-BR')
                            : 'Sem registros'
                          }
                        </td>
                        <td className="px-4 py-3 text-center">
                          <div className="flex justify-center gap-1">
                            <Link
                                href={`/secretaria/turmas/${item.id}`}
                                className="text-blue-600 hover:text-white hover:bg-blue-600 p-2 rounded-lg transition-all"
                                title="Ver detalhes da turma"
                            >
                                <Eye className="w-4 h-4" />
                            </Link>
                            <Link 
                              href={`/secretaria/matriculas?turma_id=${item.id}`}
                              className="text-blue-600 hover:text-white hover:bg-blue-600 p-2 rounded-lg transition-all"
                              title="Ver matrículas"
                            >
                              <Users className="w-4 h-4" />
                            </Link>
                            <Link
                              href={`/secretaria/turmas/${item.id}/editar`}
                              className="text-green-600 hover:text-white hover:bg-green-600 p-2 rounded-lg transition-all"
                              title="Editar turma"
                            >
                              <Edit className="w-4 h-4" />
                            </Link>
                            <button
                              onClick={() => { setManageTurmaId(item.id); loadAssignments(item.id); }}
                              className="text-purple-600 hover:text-white hover:bg-purple-600 p-2 rounded-lg transition-all"
                              title="Gerir disciplinas"
                            >
                              <LinkIcon className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>

                      {/* EXPANSÃO DE ATRIBUIÇÕES */}
                      {manageTurmaId === item.id && (
                        <tr className="bg-slate-50">
                          <td colSpan={6} className="px-4 pb-4">
                            <div className="rounded-lg border border-slate-200 p-4 bg-white">
                              <div className="flex items-center justify-between mb-3">
                                <h4 className="font-semibold text-slate-800 flex items-center gap-2">
                                  <LinkIcon className="h-4 w-4" />
                                  Atribuições de {item.nome}
                                </h4>
                                <div className="flex gap-2">
                                    <button
                                        onClick={() => setShowAtribuirForm(true)}
                                        className="bg-blue-600 text-white px-3 py-1 rounded-md hover:bg-blue-700 text-xs"
                                    >
                                        Adicionar Atribuição
                                    </button>
                                    <button 
                                      onClick={() => { setManageTurmaId(null); setAssignments(null); }} 
                                      className="text-slate-500 hover:text-slate-700"
                                    >
                                      ✕
                                    </button>
                                </div>
                              </div>
                              {showAtribuirForm && (
                                <div className="my-4">
                                  <AtribuirProfessorForm turmaId={item.id} onSuccess={() => {
                                    setShowAtribuirForm(false);
                                    loadAssignments(item.id);
                                  }} />
                                </div>
                              )}
                              {loadingAssignments ? (
                                <div className="flex items-center gap-2 text-slate-500">
                                  <Loader2 className="h-4 w-4 animate-spin" />
                                  Carregando atribuições...
                                </div>
                              ) : !assignments || assignments.length === 0 ? (
                                <div className="text-slate-500 text-sm">Nenhuma atribuição cadastrada.</div>
                              ) : (
                                <div className="overflow-x-auto">
                                  <table className="min-w-full text-sm border border-slate-200">
                                    <thead className="bg-slate-50">
                                      <tr>
                                        <th className="p-2 text-left border border-slate-200">Disciplina</th>
                                        <th className="p-2 text-left border border-slate-200">Professor</th>
                                        <th className="p-2 text-left border border-slate-200">Vínculos</th>
                                        <th className="p-2 text-left border border-slate-200">Ações</th>
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {assignments.map((a) => (
                                        <tr key={a.id} className="border-t border-slate-200">
                                          <td className="p-2 border border-slate-200">{a.disciplina?.nome || a.disciplina?.id}</td>
                                          <td className="p-2 border border-slate-200">{a.professor?.nome || a.professor?.email || a.professor?.id}</td>
                                          <td className="p-2 border border-slate-200">
                                            <div className="flex flex-wrap gap-1">
                                              <span className={`inline-block px-2 py-0.5 rounded-full text-xs ${a.vinculos.horarios ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-600'}`}>Horários</span>
                                              <span className={`inline-block px-2 py-0.5 rounded-full text-xs ${a.vinculos.notas ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-600'}`}>Notas</span>
                                              <span className={`inline-block px-2 py-0.5 rounded-full text-xs ${a.vinculos.presencas ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-600'}`}>Presenças</span>
                                              <span className={`inline-block px-2 py-0.5 rounded-full text-xs ${a.vinculos.planejamento ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-600'}`}>Planejamento</span>
                                            </div>
                                          </td>
                                          <td className="p-2 border border-slate-200">
                                            <button
                                              onClick={async () => {
                                                if (!confirm('Remover esta atribuição?')) return;
                                                try {
                                                  const res = await fetch(`/api/secretaria/turmas/${item.id}/disciplinas/${a.disciplina?.id}`, { method: 'DELETE' });
                                                  const json = await res.json().catch(()=>null);
                                                  if (!res.ok || !json?.ok) throw new Error(json?.error || 'Falha ao remover');
                                                  await loadAssignments(item.id);
                                                } catch (e) {
                                                  console.error(e);
                                                  alert(e instanceof Error ? e.message : String(e));
                                                }
                                              }}
                                              className="inline-flex items-center gap-1 px-2 py-1 rounded border border-red-200 text-red-600 hover:bg-red-50 text-xs"
                                            >
                                              <Trash2 className="h-3 w-3" />
                                              Remover
                                            </button>
                                          </td>
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                </div>
                              )}
                            </div>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })}
                
                {itensFiltrados.length === 0 && data.items.length > 0 && (
                  <tr>
                    <td colSpan={6} className="p-8 text-center text-slate-500">
                      <Search className="h-12 w-12 mx-auto mb-3 text-slate-300" />
                      Nenhuma turma encontrada com os filtros atuais.
                      <div className="mt-2 text-sm">
                        Tente ajustar a busca ou filtros.
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
}