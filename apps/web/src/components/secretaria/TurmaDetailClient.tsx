"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  Loader2, UsersRound, BookOpen, UserCheck, Download, 
  MoreVertical, UserPlus, FileText, CalendarCheck, Settings, 
  School, LayoutDashboard, GraduationCap, MapPin
} from "lucide-react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { usePlanFeature } from "@/hooks/usePlanFeature";

// --- TYPES (Mantidos e Refinados) ---
type Aluno = {
  numero: number;
  matricula_id: string;
  aluno_id: string;
  nome: string;
  bi: string;
  numero_matricula?: string | number | null;
  status_matricula: string;
  status_financeiro?: 'em_dia' | 'atraso';
};

type TurmaData = {
  turma: {
    id: string;
    nome: string;
    classe_id: string;
    classe_nome: string;
    ano_letivo: number;
    turno: string;
    sala: string | null;
    capacidade: number;
    ocupacao: number;
    diretor?: { id: string; nome: string; email: string } | null;
    curso_nome?: string | null;
  };
  alunos: Aluno[];
  disciplinas: Array<{ id: string; nome: string; professor?: string }>;
};

// --- HELPER COMPONENTS ---

function StatusBadge({ status }: { status: string }) {
  const isActive = status.toLowerCase() === 'ativa' || status.toLowerCase() === 'ativo';
  return (
    <span className={`
      px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase border tracking-wide
      ${isActive 
        ? 'bg-[#1F6B3B]/10 text-[#1F6B3B] border-[#1F6B3B]/20' 
        : 'bg-red-50 text-red-600 border-red-100'}
    `}>
      {status}
    </span>
  );
}

function DocCard({ icon: Icon, title, desc, onClick, highlight }: any) {
  return (
      <button 
        onClick={onClick} 
        disabled={!onClick}
        className={`
          p-6 rounded-xl border transition-all duration-200 flex flex-col items-center gap-3 group text-center h-full w-full
          ${highlight 
            ? 'bg-[#1F6B3B]/5 border-[#1F6B3B]/20 hover:border-[#1F6B3B] hover:shadow-md' 
            : 'bg-white border-slate-200 border-dashed hover:border-[#E3B23C] hover:bg-amber-50/30'}
        `}
      >
          <div className={`
            p-3 rounded-xl transition-colors
            ${highlight 
              ? 'bg-[#1F6B3B] text-white shadow-sm' 
              : 'bg-slate-50 text-slate-400 group-hover:bg-[#E3B23C] group-hover:text-white'}
          `}>
              <Icon size={24}/>
          </div>
          <div>
            <h4 className="font-bold text-slate-800 text-sm">{title}</h4>
            <p className="text-xs text-slate-500 mt-1 leading-relaxed">{desc}</p>
          </div>
      </button>
  )
}

// --- MAIN COMPONENT ---

