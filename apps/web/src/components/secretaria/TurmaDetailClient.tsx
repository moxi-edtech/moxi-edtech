"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { 
  Loader2, Users, BookOpen, UserCheck, Download, 
  MoreVertical, UserPlus, FileText, Calendar, Settings, 
  Edit3, School, LayoutGrid 
} from "lucide-react";

// Tipos (Mantidos/Expandidos)
type Aluno = {
  numero: number;
  matricula_id: string;
  aluno_id: string;
  nome: string;
  bi: string;
  foto?: string;
  status_matricula: string; // 'ativa', 'cancelada'
  status_financeiro?: 'em_dia' | 'atraso'; // Novo
};

type TurmaData = {
  turma: {
    id: string;
    nome: string;
    classe: string;
    turno: string;
    sala: string | null;
    capacidade: number;
    ocupacao: number;
    diretor?: { id: string; nome: string; email: string } | null;
    curso_nome?: string | null;
    curso_tipo?: string | null;
  };
  alunos: Aluno[];
  disciplinas: Array<{ id: string; nome: string; professor?: string }>;
};

export default function TurmaDetailClient({ turmaId }: { turmaId: string }) {
  const [activeTab, setActiveTab] = useState<'alunos' | 'pedagogico' | 'docs'>('alunos');
  const [data, setData] = useState<TurmaData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch Data (Simulado/Real)
  useEffect(() => {
    async function load() {
      try {
        setLoading(true);
        // Aqui chamarias a tua API real. Vou simular a estrutura ideal.
        const res = await fetch(`/api/secretaria/turmas/${turmaId}/detalhes`); 
        // Nota: Cria este endpoint agregado para trazer tudo de uma vez
        
        if(!res.ok) throw new Error("Erro ao carregar turma");
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

  if (loading) return <div className="h-screen flex items-center justify-center"><Loader2 className="w-8 h-8 animate-spin text-teal-600"/></div>;
  if (error) return <div className="p-8 text-center text-red-600 bg-red-50 rounded-xl m-6">{error}</div>;
  if (!data) return null;

  const { turma, alunos, disciplinas } = data;

  return (
    <div className="min-h-screen bg-slate-50 pb-20">
      
      {/* HEADER (HERO) */}
      <div className="bg-white border-b border-slate-200 px-6 py-8">
        <div className="max-w-6xl mx-auto">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
            
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 rounded-2xl bg-teal-50 text-teal-600 flex items-center justify-center border border-teal-100 shadow-sm">
                <span className="text-2xl font-black">{turma.nome.substring(0,2)}</span>
              </div>
              <div>
                <h1 className="text-2xl font-bold text-slate-900">{turma.nome}</h1>
                <div className="flex items-center gap-3 text-sm text-slate-500 mt-1">
                   <span className="flex items-center gap-1"><School className="w-4 h-4"/> {turma.classe}</span>
                   {turma.curso_nome && (
                     <span className="flex items-center gap-1">
                       <LayoutGrid className="w-4 h-4"/> {turma.curso_nome}
                     </span>
                   )}
                   <span className="w-1 h-1 rounded-full bg-slate-300"/>
                   <span className="flex items-center gap-1"><Calendar className="w-4 h-4"/> {turma.turno}</span>
                   <span className="w-1 h-1 rounded-full bg-slate-300"/>
                   <span className="flex items-center gap-1"><LayoutGrid className="w-4 h-4"/> Sala {turma.sala || "N/D"}</span>
                </div>
              </div>
            </div>

            <div className="flex gap-3">
               <Link href={`/secretaria/matriculas/nova?turmaId=${turma.id}`} className="flex items-center gap-2 bg-slate-900 text-white px-5 py-2.5 rounded-xl text-sm font-bold hover:bg-slate-800 transition shadow-lg shadow-slate-900/20">
                  <UserPlus className="w-4 h-4"/> Matricular Aluno
               </Link>
               <button className="p-2.5 border border-slate-200 rounded-xl text-slate-500 hover:bg-slate-50 hover:text-slate-900">
                  <Settings className="w-5 h-5"/>
               </button>
            </div>

          </div>

          {/* STATS & DIRECTOR */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-8">
             {/* Ocupação */}
             <div className="bg-white border border-slate-200 p-4 rounded-xl shadow-sm flex items-center gap-4">
                <div className="p-3 bg-blue-50 text-blue-600 rounded-lg"><Users className="w-5 h-5"/></div>
                <div className="flex-1">
                   <p className="text-xs font-bold text-slate-400 uppercase">Ocupação</p>
                   <div className="flex justify-between items-end">
                      <span className="text-xl font-bold text-slate-800">{turma.ocupacao}/{turma.capacidade}</span>
                      <span className="text-xs text-slate-500 mb-1">{Math.round((turma.ocupacao/turma.capacidade)*100)}%</span>
                   </div>
                   <div className="w-full h-1.5 bg-slate-100 rounded-full mt-2 overflow-hidden">
                      <div className="h-full bg-blue-500 rounded-full" style={{width: `${(turma.ocupacao/turma.capacidade)*100}%`}}/>
                   </div>
                </div>
             </div>

             {/* Diretor */}
             <div className="bg-white border border-slate-200 p-4 rounded-xl shadow-sm flex items-center gap-4">
                <div className="w-12 h-12 bg-indigo-50 text-indigo-600 rounded-full flex items-center justify-center font-bold border border-indigo-100">
                   {turma.diretor ? turma.diretor.nome[0] : "?"}
                </div>
                <div>
                   <p className="text-xs font-bold text-slate-400 uppercase">Diretor de Turma</p>
                   <p className="font-bold text-slate-800 text-sm">{turma.diretor?.nome || "Não atribuído"}</p>
                   {turma.diretor && <p className="text-xs text-slate-500">{turma.diretor.email}</p>}
                </div>
                {!turma.diretor && (
                   <button className="ml-auto text-xs font-bold text-teal-600 hover:underline">Atribuir</button>
                )}
             </div>
          </div>
        </div>
      </div>

      {/* CONTENT TABS */}
      <div className="max-w-6xl mx-auto px-6 mt-8">
         
         <div className="flex border-b border-slate-200 mb-6">
            <button onClick={() => setActiveTab('alunos')} className={`px-6 py-3 text-sm font-bold border-b-2 transition ${activeTab === 'alunos' ? 'border-slate-900 text-slate-900' : 'border-transparent text-slate-400'}`}>
               Alunos ({alunos.length})
            </button>
            <button onClick={() => setActiveTab('pedagogico')} className={`px-6 py-3 text-sm font-bold border-b-2 transition ${activeTab === 'pedagogico' ? 'border-teal-500 text-teal-600' : 'border-transparent text-slate-400'}`}>
               Pedagógico
            </button>
            <button onClick={() => setActiveTab('docs')} className={`px-6 py-3 text-sm font-bold border-b-2 transition ${activeTab === 'docs' ? 'border-orange-500 text-orange-600' : 'border-transparent text-slate-400'}`}>
               Documentos
            </button>
         </div>

         {/* ABA: ALUNOS */}
         {activeTab === 'alunos' && (
            <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden animate-in fade-in">
               <table className="w-full text-left text-sm">
                  <thead className="bg-slate-50 border-b border-slate-200 text-xs font-bold text-slate-500 uppercase">
                     <tr>
                        <th className="px-6 py-3">Nº</th>
                        <th className="px-6 py-3">Aluno</th>
                        <th className="px-6 py-3">Estado</th>
                        <th className="px-6 py-3">Financeiro</th>
                        <th className="px-6 py-3 text-right">Ações</th>
                     </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                     {alunos.map(aluno => (
                        <tr key={aluno.aluno_id} className="hover:bg-slate-50 transition group">
                           <td className="px-6 py-4 font-mono text-slate-500">{String(aluno.numero).padStart(2, '0')}</td>
                           <td className="px-6 py-4">
                              <div className="flex items-center gap-3">
                                 <div className="w-8 h-8 bg-slate-200 rounded-full flex items-center justify-center text-xs font-bold text-slate-600">
                                    {aluno.nome[0]}
                                 </div>
                                 <div>
                                    <p className="font-bold text-slate-800">{aluno.nome}</p>
                                    <p className="text-xs text-slate-400">{aluno.bi}</p>
                                 </div>
                              </div>
                           </td>
                           <td className="px-6 py-4">
                              <span className={`px-2 py-1 rounded-full text-[10px] font-bold uppercase border ${aluno.status_matricula === 'ativa' ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : 'bg-red-50 text-red-600 border-red-100'}`}>
                                 {aluno.status_matricula}
                              </span>
                           </td>
                           <td className="px-6 py-4">
                              {/* Simulação de status financeiro */}
                              <span className="flex items-center gap-1 text-xs font-medium text-slate-500">
                                 <div className="w-2 h-2 rounded-full bg-emerald-500"/> Em dia
                              </span>
                           </td>
                           <td className="px-6 py-4 text-right">
                              <button className="p-2 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100">
                                 <MoreVertical className="w-4 h-4"/>
                              </button>
                           </td>
                        </tr>
                     ))}
                  </tbody>
               </table>
            </div>
         )}

         {/* ABA: PEDAGÓGICO */}
         {activeTab === 'pedagogico' && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 animate-in fade-in">
               {disciplinas.map(d => (
                  <div key={d.id} className="bg-white p-5 rounded-xl border border-slate-200 hover:border-teal-400 transition group cursor-pointer">
                     <h4 className="font-bold text-slate-800">{d.nome}</h4>
                     <p className="text-sm text-slate-500 mt-1 flex items-center gap-2">
                        <UserCheck className="w-4 h-4"/> {d.professor || "Sem professor"}
                     </p>
                     <div className="mt-4 flex gap-2">
                        <button className="flex-1 py-2 text-xs font-bold bg-slate-50 text-slate-600 rounded-lg group-hover:bg-slate-900 group-hover:text-white transition">
                           Lançar Notas
                        </button>
                     </div>
                  </div>
               ))}
            </div>
         )}

         {/* ABA: DOCUMENTOS */}
         {activeTab === 'docs' && (
            <div className="bg-white p-8 rounded-2xl border border-slate-200 text-center animate-in fade-in">
               <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <DocCard icon={FileText} title="Lista Nominal" desc="PDF oficial com todos os alunos" />
                  <DocCard icon={LayoutGrid} title="Pauta em Branco" desc="Grelha para lançamento manual" />
                  <DocCard icon={BookOpen} title="Mini-Pautas" desc="Fichas individuais por disciplina" />
               </div>
            </div>
         )}

      </div>
    </div>
  );
}

function DocCard({ icon: Icon, title, desc }: any) {
    return (
        <button className="p-6 rounded-xl border-2 border-dashed border-slate-200 hover:border-teal-500 hover:bg-teal-50/30 transition flex flex-col items-center gap-3 group">
            <div className="p-3 bg-slate-50 rounded-full text-slate-400 group-hover:bg-teal-100 group-hover:text-teal-600 transition">
                <Icon className="w-6 h-6"/>
            </div>
            <h4 className="font-bold text-slate-800">{title}</h4>
            <p className="text-xs text-slate-500">{desc}</p>
        </button>
    )
}
