"use client";

import Link from 'next/link';
import React, { useState, useEffect, useMemo } from 'react';
import { 
  Search, Eye, AlertCircle, 
  CheckCircle, Clock, ChevronDown, ChevronUp, Mail, 
  Download, ArrowUpRight, Ban, Wallet, MessageCircle, X, Loader2
} from 'lucide-react';
import ModalExtratoAluno from './modal-extrato-aluno';
import { useParams } from 'next/navigation';
import { buildPortalHref } from '@/lib/navigation';
import { formatTurmaDisplayName } from '@/utils/formatters';
import { useToast, useConfirm } from "@/components/feedback/FeedbackSystem";

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
  statusFinanceiro: 'pendente' | 'paga' | 'atrasada' | 'cancelada';
  possuiMensalidades: boolean;
  valorEmDivida: number;
  diasAtraso?: number;
  qtdMensalidadesAtrasadas: number;
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
  dataVencimento: Date | string | null;
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
  const params = useParams();
  const escolaParam = params?.id as string;
  
  // --- States ---
  const [data, setData] = useState<{ turmas: Turma[], alunos: Aluno[] }>({ turmas: [], alunos: [] });
  const [loading, setLoading] = useState(true);
  const [mensalidadesByAluno, setMensalidadesByAluno] = useState<Record<string, MensalidadeAluno[]>>({});
  
  // UX States
  const [expandedTurmas, setExpandedTurmas] = useState<string[]>([]);
  const [busca, setBusca] = useState('');
  const [filtroStatus, setFiltroStatus] = useState<'todos' | 'inadimplentes'>('todos');
  
  // Modal States
  const [modalExtrato, setModalExtrato] = useState<{ show: boolean, aluno: Aluno | null }>({ show: false, aluno: null });
  const [modalCobranca, setModalCobranca] = useState(false);
  const [whatsappStatus, setWhatsappStatus] = useState<'connected' | 'disconnected' | 'checking' | 'disabled'>('checking');

  // Hooks
  const { success, error, warning } = useToast();
  const confirm = useConfirm();

  // --- Data Fetching ---
  useEffect(() => {
    if (!escolaParam) return;
    const fetchData = async () => {
      setLoading(true);
      try {
        const escolaQuery = `escola_id=${encodeURIComponent(escolaParam)}`;
        const [turmasRes, alunosRes] = await Promise.all([
          fetch(`/api/financeiro/turmas?${escolaQuery}`, { cache: 'no-store' }),
          fetch(`/api/financeiro/alunos?${escolaQuery}`, { cache: 'no-store' })
        ]);
        
        const [turmas, alunos] = await Promise.all([
          turmasRes.json(),
          alunosRes.json()
        ]);

        setData({ 
          turmas: Array.isArray(turmas) ? turmas : [], 
          alunos: Array.isArray(alunos) ? alunos : [],
        });
      } catch (error) {
        console.error("Erro ao carregar dados", error);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [escolaParam]);

  useEffect(() => {
    if (!escolaParam) return;
    const fetchWhatsappStatus = async () => {
      try {
        const response = await fetch(`/api/escola/${escolaParam}/admin/comunicacao/whatsapp`, { cache: 'no-store' });
        const res = await response.json();
        if (res.ok && res.data) {
          if (res.data.experimentalEnabled === false) {
            setWhatsappStatus('disabled');
          } else if (res.data.provider?.status === 'connected') {
            setWhatsappStatus('connected');
          } else {
            setWhatsappStatus('disconnected');
          }
        } else {
          setWhatsappStatus('disconnected');
        }
      } catch (err) {
        console.error(err);
        setWhatsappStatus('disconnected');
      }
    };
    fetchWhatsappStatus();
  }, [escolaParam]);

  // --- Logic Helpers ---
  const toggleTurma = (turmaId: string) => {
    setExpandedTurmas(prev => 
      prev.includes(turmaId) ? prev.filter(id => id !== turmaId) : [...prev, turmaId]
    );
  };

  const openExtrato = async (aluno: Aluno) => {
    setModalExtrato({ show: true, aluno });
    if (mensalidadesByAluno[aluno.id]) return;

    try {
      const response = await fetch(
        `/api/financeiro/mensalidades?alunoId=${encodeURIComponent(aluno.id)}&escola_id=${encodeURIComponent(escolaParam)}`,
        { cache: 'no-store' }
      );
      const payload = await response.json();
      setMensalidadesByAluno(prev => ({
        ...prev,
        [aluno.id]: Array.isArray(payload) ? payload : [],
      }));
    } catch (error) {
      console.error("Erro ao carregar extrato do aluno", error);
      setMensalidadesByAluno(prev => ({
        ...prev,
        [aluno.id]: [],
      }));
    }
  };

  const getResumoFinanceiro = (turmaId: string) => {
    const alunosDaTurma = data.alunos.filter(a => a.turmaId === turmaId);
    const pagas = alunosDaTurma.filter(aluno => aluno.statusFinanceiro === 'paga').length;
    const pendentes = alunosDaTurma.filter(aluno => aluno.statusFinanceiro === 'pendente').length;
    const atrasadas = alunosDaTurma.filter(aluno => aluno.statusFinanceiro === 'atrasada').length;
    const arrecadacao = (pagas / (alunosDaTurma.length || 1)) * 100;
    const totalEmDivida = alunosDaTurma.reduce((acc, aluno) => acc + Number(aluno.valorEmDivida ?? 0), 0);

    return { pagas, pendentes, atrasadas, arrecadacao, qtdAlunos: alunosDaTurma.length, totalEmDivida };
  };

  const formatCurrency = (val: number) => new Intl.NumberFormat('pt-AO', { style: 'currency', currency: 'AOA', maximumFractionDigits: 0 }).format(val);

  const resumoGeral = useMemo(() => {
    const totalAlunos = data.alunos.length;
    const totalAtrasadas = data.alunos.filter(a => a.statusFinanceiro === 'atrasada').length;
    const totalPendentes = data.alunos.filter(a => a.statusFinanceiro === 'pendente').length;
    const totalPagas = data.alunos.filter(a => a.statusFinanceiro === 'paga').length;
    const totalDivida = data.alunos.reduce((acc, a) => acc + Number(a.valorEmDivida ?? 0), 0);
    const taxaArrecadacao = totalAlunos > 0 ? (totalPagas / totalAlunos) * 100 : 0;

    return { totalAlunos, totalAtrasadas, totalPendentes, totalPagas, totalDivida, taxaArrecadacao };
  }, [data.alunos]);

  const handleCobrarWhatsApp = async (aluno: Aluno) => {
    if (aluno.valorEmDivida <= 0) {
      warning("Aviso", "Este aluno não possui dívidas pendentes.");
      return;
    }

    const ok = await confirm({
      title: "Cobrança via WhatsApp",
      message: `Deseja enviar um aviso de cobrança via WhatsApp (WAHA) para o responsável de ${aluno.nome}?`,
      confirmLabel: "Sim, Enviar",
    });

    if (!ok) return;

    try {
      const response = await fetch(`/api/escola/${escolaParam}/admin/comunicacao/whatsapp/bulk`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messageType: 'finance_charge',
          title: 'Aviso de Mensalidade',
          body: `Prezado responsável, gostaríamos de lembrar sobre a mensalidade pendente de ${aluno.nome} no valor de ${formatCurrency(aluno.valorEmDivida)}. Agradecemos a regularização.`,
          filters: {
            alunoIds: [aluno.id],
          },
          expectedCount: 1
        })
      });

      const res = await response.json();
      if (response.ok && res.ok !== false) {
        success("Sucesso", "Cobrança enviada com sucesso.");
      } else {
        error("Erro", res.error || "Não foi possível enviar a cobrança.");
      }
    } catch (err) {
      console.error(err);
      error("Erro", "Ocorreu uma falha no envio.");
    }
  };

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
    <div className="space-y-8 print:space-y-6 print:p-0">
      
      <style dangerouslySetInnerHTML={{ __html: `
        @media print {
          /* Ocultar elementos não executivos e navegações */
          aside, nav, header, button, form, .print\\:hidden, select, input, .flex-row-btn {
            display: none !important;
          }
          /* Resetar margens e fundos para papel */
          body, main, div, table {
            background: white !important;
            color: black !important;
            box-shadow: none !important;
          }
          .rounded-2xl, .rounded-xl {
            border-radius: 0 !important;
            border: none !important;
          }
          /* Evitar quebras de página desajustadas */
          .print\\:break-avoid {
            break-inside: avoid !important;
          }
          /* Forçar cores de fundo na impressão */
          * {
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
        }
      `}} />

      {/* CABEÇALHO PARA IMPRESSÃO */}
      <div className="hidden print:block border-b-2 border-slate-900 pb-4 mb-6">
        <h1 className="text-2xl font-bold text-slate-900 uppercase">Relatório Executivo de Mensalidades</h1>
        <p className="text-slate-500 text-xs mt-1">Escola: {escolaParam} | Data de Emissão: {new Date().toLocaleDateString('pt-PT')}</p>
      </div>

      {/* HEADER PROFISSIONAL */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 border-b border-slate-200 pb-6 print:hidden">
        <div>
          <div className="flex items-center gap-2 text-slate-500 text-xs font-bold uppercase tracking-wider mb-1">
            <Wallet className="w-4 h-4" />
            Gestão Financeira
          </div>
          <h1 className="text-3xl font-bold text-slate-900 tracking-tight">Turmas & Mensalidades</h1>
          <p className="text-slate-500 mt-1">Acompanhamento de inadimplência e arrecadação por turma.</p>
        </div>
        <div className="flex items-center gap-3">
          <button 
            onClick={() => window.print()}
            className="flex items-center gap-2 px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-slate-700 hover:bg-slate-50 hover:border-slate-300 transition-all text-sm font-bold shadow-sm"
          >
            <Download className="w-4 h-4" /> Relatório
          </button>
          {whatsappStatus === 'connected' && (
            <span className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-emerald-50 text-emerald-700 text-xs font-bold border border-emerald-100/50 shadow-sm print:hidden">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" /> WAHA Online
            </span>
          )}
          {whatsappStatus === 'disconnected' && (
            <span className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-rose-50 text-rose-700 text-xs font-bold border border-rose-100/50 shadow-sm print:hidden" title="O serviço de WhatsApp está desconectado.">
              <span className="h-1.5 w-1.5 rounded-full bg-rose-500 animate-pulse" /> WAHA Offline
            </span>
          )}
          {whatsappStatus === 'checking' && (
            <span className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-50 text-slate-400 text-xs font-bold border border-slate-100 shadow-sm print:hidden">
              <span className="h-1.5 w-1.5 rounded-full bg-slate-400 animate-pulse" /> WAHA status...
            </span>
          )}

          <button 
            onClick={() => setModalCobranca(true)}
            className="flex items-center gap-2 px-4 py-2.5 bg-slate-900 text-white rounded-xl hover:bg-slate-800 transition-all text-sm font-bold shadow-md print:hidden"
          >
            <Mail className="w-4 h-4" /> Disparar Cobranças
          </button>
        </div>
      </div>

      {/* RESUMO GERAL EXECUTIVO (KPIs Globais) */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4 print:break-avoid">
        {/* KPI 1: Arrecadação Global */}
        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm flex flex-col justify-between h-28 print:border-slate-300">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Taxa de Arrecadação</span>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-black text-[#1F6B3B]">{resumoGeral.taxaArrecadacao.toFixed(1)}%</span>
            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 print:hidden">Meta: 90%</span>
          </div>
        </div>

        {/* KPI 2: Total em Dívida */}
        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm flex flex-col justify-between h-28 print:border-slate-300">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Carteira em Atraso</span>
          <div className="mt-2">
            <span className="text-2xl font-black text-rose-600">{formatCurrency(resumoGeral.totalDivida)}</span>
          </div>
        </div>

        {/* KPI 3: Alunos Regulares */}
        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm flex flex-col justify-between h-28 print:border-slate-300">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Alunos Regulares</span>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-black text-slate-800">{resumoGeral.totalPagas}</span>
            <span className="text-xs text-slate-400">de {resumoGeral.totalAlunos} ativos</span>
          </div>
        </div>

        {/* KPI 4: Atrasos Pendentes */}
        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm flex flex-col justify-between h-28 print:border-slate-300">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Casos em Aberto</span>
          <div className="mt-2 flex items-baseline gap-4">
            <div>
              <span className="text-2xl font-black text-rose-600">{resumoGeral.totalAtrasadas}</span>
              <span className="text-[9px] font-bold text-slate-400 block uppercase">Atrasados</span>
            </div>
            <div>
              <span className="text-2xl font-black text-amber-600">{resumoGeral.totalPendentes}</span>
              <span className="text-[9px] font-bold text-slate-400 block uppercase">A Vencer</span>
            </div>
          </div>
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
                        {formatTurmaDisplayName(turma)}
                      </h3>
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wide border bg-slate-50 text-slate-500 border-slate-200">
                        {turma.cursoNome}
                      </span>
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wide border bg-slate-50 text-slate-500 border-slate-200">
                        {turma.turno === 'M' ? 'Manhã' : 'Tarde'}
                      </span>
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wide border ${
                          stats.atrasadas > 0
                            ? 'bg-rose-50 text-rose-700 border-rose-200'
                            : stats.pendentes > 0
                              ? 'bg-amber-50 text-amber-700 border-amber-200'
                              : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                        }`}
                      >
                        {stats.atrasadas > 0 ? 'Em atraso' : stats.pendentes > 0 ? 'Pendente' : 'Regular'}
                      </span>
                    </div>
                    
                    {/* Barra de Progresso Financeiro */}
                    <div className="w-full max-w-sm">
                      <div className="flex justify-between text-[10px] font-bold uppercase tracking-wider mb-1.5">
                        <span className="text-slate-400">Arrecadação</span>
                        <span className={stats.arrecadacao < 80 ? 'text-klasse-gold-600' : 'text-[#1F6B3B]'}>
                          {stats.arrecadacao.toFixed(0)}%
                        </span>
                      </div>
                      <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
                        <div 
                          className={`h-full transition-all duration-1000 ease-out ${stats.arrecadacao < 50 ? 'bg-rose-500' : stats.arrecadacao < 80 ? 'bg-klasse-gold-400' : 'bg-[#1F6B3B]'}`}
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
                    <div className="text-center">
                      <div className={`text-xl font-bold ${stats.pendentes > 0 ? 'text-amber-600' : 'text-slate-300'}`}>{stats.pendentes}</div>
                      <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Pendentes</div>
                    </div>
                    <div className="text-center border-l border-slate-100 pl-4 min-w-[90px]">
                      <div className={`text-sm font-black ${stats.totalEmDivida > 0 ? 'text-rose-600' : 'text-slate-300'}`}>
                        {stats.totalEmDivida > 0 ? formatCurrency(stats.totalEmDivida) : '—'}
                      </div>
                      <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mt-1">Dívida</div>
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
                          <th className="px-6 py-3 text-right">Em dívida</th>
                          <th className="px-6 py-3 text-right pr-8">Ações</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 bg-white">
                        {alunosFiltrados.map(aluno => {
                          // Filtro Interno
                          if (filtroStatus === 'inadimplentes' && aluno.statusFinanceiro !== 'atrasada') return null;

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
                                {aluno.possuiMensalidades ? (
                                  <StatusBadge status={aluno.statusFinanceiro} diasAtraso={aluno.diasAtraso} />
                                ) : (
                                  <span className="text-slate-300 text-xs italic">Sem registro</span>
                                )}
                              </td>
                              <td className="px-6 py-4 text-right font-medium text-slate-700 tabular-nums">
                                {aluno.valorEmDivida > 0 ? formatCurrency(aluno.valorEmDivida) : '-'}
                              </td>
                              <td className="px-6 py-4 pr-8 text-right">
                                <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                  {/* Botão Pagar: Dourado (Ação) */}
                                  <button 
                                    title="Ver Extrato"
                                    onClick={(e) => { e.stopPropagation(); void openExtrato(aluno); }}
                                    className="p-1.5 text-[#E3B23C] bg-[#E3B23C]/10 hover:bg-[#E3B23C] hover:text-white rounded-lg transition-colors"
                                  >
                                    <Eye className="w-4 h-4" />
                                  </button>
                                  {/* Botão Cobrar WhatsApp: Verde (Sucesso) */}
                                  <button 
                                    title="Cobrar por WhatsApp"
                                    onClick={(e) => { e.stopPropagation(); void handleCobrarWhatsApp(aluno); }}
                                    className="p-1.5 text-emerald-600 bg-emerald-50 hover:bg-emerald-600 hover:text-white rounded-lg transition-colors"
                                  >
                                    <MessageCircle className="w-4 h-4" />
                                  </button>
                                  {/* Botão Cobrar: Slate (Neutro) */}
                                  <button 
                                    title="Cobrar por Email"
                                    className="p-1.5 text-slate-500 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
                                  >
                                    <Mail className="w-4 h-4" />
                                  </button>
                                  {/* Botão Perfil: Slate (Neutro) */}
                                  <Link
                                    href={buildPortalHref(escolaParam, `/admin/alunos/${aluno.id}`)}
                                    title="Ver Perfil Completo"
                                    className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-50 rounded-lg transition-colors"
                                  >
                                    <ArrowUpRight className="w-4 h-4" />
                                  </Link>
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

      {/* Modal de Extrato */}
      {modalExtrato.show && modalExtrato.aluno && (
        <ModalExtratoAluno 
          aluno={{ 
            id: modalExtrato.aluno.id, 
            nome: modalExtrato.aluno.nome, 
            turma: modalExtrato.aluno.turmaNome 
          }}
          mensalidades={mensalidadesByAluno[modalExtrato.aluno.id] ?? []}
          onClose={() => setModalExtrato({ show: false, aluno: null })}
        />
      )}
      {/* Modal de Cobrança em Massa */}
      {modalCobranca && (
        <ModalBulkCobranca
          escolaParam={escolaParam}
          turmas={data.turmas}
          alunos={data.alunos}
          onClose={() => setModalCobranca(false)}
        />
      )}
    </div>
  );
};

interface ModalBulkCobrancaProps {
  escolaParam: string;
  turmas: Turma[];
  alunos: Aluno[];
  onClose: () => void;
}

const ModalBulkCobranca: React.FC<ModalBulkCobrancaProps> = ({ escolaParam, turmas, alunos, onClose }) => {
  const [canal, setCanal] = useState<'whatsapp' | 'email'>('whatsapp');
  const [turmaId, setTurmaId] = useState<string>('todas');
  const [grupo, setGrupo] = useState<'inadimplentes' | 'todos'>('inadimplentes');
  const [mensagem, setMensagem] = useState(
    "Prezado encarregado, lembramos que existem mensalidades em aberto referentes ao ano letivo em curso. Solicitamos a regularização das propinas na secretaria ou o envio do comprovativo via portal. Obrigado."
  );
  const [sending, setSending] = useState(false);
  const { success, error, warning } = useToast();

  // Calculate target recipients count
  const targetAlunos = useMemo(() => {
    return alunos.filter(a => {
      // Filter by class
      if (turmaId !== 'todas' && a.turmaId !== turmaId) return false;
      // Filter by finance status
      if (grupo === 'inadimplentes') return a.statusFinanceiro === 'atrasada';
      return a.statusFinanceiro === 'atrasada' || a.statusFinanceiro === 'pendente';
    });
  }, [alunos, turmaId, grupo]);

  const handleSend = async () => {
    if (targetAlunos.length === 0) {
      warning("Aviso", "Nenhum destinatário elegível encontrado para os filtros selecionados.");
      return;
    }

    setSending(true);

    try {
      if (canal === 'whatsapp') {
        const response = await fetch(`/api/escola/${escolaParam}/admin/comunicacao/whatsapp/bulk`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            messageType: 'finance_charge',
            title: 'Lembrete de Propinas',
            body: mensagem,
            filters: {
              alunoIds: targetAlunos.map(a => a.id),
            },
            expectedCount: targetAlunos.length
          })
        });

        const res = await response.json();
        if (response.ok && res.ok !== false) {
          success("Sucesso", `Mensagens enviadas para a fila de processamento (${targetAlunos.length} contatos).`);
          onClose();
        } else {
          error("Erro", res.error || "Não foi possível disparar as mensagens via WhatsApp.");
        }
      } else {
        // Email mock or placeholder
        success("Sucesso", `E-mails de cobrança enviados para processamento (${targetAlunos.length} contatos).`);
        onClose();
      }
    } catch (err) {
      console.error(err);
      error("Erro", "Ocorreu uma falha na rede ou servidor.");
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl max-w-lg w-full overflow-hidden shadow-2xl border border-slate-100 flex flex-col">
        <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50">
          <div>
            <h3 className="text-lg font-black text-slate-900">Disparar Cobranças</h3>
            <p className="text-slate-500 text-xs mt-0.5">Envio de lembretes e avisos financeiros.</p>
          </div>
          <button onClick={onClose} className="p-1 rounded-full text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-4 overflow-y-auto max-h-[70vh]">
          {/* Canal */}
          <div>
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-2">Canal de Comunicação</label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setCanal('whatsapp')}
                className={`py-2 px-3 rounded-lg border text-xs font-bold flex items-center justify-center gap-2 transition ${
                  canal === 'whatsapp' ? 'border-emerald-600 bg-emerald-50 text-emerald-700' : 'border-slate-200 text-slate-600 hover:border-slate-300'
                }`}
              >
                <MessageCircle className="w-4 h-4" /> WhatsApp (WAHA)
              </button>
              <button
                type="button"
                onClick={() => setCanal('email')}
                className={`py-2 px-3 rounded-lg border text-xs font-bold flex items-center justify-center gap-2 transition ${
                  canal === 'email' ? 'border-blue-600 bg-blue-50 text-blue-700' : 'border-slate-200 text-slate-600 hover:border-slate-300'
                }`}
              >
                <Mail className="w-4 h-4" /> E-mail
              </button>
            </div>
          </div>

          {/* Turmas */}
          <div>
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-1.5">Turma Alvo</label>
            <select
              value={turmaId}
              onChange={(e) => setTurmaId(e.target.value)}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs font-medium text-slate-700 focus:ring-0 outline-none"
            >
              <option value="todas">Todas as turmas</option>
              {turmas.map(t => (
                <option key={t.id} value={t.id}>{formatTurmaDisplayName(t)}</option>
              ))}
            </select>
          </div>

          {/* Grupo Financeiro */}
          <div>
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-2">Grupo Financeiro</label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setGrupo('inadimplentes')}
                className={`py-2 px-3 rounded-lg border text-xs font-bold transition ${
                  grupo === 'inadimplentes' ? 'border-rose-300 bg-rose-50/50 text-rose-700' : 'border-slate-200 text-slate-600 hover:border-slate-300'
                }`}
              >
                Apenas Inadimplentes
              </button>
              <button
                type="button"
                onClick={() => setGrupo('todos')}
                className={`py-2 px-3 rounded-lg border text-xs font-bold transition ${
                  grupo === 'todos' ? 'border-amber-300 bg-amber-50/50 text-amber-700' : 'border-slate-200 text-slate-600 hover:border-slate-300'
                }`}
              >
                Todos os Pendentes
              </button>
            </div>
          </div>

          {/* Preview Count */}
          <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between">
            <span className="text-xs text-slate-500 font-medium">Destinatários Estimados</span>
            <span className="px-2 py-0.5 bg-slate-200 text-slate-800 rounded text-xs font-black">
              {targetAlunos.length} Encarregados
            </span>
          </div>

          {/* Mensagem */}
          <div>
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-1.5">Corpo da Mensagem</label>
            <textarea
              value={mensagem}
              onChange={(e) => setMensagem(e.target.value)}
              rows={4}
              maxLength={1000}
              placeholder="Escreva a mensagem de cobrança..."
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs font-medium text-slate-700 focus:ring-0 outline-none resize-none"
            />
          </div>
        </div>

        <div className="p-6 border-t border-slate-100 flex justify-end gap-3 bg-slate-50">
          <button
            type="button"
            disabled={sending}
            onClick={onClose}
            className="px-4 py-2 border border-slate-200 rounded-xl text-slate-600 hover:bg-slate-100 text-xs font-bold transition"
          >
            Cancelar
          </button>
          <button
            type="button"
            disabled={sending || targetAlunos.length === 0}
            onClick={handleSend}
            className="px-4 py-2 bg-slate-900 text-white rounded-xl hover:bg-slate-800 text-xs font-bold flex items-center gap-2 transition disabled:opacity-50"
          >
            {sending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
            Enviar Lote
          </button>
        </div>
      </div>
    </div>
  );
};

export default TurmasAlunosFinanceiro;
