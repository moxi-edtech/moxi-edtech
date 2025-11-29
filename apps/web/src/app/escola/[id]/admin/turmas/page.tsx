import { supabaseServer } from "@/lib/supabaseServer";
import { 
  Users, 
  Clock, 
  Calendar, 
  Building2, 
  Search, 
  Download, 
  Plus, 
  MoreVertical,
  Filter
} from "lucide-react";

export const dynamic = 'force-dynamic';

// --- TYPES & HELPERS ---
type TurmaRow = {
  id: string;
  nome: string;
  turno: string | null;
  ano_letivo: string | null;
  sala: string | null;
};

// Componente KPI Individual (Micro-componente para limpar o código principal)
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

export default async function TurmasPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: escolaId } = await params;
  const s = await supabaseServer();
  
  // Fetch Data
  const { data: turmas } = await s
    .from('turmas')
    .select('id, nome, turno, ano_letivo, sala')
    .eq('escola_id', escolaId)
    .order('nome');

  // Lógica de Estatísticas
  const totalTurmas = turmas?.length || 0;
  const turnosMap = turmas?.reduce((acc, t) => {
    const turno = t.turno || 'Indefinido';
    acc[turno] = (acc[turno] || 0) + 1;
    return acc;
  }, {} as Record<string, number>) || {};
  
  const turnoDominante = Object.entries(turnosMap).sort((a, b) => b[1] - a[1])[0]?.[0] || '—';
  const comSala = turmas?.filter(t => t.sala).length || 0;

  return (
    <div className="w-full max-w-7xl mx-auto p-6 space-y-8 pb-20">
      
      {/* 1. HEADER & BREADCRUMB */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">Gestão de Turmas</h1>
          <p className="text-sm font-medium text-slate-500">Administre a estrutura acadêmica e alocação de salas.</p>
        </div>
        <div className="flex gap-3">
          <button className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 text-slate-600 rounded-xl text-sm font-bold hover:bg-slate-50 transition shadow-sm">
            <Download className="h-4 w-4" />
            <span className="hidden sm:inline">Exportar</span>
          </button>
          <button className="flex items-center gap-2 px-5 py-2 bg-slate-900 text-white rounded-xl text-sm font-bold hover:bg-slate-800 shadow-lg shadow-slate-900/20 transition hover:-translate-y-0.5">
            <Plus className="h-4 w-4" />
            Nova Turma
          </button>
        </div>
      </div>

      {/* 2. KPIS ROW */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard 
          title="Total Turmas" 
          value={totalTurmas} 
          icon={Users} 
          colorClass="text-blue-600" 
          bgClass="bg-blue-50" 
        />
        <KpiCard 
          title="Turnos Ativos" 
          value={Object.keys(turnosMap).length} 
          icon={Clock} 
          colorClass="text-orange-600" 
          bgClass="bg-orange-50" 
        />
        <KpiCard 
          title="Turno Dominante" 
          value={turnoDominante} 
          icon={Calendar} 
          colorClass="text-purple-600" 
          bgClass="bg-purple-50" 
        />
        <KpiCard 
          title="Com Sala Fixa" 
          value={`${comSala}/${totalTurmas}`} 
          icon={Building2} 
          colorClass="text-emerald-600" 
          bgClass="bg-emerald-50" 
        />
      </div>

      {/* 3. CONTEÚDO PRINCIPAL (Tabela) */}
      <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
        
        {/* Toolbar da Tabela */}
        <div className="p-5 border-b border-slate-100 bg-slate-50/50 flex flex-col sm:flex-row gap-4 justify-between items-center">
          
          {/* Search */}
          <div className="relative w-full sm:max-w-xs">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Search className="h-4 w-4 text-slate-400" />
            </div>
            <input 
              type="text" 
              placeholder="Buscar turma..." 
              className="block w-full pl-10 pr-3 py-2 border border-slate-200 rounded-lg leading-5 bg-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500 sm:text-sm transition-shadow"
            />
          </div>

          {/* Filters */}
          <div className="flex gap-2 w-full sm:w-auto">
            <button className="flex-1 sm:flex-none inline-flex items-center justify-center gap-2 px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs font-bold text-slate-600 hover:bg-slate-50 transition">
              <Filter className="h-3 w-3" />
              Turno
            </button>
            <button className="flex-1 sm:flex-none inline-flex items-center justify-center gap-2 px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs font-bold text-slate-600 hover:bg-slate-50 transition">
              <Filter className="h-3 w-3" />
              Ano Letivo
            </button>
          </div>
        </div>

        {/* Estado Vazio (Hero) */}
        {!turmas || turmas.length === 0 ? (
          <div className="p-12 text-center flex flex-col items-center justify-center">
            <div className="bg-slate-50 p-4 rounded-full mb-4">
              <Users className="h-10 w-10 text-slate-300" />
            </div>
            <h3 className="text-lg font-bold text-slate-900">Nenhuma turma encontrada</h3>
            <p className="text-slate-500 text-sm mt-1 max-w-sm">
              Ainda não existem turmas cadastradas para esta escola. Comece por criar a estrutura inicial.
            </p>
            <button className="mt-6 px-6 py-2 bg-teal-600 text-white text-sm font-bold rounded-xl hover:bg-teal-700 transition">
              Criar Primeira Turma
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-100">
              <thead className="bg-white">
                <tr>
                  <th scope="col" className="px-6 py-4 text-left text-xs font-bold text-slate-400 uppercase tracking-wider">Turma</th>
                  <th scope="col" className="px-6 py-4 text-left text-xs font-bold text-slate-400 uppercase tracking-wider">Turno</th>
                  <th scope="col" className="px-6 py-4 text-left text-xs font-bold text-slate-400 uppercase tracking-wider">Sala</th>
                  <th scope="col" className="px-6 py-4 text-left text-xs font-bold text-slate-400 uppercase tracking-wider">Ano</th>
                  <th scope="col" className="px-6 py-4 text-center text-xs font-bold text-slate-400 uppercase tracking-wider">Ações</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-slate-50">
                {turmas.map((turma) => (
                  <tr key={turma.id} className="hover:bg-slate-50/80 transition-colors group">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <div className="flex-shrink-0 h-10 w-10 rounded-lg bg-slate-100 flex items-center justify-center text-slate-500 font-bold text-sm">
                          {turma.nome.substring(0, 2)}
                        </div>
                        <div className="ml-4">
                          <div className="text-sm font-bold text-slate-900">{turma.nome}</div>
                          <div className="text-xs text-slate-400 font-mono">ID: {turma.id.slice(0,6)}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {turma.turno ? (
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold capitalize
                          ${turma.turno === 'Manhã' ? 'bg-orange-50 text-orange-700' : 
                            turma.turno === 'Tarde' ? 'bg-amber-50 text-amber-700' : 'bg-indigo-50 text-indigo-700'}
                        `}>
                          {turma.turno}
                        </span>
                      ) : <span className="text-slate-300 text-xs italic">N/A</span>}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {turma.sala ? (
                        <div className="flex items-center text-sm text-slate-600">
                          <Building2 className="flex-shrink-0 mr-1.5 h-4 w-4 text-slate-400" />
                          {turma.sala}
                        </div>
                      ) : <span className="text-slate-300 text-xs italic">Sem sala</span>}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500">
                      {turma.ano_letivo || '—'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <button className="text-slate-400 hover:text-slate-600 p-2 rounded-full hover:bg-slate-100 transition">
                        <MoreVertical className="h-4 w-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        
        {/* Footer da Tabela (Paginação ou Info) */}
        {turmas && turmas.length > 0 && (
          <div className="bg-slate-50 px-6 py-4 border-t border-slate-200 flex items-center justify-between text-xs text-slate-500">
            <span>A mostrar {turmas.length} resultados</span>
            <div className="flex gap-2">
              <button disabled className="px-3 py-1 bg-white border border-slate-200 rounded-md text-slate-300 cursor-not-allowed">Anterior</button>
              <button disabled className="px-3 py-1 bg-white border border-slate-200 rounded-md text-slate-300 cursor-not-allowed">Próximo</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}