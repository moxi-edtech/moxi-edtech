"use client";

import { useEffect, useMemo, useState } from "react";
import TurmaForm from "./TurmaForm";
import Link from "next/link";

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
      
      // ✅ DEBUG: Vamos ver exatamente o que está sendo enviado
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
        // ✅ Tenta obter mais detalhes do erro
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

  // ✅ Tela de loading melhorada
  if (loading && !data) {
    return (
      <div className="flex justify-center items-center py-12">
        <div className="text-center">
          <div className="w-8 h-8 border-4 border-emerald-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-sm text-gray-600">Carregando turmas...</p>
        </div>
      </div>
    );
  }

  // ✅ Tela de erro melhorada com opções
  if (error && !data) {
    return (
      <div className="p-6 space-y-4">
        <div className="rounded-lg bg-red-50 border border-red-200 p-4">
          <h3 className="text-red-800 font-medium">Erro ao carregar turmas</h3>
          <p className="text-red-600 text-sm mt-1">{error}</p>
          <div className="mt-3 flex gap-2">
            <button 
              onClick={fetchData}
              className="px-4 py-2 bg-red-600 text-white rounded-lg text-sm hover:bg-red-700 transition-colors"
            >
              Tentar novamente
            </button>
            <button 
              onClick={() => setShowCreateForm(true)}
              className="px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm hover:bg-emerald-700 transition-colors"
            >
              Criar primeira turma
            </button>
          </div>
        </div>
        
        {/* ✅ Debug info para desenvolvedor */}
        <div className="rounded-lg bg-gray-50 border border-gray-200 p-4">
          <h4 className="text-gray-800 font-medium text-sm">Informações para debug:</h4>
          <p className="text-gray-600 text-xs mt-1">
            URL da API: <code>/api/secretaria/turmas</code>
            <br/>
            Filtro atual: <code>{turno}</code>
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Gestão de Turmas</h1>
          <p className="text-sm text-gray-600 mt-1">
            Gerencie os agrupamentos físicos e horários para alocação de estudantes.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button 
            onClick={() => setShowCreateForm(true)}
            className="rounded-full bg-emerald-600 px-4 py-2 text-sm text-white hover:bg-emerald-700 transition-colors flex items-center gap-2"
          >
            <span>+</span>
            <span>Nova Turma</span>
          </button>
        </div>
      </header>

      {/* Aviso atualizado */}
      <div className="rounded-xl border border-blue-200 bg-blue-50 p-4 text-blue-800">
        <p className="text-sm">
          <strong>Turmas = Agrupamentos Físicos/Horários</strong><br/>
          Cada turma é um container onde alunos de diferentes classes e cursos podem compartilhar o mesmo espaço/tempo.
          O contexto acadêmico (classe, curso, equipe pedagógica) é definido na matrícula.
        </p>
      </div>

      {/* Modal de criação */}
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

      {/* ✅ Estado vazio - quando não há turmas */}
      {data?.items?.length === 0 && !loading && (
        <div className="rounded-2xl border border-gray-200 bg-white p-8 text-center">
          <div className="text-4xl mb-4">🏫</div>
          <h3 className="text-lg font-medium text-gray-900 mb-2">Nenhuma turma cadastrada</h3>
          <p className="text-gray-600 mb-4">Comece criando a primeira turma para organizar os espaços físicos e horários.</p>
          <button 
            onClick={() => setShowCreateForm(true)}
            className="rounded-full bg-emerald-600 px-6 py-3 text-sm text-white hover:bg-emerald-700 transition-colors"
          >
            Criar Primeira Turma
          </button>
        </div>
      )}

      {/* Cards de estatísticas - só mostra se tiver dados */}
      {data && data.items && data.items.length > 0 && (
        <>
          <section className="grid gap-4 md:grid-cols-3">
            <HighlightCard 
              title="Turmas ativas" 
              value={data?.stats?.totalTurmas ?? 0} 
              description="Containers físicos disponíveis" 
              icon="🏫" 
            />
            <HighlightCard 
              title="Alunos alocados" 
              value={data?.stats?.totalAlunos ?? 0} 
              description="Estudantes distribuídos nas turmas" 
              icon="👩‍🎓" 
            />
            <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
              <p className="text-xs font-semibold uppercase text-gray-500 mb-3">
                Distribuição por turno
              </p>
              <ul className="space-y-2">
                {filtrosTurno.slice(1).map((item) => (
                  <li key={item.id} className="flex items-center justify-between text-sm">
                    <span className="text-gray-600">{item.label}</span>
                    <span className="font-semibold text-gray-900">{item.total}</span>
                  </li>
                ))}
                {filtrosTurno.length <= 1 && (
                  <li className="text-sm text-gray-500">Sem turnos cadastrados</li>
                )}
              </ul>
            </div>
          </section>

          {/* Filtros e tabela */}
          <section className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between mb-6">
              <div className="flex flex-wrap gap-2">
                {filtrosTurno.map((item) => {
                  const isActive = turno === item.id;
                  return (
                    <button
                      key={item.id}
                      onClick={() => setTurno(item.id)}
                      className={`rounded-full px-4 py-2 text-sm transition-colors flex items-center gap-2 ${
                        isActive
                          ? 'bg-emerald-600 text-white shadow-sm'
                          : 'border border-gray-300 text-gray-700 hover:bg-gray-50'
                      }`}
                    >
                      <span>{item.label}</span>
                      <span
                        className={`rounded-full px-2 py-1 text-xs font-medium ${
                          isActive ? 'bg-white/20 text-white' : 'bg-gray-100 text-gray-600'
                        }`}
                      >
                        {item.total}
                      </span>
                    </button>
                  );
                })}
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="search"
                  value={busca}
                  onChange={(e) => setBusca(e.target.value)}
                  placeholder="Pesquisar turma, sala, ano letivo..."
                  className="w-full rounded-full border border-gray-300 px-4 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-200 lg:w-80"
                />
              </div>
            </div>

            {/* Tabela */}
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Turma
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Local/Turno
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Capacidade
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Ocupação
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Última movimentação
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Ações
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {itensFiltrados.map((item) => {
                    const ocupacaoPercentual = getOcupacaoPercentual(item);
                    const ocupacaoColor = getOcupacaoColor(ocupacaoPercentual);
                    
                    return (
                      <tr key={item.id} className="hover:bg-gray-50 transition-colors">
                        <td className="px-4 py-4">
                          <div>
                            <p className="font-medium text-gray-900">{item.nome}</p>
                            <p className="text-xs text-gray-500 mt-1">
                              {item.ano_letivo || 'Ano letivo não informado'}
                            </p>
                          </div>
                        </td>
                        <td className="px-4 py-4">
                          <div>
                            <p className="text-sm text-gray-900">
                              {item.sala || 'Sem local definido'}
                            </p>
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800 mt-1">
                              {TURNO_LABELS[item.turno] || item.turno}
                            </span>
                          </div>
                        </td>
                        <td className="px-4 py-4 text-sm text-gray-900">
                          <div>
                            <p>
                              {item.ocupacao_atual || 0} / {item.capacidade_maxima || 'N/A'}
                            </p>
                            <p className="text-xs text-gray-500">alunos</p>
                          </div>
                        </td>
                        <td className="px-4 py-4">
                          <div className="flex items-center gap-2">
                            <div className="w-16 bg-gray-200 rounded-full h-2">
                              <div 
                                className={`h-2 rounded-full ${ocupacaoColor} transition-all`}
                                style={{ width: `${Math.min(ocupacaoPercentual, 100)}%` }}
                              ></div>
                            </div>
                            <span className="text-xs text-gray-600 whitespace-nowrap">
                              {ocupacaoPercentual}%
                            </span>
                          </div>
                        </td>
                        <td className="px-4 py-4 text-sm text-gray-500">
                          {item.ultima_matricula 
                            ? new Date(item.ultima_matricula).toLocaleDateString('pt-BR')
                            : 'Sem registros'
                          }
                        </td>
                        <td className="px-4 py-4">
                          <div className="flex flex-col gap-2">
                            <Link 
                              href={`/secretaria/matriculas?turma_id=${item.id}`}
                              className="rounded-lg border border-gray-300 px-3 py-2 text-xs text-gray-700 hover:border-emerald-500 hover:text-emerald-600 transition-colors text-center"
                            >
                              Ver matrículas
                            </Link>
                            <Link
                              href={`/secretaria/turmas/${item.id}/editar`}
                              className="rounded-lg border border-gray-300 px-3 py-2 text-xs text-gray-700 hover:border-blue-500 hover:text-blue-600 transition-colors text-center"
                            >
                              Editar turma
                            </Link>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                  {itensFiltrados.length === 0 && data.items.length > 0 && (
                    <tr>
                      <td colSpan={6} className="px-4 py-8 text-center">
                        <div className="text-gray-500">
                          <p className="text-sm">Nenhuma turma encontrada com os filtros atuais</p>
                          <p className="text-xs mt-1">Tente ajustar a busca ou filtros</p>
                        </div>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}
    </div>
  );
}

function HighlightCard({ 
  title, 
  value, 
  description, 
  icon 
}: { 
  title: string; 
  value: number; 
  description: string; 
  icon: string; 
}) {
  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
      <div className="text-2xl mb-3" aria-hidden="true">{icon}</div>
      <p className="text-sm font-semibold uppercase tracking-wide text-gray-500 mb-1">
        {title}
      </p>
      <p className="text-3xl font-bold text-gray-900 mb-2">{value}</p>
      <p className="text-sm text-gray-600">{description}</p>
    </div>
  );
}