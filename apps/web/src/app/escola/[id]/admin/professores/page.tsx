import { supabaseServer } from "@/lib/supabaseServer";
import { Users, Mail, IdCard, UserPlus, BookOpen } from "lucide-react";

export const dynamic = 'force-dynamic';

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id: escolaId } = await params;
  const s = await supabaseServer();

  // Busca professores via vinculo escola_usuarios + profiles
  const { data: vinculados } = await s
    .from('escola_usuarios')
    .select('user_id, created_at')
    .eq('escola_id', escolaId)
    .eq('papel', 'professor');

  const userIds = (vinculados || []).map((v: any) => v.user_id).filter(Boolean);

  let perfis: Array<{ 
    user_id: string; 
    nome: string | null; 
    email: string | null;
    created_at: string;
  }> = [];
  
  if (userIds.length > 0) {
    const { data } = await s
      .from('profiles')
      .select('user_id, nome, email, created_at')
      .in('user_id', userIds);
    perfis = (data || []) as any[];
  }

  // Calcular métricas
  const totalProfessores = perfis.length;
  const professoresComEmail = perfis.filter(p => p.email).length;
  const professoresComNome = perfis.filter(p => p.nome).length;

  return (
    <div className="w-full max-w-6xl mx-auto space-y-6 p-6 bg-slate-50 rounded-xl">
      {/* --- HEADER COM MÉTRICAS --- */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
          <div className="text-2xl font-bold text-moxinexa-navy">{totalProfessores}</div>
          <div className="text-sm text-slate-500 flex items-center gap-2">
            <Users className="h-4 w-4" />
            Total de Professores
          </div>
        </div>
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
          <div className="text-2xl font-bold text-orange-600">
            {professoresComEmail}
          </div>
          <div className="text-sm text-slate-500 flex items-center gap-2">
            <Mail className="h-4 w-4" />
            Com E-mail
          </div>
        </div>
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
          <div className="text-2xl font-bold text-moxinexa-teal">
            {professoresComNome}
          </div>
          <div className="text-sm text-slate-500 flex items-center gap-2">
            <IdCard className="h-4 w-4" />
            Com Nome Cadastrado
          </div>
        </div>
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
          <div className="text-2xl font-bold text-green-600">
            {Math.round((professoresComNome / totalProfessores) * 100) || 0}%
          </div>
          <div className="text-sm text-slate-500 flex items-center gap-2">
            <BookOpen className="h-4 w-4" />
            Perfis Completos
          </div>
        </div>
      </div>

      {/* --- HEADER DE AÇÃO --- */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
        <div>
          <h1 className="text-2xl font-bold text-moxinexa-navy flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-purple-500" />
            Corpo Docente
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            {totalProfessores} professores vinculados • {professoresComNome} com perfil completo
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button className="inline-flex items-center gap-2 rounded-lg bg-slate-100 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-200 transition-all">
            <Users className="h-4 w-4" />
            Relatório
          </button>

          <button className="inline-flex items-center gap-2 rounded-lg bg-moxinexa-teal px-5 py-3 text-sm font-bold text-white hover:bg-teal-600 shadow-lg shadow-teal-900/20 transition-all active:scale-95 transform hover:-translate-y-0.5">
            <UserPlus className="h-4 w-4" />
            Adicionar Professor
          </button>
        </div>
      </div>

      {/* --- TABELA DE PROFESSORES --- */}
      <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-4 py-4 text-left text-xs font-bold uppercase tracking-wide text-slate-500">
                  Professor
                </th>
                <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wide text-slate-500">
                  Contato
                </th>
                <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wide text-slate-500">
                  Identificação
                </th>
                <th className="px-4 py-3 text-center text-xs font-bold uppercase tracking-wide text-slate-500">
                  Status do Perfil
                </th>
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-100">
              {perfis.length === 0 ? (
                <tr>
                  <td colSpan={4} className="p-8 text-center text-slate-500">
                    <Users className="h-12 w-12 mx-auto mb-3 text-slate-300" />
                    Nenhum professor vinculado à escola.
                    <div className="mt-2 text-sm">
                      Adicione professores para começar a gerenciar o corpo docente.
                    </div>
                  </td>
                </tr>
              ) : (
                perfis.map((professor) => {
                  const hasNome = !!professor.nome;
                  const hasEmail = !!professor.email;
                  const profileComplete = hasNome && hasEmail;
                  
                  return (
                    <tr key={professor.user_id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-4 py-4 text-slate-900">
                        <div className="font-bold text-moxinexa-navy">
                          {professor.nome || (
                            <span className="text-slate-400">Nome não cadastrado</span>
                          )}
                        </div>
                        <div className="text-xs text-slate-500">
                          Vinculado em {new Date(professor.created_at).toLocaleDateString('pt-AO')}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        {professor.email ? (
                          <div className="flex items-center gap-2">
                            <Mail className="h-4 w-4 text-slate-400" />
                            <span className="text-slate-700">{professor.email}</span>
                          </div>
                        ) : (
                          <span className="text-slate-400 text-xs flex items-center gap-2">
                            <Mail className="h-4 w-4" />
                            E-mail não cadastrado
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2 text-slate-600">
                          <IdCard className="h-4 w-4 text-slate-400" />
                          <span className="font-mono text-xs bg-slate-100 px-2 py-1 rounded">
                            {professor.user_id.slice(0, 8)}...
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-center">
                        {profileComplete ? (
                          <span className="inline-flex items-center rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-bold text-emerald-700">
                            ✓ Completo
                          </span>
                        ) : (
                          <span className="inline-flex items-center rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-bold text-amber-700">
                            ⚠ Incompleto
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* --- FOOTER COM INFORMAÇÕES ADICIONAIS --- */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
        <div className="text-sm text-slate-600">
          <p className="flex items-center gap-2 mb-2">
            <span className="font-bold">📊 Resumo do Corpo Docente:</span>
          </p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-2 text-xs">
            <div className="bg-blue-50 p-2 rounded">
              <strong>Total:</strong> {totalProfessores} professores
            </div>
            <div className="bg-green-50 p-2 rounded">
              <strong>Completos:</strong> {professoresComNome} perfis
            </div>
            <div className="bg-orange-50 p-2 rounded">
              <strong>Com e-mail:</strong> {professoresComEmail} professores
            </div>
          </div>
          <p className="mt-3 text-slate-500">
            💡 <strong>Dica:</strong> Incentive os professores a completarem seus perfis para melhor comunicação.
          </p>
        </div>
      </div>
    </div>
  );
}