export default function TurmaDetailClient({ turmaId }: { turmaId: string }) {
  const [activeTab, setActiveTab] = useState<'alunos' | 'pedagogico' | 'docs'>('alunos');
  const [data, setData] = useState<TurmaData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const alunosScrollRef = useRef<HTMLDivElement | null>(null);
  const { isEnabled: canQrDocs } = usePlanFeature("doc_qr_code");
  const alunos = data?.alunos ?? [];
  const alunosVirtualizer = useVirtualizer({
    count: alunos.length,
    getScrollElement: () => alunosScrollRef.current,
    estimateSize: () => 64,
    overscan: 6,
  });

  useEffect(() => {
    async function load() {
      try {
        setLoading(true);
        const res = await fetch(`/api/secretaria/turmas/${turmaId}/detalhes`);
        if(!res.ok) throw new Error("Falha ao carregar dados da turma.");
        const json = await res.json();
        setData(json.data);
      } catch (e: any) {
        setError(e.message);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [turmaId]);

  const handleDownloadPauta = () => {
    window.location.href = `/api/secretaria/turmas/${turmaId}/pauta`;
  };

  const handleListaPdf = () => {
    if (!canQrDocs) {
      alert("Seu plano não permite PDF com QR.");
      return;
    }
    window.open(`/api/secretaria/turmas/${turmaId}/alunos/lista?format=pdf`, "_blank");
  };

  if (loading) return (
    <div className="h-[60vh] flex flex-col items-center justify-center gap-3 text-slate-400">
      <Loader2 className="w-8 h-8 animate-spin text-[#1F6B3B]"/>
      <p className="text-xs font-medium">Carregando turma...</p>
    </div>
  );
  
  if (error) return <div className="p-6 text-center text-red-600 bg-red-50 rounded-xl border border-red-100 m-6 text-sm font-bold">{error}</div>;
  if (!data) return null;

  const { turma, disciplinas } = data;
  const ocupacaoPct = Math.min((turma.ocupacao / Math.max(turma.capacidade, 1)) * 100, 100);
  const hasAlunos = alunos.length > 0;
  const virtualRows = alunosVirtualizer.getVirtualItems();
  const shouldVirtualize = hasAlunos && virtualRows.length > 0;
  const renderAlunoRow = (aluno: Aluno, rowStyle?: React.CSSProperties) => (
    <tr
      key={aluno.aluno_id}
      className="hover:bg-slate-50/80 transition group"
      style={rowStyle}
    >
      <td className="px-6 py-4 font-mono text-slate-400 text-xs">{String(aluno.numero).padStart(2, '0')}</td>
      <td className="px-6 py-4">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center text-xs font-bold text-slate-600">
            {aluno.nome[0]}
          </div>
          <div>
            <p className="font-bold text-slate-800 text-sm">{aluno.nome}</p>
            <p className="text-[10px] text-slate-400">BI: {aluno.bi || '---'}</p>
          </div>
        </div>
      </td>
      <td className="px-6 py-4">
        <div className="flex flex-col gap-1">
          <span className="inline-flex items-center gap-1 rounded-md bg-slate-100 px-2 py-1 font-mono text-[11px] font-bold text-slate-700 ring-1 ring-slate-200">
            Mat.: {aluno.numero_matricula ? aluno.numero_matricula : '—'}
          </span>
          <StatusBadge status={aluno.status_matricula || 'indefinido'} />
        </div>
      </td>
      <td className="px-6 py-4">
        <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md bg-emerald-50 text-emerald-700 text-[10px] font-bold border border-emerald-100 uppercase">
          Em Dia
        </span>
      </td>
      <td className="px-6 py-4 text-right">
        <button className="p-2 text-slate-300 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors">
          <MoreVertical size={16}/>
        </button>
      </td>
    </tr>
  );

  return (
    <div className="min-h-screen bg-slate-50/50 pb-20 font-sora">
      
      {/* HERO SECTION */}
      <div className="bg-white border-b border-slate-200 px-6 py-8">
        <div className="max-w-7xl mx-auto space-y-8">
          
          {/* Top Row */}
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
            <div className="flex items-center gap-5">
              {/* Avatar da Turma (Brand Green) */}
              <div className="w-16 h-16 rounded-2xl bg-[#1F6B3B] text-white flex items-center justify-center shadow-lg shadow-green-900/10">
                <span className="text-2xl font-bold tracking-tighter">{turma.nome.substring(0,2).toUpperCase()}</span>
              </div>
              
              <div>
                <h1 className="text-2xl font-bold text-slate-900 tracking-tight">{turma.nome}</h1>
                <div className="flex flex-wrap items-center gap-3 text-xs font-medium text-slate-500 mt-2">
                   <span className="flex items-center gap-1.5 bg-slate-100 px-2 py-1 rounded-md border border-slate-200 text-slate-700">
                      <School size={12}/> {turma.classe_nome}
                   </span>
                   {turma.curso_nome && (
                     <span className="flex items-center gap-1.5 bg-slate-100 px-2 py-1 rounded-md border border-slate-200 text-slate-700">
                       <GraduationCap size={12}/> {turma.curso_nome}
                     </span>
                   )}
                   <span className="flex items-center gap-1.5 bg-slate-100 px-2 py-1 rounded-md border border-slate-200 text-slate-700">
                      <CalendarCheck size={12}/> {turma.turno}
                   </span>
                   <span className="flex items-center gap-1.5 bg-slate-100 px-2 py-1 rounded-md border border-slate-200 text-slate-700">
                      <MapPin size={12}/> Sala {turma.sala || "N/D"}
                   </span>
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-3 w-full md:w-auto">
               <button className="p-2.5 bg-white border border-slate-200 rounded-xl text-slate-500 hover:text-slate-900 hover:border-slate-300 transition-colors shadow-sm">
                  <Settings size={20}/>
               </button>
               {/* CTA: GOLD */}
               <Link 
                 href={`/secretaria/matriculas/nova?turmaId=${turma.id}`} 
                 className="flex-1 md:flex-none flex items-center justify-center gap-2 bg-[#E3B23C] text-white px-6 py-2.5 rounded-xl text-sm font-bold hover:brightness-95 transition-all shadow-sm shadow-orange-500/10 active:scale-95"
               >
                  <UserPlus size={18}/> Matricular
               </Link>
            </div>
          </div>

          {/* Stats Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
             {/* Card 1: Ocupação */}
             <div className="bg-white border border-slate-200 p-5 rounded-xl shadow-sm flex items-center justify-between">
                <div className="flex-1 mr-4">
                   <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Capacidade</p>
                   <div className="flex items-baseline gap-1">
                      <span className="text-xl font-bold text-slate-800">{turma.ocupacao}</span>
                      <span className="text-sm text-slate-400">/ {turma.capacidade}</span>
                   </div>
                   <div className="w-full h-1.5 bg-slate-100 rounded-full mt-3 overflow-hidden">
                      <div className={`h-full rounded-full ${ocupacaoPct >= 100 ? 'bg-red-500' : 'bg-[#1F6B3B]'}`} style={{width: `${ocupacaoPct}%`}}/>
                   </div>
                </div>
                <div className="p-3 bg-slate-50 text-slate-400 rounded-lg">
                   <UsersRound size={20}/>
                </div>
             </div>

             {/* Card 2: Direção */}
             <div className="bg-white border border-slate-200 p-5 rounded-xl shadow-sm flex items-center justify-between">
                <div>
                   <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Diretor de Turma</p>
                   {turma.diretor ? (
                     <>
                        <p className="font-bold text-slate-800 text-sm truncate">{turma.diretor.nome}</p>
                        <p className="text-[10px] text-slate-400 truncate">{turma.diretor.email}</p>
                     </>
                   ) : (
                     <button className="text-xs font-bold text-[#E3B23C] hover:underline flex items-center gap-1 mt-1">
                        + Atribuir Professor
                     </button>
                   )}
                </div>
                <div className="h-10 w-10 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center text-xs font-bold text-slate-600">
                   {turma.diretor ? turma.diretor.nome[0] : "?"}
                </div>
             </div>

             {/* Card 3: Status Acadêmico (Placeholder) */}
             <div className="bg-white border border-slate-200 p-5 rounded-xl shadow-sm flex items-center justify-between">
                 <div>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Ano Letivo</p>
                    <p className="font-bold text-slate-800 text-sm">{turma.ano_letivo}</p>
                    <p className="text-[10px] text-[#1F6B3B] font-bold mt-1 flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-[#1F6B3B]"></span> Em Andamento
                    </p>
                 </div>
                 <div className="p-3 bg-slate-50 text-slate-400 rounded-lg">
                   <CalendarCheck size={20}/>
                </div>
             </div>
          </div>
        </div>
      </div>

      {/* TABS & CONTENT */}
      <div className="max-w-7xl mx-auto px-6 mt-8">
         
         <div className="flex border-b border-slate-200 mb-6 gap-6">
            <button 
                onClick={() => setActiveTab('alunos')} 
                className={`pb-3 text-sm font-bold border-b-2 transition-all ${activeTab === 'alunos' ? 'border-[#E3B23C] text-slate-900' : 'border-transparent text-slate-400 hover:text-slate-600'}`}
            >
               Alunos <span className="ml-1 text-xs bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded-full">{alunos.length}</span>
            </button>
            <button 
                onClick={() => setActiveTab('pedagogico')} 
                className={`pb-3 text-sm font-bold border-b-2 transition-all ${activeTab === 'pedagogico' ? 'border-[#E3B23C] text-slate-900' : 'border-transparent text-slate-400 hover:text-slate-600'}`}
            >
               Pedagógico
            </button>
            <button 
                onClick={() => setActiveTab('docs')} 
                className={`pb-3 text-sm font-bold border-b-2 transition-all ${activeTab === 'docs' ? 'border-[#E3B23C] text-slate-900' : 'border-transparent text-slate-400 hover:text-slate-600'}`}
            >
               Documentos
            </button>
         </div>

         {/* CONTENT: ALUNOS */}
        {activeTab === 'alunos' && (
            <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden animate-in fade-in slide-in-from-bottom-2 duration-300">
               <div className="overflow-x-auto">
                 <div ref={alunosScrollRef} className="max-h-[560px] overflow-y-auto">
                 <table className="w-full table-fixed text-left text-sm">
                    <thead className="bg-slate-50 border-b border-slate-100 sticky top-0 z-10" style={{ display: "table", width: "100%", tableLayout: "fixed" }}>
                       <tr>
                         <th className="px-6 py-3 text-[11px] font-bold text-slate-400 uppercase tracking-wider">Nº</th>
                         <th className="px-6 py-3 text-[11px] font-bold text-slate-400 uppercase tracking-wider">Estudante</th>
                          <th className="px-6 py-3 text-[11px] font-bold text-slate-400 uppercase tracking-wider">Matrícula</th>
                          <th className="px-6 py-3 text-[11px] font-bold text-slate-400 uppercase tracking-wider">Situação</th>
                          <th className="px-6 py-3 text-right text-[11px] font-bold text-slate-400 uppercase tracking-wider">Ações</th>
                       </tr>
                    </thead>
                    <tbody
                      className="divide-y divide-slate-50"
                      style={
                        shouldVirtualize
                          ? {
                              position: "relative",
                              display: "block",
                              height: alunosVirtualizer.getTotalSize(),
                            }
                          : undefined
                      }
                    >
                       {alunos.length === 0 ? (
                          <tr style={{ display: "table", width: "100%", tableLayout: "fixed" }}>
                            <td colSpan={5} className="p-12 text-center text-slate-400 text-sm">Nenhum aluno matriculado nesta turma.</td>
                          </tr>
                       ) : shouldVirtualize ? (
                          virtualRows.map((virtualRow) => {
                            const aluno = alunos[virtualRow.index];
                            return renderAlunoRow(aluno, {
                              position: "absolute",
                              top: 0,
                              left: 0,
                              transform: `translateY(${virtualRow.start}px)`,
                              width: "100%",
                              display: "table",
                              tableLayout: "fixed",
                            });
                          })
                       ) : (
                          alunos.map((aluno) => renderAlunoRow(aluno))
                       )}
                    </tbody>
                 </table>
                 </div>
               </div>
            </div>
         )}

         {/* CONTENT: PEDAGÓGICO */}
         {activeTab === 'pedagogico' && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
               {disciplinas.length === 0 ? (
                  <div className="col-span-full p-12 text-center bg-white rounded-xl border border-dashed border-slate-200">
                     <p className="text-slate-400 text-sm">Nenhuma disciplina vinculada.</p>
                  </div>
               ) : disciplinas.map(d => (
                  <div key={d.id} className="bg-white p-5 rounded-xl border border-slate-200 hover:border-[#1F6B3B]/30 hover:shadow-sm transition-all group cursor-pointer">
                     <div className="flex justify-between items-start mb-2">
                        <div className="p-2 rounded-lg bg-slate-50 text-slate-400 group-hover:text-[#1F6B3B] transition-colors">
                           <BookOpen size={18}/>
                        </div>
                     </div>
                     <h4 className="font-bold text-slate-800 text-sm mb-1">{d.nome}</h4>
                     <p className="text-xs text-slate-500 mb-4 flex items-center gap-1.5">
                        <UserCheck size={12}/> {d.professor || "Professor N/D"}
                     </p>
                     <button className="w-full py-2 text-xs font-bold bg-slate-50 text-slate-600 rounded-lg group-hover:bg-slate-900 group-hover:text-white transition-colors">
                        Gerenciar Notas
                     </button>
                  </div>
               ))}
            </div>
         )}

         {/* CONTENT: DOCS */}
         {activeTab === 'docs' && (
            <div className="bg-white p-8 rounded-xl border border-slate-200 animate-in fade-in slide-in-from-bottom-2 duration-300">
               <h3 className="text-lg font-bold text-slate-800 mb-6">Central de Documentos</h3>
               <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                  {/* Highlighted Card (Gold/Green mix for specific action) */}
                  <DocCard 
                    icon={Download} 
                    title="Pauta Digital (Excel)" 
                    desc="Planilha oficial para lançamento offline de notas." 
                    onClick={handleDownloadPauta} 
                    highlight={true} 
                  />
                  
                  <DocCard
                    icon={FileText}
                    title="Lista Nominal"
                    desc="Relatório PDF oficial da turma."
                    onClick={handleListaPdf}
                  />
                  <DocCard icon={LayoutDashboard} title="Pauta em Branco" desc="Grelha vazia para preenchimento." />
                  <DocCard icon={BookOpen} title="Mini-Pautas" desc="Fichas individuais por disciplina." />
               </div>
            </div>
         )}

      </div>
    </div>
  );
}
