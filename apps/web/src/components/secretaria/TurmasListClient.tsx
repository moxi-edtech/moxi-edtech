"use client";

import { useEffect, useMemo, useState, Fragment } from "react";
import Link from "next/link";
import { 
  Loader2, Search, ArrowLeft,
  Users, BookOpen, BarChart3, Building2, Calendar,
  Eye, Link as LinkIcon, Plus, Trash2,
  GraduationCap, School, ScrollText, MoreVertical
} from "lucide-react";

import TurmaForm from "./TurmaForm";
import AtribuirProfessorForm from "./AtribuirProfessorForm";
import { useEscolaId } from "@/hooks/useEscolaId";
import { buildEscolaUrl } from "@/lib/escola/url";

// --- TIPOS ---
interface TurmaItem {
  id: string;
  nome: string;
  turno: string;
  ano_letivo: number | null;
  session_id?: string;
  sala?: string;
  capacidade_maxima?: number;
  ocupacao_atual?: number;
  ultima_matricula: string | null;
  classe_nome?: string;
  curso_nome?: string;
  curso_tipo?: string; 
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
  manha: "Manhã", tarde: "Tarde", noite: "Noite", integral: "Integral", sem_turno: "Sem turno",
};

// --- HELPERS (Lógica Pura) ---

const getOcupacao = (t: TurmaItem) => {
  const max = t.capacidade_maxima || 30;
  const atual = t.ocupacao_atual || 0;
  const pct = Math.round((atual / max) * 100);
  
  let color = 'bg-emerald-500';
  let textColor = 'text-emerald-600';
  
  if (pct >= 90) { color = 'bg-rose-500'; textColor = 'text-rose-600'; }
  else if (pct >= 70) { color = 'bg-amber-500'; textColor = 'text-amber-600'; }

  return { atual, max, pct, color, textColor };
};

const getDisplayInfo = (t: TurmaItem) => {
  const tipoBanco = t.curso_tipo || 'geral';
  const cursoLabel = t.curso_nome || "Curso Geral";
  
  let classeLabel = t.classe_nome || "";
  const matchNum = (classeLabel + " " + t.nome).match(/(\d+)/);
  const numeroClasse = matchNum ? parseInt(matchNum[1], 10) : 0;

  if (!classeLabel || classeLabel === 'Classe não definida') {
      classeLabel = numeroClasse > 0 ? `${numeroClasse}ª Classe` : t.nome;
  }

  // Lógica de ícones e cores por tipo de ensino
  if (['tecnico', 'curso_tecnico'].includes(tipoBanco)) {
      return { main: cursoLabel, sub: classeLabel, isHighlight: true, color: 'purple', icon: GraduationCap };
  }
  if (['puniv', 'curso_puniv'].includes(tipoBanco)) {
      return { main: cursoLabel, sub: `${classeLabel} (PUNIV)`, isHighlight: true, color: 'blue', icon: ScrollText };
  }
  if (tipoBanco === 'ciclo1' || (numeroClasse >= 7 && numeroClasse <= 9)) {
      return { main: classeLabel, sub: "Iº Ciclo do Secundário", isHighlight: false, color: 'slate', icon: School };
  }
  if (tipoBanco === 'primario' || (numeroClasse >= 1 && numeroClasse <= 6)) {
      return { main: classeLabel, sub: "Ensino Primário", isHighlight: false, color: 'slate', icon: BookOpen };
  }

  return { main: classeLabel, sub: "Ensino Geral", isHighlight: false, color: 'slate', icon: School };
};

// --- SUB-COMPONENTES ---

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

