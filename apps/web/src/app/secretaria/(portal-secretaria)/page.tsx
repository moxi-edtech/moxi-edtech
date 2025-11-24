// No seu arquivo principal, adicione o link para professores
import AuditPageView from "@/components/audit/AuditPageView";
import { supabaseServer } from "@/lib/supabaseServer";
import Link from "next/link";
import { getPapelForEscola } from "@/lib/auth";
import { hasPermission } from "@/lib/permissions";
import SecretariaDashboardLoader from "@/components/secretaria/DashboardLoader";
import { 
  Users, 
  UserPlus, 
  BookOpen, 
  Building, 
  BarChart3, 
  Bell, 
  Download, 
  Zap,
  Shield,
  Crown,
  ArrowRight
} from "lucide-react";

export default async function Page() {
  const s = await supabaseServer()
  const { data: sess } = await s.auth.getUser()
  const user = sess?.user
  let escolaId: string | null = null
  if (user) {
    const { data: prof } = await s
      .from('profiles')
      .select('escola_id, role')
      .eq('user_id', user.id)
      .maybeSingle()
    escolaId = (prof as any)?.escola_id ?? null
  }
  if (!escolaId) {
    return (
      <>
        <AuditPageView portal="secretaria" acao="PAGE_VIEW" entity="home" />
        <div className="w-full max-w-6xl mx-auto p-6">
          <div className="bg-amber-50 p-6 rounded-xl border border-amber-200 shadow-sm">
            <h3 className="text-amber-800 font-medium text-lg mb-2">Vincule sua conta</h3>
            <p className="text-amber-700">Vincule seu perfil a uma escola para acessar o painel.</p>
          </div>
        </div>
      </>
    )
  }

  const { data: esc } = await s.from('escolas').select('plano').eq('id', escolaId).maybeSingle()
  const plan = ((esc as any)?.plano || 'basico') as 'basico'|'standard'|'premium'

  // Papel & permissions for UI gating
  const papel = await getPapelForEscola(escolaId)
  const canCriarMatricula = hasPermission(papel as any, 'criar_matricula')
  const canGerenciarProfessores = hasPermission(papel as any, 'criar_usuario')

  const getPlanColor = (plan: string) => {
    switch (plan) {
      case 'premium': return 'text-purple-600 bg-purple-50 border-purple-200';
      case 'standard': return 'text-blue-600 bg-blue-50 border-blue-200';
      default: return 'text-slate-600 bg-slate-50 border-slate-200';
    }
  };

  const getPlanIcon = (plan: string) => {
    switch (plan) {
      case 'premium': return <Crown className="h-4 w-4" />;
      case 'standard': return <Shield className="h-4 w-4" />;
      default: return <Shield className="h-4 w-4" />;
    }
  };

  return (
    <>
      <AuditPageView portal="secretaria" acao="PAGE_VIEW" entity="home" />
      
      <div className="w-full max-w-6xl mx-auto space-y-6 p-6 bg-slate-50 rounded-xl">
        {/* --- HEADER DO PLANO --- */}
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
          <div>
            <h1 className="text-2xl font-bold text-moxinexa-navy flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-green-500 animate-pulse" />
              Painel da Secretaria
            </h1>
            <p className="text-sm text-slate-500 mt-1">
              Gestão completa de alunos, turmas e atividades acadêmicas
            </p>
          </div>

          <div className="flex items-center gap-3">
            <div className={`inline-flex items-center gap-2 rounded-lg border px-4 py-2 text-sm font-semibold ${getPlanColor(plan)}`}>
              {getPlanIcon(plan)}
              Plano {plan.charAt(0).toUpperCase() + plan.slice(1)}
            </div>
          </div>
        </div>

        {/* --- DASHBOARD PRINCIPAL --- */}
        <SecretariaDashboardLoader />

        {/* --- AÇÕES RÁPIDAS --- */}
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="text-lg font-bold text-moxinexa-navy flex items-center gap-2">
                <Zap className="h-5 w-5 text-moxinexa-teal" />
                Ações Rápidas
              </h3>
              <p className="text-sm text-slate-500 mt-1">
                Acesse rapidamente as funcionalidades mais utilizadas
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-3">
            <Link 
              href="/secretaria/alunos" 
              className="group p-4 rounded-lg border border-slate-200 bg-slate-50 hover:bg-white hover:border-moxinexa-teal hover:shadow-md transition-all text-center"
            >
              <Users className="w-6 h-6 text-slate-600 group-hover:text-moxinexa-teal mx-auto mb-2 transition-colors" />
              <div className="text-xs font-semibold text-slate-700 group-hover:text-slate-900">Ver Alunos</div>
            </Link>

            <Link 
              href="/secretaria/professores" 
              className="group p-4 rounded-lg border border-slate-200 bg-slate-50 hover:bg-white hover:border-moxinexa-teal hover:shadow-md transition-all text-center"
            >
              <UserPlus className="w-6 h-6 text-slate-600 group-hover:text-moxinexa-teal mx-auto mb-2 transition-colors" />
              <div className="text-xs font-semibold text-slate-700 group-hover:text-slate-900">Ver Professores</div>
            </Link>

            <Link 
              href="/secretaria/matriculas" 
              className="group p-4 rounded-lg border border-slate-200 bg-slate-50 hover:bg-white hover:border-moxinexa-teal hover:shadow-md transition-all text-center"
            >
              <BookOpen className="w-6 h-6 text-slate-600 group-hover:text-moxinexa-teal mx-auto mb-2 transition-colors" />
              <div className="text-xs font-semibold text-slate-700 group-hover:text-slate-900">Ver Matrículas</div>
            </Link>

            <Link 
              href="/secretaria/fluxo-academico" 
              className="group p-4 rounded-lg border border-green-200 bg-green-50 hover:bg-green-100 hover:border-green-300 hover:shadow-md transition-all text-center"
            >
              <ArrowRight className="w-6 h-6 text-green-600 group-hover:text-green-700 mx-auto mb-2 transition-colors" />
              <div className="text-xs font-semibold text-green-700 group-hover:text-green-900">Fluxo Acadêmico</div>
            </Link>

            {canCriarMatricula ? (
              <Link 
                href="/secretaria/alunos/novo" 
                className="group p-4 rounded-lg border border-blue-200 bg-blue-50 hover:bg-blue-100 hover:border-blue-300 hover:shadow-md transition-all text-center"
              >
                <UserPlus className="w-6 h-6 text-blue-600 group-hover:text-blue-700 mx-auto mb-2 transition-colors" />
                <div className="text-xs font-semibold text-blue-700 group-hover:text-blue-900">Novo Aluno</div>
              </Link>
            ) : (
              <div 
                className="group p-4 rounded-lg border border-slate-200 bg-slate-50 opacity-50 cursor-not-allowed text-center"
                title="Sem permissão (requer: criar_matricula)"
              >
                <UserPlus className="w-6 h-6 text-slate-400 mx-auto mb-2" />
                <div className="text-xs font-semibold text-slate-500">Novo Aluno</div>
              </div>
            )}

            {canGerenciarProfessores ? (
              <Link 
                href="/secretaria/professores/novo" 
                className="group p-4 rounded-lg border border-blue-200 bg-blue-50 hover:bg-blue-100 hover:border-blue-300 hover:shadow-md transition-all text-center"
              >
                <UserPlus className="w-6 h-6 text-blue-600 group-hover:text-blue-700 mx-auto mb-2 transition-colors" />
                <div className="text-xs font-semibold text-blue-700 group-hover:text-blue-900">Novo Professor</div>
              </Link>
            ) : (
              <div 
                className="group p-4 rounded-lg border border-slate-200 bg-slate-50 opacity-50 cursor-not-allowed text-center"
                title="Sem permissão (requer: criar_usuario)"
              >
                <UserPlus className="w-6 h-6 text-slate-400 mx-auto mb-2" />
                <div className="text-xs font-semibold text-slate-500">Novo Professor</div>
              </div>
            )}

            <Link 
              href="/secretaria/turmas" 
              className="group p-4 rounded-lg border border-slate-200 bg-slate-50 hover:bg-white hover:border-moxinexa-teal hover:shadow-md transition-all text-center"
            >
              <Building className="w-6 h-6 text-slate-600 group-hover:text-moxinexa-teal mx-auto mb-2 transition-colors" />
              <div className="text-xs font-semibold text-slate-700 group-hover:text-slate-900">Ver Turmas</div>
            </Link>

            <Link 
              href="/secretaria/relatorios" 
              className="group p-4 rounded-lg border border-slate-200 bg-slate-50 hover:bg-white hover:border-moxinexa-teal hover:shadow-md transition-all text-center"
            >
              <BarChart3 className="w-6 h-6 text-slate-600 group-hover:text-moxinexa-teal mx-auto mb-2 transition-colors" />
              <div className="text-xs font-semibold text-slate-700 group-hover:text-slate-900">Relatórios</div>
            </Link>

            <Link 
              href="/secretaria/alertas" 
              className="group p-4 rounded-lg border border-slate-200 bg-slate-50 hover:bg-white hover:border-moxinexa-teal hover:shadow-md transition-all text-center"
            >
              <Bell className="w-6 h-6 text-slate-600 group-hover:text-moxinexa-teal mx-auto mb-2 transition-colors" />
              <div className="text-xs font-semibold text-slate-700 group-hover:text-slate-900">Alertas</div>
            </Link>

            <Link 
              href="/secretaria/exportacoes" 
              className="group p-4 rounded-lg border border-slate-200 bg-slate-50 hover:bg-white hover:border-moxinexa-teal hover:shadow-md transition-all text-center"
            >
              <Download className="w-6 h-6 text-slate-600 group-hover:text-moxinexa-teal mx-auto mb-2 transition-colors" />
              <div className="text-xs font-semibold text-slate-700 group-hover:text-slate-900">Exportações</div>
            </Link>
          </div>

          {/* --- RECURSOS DO PLANO --- */}
          <div className="mt-6 pt-6 border-t border-slate-200">
            <div className="text-sm text-slate-600">
              {plan === 'basico' ? (
                <div className="space-y-3">
                  <div className="font-semibold text-slate-700">📈 Recursos avançados disponíveis nos planos superiores:</div>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
                    <div className="flex items-center gap-2 p-2 bg-amber-50 rounded border border-amber-200">
                      <Bell className="h-4 w-4 text-amber-600" />
                      <span>Alertas automáticos</span>
                    </div>
                    <div className="flex items-center gap-2 p-2 bg-amber-50 rounded border border-amber-200">
                      <Download className="h-4 w-4 text-amber-600" />
                      <span>Exportações detalhadas</span>
                    </div>
                    <div className="flex items-center gap-2 p-2 bg-purple-50 rounded border border-purple-200">
                      <Crown className="h-4 w-4 text-purple-600" />
                      <span>Integrações avançadas</span>
                    </div>
                  </div>
                </div>
              ) : plan === 'standard' ? (
                <div className="text-green-600 font-medium">
                  ✅ Você está aproveitando todos os recursos do plano Standard
                </div>
              ) : (
                <div className="text-purple-600 font-medium">
                  👑 Você tem acesso a todos os recursos Premium
                </div>
              )}
            </div>
          </div>
        </div>

        {/* --- UPGRADE BANNER PARA PLANO BÁSICO --- */}
        {plan === 'basico' && (
          <div className="bg-gradient-to-r from-amber-50 to-orange-50 p-6 rounded-xl border border-amber-200 shadow-sm">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
              <div>
                <h4 className="text-lg font-bold text-amber-800 flex items-center gap-2">
                  <Crown className="h-5 w-5" />
                  Desbloqueie recursos do plano Standard
                </h4>
                <p className="text-amber-700 mt-1">
                  Aproveite alertas automáticos, exportações detalhadas e muito mais
                </p>
              </div>
              <div className="flex gap-3">
                <div className="text-right">
                  <div className="text-sm font-semibold text-amber-800">Fale com o Super Admin</div>
                  <div className="text-xs text-amber-600">para atualizar o plano</div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  )
}