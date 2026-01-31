// apps/web/src/app/financeiro/turmas-alunos/page.tsx
'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { 
  Search, Filter, CalendarDays, DollarSign, AlertTriangle, 
  CheckCircle, Clock, ChevronDown, ChevronUp, Eye, Mail, 
  Download, Printer, MoreVertical, Ban, User, Wallet
} from 'lucide-react';
import ModalRegistrarPagamento from './ModalRegistrarPagamento';

// --- Types & Interfaces ---
interface Aluno {
  id: string;
  nome: string;
  numeroEstudante?: string;
  bi: string;
  telefone: string;
  turmaId: string;
  turmaNome: string;
  avatarUrl?: string; // Adicionado para UX
}

interface Turma {
  id: string;
  nome: string;
  turno: 'M' | 'T' | 'N';
  anoLetivo: number;
  cursoNome: string;
  capacidadeMaxima: number;
  alunosInscritos: number;
  statusValidacao: string;
}

interface MensalidadeAluno {
  id: string; // Adicionado para corresponder ao ModalRegistrarPagamento
  alunoId: string;
  alunoNome: string;
  turma: string;
  mesReferencia: number;
  anoReferencia: number;
  valor: number;
  dataVencimento: Date;
  status: 'pendente' | 'paga' | 'atrasada' | 'cancelada';
  diasAtraso?: number;
}

// --- Components UI Micro ---