// Componente isolado para a Linha da Tabela (Melhora performance e legibilidade)
function TurmaRow({ 
  turma, 
  isExpanded, 
  onToggleExpand, 
  assignments, 
  loadingAssignments, 
  onAddProfessor 
}: { 
  turma: TurmaItem, 
  isExpanded: boolean, 
  onToggleExpand: () => void,
  assignments: any[] | null,
  loadingAssignments: boolean,
  onAddProfessor: () => void
}) {
  const stats = getOcupacao(turma);
  const info = getDisplayInfo(turma); 
  const InfoIcon = info.icon;

  // Utilitário para classes de cor dinâmicas
  const getColors = (color: string) => {
     if (color === 'purple') return { text: 'text-purple-700', icon: 'text-purple-500', bg: 'bg-purple-50' };
     if (color === 'blue') return { text: 'text-blue-700', icon: 'text-blue-500', bg: 'bg-blue-50' };
     return { text: 'text-slate-700', icon: 'text-slate-400', bg: 'bg-slate-50' };
  };
  const theme = getColors(info.color);

  return (
    <Fragment>
      <tr className={`transition-colors group ${isExpanded ? 'bg-slate-50' : 'hover:bg-slate-50/80'}`}>
        <td className="px-6 py-4">
           <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-white flex items-center justify-center text-slate-600 font-bold text-sm border border-slate-200 shadow-sm">
                 {(turma.nome || 'S/N').substring(0,2).toUpperCase()}
              </div>
              <div>
                 <Link href={`/secretaria/turmas/${turma.id}`} className="font-bold text-sm text-slate-800 hover:text-teal-600 hover:underline decoration-teal-600/30 underline-offset-2">
                    {turma.nome || 'Turma sem nome'}
                 </Link>
                 <p className="text-xs text-slate-400">{turma.ano_letivo}</p>
              </div>
           </div>
        </td>

        <td className="px-6 py-4">
            <div className="space-y-1">
                <div className={`flex items-center gap-1.5 text-sm font-medium ${theme.text}`}>
                    <InfoIcon className={`w-3.5 h-3.5 ${theme.icon}`}/>
                    {info.main}
                </div>
                <div className="flex items-center gap-1.5 text-xs text-slate-500 ml-0.5">
                    <BookOpen className="w-3 h-3 text-slate-400"/>
                    {info.sub}
                </div>
            </div>
        </td>

        <td className="px-6 py-4">
            <div className="space-y-1">
                <div className="text-sm text-slate-600 font-medium flex items-center gap-1.5">
                    <Building2 className="w-3.5 h-3.5 text-slate-400"/> {turma.sala || 'Sem sala'}
                </div>
                <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-slate-100 text-slate-600`}>
                    {TURNO_LABELS[turma.turno] || turma.turno}
                </span>
            </div>
        </td>
        
        <td className="px-6 py-4">
            <div className="w-full max-w-[140px]">
                <div className="flex justify-between text-xs mb-1">
                    <span className="font-bold text-slate-700">{stats.atual}/{stats.max}</span>
                    <span className={`${stats.textColor} font-bold`}>{stats.pct}%</span>
                </div>
                <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
                    <div className={`h-full ${stats.color}`} style={{width: `${Math.min(stats.pct, 100)}%`}}></div>
                </div>
            </div>
        </td>

        <td className="px-6 py-4 text-right">
            <div className="flex justify-end gap-1 opacity-80 group-hover:opacity-100 transition-opacity">
                {/* Botão Principal: Ver Detalhes */}
                <Link href={`/secretaria/turmas/${turma.id}`} className="p-2 text-teal-600 bg-teal-50 hover:bg-teal-100 rounded-lg transition" title="Abrir Turma (Pautas)">
                    <Eye className="w-4 h-4"/>
                </Link>
                
                {/* Botão Secundário: Professores */}
                <button onClick={onToggleExpand} className={`p-2 rounded-lg transition ${isExpanded ? 'text-purple-600 bg-purple-50' : 'text-slate-400 hover:text-purple-600 hover:bg-purple-50'}`} title="Professores">
                    <LinkIcon className="w-4 h-4"/>
                </button>
                
                <button className="p-2 text-slate-400 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition">
                    <MoreVertical className="w-4 h-4"/>
                </button>
            </div>
        </td>
      </tr>

      {/* Área Expandida: Atribuições */}
      {isExpanded && (
        <tr className="bg-slate-50/50 border-b border-slate-200 animate-in fade-in duration-200">
            <td colSpan={5} className="px-6 py-4">
                <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm ml-10 relative before:content-[''] before:absolute before:left-[-20px] before:top-[-20px] before:w-[20px] before:h-[40px] before:border-b-2 before:border-l-2 before:border-slate-200 before:rounded-bl-xl">
                    <div className="flex justify-between items-center mb-4 border-b border-slate-100 pb-2">
                        <h4 className="font-bold text-sm text-slate-700 flex items-center gap-2">
                            <Users className="w-4 h-4 text-purple-500"/> Professores da Turma
                        </h4>
                        <button onClick={onAddProfessor} className="text-xs font-bold bg-purple-600 text-white px-3 py-1.5 rounded-lg hover:bg-purple-700 transition flex items-center gap-1">
                            <Plus size={14}/> Atribuir
                        </button>
                    </div>
                    
                    {loadingAssignments ? (
                        <div className="py-6 text-center text-xs text-slate-400 flex items-center justify-center gap-2">
                            <Loader2 className="w-4 h-4 animate-spin"/> Buscando professores...
                        </div>
                    ) : !assignments || assignments.length === 0 ? (
                        <div className="py-4 text-center text-xs text-slate-400 italic bg-slate-50 rounded-lg border border-dashed border-slate-200">
                            Nenhum professor atribuído a esta turma.
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                            {assignments.map(a => (
                                <div key={a.id} className="flex items-center justify-between p-2.5 border border-slate-100 rounded-lg bg-slate-50 hover:bg-white hover:border-purple-200 transition group/card">
                                    <div className="flex items-center gap-3 overflow-hidden">
                                        <div className="w-8 h-8 shrink-0 rounded-full bg-purple-100 text-purple-700 flex items-center justify-center font-bold text-xs uppercase">
                                            {(a.professor?.nome || '?')[0]}
                                        </div>
                                        <div className="min-w-0">
                                            <p className="text-xs font-bold text-slate-700 truncate">{a.disciplina?.nome}</p>
                                            <p className="text-[10px] text-slate-500 truncate">{a.professor?.nome}</p>
                                        </div>
                                    </div>
                                    <button className="p-1.5 text-slate-300 hover:text-red-500 opacity-0 group-hover/card:opacity-100 transition-opacity">
                                        <Trash2 className="w-3.5 h-3.5"/>
                                    </button>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </td>
        </tr>
      )}
    </Fragment>
  );
}

// --- COMPONENTE PRINCIPAL ---

export default function TurmasListClient() {
  const [turno, setTurno] = useState<string>("todos");
  const [busca, setBusca] = useState("");
  const [data, setData] = useState<TurmasResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Estados de Modais e Expansão
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [expandedTurmaId, setExpandedTurmaId] = useState<string | null>(null);
  const [assignments, setAssignments] = useState<any[] | null>(null);
  const [loadingAssignments, setLoadingAssignments] = useState(false);
  const [showAtribuirForm, setShowAtribuirForm] = useState(false);
  
  const { escolaId } = useEscolaId();

  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null);
      if (!escolaId) return;
      
      const params = new URLSearchParams();
      if (turno !== "todos") params.set('turno', turno);
      
      const url = buildEscolaUrl(escolaId, '/turmas', params);
      const res = await fetch(url, { cache: 'no-store', headers: { 'X-Proxy-Used': 'canonical' } });
      const json = await res.json();
      
      if (!res.ok || !json?.ok) throw new Error(json?.error || 'Falha ao carregar');
      setData(json);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { 
      if (escolaId) fetchData(); 
  }, [turno, escolaId]);

  // Carregar professores quando expandir uma linha
  const handleExpand = async (turmaId: string) => {
      // Se já estiver aberto, fecha
      if (expandedTurmaId === turmaId) {
          setExpandedTurmaId(null);
          setAssignments(null);
          return;
      }
      
      // Abre e carrega
      setExpandedTurmaId(turmaId);
      setLoadingAssignments(true);
      try {
        if (!escolaId) throw new Error('Escola não identificada');
        const res = await fetch(buildEscolaUrl(escolaId, `/turmas/${turmaId}/disciplinas`), { headers: { 'X-Proxy-Used': 'canonical' } });
        const json = await res.json();
        if (json.ok) setAssignments(json.items || []);
      } catch(e) { 
        setAssignments([]); 
      } finally { 
        setLoadingAssignments(false); 
      }
  };

  // Filtros
  const filtrosTurno = useMemo(() => {
    const porTurno = data?.stats?.porTurno ?? [];
    const base = porTurno.map((item) => ({
      id: item.turno,
      label: TURNO_LABELS[item.turno] || item.turno,
      total: item.total,
    }));
    return [{ id: "todos", label: "Todos", total: data?.stats?.totalTurmas ?? 0 }, ...base];
  }, [data]);

  const itensFiltrados = useMemo(() => {
    const itens = data?.items ?? [];
    const lower = busca.trim().toLowerCase();
    return itens.filter((item) => {
      if (turno !== "todos" && (item.turno ?? 'sem_turno') !== turno) return false;
      if (!lower) return true;
      return (item.nome || '').toLowerCase().includes(lower) || 
             (item.sala || '').toLowerCase().includes(lower) ||
             (item.curso_nome || '').toLowerCase().includes(lower) ||
             (item.classe_nome || '').toLowerCase().includes(lower);
    });
  }, [data, turno, busca]);

  return (
    <div className="w-full max-w-7xl mx-auto p-6 space-y-8 pb-20">
      
      {/* HEADER */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <button onClick={() => window.history.back()} className="flex items-center gap-2 text-xs font-bold text-slate-400 hover:text-slate-600 transition-colors mb-2">
            <ArrowLeft size={14}/> Voltar
          </button>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">Gestão de Turmas</h1>
          <p className="text-sm font-medium text-slate-500">Administre turmas, atribua professores e acesse as pautas.</p>
        </div>
        
        <button onClick={() => setShowCreateForm(true)} className="flex items-center gap-2 px-5 py-2.5 bg-slate-900 text-white rounded-xl text-sm font-bold hover:bg-slate-800 shadow-lg shadow-slate-900/20 transition hover:-translate-y-0.5">
          <Plus size={18} /> Nova Turma
        </button>
      </div>

      {/* KPIS */}
      {data?.stats && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <KpiCard title="Total Turmas" value={data.stats.totalTurmas || 0} icon={Building2} colorClass="text-blue-600" bgClass="bg-blue-50" />
          <KpiCard title="Alunos Alocados" value={data.stats.totalAlunos || 0} icon={Users} colorClass="text-orange-600" bgClass="bg-orange-50" />
          <KpiCard title="Turnos Ativos" value={filtrosTurno.length - 1} icon={Calendar} colorClass="text-teal-600" bgClass="bg-teal-50" />
          <KpiCard title="Média Alunos" value={Math.round((data.stats.totalAlunos || 0) / Math.max(data.stats.totalTurmas || 1, 1))} icon={BarChart3} colorClass="text-purple-600" bgClass="bg-purple-50" />
        </div>
      )}

      {/* PAINEL PRINCIPAL */}
      <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden min-h-[400px] flex flex-col">
        
        {/* BARRA DE FILTROS */}
        <div className="p-5 border-b border-slate-100 bg-slate-50/50 flex flex-col sm:flex-row gap-4 justify-between items-center">
           <div className="relative w-full sm:max-w-xs group">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 group-focus-within:text-teal-500 transition-colors" />
              <input 
                type="text" 
                placeholder="Buscar turma, curso..." 
                value={busca} 
                onChange={e => setBusca(e.target.value)} 
                className="w-full pl-10 pr-4 py-2 bg-white border border-slate-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 transition-all"
              />
           </div>
           <div className="flex gap-2 overflow-x-auto pb-2 sm:pb-0 w-full sm:w-auto no-scrollbar">
              {filtrosTurno.map(t => (
                 <button key={t.id} onClick={() => setTurno(t.id)} className={`whitespace-nowrap px-3 py-2 rounded-lg text-xs font-bold border transition-all ${turno === t.id ? 'bg-slate-800 text-white border-slate-800 shadow-md shadow-slate-900/10' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'}`}>
                    {t.label} <span className={`ml-1 text-[10px] px-1.5 rounded-full ${turno === t.id ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-500'}`}>{t.total}</span>
                 </button>
              ))}
           </div>
        </div>

        {/* TABELA */}
        <div className="overflow-x-auto flex-1">
           <table className="min-w-full divide-y divide-slate-100">
              <thead className="bg-white sticky top-0 z-10">
                 <tr>
                    <th className="px-6 py-4 text-left text-xs font-bold text-slate-400 uppercase tracking-wider">Turma</th>
                    <th className="px-6 py-4 text-left text-xs font-bold text-slate-400 uppercase tracking-wider">Curso / Classe</th>
                    <th className="px-6 py-4 text-left text-xs font-bold text-slate-400 uppercase tracking-wider">Local / Turno</th>
                    <th className="px-6 py-4 text-left text-xs font-bold text-slate-400 uppercase tracking-wider w-40">Ocupação</th>
                    <th className="px-6 py-4 text-right text-xs font-bold text-slate-400 uppercase tracking-wider">Ações</th>
                 </tr>
              </thead>
              <tbody className="bg-white divide-y divide-slate-50">
                 {loading && !data ? (
                    <tr><td colSpan={5} className="p-20 text-center text-slate-500"><Loader2 className="h-8 w-8 animate-spin mx-auto mb-3 text-teal-600"/>Carregando turmas...</td></tr>
                 ) : itensFiltrados.length === 0 ? (
                    <tr>
                        <td colSpan={5} className="p-20 text-center">
                            <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4 text-slate-300">
                                <Search size={32}/>
                            </div>
                            <p className="text-slate-800 font-bold">Nenhuma turma encontrada</p>
                            <p className="text-slate-400 text-sm mt-1">Tente ajustar os filtros ou crie uma nova turma.</p>
                        </td>
                    </tr>
                 ) : (
                    itensFiltrados.map(turma => (
                        <TurmaRow 
                            key={turma.id}
                            turma={turma}
                            isExpanded={expandedTurmaId === turma.id}
                            onToggleExpand={() => handleExpand(turma.id)}
                            assignments={assignments}
                            loadingAssignments={loadingAssignments}
                            onAddProfessor={() => setShowAtribuirForm(true)}
                        />
                    ))
                 )}
              </tbody>
           </table>
        </div>
      </div>
      
      {/* MODAL NOVA TURMA */}
      {showCreateForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-white p-6 rounded-2xl shadow-2xl w-full max-w-lg animate-in zoom-in-95 duration-200">
                <div className="flex justify-between mb-6">
                    <div>
                        <h3 className="font-bold text-xl text-slate-800">Nova Turma</h3>
                        <p className="text-sm text-slate-500">Crie uma nova turma para o ano letivo.</p>
                    </div>
                    <button onClick={() => setShowCreateForm(false)} className="p-2 hover:bg-slate-100 rounded-full h-fit"><ArrowLeft className="w-5 h-5 text-slate-400"/></button>
                </div>
                <TurmaForm onSuccess={() => { setShowCreateForm(false); fetchData(); }} />
            </div>
        </div>
      )}

      {/* MODAL ATRIBUIR PROFESSOR */}
      {showAtribuirForm && expandedTurmaId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
             <div className="bg-white p-6 rounded-2xl shadow-2xl w-full max-w-lg animate-in zoom-in-95 duration-200">
                <div className="flex justify-between mb-6">
                     <div>
                        <h3 className="font-bold text-xl text-slate-800">Atribuir Professor</h3>
                        <p className="text-sm text-slate-500">Vincule um docente a uma disciplina desta turma.</p>
                    </div>
                    <button onClick={() => setShowAtribuirForm(false)} className="p-2 hover:bg-slate-100 rounded-full h-fit"><ArrowLeft className="w-5 h-5 text-slate-400"/></button>
                </div>
                <AtribuirProfessorForm turmaId={expandedTurmaId} onSuccess={() => { setShowAtribuirForm(false); handleExpand(expandedTurmaId); }} />
            </div>
        </div>
      )}

    </div>
  );
}