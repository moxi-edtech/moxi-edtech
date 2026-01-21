"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  AlertCircle,
  ArrowLeft,
  ChevronRight,
  Mail,
  Phone,
  Search,
  Users,
  MapPin,
  Calendar,
  CreditCard,
  FileText,
  GraduationCap,
  Pencil
} from "lucide-react";

// --- TYPES ---
type AlunoFicha = {
  id: string;
  created_at: string | null;
  updated_at: string | null;
  nome: string;
  status: string | null;
  telefone: string | null;
  email: string | null;
  bi_numero: string | null;
  data_nascimento: string | null;
  sexo: string | null;
  naturalidade: string | null;
  responsavel_nome?: string | null;
  responsavel_contato?: string | null;
  responsavel?: string | null;
  telefone_responsavel?: string | null;
  profile_id?: string | null;
  escola_id?: string | null;
};

type Props = {
  aluno?: AlunoFicha | null;
  error?: string | null;
};

// --- HELPER COMPONENTS ---

function InfoRow({ label, value, icon: Icon }: { label: string; value: string | null; icon?: React.ElementType }) {
  if (!value) return null;
  return (
    <div className="flex items-start gap-3 p-3 rounded-xl bg-slate-50 border border-slate-100">
      {Icon && <Icon className="w-4 h-4 text-slate-400 mt-0.5" />}
      <div>
        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{label}</p>
        <p className="text-sm font-bold text-slate-800 break-all">{value}</p>
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const s = (status || "").toLowerCase();
  let style = "bg-slate-100 text-slate-500 border-slate-200";
  
  if (s === 'ativo') style = "bg-[#1F6B3B]/10 text-[#1F6B3B] border-[#1F6B3B]/20";
  if (s === 'suspenso') style = "bg-red-50 text-red-600 border-red-200";
  
  return (
    <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase border ${style}`}>
      {status || "N/D"}
    </span>
  );
}

// --- MAIN COMPONENT ---

export default function FichaAluno360Client({ aluno, error }: Props) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<'geral' | 'financeiro' | 'academico'>('geral');

  const alunoId = aluno?.id ?? '';
  const displayIdCurto = alunoId ? alunoId.slice(0, 8).toUpperCase() : '';
  const dataNascFmt = aluno?.data_nascimento
    ? new Date(aluno.data_nascimento).toLocaleDateString("pt-PT", { day: '2-digit', month: 'long', year: 'numeric' })
    : null;

  // --- ERROR STATE ---
  if (error || !aluno) {
    return (
      <div className="bg-slate-50 min-h-screen flex flex-col items-center justify-center p-4 font-sora">
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xl shadow-slate-200/50 p-8 max-w-md w-full text-center">
          <div className="w-12 h-12 bg-red-50 text-red-500 rounded-full flex items-center justify-center mx-auto mb-4">
            <AlertCircle size={24} />
          </div>
          <h2 className="text-lg font-bold text-slate-900">
            {error ? "Erro ao carregar dados" : "Aluno não encontrado"}
          </h2>
          <p className="text-sm text-slate-500 mt-2 mb-6">
            {error || "O registro que você procura pode ter sido removido ou você não tem permissão para acessá-lo."}
          </p>
          <button
            onClick={() => router.back()}
            className="w-full py-2.5 bg-slate-900 text-white rounded-xl font-bold text-sm hover:bg-slate-800 transition"
          >
            Voltar para Lista
          </button>
        </div>
      </div>
    );
  }

  // --- DATA FORMATTING ---
  const encarregadoNome = aluno.responsavel_nome || aluno.responsavel || "Não definido";
  const encarregadoContato = aluno.responsavel_contato || aluno.telefone_responsavel || aluno.telefone || "—";

  return (
    <div className="bg-slate-50/50 text-slate-900 font-sora min-h-screen flex flex-col pb-20">
      
      {/* HEADER */}
      <header className="bg-white border-b border-slate-200 h-16 flex items-center justify-between px-6 sticky top-0 z-30 shadow-sm/50 backdrop-blur-md bg-white/90">
        <div className="flex items-center gap-4">
          <button
            onClick={() => router.back()}
            className="p-2 hover:bg-slate-100 rounded-xl text-slate-400 hover:text-slate-700 transition"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>

          <div className="h-6 w-px bg-slate-200 hidden sm:block" />

          <nav className="hidden sm:flex items-center gap-2 text-sm">
            <span className="text-slate-500 font-medium">Alunos</span>
            <ChevronRight className="w-4 h-4 text-slate-300" />
            <span className="font-bold text-slate-900 bg-slate-100 px-2 py-0.5 rounded-md">{aluno.nome}</span>
          </nav>
        </div>

        <div className="flex items-center gap-3">
          <div className="relative hidden md:block">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Pesquisar aluno..."
              className="pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-[#E3B23C]/20 focus:border-[#E3B23C] outline-none w-64 transition-all"
            />
          </div>
          <button className="p-2 border border-slate-200 rounded-xl text-slate-500 hover:bg-slate-50 hover:text-slate-900 transition">
             <Pencil size={18} />
          </button>
        </div>
      </header>

      <main className="flex-1 max-w-7xl mx-auto w-full p-6 grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* SIDEBAR: PERFIL */}
        <aside className="lg:col-span-4 space-y-6">
          {/* Card Principal */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden p-6 text-center relative">
            <div className="absolute top-4 right-4">
                <StatusBadge status={aluno.status || "N/D"} />
            </div>

            <div className="w-24 h-24 mx-auto rounded-full bg-slate-100 border-4 border-white shadow-lg flex items-center justify-center text-2xl font-bold text-slate-400 mb-4">
               {aluno.nome.charAt(0)}
            </div>

            <h1 className="text-xl font-bold text-slate-900 leading-tight">{aluno.nome}</h1>
            <p className="text-xs text-slate-400 font-mono mt-1 mb-6">ID: {displayIdCurto}</p>

            <div className="grid grid-cols-2 gap-3 text-left">
                <InfoRow label="BI / Cédula" value={aluno.bi_numero || "N/D"} icon={CreditCard}/>
                <InfoRow label="Nascimento" value={dataNascFmt || "N/D"} icon={Calendar}/>
                <InfoRow label="Gênero" value={aluno.sexo || "N/D"} icon={Users}/>
                <InfoRow label="Naturalidade" value={aluno.naturalidade || "N/D"} icon={MapPin}/>
            </div>
          </div>

          {/* Card Encarregado */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
            <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                    <Users className="w-4 h-4 text-[#1F6B3B]" />
                    Encarregado(a)
                </h3>
            </div>
            
            <div className="p-4 bg-slate-50 rounded-xl border border-slate-100 mb-4">
                <p className="text-sm font-bold text-slate-800">{encarregadoNome}</p>
                <p className="text-xs text-slate-500 mt-0.5">Responsável Financeiro</p>
            </div>

            <div className="space-y-2">
                <a href={`tel:${encarregadoContato}`} className="flex items-center justify-between p-3 rounded-xl border border-slate-200 hover:border-[#1F6B3B] hover:bg-green-50/50 transition group cursor-pointer">
                    <div className="flex items-center gap-3">
                        <div className="p-1.5 bg-slate-100 rounded-lg text-slate-400 group-hover:text-[#1F6B3B] transition-colors"><Phone size={14} /></div>
                        <span className="text-xs font-bold text-slate-700">{encarregadoContato}</span>
                    </div>
                </a>
                {aluno.email && (
                     <a href={`mailto:${aluno.email}`} className="flex items-center justify-between p-3 rounded-xl border border-slate-200 hover:border-[#1F6B3B] hover:bg-green-50/50 transition group cursor-pointer">
                        <div className="flex items-center gap-3">
                            <div className="p-1.5 bg-slate-100 rounded-lg text-slate-400 group-hover:text-[#1F6B3B] transition-colors"><Mail size={14} /></div>
                            <span className="text-xs font-bold text-slate-700">{aluno.email}</span>
                        </div>
                    </a>
                )}
            </div>
          </div>
        </aside>

        {/* MAIN CONTENT */}
        <div className="lg:col-span-8 space-y-6">
          
          {/* ALERTAS FINANCEIROS (Se houver - Exemplo estático mantido mas estilizado corretamente) */}
          <div className="bg-red-50 border border-red-100 rounded-xl p-4 flex flex-col sm:flex-row items-center justify-between gap-4 shadow-sm">
            <div className="flex items-start gap-4">
              <div className="p-2 bg-white text-red-600 rounded-xl shadow-sm border border-red-100">
                <AlertCircle className="w-6 h-6" />
              </div>
              <div>
                <p className="text-sm font-bold text-red-900">Pendência Financeira Detectada</p>
                <p className="text-xs text-red-700 mt-1">Existe uma mensalidade (Outubro) em atraso no valor de <span className="font-bold">25.000 Kz</span>.</p>
              </div>
            </div>
            <button className="whitespace-nowrap bg-red-600 hover:bg-red-700 text-white text-xs font-bold px-5 py-2.5 rounded-xl shadow-lg shadow-red-900/10 transition">
              Regularizar
            </button>
          </div>

          {/* TABS NAVIGATION */}
          <div className="border-b border-slate-200">
             <div className="flex gap-6">
                <button 
                    onClick={() => setActiveTab('geral')}
                    className={`pb-3 text-sm font-bold border-b-2 transition-all ${activeTab === 'geral' ? 'border-[#E3B23C] text-slate-900' : 'border-transparent text-slate-400 hover:text-slate-600'}`}
                >
                    Visão Geral
                </button>
                <button 
                    onClick={() => setActiveTab('academico')}
                    className={`pb-3 text-sm font-bold border-b-2 transition-all ${activeTab === 'academico' ? 'border-[#E3B23C] text-slate-900' : 'border-transparent text-slate-400 hover:text-slate-600'}`}
                >
                    Acadêmico
                </button>
                <button 
                    onClick={() => setActiveTab('financeiro')}
                    className={`pb-3 text-sm font-bold border-b-2 transition-all ${activeTab === 'financeiro' ? 'border-[#E3B23C] text-slate-900' : 'border-transparent text-slate-400 hover:text-slate-600'}`}
                >
                    Financeiro
                </button>
             </div>
          </div>

          {/* TAB CONTENT PLACEHOLDER */}
          <div className="bg-white border border-slate-200 rounded-2xl shadow-sm min-h-[400px] p-8 flex flex-col items-center justify-center text-center">
             <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mb-4">
                {activeTab === 'geral' && <FileText className="text-slate-300 w-8 h-8"/>}
                {activeTab === 'academico' && <GraduationCap className="text-slate-300 w-8 h-8"/>}
                {activeTab === 'financeiro' && <CreditCard className="text-slate-300 w-8 h-8"/>}
             </div>
             <h3 className="text-lg font-bold text-slate-900">Módulo {activeTab.charAt(0).toUpperCase() + activeTab.slice(1)}</h3>
             <p className="text-sm text-slate-500 max-w-sm mt-2">
                Os componentes detalhados desta seção serão carregados aqui. (Notas, Histórico de Pagamentos, Ocorrências).
             </p>
             
             {/* Apenas para demonstração visual do botão correto */}
             <div className="mt-6">
                <button className="px-5 py-2.5 bg-[#E3B23C] text-white rounded-xl text-sm font-bold hover:brightness-95 shadow-sm shadow-orange-500/10">
                    Ação Principal
                </button>
             </div>
          </div>

        </div>
      </main>
    </div>
  );
}
