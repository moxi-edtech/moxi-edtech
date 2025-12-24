"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { 
  Loader2, Users, BookOpen, UserCheck, Download, 
  MoreVertical, UserPlus, FileText, Calendar, Settings, 
  School, LayoutGrid 
} from "lucide-react";

// Tipos
type Aluno = {
  numero: number;
  matricula_id: string;
  aluno_id: string;
  nome: string;
  bi: string;
  foto?: string;
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

  // Carregar Dados
  useEffect(() => {
    async function load() {
      try {
        setLoading(true);
        // Chama a API de detalhes (Certifique-se que ela existe)
        const res = await fetch(`/api/secretaria/turmas/${turmaId}/detalhes`);

        if(!res.ok) throw new Error("Erro ao carregar detalhes da turma");
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

  // Ação de Download (Chama a API que gera o Excel on-the-fly)
  const handleDownloadPauta = () => {
    // Redireciona para a rota API, que força o download do arquivo
    window.location.href = `/api/secretaria/turmas/${turmaId}/pauta`;
  };

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
                <span className="text-2xl font-black">{turma.nome.substring(0,2).toUpperCase()}</span>
              </div>
              <div>
                <h1 className="text-2xl font-bold text-slate-900">{turma.nome}</h1>
                <p className="text-xs font-bold text-slate-400 mt-1">Ano Letivo {turma.ano_letivo}</p>
                <div className="flex items-center gap-3 text-sm text-slate-500 mt-2">
                   <span className="flex items-center gap-1"><School className="w-4 h-4"/> {turma.classe_nome}</span>
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
               <button className="p-2.5 border border-slate-200 rounded-xl text-slate-500 hover:bg-slate-50 hover:text-slate-900 transition">
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
                      <span className="text-xs text-slate-500 mb-1">{Math.round((turma.ocupacao/Math.max(turma.capacidade,1))*100)}%</span>
                   </div>
                   <div className="w-full h-1.5 bg-slate-100 rounded-full mt-2 overflow-hidden">
                      <div className="h-full bg-blue-500 rounded-full" style={{width: `${Math.min((turma.ocupacao/turma.capacidade)*100, 100)}%`}}/>
                   </div>
                </div>
             </div>

             {/* Diretor */}
             <div className="bg-white border border-slate-200 p-4 rounded-xl shadow-sm flex items-center gap-4">
                <div className="w-12 h-12 bg-indigo-50 text-indigo-600 rounded-full flex items-center justify-center font-bold border border-indigo-100 uppercase">
                   {turma.diretor ? turma.diretor.nome[0] : "?"}
                </div>
                <div>
                   <p className="text-xs font-bold text-slate-400 uppercase">Diretor de Turma</p>
                   <p className="font-bold text-slate-800 text-sm">{turma.diretor?.nome || "Não atribuído"}</p>
                   {turma.diretor && <p className="text-xs text-slate-500 truncate max-w-[150px]">{turma.diretor.email}</p>}
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
         
         <div className="flex border-b border-slate-200 mb-6 overflow-x-auto no-scrollbar">
            <button onClick={() => setActiveTab('alunos')} className={`px-6 py-3 text-sm font-bold border-b-2 transition whitespace-nowrap ${activeTab === 'alunos' ? 'border-slate-900 text-slate-900' : 'border-transparent text-slate-400 hover:text-slate-600'}`}>
               Alunos ({alunos.length})
            </button>
            <button onClick={() => setActiveTab('pedagogico')} className={`px-6 py-3 text-sm font-bold border-b-2 transition whitespace-nowrap ${activeTab === 'pedagogico' ? 'border-teal-500 text-teal-600' : 'border-transparent text-slate-400 hover:text-slate-600'}`}>
               Pedagógico
            </button>
            <button onClick={() => setActiveTab('docs')} className={`px-6 py-3 text-sm font-bold border-b-2 transition whitespace-nowrap ${activeTab === 'docs' ? 'border-orange-500 text-orange-600' : 'border-transparent text-slate-400 hover:text-slate-600'}`}>
               Documentos
            </button>
         </div>

         {/* ABA: ALUNOS */}
         {activeTab === 'alunos' && (
            <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden animate-in fade-in slide-in-from-bottom-2 duration-300">
               <div className="overflow-x-auto">
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
                       {alunos.length === 0 ? (
                          <tr><td colSpan={5} className="p-10 text-center text-slate-400">Nenhum aluno nesta turma.</td></tr>
                       ) : alunos.map(aluno => (
                          <tr key={aluno.aluno_id} className="hover:bg-slate-50 transition group">
                             <td className="px-6 py-4 font-mono text-slate-500">{String(aluno.numero).padStart(2, '0')}</td>
                             <td className="px-6 py-4">
                                <div className="flex items-center gap-3">
                                   <div className="w-8 h-8 bg-slate-200 rounded-full flex items-center justify-center text-xs font-bold text-slate-600 uppercase">
                                      {aluno.nome[0]}
                                   </div>
                                   <div>
                                      <p className="font-bold text-slate-800">{aluno.nome}</p>
                                      <p className="text-xs text-slate-400">{aluno.bi || 'Sem BI'}</p>
                                   </div>
                                </div>
                             </td>
                             <td className="px-6 py-4">
                                <span className={`px-2 py-1 rounded-full text-[10px] font-bold uppercase border ${aluno.status_matricula === 'ativa' ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : 'bg-red-50 text-red-600 border-red-100'}`}>
                                   {aluno.status_matricula}
                                </span>
                             </td>
                             <td className="px-6 py-4">
                                <span className="flex items-center gap-1 text-xs font-medium text-slate-500">
                                   <div className="w-2 h-2 rounded-full bg-emerald-500"/> Em dia
                                </span>
                             </td>
                             <td className="px-6 py-4 text-right">
                                <button className="p-2 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100 transition">
                                   <MoreVertical className="w-4 h-4"/>
                                </button>
                             </td>
                          </tr>
                       ))}
                    </tbody>
                 </table>
               </div>
            </div>
         )}

         {/* ABA: PEDAGÓGICO */}
         {activeTab === 'pedagogico' && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
               {disciplinas.length === 0 ? (
                  <div className="col-span-full p-10 text-center text-slate-400 italic bg-white rounded-2xl border border-dashed border-slate-200">
                     Nenhuma disciplina encontrada para este curso.
                  </div>
               ) : disciplinas.map(d => (
                  <div key={d.id} className="bg-white p-5 rounded-xl border border-slate-200 hover:border-teal-400 transition group cursor-pointer hover:shadow-sm">
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

         {/* ABA: DOCUMENTOS (AQUI ESTÁ A MÁGICA) */}
         {activeTab === 'docs' && (
            <div className="bg-white p-8 rounded-2xl border border-slate-200 text-center animate-in fade-in slide-in-from-bottom-2 duration-300">
               <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                  {/* BOTÃO PRINCIPAL DE DOWNLOAD */}
                  <DocCard 
                    icon={Download} 
                    title="Pauta Digital" 
                    desc="Baixar planilha Excel inteligente para lançamento de notas" 
                    onClick={handleDownloadPauta} 
                    highlight 
                  />
                  
                  <DocCard icon={FileText} title="Lista Nominal" desc="PDF oficial com a lista de alunos da turma" />
                  <DocCard icon={LayoutGrid} title="Pauta em Branco" desc="Grelha vazia para lançamento manual" />
                  <DocCard icon={BookOpen} title="Mini-Pautas" desc="Fichas individuais por disciplina" />
               </div>
            </div>
         )}

      </div>
    </div>
  );
}

// Micro-Componente de Cartão de Documento
function DocCard({ icon: Icon, title, desc, onClick, highlight }: any) {
    return (
        <button 
          onClick={onClick} 
          disabled={!onClick}
          className={`p-6 rounded-xl border-2 ${highlight ? 'border-teal-100 bg-teal-50/20' : 'border-dashed border-slate-200'} hover:border-teal-500 hover:bg-teal-50 transition flex flex-col items-center gap-3 group text-center h-full`}
        >
            <div className={`p-3 rounded-full transition ${highlight ? 'bg-teal-100 text-teal-600' : 'bg-slate-50 text-slate-400 group-hover:bg-teal-100 group-hover:text-teal-600'}`}>
                <Icon className="w-6 h-6"/>
            </div>
            <div>
              <h4 className="font-bold text-slate-800">{title}</h4>
              <p className="text-xs text-slate-500 mt-1">{desc}</p>
            </div>
        </button>
    )
}