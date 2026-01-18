"use client";

import { useEffect, useMemo, useState, useCallback, useRef, type CSSProperties } from "react";
import Link from "next/link"; 
import { 
  Loader2, Search, ArrowLeft,
  UsersRound, 
  BookOpen, 
  Building2, 
  CalendarCheck,
  Eye, Pencil, Trash2, 
  Plus, Filter,
  AlertTriangle, CheckCircle2, MoreVertical,
  GraduationCap
} from "lucide-react";
import { useVirtualizer } from "@tanstack/react-virtual";

import TurmaForm from "./TurmaForm"; 
import AtribuirProfessorForm from "./AtribuirProfessorForm"; 
import { useEscolaId } from "@/hooks/useEscolaId";
import { buildEscolaUrl } from "@/lib/escola/url";

import { TurmaItem } from "~/types/turmas";

// --- TYPES ---
interface TurmasResponse {
  ok: boolean;
  items: TurmaItem[];
  stats: {
    totalTurmas: number;
    totalAlunos: number;
    porTurno: Array<{ turno: string; total: number }>;
  };
}

const TURNO_LABELS: Record<string, string> = {
  manha: "Manhã", tarde: "Tarde", noite: "Noite", integral: "Integral", sem_turno: "N/D",
};

// --- HELPER: Visual Logic ---
const getStatusColor = (pct: number) => {
  if (pct >= 90) return { bg: 'bg-red-500', text: 'text-red-600' };
  if (pct >= 70) return { bg: 'bg-[#E3B23C]', text: 'text-[#E3B23C]' };
  return { bg: 'bg-[#1F6B3B]', text: 'text-[#1F6B3B]' };
};

const getTurmaMeta = (t: TurmaItem) => {
    if (t.status_validacao === 'rascunho') {
        return { 
            label: "Validação Pendente", 
            subLabel: "Revisão Necessária",
            icon: AlertTriangle,
            style: "text-[#E3B23C] bg-amber-50 border-amber-200"
        };
    }
    return { 
        label: t.curso_nome || "Ensino Geral", 
        subLabel: t.classe_nome || "Classe N/D", 
        icon: t.curso_nome ? GraduationCap : BookOpen,
        style: "text-slate-600 bg-slate-50 border-slate-100" 
    };
};

// --- COMPONENT: KPI Card ---
function KpiCard({ title, value, icon: Icon, active, onClick }: any) {
  return (
    <div 
      onClick={onClick} 
      className={`
        p-5 rounded-xl border transition-all duration-200 group
        ${active 
            ? 'bg-slate-900 border-slate-900 shadow-lg' 
            : 'bg-white border-slate-200 hover:border-[#E3B23C]/50 hover:shadow-sm cursor-pointer'
        }
      `}
    >
      <div className="flex justify-between items-start">
        <div>
          <p className={`text-xs font-bold uppercase tracking-wider mb-1 ${active ? 'text-slate-400' : 'text-slate-500'}`}>{title}</p>
          <p className={`text-2xl font-bold ${active ? 'text-white' : 'text-slate-900'}`}>{value}</p>
        </div>
        <div className={`p-2 rounded-lg ${active ? 'bg-white/10 text-[#E3B23C]' : 'bg-slate-50 text-slate-400 group-hover:text-[#1F6B3B]'}`}>
          <Icon size={20} />
        </div>
      </div>
    </div>
  );
}

