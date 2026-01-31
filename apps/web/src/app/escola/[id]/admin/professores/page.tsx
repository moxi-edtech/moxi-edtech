import { supabaseServer } from "@/lib/supabaseServer";
import { resolveEscolaIdForUser } from "@/lib/tenant/resolveEscolaIdForUser";
import { 
  Users, 
  Mail, 
  UserCheck, 
  ShieldCheck, 
  Search, 
  Download, 
  UserPlus, 
  MoreVertical,
  Filter
} from "lucide-react";

export const dynamic = 'force-dynamic';

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

export default async function ProfessoresPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: escolaId } = await params;
  const s = await supabaseServer();

  const { data: userRes } = await s.auth.getUser();
  const user = userRes?.user;
  if (!user) {
    return <div className="p-6 text-sm text-slate-600">Não autenticado.</div>;
  }

  const metaEscolaId = (user.app_metadata as { escola_id?: string | null } | null)?.escola_id ?? null;
  const resolvedEscolaId = await resolveEscolaIdForUser(
    s as any,
    user.id,
    escolaId,
    metaEscolaId ? String(metaEscolaId) : null
  );

  if (!resolvedEscolaId) {
    return <div className="p-6 text-sm text-slate-600">Sem permissão.</div>;
  }

  // 1. Buscar Vínculos (Professores da Escola)
  const { data: vinculados } = await s
    .from('escola_users')
    .select('user_id, created_at')
    .eq('escola_id', resolvedEscolaId)
    .eq('papel', 'professor');

  const userIds = (vinculados || []).map((v: any) => v.user_id).filter(Boolean);

  // 2. Buscar Detalhes dos Perfis
  let perfis: any[] = [];
  if (userIds.length > 0) {
    const { data, error } = await (s as any)
      .rpc('tenant_profiles_by_ids', { p_user_ids: userIds });
    if (!error) {
      perfis = (data || []).sort((a: any, b: any) =>
        String(a?.nome || '').localeCompare(String(b?.nome || ''))
      );
    }
  }

  // 3. Calcular Métricas
  const total = perfis.length;
  const comEmail = perfis.filter(p => p.email).length;
  const comNome = perfis.filter(p => p.nome).length;
  const taxaConclusao = total > 0 ? Math.round((comNome / total) * 100) : 0;

  return (
    <div className="w-full max-w-7xl mx-auto p-6 space-y-8 pb-20">
      
      {/* 1. HEADER & AÇÕES */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">Corpo Docente</h1>
          <p className="text-sm font-medium text-slate-500">Gerencie os professores e acessos da plataforma.</p>
        </div>
        <div className="flex gap-3">
          <button className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 text-slate-600 rounded-xl text-sm font-bold hover:bg-slate-50 transition shadow-sm">
            <Download className="h-4 w-4" />
            <span className="hidden sm:inline">Relatório</span>
          </button>
          <button className="flex items-center gap-2 px-5 py-2 bg-slate-900 text-white rounded-xl text-sm font-bold hover:bg-slate-800 shadow-lg shadow-slate-900/20 transition hover:-translate-y-0.5">
            <UserPlus className="h-4 w-4" />
            Adicionar Professor
          </button>
        </div>
      </div>

      {/* 2. KPIS ROW */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard 
          title="Total Professores" 
          value={total} 
          icon={Users} 
          colorClass="text-blue-600" 
          bgClass="bg-blue-50" 
        />
        <KpiCard 
          title="Perfis Ativos" 
          value={comNome} 
          icon={UserCheck} 
          colorClass="text-emerald-600" 
          bgClass="bg-emerald-50" 
        />
        <KpiCard 
          title="Com E-mail" 
          value={comEmail} 
          icon={Mail} 
          colorClass="text-orange-600" 
          bgClass="bg-orange-50" 
        />
        <KpiCard 
          title="Taxa de Cadastro" 
          value={`${taxaConclusao}%`} 
          icon={ShieldCheck} 
          colorClass="text-purple-600" 
          bgClass="bg-purple-50" 
        />
      </div>

      {/* 3. TABELA PRINCIPAL */}
      <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
        
        {/* Toolbar */}
        <div className="p-5 border-b border-slate-100 bg-slate-50/50 flex flex-col sm:flex-row gap-4 justify-between items-center">
          <div className="relative w-full sm:max-w-xs">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Search className="h-4 w-4 text-slate-400" />
            </div>
            <input 
              type="text" 
              placeholder="Buscar professor..." 
              className="block w-full pl-10 pr-3 py-2 border border-slate-200 rounded-lg leading-5 bg-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500 sm:text-sm transition-shadow"
            />
          </div>
          <div className="flex gap-2 w-full sm:w-auto">
            <button className="flex-1 sm:flex-none inline-flex items-center justify-center gap-2 px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs font-bold text-slate-600 hover:bg-slate-50 transition">
              <Filter className="h-3 w-3" />
              Status
            </button>
          </div>
        </div>

        {/* Empty State */}
        {perfis.length === 0 ? (
          <div className="p-12 text-center flex flex-col items-center justify-center">
            <div className="bg-slate-50 p-4 rounded-full mb-4">
              <Users className="h-10 w-10 text-slate-300" />
            </div>
            <h3 className="text-lg font-bold text-slate-900">Nenhum professor encontrado</h3>
            <p className="text-slate-500 text-sm mt-1 max-w-sm">
              Comece a montar o corpo docente adicionando o primeiro professor.
            </p>
            <button className="mt-6 px-6 py-2 bg-teal-600 text-white text-sm font-bold rounded-xl hover:bg-teal-700 transition">
              Adicionar Primeiro
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-100">
              <thead className="bg-white">
                <tr>
                  <th scope="col" className="px-6 py-4 text-left text-xs font-bold text-slate-400 uppercase tracking-wider">Professor</th>
                  <th scope="col" className="px-6 py-4 text-left text-xs font-bold text-slate-400 uppercase tracking-wider">Contacto</th>
                  <th scope="col" className="px-6 py-4 text-left text-xs font-bold text-slate-400 uppercase tracking-wider">ID Sistema</th>
                  <th scope="col" className="px-6 py-4 text-center text-xs font-bold text-slate-400 uppercase tracking-wider">Status</th>
                  <th scope="col" className="px-6 py-4 text-right text-xs font-bold text-slate-400 uppercase tracking-wider">Ações</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-slate-50">
                {perfis.map((p) => {
                  const isComplete = p.nome && p.email;
                  return (
                    <tr key={p.user_id} className="hover:bg-slate-50/80 transition-colors group">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <div className="flex-shrink-0 h-10 w-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 font-bold text-sm border border-slate-200">
                            {p.nome ? p.nome.substring(0, 2).toUpperCase() : '?'}
                          </div>
                          <div className="ml-4">
                            <div className="text-sm font-bold text-slate-900">
                              {p.nome || <span className="text-slate-400 italic">Sem nome</span>}
                            </div>
                            <div className="text-xs text-slate-400">Desde {new Date(p.created_at).getFullYear()}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {p.email ? (
                          <div className="flex items-center text-sm text-slate-600">
                            <Mail className="flex-shrink-0 mr-1.5 h-4 w-4 text-slate-400" />
                            {p.email}
                          </div>
                        ) : <span className="text-slate-300 text-xs italic">Não informado</span>}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="font-mono text-xs text-slate-500 bg-slate-50 px-2 py-1 rounded border border-slate-100">
                          {p.user_id.substring(0, 8)}...
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-center">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold
                          ${isComplete ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'}
                        `}>
                          {isComplete ? 'Completo' : 'Pendente'}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <button className="text-slate-400 hover:text-slate-600 p-2 rounded-full hover:bg-slate-100 transition">
                          <MoreVertical className="h-4 w-4" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        
        {/* Footer (Paginação) */}
        {perfis.length > 0 && (
          <div className="bg-slate-50 px-6 py-4 border-t border-slate-200 flex items-center justify-between text-xs text-slate-500">
            <span>A mostrar {perfis.length} professores</span>
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