const StatusBadge = ({ status, diasAtraso }: { status: string, diasAtraso?: number }) => {
  const config = {
    paga: { bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200', icon: CheckCircle, label: 'Em dia' },
    pendente: { bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-200', icon: Clock, label: 'Pendente' },
    atrasada: { bg: 'bg-rose-50', text: 'text-rose-700', border: 'border-rose-200', icon: AlertTriangle, label: `Atraso ${diasAtraso || 0}d` },
    cancelada: { bg: 'bg-slate-50', text: 'text-slate-600', border: 'border-slate-200', icon: Ban, label: 'Cancelado' },
  };

  const current = config[status as keyof typeof config] || config.cancelada;
  const Icon = current.icon;

  return (
    <span className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border ${current.bg} ${current.text} ${current.border}`}>
      <Icon className="w-3.5 h-3.5" />
      {current.label}
    </span>
  );
};

const TurmaSkeleton = () => (
  <div className="bg-white border border-slate-200 rounded-xl p-6 mb-4 animate-pulse">
    <div className="flex justify-between items-center mb-4">
      <div className="h-6 bg-slate-100 rounded w-1/3"></div>
      <div className="h-6 bg-slate-100 rounded w-24"></div>
    </div>
    <div className="h-4 bg-slate-100 rounded w-full mb-2"></div>
    <div className="h-4 bg-slate-100 rounded w-2/3"></div>
  </div>
);

// --- Main Page Component ---

const TurmasAlunosFinanceiro: React.FC = () => {
  // --- States ---
  const [data, setData] = useState<{ turmas: Turma[], alunos: Aluno[], mensalidades: MensalidadeAluno[] }>({ turmas: [], alunos: [], mensalidades: [] });
  const [loading, setLoading] = useState(true);
  
  // UX States
  const [expandedTurmas, setExpandedTurmas] = useState<string[]>([]); // Accordion state
  const [busca, setBusca] = useState('');
  const [filtroStatus, setFiltroStatus] = useState<'todos' | 'inadimplentes'>('todos');
  
  // Modal States
  const [modalPagamento, setModalPagamento] = useState<{ show: boolean, aluno: Aluno | null }>({ show: false, aluno: null });

  // --- Data Fetching ---
  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        // Simulação de delay para ver o skeleton (remover em prod)
        // await new Promise(resolve => setTimeout(resolve, 1000));
        
        const [turmasRes, alunosRes, mensalidadesRes] = await Promise.all([
          fetch('/api/financeiro/turmas'),
          fetch('/api/financeiro/alunos'),
          fetch('/api/financeiro/mensalidades')
        ]);
        
        const [turmas, alunos, mensalidades] = await Promise.all([
          turmasRes.json(), 
          alunosRes.json(), 
          mensalidadesRes.json()
        ]);

        setData({ 
          turmas: Array.isArray(turmas) ? turmas : [], 
          alunos: Array.isArray(alunos) ? alunos : [], 
          mensalidades: Array.isArray(mensalidades) ? mensalidades : [] 
        });
      } catch (error) {
        console.error("Erro ao carregar dados", error);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  // --- Logic Helpers ---
  
  const toggleTurma = (turmaId: string) => {
    setExpandedTurmas(prev => 
      prev.includes(turmaId) ? prev.filter(id => id !== turmaId) : [...prev, turmaId]
    );
  };

  const getResumoFinanceiro = (turmaId: string) => {
    const alunosDaTurma = data.alunos.filter(a => a.turmaId === turmaId);
    const mensalidadesDaTurma = data.mensalidades.filter(m => alunosDaTurma.some(a => a.id === m.alunoId));
    
    const total = mensalidadesDaTurma.length;
    const pagas = mensalidadesDaTurma.filter(m => m.status === 'paga').length;
    const atrasadas = mensalidadesDaTurma.filter(m => m.status === 'atrasada').length;
    const arrecadacao = (pagas / (total || 1)) * 100; // Evitar div por 0

    return { total, pagas, atrasadas, arrecadacao, qtdAlunos: alunosDaTurma.length };
  };

  const formatCurrency = (val: number) => new Intl.NumberFormat('pt-AO', { style: 'currency', currency: 'AOA' }).format(val);

  // --- Filtering Logic ---
  const turmasProcessadas = useMemo(() => {
    return data.turmas.filter(t => {
      // Se houver busca, verifique se a turma ou algum aluno da turma corresponde
      if (busca) {
        const matchTurma = t.nome.toLowerCase().includes(busca.toLowerCase());
        const matchAluno = data.alunos.some(a => 
          a.turmaId === t.id && a.nome.toLowerCase().includes(busca.toLowerCase())
        );
        return matchTurma || matchAluno;
      }
      return true;
    });
  }, [data.turmas, data.alunos, busca]);

  return (
    <div className="min-h-screen bg-slate-50/50 p-6 md:p-8 font-sans text-slate-900">
      
      {/* Header Section */}
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">Gestão Financeira</h1>
          <p className="text-slate-500 mt-1">Controle de mensalidades por turma e alunos.</p>
        </div>
        <div className="flex items-center gap-3">
          <button className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 rounded-lg text-slate-700 hover:bg-slate-50 hover:border-slate-300 transition-all text-sm font-medium shadow-sm">
            <Download className="w-4 h-4" /> Exportar Relatório
          </button>
          <button className="flex items-center gap-2 px-4 py-2 bg-slate-900 text-white rounded-lg hover:bg-slate-800 transition-all text-sm font-medium shadow-lg shadow-slate-900/10">
            <Mail className="w-4 h-4" /> Cobrança em Lote
          </button>
        </div>
      </header>

      {/* Toolbar / Filters */}
      <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100 mb-6 flex flex-col md:flex-row gap-4 items-center justify-between sticky top-4 z-10 backdrop-blur-xl bg-white/90 supports-[backdrop-filter]:bg-white/60">
        <div className="relative w-full md:max-w-md group">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5 group-focus-within:text-indigo-600 transition-colors" />
          <input 
            type="text" 
            placeholder="Buscar por aluno, nº estudante ou turma..." 
            className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border-none rounded-xl text-slate-900 placeholder:text-slate-400 focus:ring-2 focus:ring-indigo-500/20 focus:bg-white transition-all"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
          />
        </div>

        <div className="flex items-center gap-2 w-full md:w-auto overflow-x-auto pb-1 md:pb-0">
          <div className="flex bg-slate-100 p-1 rounded-lg">
            <button 
              onClick={() => setFiltroStatus('todos')}
              className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all ${filtroStatus === 'todos' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
            >
              Todos
            </button>
            <button 
              onClick={() => setFiltroStatus('inadimplentes')}
              className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all ${filtroStatus === 'inadimplentes' ? 'bg-white text-rose-600 shadow-sm' : 'text-slate-500 hover:text-rose-600'}`}
            >
              Inadimplentes
            </button>
          </div>
          <button className="p-2.5 text-slate-500 hover:bg-slate-100 rounded-lg border border-transparent hover:border-slate-200 transition-all">
            <Filter className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Content Area */}
      <div className="space-y-4">
        {loading ? (
          <>
            <TurmaSkeleton />
            <TurmaSkeleton />
            <TurmaSkeleton />
          </>
        ) : turmasProcessadas.length === 0 ? (
          <div className="text-center py-20">
            <div className="bg-slate-100 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
              <Search className="w-8 h-8 text-slate-400" />
            </div>
            <h3 className="text-lg font-medium text-slate-900">Nenhum resultado encontrado</h3>
            <p className="text-slate-500">Tente ajustar seus filtros ou busca.</p>
          </div>
        ) : (
          turmasProcessadas.map(turma => {
            const stats = getResumoFinanceiro(turma.id);
            const isExpanded = expandedTurmas.includes(turma.id) || busca.length > 0;
            const alunosFiltrados = data.alunos.filter(a => a.turmaId === turma.id);

            // Se filtro de inadimplentes estiver ativo, verifique se a turma tem inadimplência relevante
            if (filtroStatus === 'inadimplentes' && stats.atrasadas === 0) return null;

            return (
              <div key={turma.id} className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm hover:shadow-md transition-shadow duration-300">
                
                {/* Turma Card Header (Clickable) */}
                <div 
                  onClick={() => toggleTurma(turma.id)}
                  className="p-5 cursor-pointer flex flex-col md:flex-row md:items-center justify-between gap-4 group"
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-1">
                      <h3 className="text-lg font-bold text-slate-900 group-hover:text-indigo-600 transition-colors">
                        {turma.nome} <span className="text-slate-400 font-normal text-sm ml-2">{turma.cursoNome}</span>
                      </h3>
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wide border ${turma.turno === 'M' ? 'bg-amber-50 text-amber-700 border-amber-200' : 'bg-indigo-50 text-indigo-700 border-indigo-200'}`}>
                        {turma.turno === 'M' ? 'Manhã' : 'Tarde'}
                      </span>
                    </div>
                    
                    {/* Progress Bar Micro-Interaction */}
                    <div className="flex items-center gap-4 mt-3">
                      <div className="flex-1 max-w-md">
                        <div className="flex justify-between text-xs mb-1.5">
                          <span className="text-slate-500 font-medium">Saúde Financeira</span>
                          <span className={`${stats.arrecadacao < 50 ? 'text-rose-600' : 'text-emerald-600'} font-bold`}>
                            {stats.arrecadacao.toFixed(0)}% Arrecadado
                          </span>
                        </div>
                        <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                          <div 
                            className={`h-full rounded-full transition-all duration-1000 ease-out ${stats.arrecadacao < 50 ? 'bg-rose-500' : stats.arrecadacao < 80 ? 'bg-amber-400' : 'bg-emerald-500'}`}
                            style={{ width: `${stats.arrecadacao}%` }}
                          />
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Quick Stats */}
                  <div className="flex items-center gap-6 md:border-l md:border-slate-100 md:pl-6">
                    <div className="text-center">
                      <div className="text-2xl font-bold text-slate-900">{stats.qtdAlunos}</div>
                      <div className="text-xs text-slate-500 font-medium uppercase tracking-wider">Alunos</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold text-rose-600">{stats.atrasadas}</div>
                      <div className="text-xs text-rose-600/80 font-medium uppercase tracking-wider">Atrasos</div>
                    </div>
                    <div className="text-slate-300">
                        {isExpanded ? <ChevronUp /> : <ChevronDown />}
                    </div>
                  </div>
                </div>

                {/* Expanded Details - Student List */}
                {isExpanded && (
                  <div className="border-t border-slate-100 bg-slate-50/50">
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-sm">
                        <thead className="bg-slate-50 text-slate-500 border-b border-slate-200">
                          <tr>
                            <th className="px-6 py-3 font-medium">Aluno</th>
                            <th className="px-6 py-3 font-medium">Status Mensalidade</th>
                            <th className="px-6 py-3 font-medium text-right">Valor</th>
                            <th className="px-6 py-3 font-medium text-right">Ações</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 bg-white">
                          {alunosFiltrados.map(aluno => {
                            const mensalidade = data.mensalidades.find(m => m.alunoId === aluno.id);
                            
                            // Filtro interno
                            if (filtroStatus === 'inadimplentes' && mensalidade?.status !== 'atrasada') return null;

                            return (
                              <tr key={aluno.id} className="group hover:bg-indigo-50/30 transition-colors">
                                <td className="px-6 py-4">
                                  <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 font-bold border border-slate-200 group-hover:border-indigo-200 group-hover:bg-white transition-colors">
                                      {aluno.nome.charAt(0)}
                                    </div>
                                    <div>
                                      <div className="font-medium text-slate-900">{aluno.nome}</div>
                                      <div className="text-xs text-slate-500 flex items-center gap-1">
                                        ID: {aluno.numeroEstudante || 'N/A'} 
                                        <span className="w-1 h-1 bg-slate-300 rounded-full"></span> 
                                        {aluno.bi}
                                      </div>
                                    </div>
                                  </div>
                                </td>
                                <td className="px-6 py-4">
                                  {mensalidade ? (
                                    <StatusBadge status={mensalidade.status} diasAtraso={mensalidade.diasAtraso} />
                                  ) : (
                                    <span className="text-slate-400 italic">Sem registro</span>
                                  )}
                                </td>
                                <td className="px-6 py-4 text-right font-medium text-slate-700">
                                  {mensalidade ? formatCurrency(mensalidade.valor) : '-'}
                                </td>
                                <td className="px-6 py-4 text-right">
                                  <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <button 
                                      title="Registrar Pagamento"
                                      onClick={(e) => { e.stopPropagation(); setModalPagamento({ show: true, aluno }); }}
                                      className="p-2 text-emerald-600 bg-emerald-50 hover:bg-emerald-100 rounded-lg border border-emerald-200 transition-colors"
                                    >
                                      <DollarSign className="w-4 h-4" />
                                    </button>
                                    <button 
                                      title="Cobrar"
                                      className="p-2 text-rose-600 bg-rose-50 hover:bg-rose-100 rounded-lg border border-rose-200 transition-colors"
                                    >
                                      <Mail className="w-4 h-4" />
                                    </button>
                                    <button 
                                      title="Ver Perfil"
                                      className="p-2 text-slate-500 hover:bg-slate-100 rounded-lg border border-transparent hover:border-slate-200 transition-colors"
                                    >
                                      <User className="w-4 h-4" />
                                    </button>
                                  </div>
                                </td>
                              </tr>
                            );
                          })}
                          {alunosFiltrados.length === 0 && (
                            <tr>
                              <td colSpan={4} className="px-6 py-8 text-center text-slate-400 italic">
                                Nenhum aluno nesta turma para os filtros selecionados.
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Modal Integration */}
      {modalPagamento.show && modalPagamento.aluno && (
        <ModalRegistrarPagamento 
          aluno={{ 
            id: modalPagamento.aluno.id, 
            nome: modalPagamento.aluno.nome, 
            turma: modalPagamento.aluno.turmaNome 
          }}
          mensalidades={data.mensalidades.filter(m => m.alunoId === modalPagamento.aluno?.id)}
          onClose={() => setModalPagamento({ show: false, aluno: null })}
          onConfirm={(dados) => {
            console.log("Pagamento:", dados);
            setModalPagamento({ show: false, aluno: null });
            // Aqui adicionaria o toast de sucesso
          }}
        />
      )}
    </div>
  );
};

export default TurmasAlunosFinanceiro;