// --- COMPONENT: Row ---
function TurmaRow({ 
    turma, isExpanded, onToggleExpand, onEdit, style 
}: { 
    turma: TurmaItem, isExpanded: boolean, onToggleExpand: () => void, onEdit: (t: TurmaItem) => void, style?: CSSProperties 
}) {
    // 1. BLINDAGEM VISUAL: Garante que existam valores antes de processar
    const safeNome = turma.nome || "Sem Nome";
    const avatarLetras = safeNome.substring(0, 2).toUpperCase();

    const meta = getTurmaMeta(turma);
    const MetaIcon = meta.icon;
    
    const max = turma.capacidade_maxima || 30;
    const atual = turma.ocupacao_atual || 0;
    const pct = Math.min(Math.round((atual / max) * 100), 100);
    const progressColors = getStatusColor(pct);

    const isDraft = turma.status_validacao === 'rascunho';

    return (
            <tr
                className={`
                border-b border-slate-100 transition-colors group
                ${isDraft ? 'bg-amber-50/30' : 'hover:bg-slate-50'}
                ${isExpanded ? 'bg-slate-50' : ''}
            `}
                style={style}
            >
                <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                        <div className={`
                            w-10 h-10 rounded-xl flex items-center justify-center text-sm font-bold border
                            ${isDraft ? 'bg-amber-100 text-[#E3B23C] border-amber-200' : 'bg-slate-100 text-slate-600 border-slate-200'}
                        `}>
                            {avatarLetras}
                        </div>
                        <div>
                            {isDraft ? (
                                <span className="font-bold text-sm text-slate-800">{safeNome}</span>
                            ) : (
                                <Link href={`/secretaria/turmas/${turma.id}`} className="font-bold text-sm text-slate-900 hover:text-[#1F6B3B] hover:underline decoration-[#1F6B3B]/30 underline-offset-4 transition-colors">
                                    {safeNome}
                                </Link>
                            )}
                            <div className="flex items-center gap-2 mt-0.5">
                                <span className="text-[10px] font-mono text-slate-400 bg-slate-100 px-1.5 rounded">{turma.ano_letivo || '-'}</span>
                                {isDraft && <span className="text-[10px] font-bold text-[#E3B23C]">RASCUNHO</span>}
                            </div>
                        </div>
                    </div>
                </td>

                <td className="px-6 py-4">
                    <div className="flex flex-col gap-1">
                        <div className="flex items-center gap-1.5 text-sm font-medium text-slate-700">
                            <MetaIcon size={14} className="text-slate-400" />
                            {meta.label}
                        </div>
                        <span className="text-xs text-slate-500 pl-5">{meta.subLabel}</span>
                    </div>
                </td>

                <td className="px-6 py-4">
                    <div className="space-y-1.5">
                         <div className="flex items-center gap-1.5 text-xs font-medium text-slate-600">
                            <Building2 size={14} className="text-slate-400"/>
                            {turma.sala || 'Sala N/D'}
                         </div>
                         <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase bg-slate-100 text-slate-600 border border-slate-200">
                            {TURNO_LABELS[turma.turno || ''] || turma.turno}
                         </span>
                    </div>
                </td>

                <td className="px-6 py-4">
                    <div className="w-32">
                        <div className="flex justify-between text-[10px] font-bold mb-1.5">
                            <span className="text-slate-600">{atual}/{max}</span>
                            <span className={progressColors.text}>{pct}%</span>
                        </div>
                        <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
                            <div className={`h-full rounded-full ${progressColors.bg}`} style={{ width: `${pct}%` }} />
                        </div>
                    </div>
                </td>

                <td className="px-6 py-4 text-right">
                    <div className="flex items-center justify-end gap-1 opacity-60 group-hover:opacity-100 transition-opacity">
                        {isDraft ? (
                            <button 
                                onClick={() => onEdit(turma)}
                                className="flex items-center gap-1.5 px-3 py-1.5 bg-[#E3B23C] text-white hover:brightness-95 rounded-xl text-xs font-bold shadow-sm transition-all"
                            >
                                <CheckCircle2 size={14}/> Ativar
                            </button>
                        ) : (
                            <>
                                <Link href={`/secretaria/turmas/${turma.id}`} className="p-2 text-slate-400 hover:text-[#1F6B3B] hover:bg-green-50 rounded-lg transition-colors">
                                    <Eye size={16}/>
                                </Link>
                                <button onClick={() => onEdit(turma)} className="p-2 text-slate-400 hover:text-[#E3B23C] hover:bg-amber-50 rounded-lg transition-colors">
                                    <Pencil size={16}/>
                                </button>
                                <button onClick={onToggleExpand} className={`p-2 rounded-lg transition-colors ${isExpanded ? 'text-slate-800 bg-slate-100' : 'text-slate-400 hover:text-slate-800 hover:bg-slate-50'}`}>
                                    <UsersRound size={16}/>
                                </button>
                            </>
                        )}
                    </div>
                </td>
            </tr>
    );
}

