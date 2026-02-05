"use client";

import React, { useState, useEffect, useMemo } from 'react';
import { 
  Search, Filter, DollarSign, AlertCircle, 
  CheckCircle, Clock, ChevronDown, ChevronUp, Mail, 
  Download, Users, ArrowUpRight, Ban, User, Wallet
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
  avatarUrl?: string;
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
  id: string;
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

// --- Helper Components ---

const StatusBadge = ({ status, diasAtraso }: { status: string, diasAtraso?: number }) => {
  // Enterprise Palette
  const config = {
    paga: { bg: 'bg-[#1F6B3B]/10', text: 'text-[#1F6B3B]', border: 'border-[#1F6B3B]/20', icon: CheckCircle, label: 'Regular' },
    pendente: { bg: 'bg-slate-100', text: 'text-slate-600', border: 'border-slate-200', icon: Clock, label: 'A vencer' },
    atrasada: { bg: 'bg-rose-50', text: 'text-rose-700', border: 'border-rose-200', icon: AlertCircle, label: `${diasAtraso || 0}d Atraso` },
    cancelada: { bg: 'bg-slate-50', text: 'text-slate-400', border: 'border-slate-100', icon: Ban, label: 'Inativo' },
  };

  const current = config[status as keyof typeof config] || config.cancelada;
  const Icon = current.icon;

  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold uppercase tracking-wide border ${current.bg} ${current.text} ${current.border}`}>
      <Icon className="w-3 h-3" />
      {current.label}
    </span>
  );
};

const TurmaSkeleton = () => (
  <div className="bg-white border border-slate-200 rounded-2xl p-6 mb-4 animate-pulse flex justify-between items-center">
    <div className="space-y-3 w-1/2">
      <div className="h-5 bg-slate-100 rounded w-1/3"></div>
      <div className="h-3 bg-slate-50 rounded w-2/3"></div>
    </div>
    <div className="h-8 w-8 bg-slate-100 rounded-full"></div>
  </div>
);

// --- Main Page ---

const TurmasAlunosFinanceiro: React.FC = () => {
  // --- States ---
  const [data, setData] = useState<{ turmas: Turma[], alunos: Aluno[], mensalidades: MensalidadeAluno[] }>({ turmas: [], alunos: [], mensalidades: [] });
  const [loading, setLoading] = useState(true);
  
  // UX States
  const [expandedTurmas, setExpandedTurmas] = useState<string[]>([]);
  const [busca, setBusca] = useState('');
  const [filtroStatus, setFiltroStatus] = useState<'todos' | 'inadimplentes'>('todos');
  
  // Modal States
  const [modalPagamento, setModalPagamento] = useState<{ show: boolean, aluno: Aluno | null }>({ show: false, aluno: null });

  // --- Data Fetching ---
  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        // Mock fetch calls - substituir por chamadas reais
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
    const arrecadacao = (pagas / (total || 1)) * 100;

    return { total, pagas, atrasadas, arrecadacao, qtdAlunos: alunosDaTurma.length };
  };

  const formatCurrency = (val: number) => new Intl.NumberFormat('pt-AO', { style: 'currency', currency: 'AOA', maximumFractionDigits: 0 }).format(val);

  // --- Filtering ---
  const turmasProcessadas = useMemo(() => {
    return data.turmas.filter(t => {
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
    <div className="min-h-screen bg-slate-50 p-6 md:p-8 font-sans text-slate-900 space-y-8">
      
      {/* HEADER PROFISSIONAL */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 border-b border-slate-200 pb-6">
        <div>
          <div className="flex items-center gap-2 text-slate-500 text-xs font-bold uppercase tracking-wider mb-1">
            <Wallet className="w-4 h-4" />
            Gestão Financeira
          </div>
          <h1 className="text-3xl font-bold text-slate-900 tracking-tight">Turmas & Mensalidades</h1>
          <p className="text-slate-500 mt-1">Acompanhamento de inadimplência e arrecadação por turma.</p>
        </div>
        <div className="flex items-center gap-3">
          <button className="flex items-center gap-2 px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-slate-700 hover:bg-slate-50 hover:border-slate-300 transition-all text-sm font-bold shadow-sm">
            <Download className="w-4 h-4" /> Relatório
          </button>
          <button className="flex items-center gap-2 px-4 py-2.5 bg-slate-900 text-white rounded-xl hover:bg-slate-800 transition-all text-sm font-bold shadow-md">
            <Mail className="w-4 h-4" /> Disparar Cobranças
          </button>
        </div>
      </div>

      {/* TOOLBAR & FILTROS */}
      <div className="bg-white rounded-2xl p-2 shadow-sm border border-slate-200 flex flex-col md:flex-row gap-4 items-center justify-between">
        
        {/* Search Input */}
        <div className="relative w-full md:max-w-md group px-2">
          <Search className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4 group-focus-within:text-[#E3B23C] transition-colors" />
          <input 
            type="text" 
            placeholder="Buscar aluno, ID ou turma..." 
            className="w-full pl-10 pr-4 py-2.5 bg-transparent border-none text-sm font-medium text-slate-900 placeholder:text-slate-400 focus:ring-0 outline-none transition-all"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
          />
        </div>

        {/* Filtros */}
        <div className="flex items-center gap-2 w-full md:w-auto p-1 bg-slate-100 rounded-xl">
          <button 
            onClick={() => setFiltroStatus('todos')}
            className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${filtroStatus === 'todos' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
          >
            Todas as Turmas
          </button>
          <button 
            onClick={() => setFiltroStatus('inadimplentes')}
            className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${filtroStatus === 'inadimplentes' ? 'bg-white text-rose-700 shadow-sm' : 'text-slate-500 hover:text-rose-700'}`}
          >
            Apenas Inadimplentes
          </button>
        </div>
      </div>

      {/* CONTEÚDO PRINCIPAL (LISTA DE TURMAS) */}
      <div className="space-y-4">
        {loading ? (
          <>
            <TurmaSkeleton />
            <TurmaSkeleton />
          </>
        ) : turmasProcessadas.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 bg-white rounded-2xl border border-dashed border-slate-300">
            <div className="p-4 bg-slate-50 rounded-full mb-4">
              <Search className="w-8 h-8 text-slate-300" />
            </div>
            <h3 className="text-lg font-bold text-slate-900">Nenhum resultado</h3>
            <p className="text-slate-500 text-sm">Tente ajustar os filtros ou termo de busca.</p>
          </div>
        ) : (
          turmasProcessadas.map(turma => {
            const stats = getResumoFinanceiro(turma.id);
            const isExpanded = expandedTurmas.includes(turma.id) || busca.length > 0;
            const alunosFiltrados = data.alunos.filter(a => a.turmaId === turma.id);

            // Se filtro ativo, esconde turmas "limpas"
            if (filtroStatus === 'inadimplentes' && stats.atrasadas === 0) return null;

            return (
              <div key={turma.id} className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm transition-all hover:border-slate-300 hover:shadow-md">
                
                {/* Header da Turma (Resumo) */}
                <div 
                  onClick={() => toggleTurma(turma.id)}
                  className="p-6 cursor-pointer flex flex-col md:flex-row items-center justify-between gap-6 group"
                >
                  {/* Info Básica */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="text-lg font-bold text-slate-900 group-hover:text-[#E3B23C] transition-colors truncate">
                        {turma.nome}
                      </h3>
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wide border bg-slate-50 text-slate-500 border-slate-200">
                        {turma.cursoNome}
                      </span>
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wide border bg-slate-50 text-slate-500 border-slate-200">
                        {turma.turno === 'M' ? 'Manhã' : 'Tarde'}
                      </span>
                    </div>
                    
                    {/* Barra de Progresso Financeiro */}
                    <div className="w-full max-w-sm">
                      <div className="flex justify-between text-[10px] font-bold uppercase tracking-wider mb-1.5">
                        <span className="text-slate-400">Arrecadação</span>
                        <span className={stats.arrecadacao < 80 ? 'text-amber-600' : 'text-[#1F6B3B]'}>
                          {stats.arrecadacao.toFixed(0)}%
                        </span>
                      </div>
                      <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
                        <div 
                          className={`h-full transition-all duration-1000 ease-out ${stats.arrecadacao < 50 ? 'bg-rose-500' : stats.arrecadacao < 80 ? 'bg-amber-400' : 'bg-[#1F6B3B]'}`}
                          style={{ width: `${stats.arrecadacao}%` }}
                        />
                      </div>
                    </div>
                  </div>

                  {/* KPIs Rápidos */}
                  <div className="flex items-center gap-8 border-l border-slate-100 pl-8">
                    <div className="text-center">
                      <div className="text-xl font-bold text-slate-900">{stats.qtdAlunos}</div>
                      <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Alunos</div>
                    </div>
                    <div className="text-center">
                      <div className={`text-xl font-bold ${stats.atrasadas > 0 ? 'text-rose-600' : 'text-slate-300'}`}>{stats.atrasadas}</div>
                      <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Atrasos</div>
                    </div>
                    <div className={`p-2 rounded-full transition-colors ${isExpanded ? 'bg-slate-100 text-slate-600' : 'text-slate-300 group-hover:text-slate-500'}`}>
                        {isExpanded ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                    </div>
                  </div>
                </div>

                {/* Tabela Expandida (Detalhes) */}
                {isExpanded && (
                  <div className="border-t border-slate-100 bg-slate-50/50">
                    <table className="w-full text-left text-sm">
                      <thead className="bg-slate-50 text-slate-400 text-xs font-bold uppercase tracking-wider border-b border-slate-200">
                        <tr>
                          <th className="px-6 py-3 pl-8">Aluno</th>
                          <th className="px-6 py-3 text-center">Status</th>
                          <th className="px-6 py-3 text-right">Mensalidade</th>
                          <th className="px-6 py-3 text-right pr-8">Ações</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 bg-white">
                        {alunosFiltrados.map(aluno => {
                          const mensalidade = data.mensalidades.find(m => m.alunoId === aluno.id);
                          
                          // Filtro Interno
                          if (filtroStatus === 'inadimplentes' && mensalidade?.status !== 'atrasada') return null;

                          return (
                            <tr key={aluno.id} className="group hover:bg-slate-50 transition-colors">
                              <td className="px-6 py-4 pl-8">
                                <div className="flex items-center gap-3">
                                  <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 font-bold border border-slate-200 text-xs">
                                    {aluno.nome.charAt(0)}
                                  </div>
                                  <div>
                                    <div className="font-bold text-slate-700">{aluno.nome}</div>
                                    <div className="text-[10px] text-slate-400 font-mono">
                                      ID: {aluno.numeroEstudante || 'N/A'}
                                    </div>
                                  </div>
                                </div>
                              </td>
                              <td className="px-6 py-4 text-center">
                                {mensalidade ? (
                                  <StatusBadge status={mensalidade.status} diasAtraso={mensalidade.diasAtraso} />
                                ) : (
                                  <span className="text-slate-300 text-xs italic">Sem registro</span>
                                )}
                              </td>
                              <td className="px-6 py-4 text-right font-medium text-slate-700 tabular-nums">
                                {mensalidade ? formatCurrency(mensalidade.valor) : '-'}
                              </td>
                              <td className="px-6 py-4 pr-8 text-right">
                                <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                  {/* Botão Pagar: Dourado (Ação) */}
                                  <button 
                                    title="Registrar Pagamento"
                                    onClick={(e) => { e.stopPropagation(); setModalPagamento({ show: true, aluno }); }}
                                    className="p-1.5 text-[#E3B23C] bg-[#E3B23C]/10 hover:bg-[#E3B23C] hover:text-white rounded-lg transition-colors"
                                  >
                                    <DollarSign className="w-4 h-4" />
                                  </button>
                                  {/* Botão Cobrar: Slate (Neutro) */}
                                  <button 
                                    title="Cobrar por Email"
                                    className="p-1.5 text-slate-500 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
                                  >
                                    <Mail className="w-4 h-4" />
                                  </button>
                                  {/* Botão Perfil: Slate (Neutro) */}
                                  <button 
                                    title="Ver Perfil Completo"
                                    className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-50 rounded-lg transition-colors"
                                  >
                                    <ArrowUpRight className="w-4 h-4" />
                                  </button>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                        {alunosFiltrados.length === 0 && (
                          <tr>
                            <td colSpan={4} className="px-6 py-8 text-center text-slate-400 italic text-sm">
                              Nenhum aluno encontrado nesta turma com os filtros atuais.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Modal de Pagamento */}
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
          }}
        />
      )}
    </div>
  );
};

export default TurmasAlunosFinanceiro;