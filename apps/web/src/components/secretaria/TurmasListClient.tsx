"use client";

import { useEffect, useMemo, useState, Fragment } from "react";
import Link from "next/link";
import { 
  Loader2, Search, Filter, ArrowLeft,
  Users, BookOpen, BarChart3, Building2, Calendar,
  Eye, Edit, MoreVertical, Link as LinkIcon, Plus, Trash2,
  GraduationCap, School, ScrollText
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
  curso_tipo?: string; // <--- NOVO CAMPO VINDO DA VIEW
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

const TURNO_LABELS: Record<string, string> = {
  manha: "Manhã", tarde: "Tarde", noite: "Noite", integral: "Integral", sem_turno: "Sem turno",
};

export default function TurmasListClient() {
  const [turno, setTurno] = useState<string>("todos");
  const [busca, setBusca] = useState("");
  const [data, setData] = useState<TurmasResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [manageTurmaId, setManageTurmaId] = useState<string | null>(null);
  const [assignments, setAssignments] = useState<any[] | null>(null);
  const [loadingAssignments, setLoadingAssignments] = useState(false);
  const [showAtribuirForm, setShowAtribuirForm] = useState(false);
  const { escolaId, isLoading: escolaLoading, error: escolaError } = useEscolaId();

  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null);
      if (!escolaId) throw new Error('Escola não identificada');
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

  useEffect(() => { if (escolaId) fetchData(); }, [turno, escolaId]);

  // --- LÓGICA INTELIGENTE V8 (BASEADA NO TIPO REAL) ---
  const getDisplayInfo = (t: TurmaItem) => {
    // Dados diretos do Banco (A Verdade)
    const tipoBanco = t.curso_tipo || 'geral';
    const cursoLabel = t.curso_nome || "Curso Geral";
    
    // Normalizar Classe
    let classeLabel = t.classe_nome || "";
    const matchNum = (classeLabel + " " + t.nome).match(/(\d+)/);
    const numeroClasse = matchNum ? parseInt(matchNum[1], 10) : 0;

    if (!classeLabel || classeLabel === 'Classe não definida') {
        classeLabel = numeroClasse > 0 ? `${numeroClasse}ª Classe` : t.nome;
    }

    // --- 1. TÉCNICO ---
    if (tipoBanco === 'tecnico' || tipoBanco === 'curso_tecnico') {
        return {
            main: cursoLabel,
            sub: classeLabel,
            isHighlight: true,
            isTecnico: true, // Roxo
            icon: GraduationCap
        };
    }

    // --- 2. PUNIV (II CICLO GERAL) ---
    if (tipoBanco === 'puniv' || tipoBanco === 'curso_puniv') {
        return {
            main: cursoLabel,
            sub: `${classeLabel} (PUNIV)`,
            isHighlight: true,
            isTecnico: false, // Azul/Indigo (ScrollText)
            icon: ScrollText
        };
    }

    // --- 3. Iº CICLO ---
    if (tipoBanco === 'ciclo1' || (numeroClasse >= 7 && numeroClasse <= 9)) {
        return {
            main: classeLabel,
            sub: "Iº Ciclo do Secundário",
            isHighlight: false,
            icon: School
        };
    }

    // --- 4. PRIMÁRIO ---
    if (tipoBanco === 'primario' || (numeroClasse >= 1 && numeroClasse <= 6)) {
        return {
            main: classeLabel,
            sub: "Ensino Primário",
            isHighlight: false,
            icon: BookOpen
        };
    }

    // Fallback
    return {
        main: classeLabel,
        sub: "Ensino Geral",
        isHighlight: false,
        icon: School
    };
  };

  // --- LÓGICA FILTROS ---
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
      return item.nome.toLowerCase().includes(lower) || 
             (item.sala || '').toLowerCase().includes(lower) ||
             (item.curso_nome || '').toLowerCase().includes(lower) ||
             (item.classe_nome || '').toLowerCase().includes(lower);
    });
  }, [data, turno, busca]);

  const getOcupacao = (t: TurmaItem) => {
    const max = t.capacidade_maxima || 30;
    const atual = t.ocupacao_atual || 0;
    const pct = Math.round((atual / max) * 100);
    
    let color = 'bg-emerald-500';
    if (pct >= 90) color = 'bg-rose-500';
    else if (pct >= 70) color = 'bg-amber-500';

    return { atual, max, pct, color };
  };
  
  const loadAssignments = async (turmaId: string) => {
      setLoadingAssignments(true);
      try {
        if (!escolaId) throw new Error('Escola não identificada');
        const res = await fetch(buildEscolaUrl(escolaId, `/turmas/${turmaId}/disciplinas`), { headers: { 'X-Proxy-Used': 'canonical' } });
        const json = await res.json();
        if (json.ok) setAssignments(json.items || []);
      } catch(e) { setAssignments([]); } 
      finally { setLoadingAssignments(false); }
  };

  // --- RENDER ---
  return (
    <div className="w-full max-w-7xl mx-auto p-6 space-y-8 pb-20">
      
      {/* HEADER */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <button onClick={() => window.history.back()} className="flex items-center gap-2 text-xs font-bold text-slate-400 hover:text-slate-600 transition-colors mb-2">
            <ArrowLeft size={14}/> Voltar
          </button>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">Gestão de Turmas</h1>
          <p className="text-sm font-medium text-slate-500">Administre a estrutura acadêmica e alocação de salas.</p>
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

      {/* TABELA */}
      <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
        
        <div className="p-5 border-b border-slate-100 bg-slate-50/50 flex flex-col sm:flex-row gap-4 justify-between items-center">
           <div className="relative w-full sm:max-w-xs">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <input type="text" placeholder="Buscar turma, curso..." value={busca} onChange={e => setBusca(e.target.value)} className="w-full pl-10 pr-4 py-2 bg-white border border-slate-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500 transition-shadow"/>
           </div>
           <div className="flex gap-2 overflow-x-auto pb-2 sm:pb-0">
              {filtrosTurno.map(t => (
                 <button key={t.id} onClick={() => setTurno(t.id)} className={`whitespace-nowrap px-3 py-2 rounded-lg text-xs font-bold border transition-all ${turno === t.id ? 'bg-slate-800 text-white border-slate-800' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'}`}>
                    {t.label} <span className="ml-1 opacity-70 text-[10px] bg-white/20 px-1.5 rounded-full">{t.total}</span>
                 </button>
              ))}
           </div>
        </div>

        <div className="overflow-x-auto">
           <table className="min-w-full divide-y divide-slate-100">
              <thead className="bg-white">
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
                    <tr><td colSpan={5} className="p-12 text-center text-slate-500"><Loader2 className="h-8 w-8 animate-spin mx-auto mb-2 text-teal-600"/>A carregar...</td></tr>
                 ) : itensFiltrados.length === 0 ? (
                    <tr><td colSpan={5} className="p-12 text-center text-slate-500">Nenhuma turma encontrada.</td></tr>
                 ) : (
                    itensFiltrados.map(turma => {
                       const stats = getOcupacao(turma);
                       const info = getDisplayInfo(turma); 
                       const InfoIcon = info.icon;

                       return (
                          <Fragment key={turma.id}>
                            <tr className="hover:bg-slate-50/80 transition-colors group">
                                <td className="px-6 py-4">
                                   <div className="flex items-center gap-3">
                                      <div className="w-10 h-10 rounded-lg bg-slate-100 flex items-center justify-center text-slate-500 font-bold text-sm border border-slate-200">
                                         {turma.nome.substring(0,2).toUpperCase()}
                                      </div>
                                      <div>
                                         <p className="font-bold text-sm text-slate-800">{turma.nome}</p>
                                         <p className="text-xs text-slate-400">{turma.ano_letivo}</p>
                                      </div>
                                   </div>
                                </td>

                                <td className="px-6 py-4">
                                    <div className="space-y-1">
                                        <div className={`flex items-center gap-1.5 text-sm font-medium ${info.isHighlight ? (info.isTecnico ? 'text-purple-700' : 'text-blue-700') : 'text-slate-700'}`}>
                                            <InfoIcon className={`w-3.5 h-3.5 ${info.isHighlight ? (info.isTecnico ? 'text-purple-500' : 'text-blue-500') : 'text-slate-400'}`}/>
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
                                        <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-blue-50 text-blue-700`}>
                                            {TURNO_LABELS[turma.turno] || turma.turno}
                                        </span>
                                    </div>
                                </td>
                                <td className="px-6 py-4">
                                    <div className="w-full max-w-[140px]">
                                        <div className="flex justify-between text-xs mb-1">
                                            <span className="font-bold text-slate-700">{stats.atual}/{stats.max}</span>
                                            <span className={`${stats.pct >= 90 ? 'text-red-500' : 'text-emerald-500'} font-bold`}>{stats.pct}%</span>
                                        </div>
                                        <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
                                            <div className={`h-full ${stats.color}`} style={{width: `${Math.min(stats.pct, 100)}%`}}></div>
                                        </div>
                                    </div>
                                </td>
                                <td className="px-6 py-4 text-right">
                                    <div className="flex justify-end gap-1 opacity-60 group-hover:opacity-100 transition-opacity">
                                        <Link href={`/secretaria/turmas/${turma.id}`} className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition" title="Ver Detalhes"><Eye className="w-4 h-4"/></Link>
                                        <button onClick={() => { setManageTurmaId(manageTurmaId === turma.id ? null : turma.id); loadAssignments(turma.id); }} className={`p-2 rounded-lg transition ${manageTurmaId === turma.id ? 'text-purple-600 bg-purple-50' : 'text-slate-400 hover:text-purple-600 hover:bg-purple-50'}`} title="Atribuições"><LinkIcon className="w-4 h-4"/></button>
                                        <button className="p-2 text-slate-400 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition"><MoreVertical className="w-4 h-4"/></button>
                                    </div>
                                </td>
                            </tr>
                            {manageTurmaId === turma.id && (
                                <tr className="bg-slate-50/50 border-b border-slate-200">
                                    <td colSpan={5} className="px-6 py-4">
                                        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm animate-in slide-in-from-top-2">
                                            <div className="flex justify-between items-center mb-4 border-b border-slate-100 pb-2">
                                                <h4 className="font-bold text-sm text-slate-700 flex items-center gap-2"><BookOpen className="w-4 h-4 text-purple-500"/> Atribuições de Professores</h4>
                                                <button onClick={() => setShowAtribuirForm(true)} className="text-xs font-bold bg-purple-600 text-white px-3 py-1.5 rounded-lg hover:bg-purple-700 transition">+ Atribuir</button>
                                            </div>
                                            {loadingAssignments ? (
                                                <div className="py-4 text-center text-xs text-slate-400"><Loader2 className="w-4 h-4 animate-spin mx-auto mb-1"/> Carregando...</div>
                                            ) : !assignments || assignments.length === 0 ? (
                                                <div className="py-4 text-center text-xs text-slate-400 italic">Nenhum professor atribuído a esta turma.</div>
                                            ) : (
                                                <div className="grid gap-2">
                                                    {assignments.map(a => (
                                                        <div key={a.id} className="flex items-center justify-between p-2 border border-slate-100 rounded-lg bg-slate-50 hover:bg-white transition">
                                                            <div className="flex items-center gap-3">
                                                                <div className="w-8 h-8 rounded-full bg-purple-100 text-purple-700 flex items-center justify-center font-bold text-xs">{(a.professor?.nome || '?')[0]}</div>
                                                                <div>
                                                                    <p className="text-xs font-bold text-slate-700">{a.disciplina?.nome}</p>
                                                                    <p className="text-[10px] text-slate-400">{a.professor?.nome}</p>
                                                                </div>
                                                            </div>
                                                            <div className="flex gap-1">
                                                                {a.vinculos.notas && <span className="text-[9px] bg-green-100 text-green-700 px-1.5 rounded">Notas</span>}
                                                                <button className="p-1 text-slate-300 hover:text-red-500"><Trash2 className="w-3 h-3"/></button>
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    </td>
                                </tr>
                            )}
                          </Fragment>
                       )
                    })
                 )}
              </tbody>
           </table>
        </div>
      </div>
      
      {showCreateForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm animate-in fade-in">
            <div className="bg-white p-6 rounded-2xl shadow-2xl w-full max-w-lg">
                <div className="flex justify-between mb-4">
                    <h3 className="font-bold text-lg">Nova Turma</h3>
                    <button onClick={() => setShowCreateForm(false)}><ArrowLeft className="w-5 h-5"/></button>
                </div>
                <TurmaForm onSuccess={() => { setShowCreateForm(false); fetchData(); }} />
            </div>
        </div>
      )}

      {showAtribuirForm && manageTurmaId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm animate-in fade-in">
             <div className="bg-white p-6 rounded-2xl shadow-2xl w-full max-w-lg">
                <div className="flex justify-between mb-4">
                    <h3 className="font-bold text-lg">Atribuir Professor</h3>
                    <button onClick={() => setShowAtribuirForm(false)}><ArrowLeft className="w-5 h-5"/></button>
                </div>
                <AtribuirProfessorForm turmaId={manageTurmaId} onSuccess={() => { setShowAtribuirForm(false); loadAssignments(manageTurmaId); }} />
            </div>
        </div>
      )}

    </div>
  );
}