// --- MAIN PAGE COMPONENT ---
export default function TurmasListClient() {
  const { escolaId } = useEscolaId();
  
  const [data, setData] = useState<TurmasResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [busca, setBusca] = useState("");
  const [turnoFilter, setTurnoFilter] = useState("todos");
  
  const [showForm, setShowForm] = useState(false);
  const [editingTurma, setEditingTurma] = useState<TurmaItem | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const scrollParentRef = useRef<HTMLDivElement | null>(null);

  const fetchData = useCallback(async () => {
    if (!escolaId) return;
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (turnoFilter !== 'todos') params.set('turno', turnoFilter);
      
      const res = await fetch(buildEscolaUrl(escolaId, '/turmas', params), {
          headers: { 'X-Proxy-Used': 'canonical' }
      });
      const json = await res.json();
      if (json.ok) setData(json);
    } catch (err) {
      console.error("Erro ao buscar turmas", err);
    } finally {
      setLoading(false);
    }
  }, [escolaId, turnoFilter]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // --- AQUI ESTAVA O ERRO ---
  // CORRIGIDO: Adicionado (|| "") antes de .toLowerCase()
  const filteredItems = useMemo(() => {
    if (!data?.items) return [];
    
    // Safety check na busca
    const lowerBusca = (busca || "").toLowerCase();

    return data.items.filter(t => {
        // Safety check nas propriedades do objeto
        const nomeSafe = (t.nome || "").toLowerCase();
        const codigoSafe = (t.turma_codigo || "").toLowerCase();
        
        return nomeSafe.includes(lowerBusca) || codigoSafe.includes(lowerBusca);
    });
  }, [data, busca]);

  const rascunhos = useMemo(() => data?.items.filter(t => t.status_validacao === 'rascunho').length || 0, [data]);
  const displayRows = useMemo(() => {
    const rows: Array<{ key: string; type: "turma" | "expanded"; turma: TurmaItem }> = [];
    filteredItems.forEach((turma) => {
      rows.push({ key: turma.id, type: "turma", turma });
      if (expandedId === turma.id) {
        rows.push({ key: `${turma.id}-expanded`, type: "expanded", turma });
      }
    });
    return rows;
  }, [filteredItems, expandedId]);

  const hasRows = !loading && displayRows.length > 0;
  const rowVirtualizer = useVirtualizer({
    count: displayRows.length,
    getScrollElement: () => scrollParentRef.current,
    estimateSize: (index) => (displayRows[index]?.type === "expanded" ? 140 : 88),
    overscan: 6,
  });

  return (
    <div className="w-full max-w-7xl mx-auto p-6 space-y-8 pb-24 font-sora">
      
      {/* HEADER */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
           <h1 className="text-2xl font-bold text-[#1F6B3B] tracking-tight">Gestão de Turmas</h1>
           <p className="text-sm text-slate-500 mt-1">Gerencie a estrutura acadêmica e alocação de salas.</p>
        </div>
        
        <div className="flex items-center gap-3">
            <button className="hidden md:flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 text-slate-700 rounded-xl text-sm font-medium hover:bg-slate-50 transition-colors">
                <Filter size={16} /> Filtros
            </button>
            <button 
                onClick={() => { setEditingTurma(null); setShowForm(true); }}
                className="flex items-center gap-2 px-5 py-2.5 bg-[#E3B23C] text-white rounded-xl text-sm font-bold hover:brightness-95 shadow-sm shadow-orange-500/20 transition-all active:scale-95"
            >
                <Plus size={18} /> Nova Turma
            </button>
        </div>
      </div>

      {/* KPI GRID */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard title="Total de Turmas" value={data?.stats.totalTurmas || 0} icon={UsersRound} active={true} />
        <KpiCard title="Alunos Alocados" value={data?.stats.totalAlunos || 0} icon={GraduationCap} />
        <KpiCard title="Pendentes" value={rascunhos} icon={AlertTriangle} />
        <KpiCard title="Turnos Ativos" value={data?.stats.porTurno.length || 0} icon={CalendarCheck} />
      </div>

      {/* MAIN CONTENT AREA */}
      <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden flex flex-col min-h-[500px]">
        
        <div className="p-4 border-b border-slate-100 flex gap-4 items-center bg-slate-50/50">
            <div className="relative flex-1 max-w-md">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <input 
                    type="text" 
                    placeholder="Buscar por nome ou código..." 
                    value={busca}
                    onChange={e => setBusca(e.target.value)}
                    className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm outline-none focus:ring-4 focus:ring-[#E3B23C]/20 focus:border-[#E3B23C] transition-all placeholder:text-slate-400"
                />
            </div>
            
            <select 
                value={turnoFilter}
                onChange={(e) => setTurnoFilter(e.target.value)}
                className="px-3 py-2.5 bg-white border border-slate-200 rounded-xl text-sm text-slate-700 outline-none focus:border-[#E3B23C] cursor-pointer"
            >
                <option value="todos">Todos os Turnos</option>
                {Object.entries(TURNO_LABELS).map(([k, v]) => (
                    <option key={k} value={k}>{v}</option>
                ))}
            </select>
        </div>

        <div className="overflow-x-auto">
            <div ref={scrollParentRef} className="max-h-[560px] overflow-y-auto">
            <table className="min-w-full table-fixed divide-y divide-slate-100">
                <thead className="bg-slate-50 sticky top-0 z-10" style={{ display: "table", width: "100%", tableLayout: "fixed" }}>
                    <tr>
                        <th className="px-6 py-3 text-left text-[11px] font-bold text-slate-400 uppercase tracking-wider">Nome da Turma</th>
                        <th className="px-6 py-3 text-left text-[11px] font-bold text-slate-400 uppercase tracking-wider">Acadêmico</th>
                        <th className="px-6 py-3 text-left text-[11px] font-bold text-slate-400 uppercase tracking-wider">Local</th>
                        <th className="px-6 py-3 text-left text-[11px] font-bold text-slate-400 uppercase tracking-wider">Capacidade</th>
                        <th className="px-6 py-3 text-right text-[11px] font-bold text-slate-400 uppercase tracking-wider">Ações</th>
                    </tr>
                </thead>
                <tbody
                    className="divide-y divide-slate-50 bg-white"
                    style={
                      hasRows
                        ? {
                            position: "relative",
                            display: "block",
                            height: rowVirtualizer.getTotalSize(),
                          }
                        : undefined
                    }
                >
                    {loading ? (
                        [...Array(5)].map((_, i) => (
                            <tr key={i} className="animate-pulse" style={{ display: "table", width: "100%", tableLayout: "fixed" }}>
                                <td className="px-6 py-4"><div className="h-10 w-10 bg-slate-100 rounded-xl mb-1"></div></td>
                                <td className="px-6 py-4"><div className="h-4 w-32 bg-slate-100 rounded"></div></td>
                                <td className="px-6 py-4"><div className="h-4 w-20 bg-slate-100 rounded"></div></td>
                                <td className="px-6 py-4"><div className="h-4 w-full bg-slate-100 rounded"></div></td>
                                <td className="px-6 py-4"></td>
                            </tr>
                        ))
                    ) : filteredItems.length === 0 ? (
                        <tr style={{ display: "table", width: "100%", tableLayout: "fixed" }}>
                            <td colSpan={5} className="py-20 text-center">
                                <div className="flex flex-col items-center justify-center text-slate-400">
                                    <div className="bg-slate-50 p-4 rounded-full mb-3">
                                        <Search size={24} />
                                    </div>
                                    <p className="font-medium text-slate-600">Nenhuma turma encontrada</p>
                                    <p className="text-xs">Tente ajustar os filtros ou sua busca.</p>
                                </div>
                            </td>
                        </tr>
                    ) : (
                        rowVirtualizer.getVirtualItems().map((virtualRow) => {
                          const row = displayRows[virtualRow.index];
                          if (!row) return null;
                          if (row.type === "expanded") {
                            return (
                              <tr
                                key={row.key}
                                className="bg-slate-50/50"
                                style={{
                                  position: "absolute",
                                  top: 0,
                                  left: 0,
                                  transform: `translateY(${virtualRow.start}px)`,
                                  width: "100%",
                                  display: "table",
                                  tableLayout: "fixed",
                                }}
                              >
                                <td colSpan={5} className="px-6 py-4">
                                  <div className="ml-12 p-4 bg-white border border-slate-200 rounded-xl shadow-sm text-center text-sm text-slate-500">
                                    <p>Detalhes avançados ou lista rápida de professores apareceriam aqui.</p>
                                  </div>
                                </td>
                              </tr>
                            );
                          }

                          return (
                            <TurmaRow
                              key={row.key}
                              turma={row.turma}
                              isExpanded={expandedId === row.turma.id}
                              onToggleExpand={() => setExpandedId(expandedId === row.turma.id ? null : row.turma.id)}
                              onEdit={(t) => {
                                setEditingTurma(t);
                                setShowForm(true);
                              }}
                              style={{
                                position: "absolute",
                                top: 0,
                                left: 0,
                                transform: `translateY(${virtualRow.start}px)`,
                                width: "100%",
                                display: "table",
                                tableLayout: "fixed",
                              }}
                            />
                          );
                        })
                    )}
                </tbody>
            </table>
            </div>
        </div>
      </div>

      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 backdrop-blur-sm p-4 animate-in fade-in duration-200">
             <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden animate-in zoom-in-95 duration-200">
                 <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                    <h3 className="font-bold text-lg text-slate-800">
                        {editingTurma ? 'Editar Turma' : 'Nova Turma'}
                    </h3>
                    <button onClick={() => setShowForm(false)} className="text-slate-400 hover:text-slate-800">
                        <span className="sr-only">Fechar</span>
                        <ArrowLeft size={20} className="rotate-180" /> 
                    </button>
                 </div>
                 <div className="p-6">
                    <TurmaForm 
                        escolaId={escolaId || ""}
                        initialData={editingTurma} 
                        onSuccess={() => { setShowForm(false); fetchData(); }} 
                    />
                 </div>
             </div>
        </div>
      )}

    </div>
  );
}
