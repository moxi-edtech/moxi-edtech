import { getChartsData } from "@/lib/charts"
import { supabaseServer } from "@/lib/supabaseServer"
import { isSuperAdminRole } from "@/lib/auth/requireSuperAdminAccess"
import AuditPageView from "@/components/audit/AuditPageView"
import { DashboardHeader } from "@/components/dashboard/DashboardHeader"
import ChartsStaticSection from "@/components/super-admin/ChartsStaticSection"
import ActivitiesSection from '@/components/super-admin/ActivitiesSection'
import nextDynamic from 'next/dynamic'
const QuickActionsSection = nextDynamic(() => import('@/components/super-admin/QuickActionsSection'))

export const dynamic = 'force-dynamic'

import {
  BuildingLibraryIcon,
  UsersIcon,
  AcademicCapIcon,
  BanknotesIcon,
} from "@heroicons/react/24/outline"
import Link from 'next/link'

type KpiItem = {
  title: string
  value: string | number
  icon: typeof BuildingLibraryIcon
  href?: string
}

export default async function Page() {
  try {
    const supabase = await supabaseServer()
    const { data: userRes } = await supabase.auth.getUser()
    const user = userRes?.user
    const { data: roleRows } = user
      ? await supabase.from("profiles").select("role").eq("user_id", user.id).order("created_at", { ascending: false }).limit(1)
      : { data: [] }
    const role = (roleRows?.[0] as any)?.role as string | undefined
    const hasAccess = isSuperAdminRole(role)

    const [charts, healthMetrics, systemHealth, cronRuns, storageUsage, activityLogs] = await Promise.all([
      getChartsData(),
      hasAccess ? (supabase as any).rpc("admin_get_escola_health_metrics") : { data: [] },
      hasAccess ? (supabase as any).rpc("admin_get_system_health") : { data: null },
      hasAccess ? (supabase as any).rpc("get_recent_cron_runs", { p_limit: 1 }) : { data: [] },
      hasAccess
        ? (supabase as any).rpc("admin_get_storage_usage", {
            p_limit: 12,
            p_bucket_ids: [
              "documentos",
              "documentos_emitidos",
              "documentos_oficiais",
              "boletins",
              "recibos",
              "declaracoes",
              "pautas_zip",
            ],
          })
        : { data: [] },
      hasAccess
        ? (supabase as any)
            .from("audit_logs")
            .select("id, created_at, mensagem, acao, escola_id, escolas(nome)")
            .order("created_at", { ascending: false })
            .limit(8)
        : { data: [] },
    ])

    const escolas = ((healthMetrics as any)?.data || []) as Array<Record<string, any>>
    const cronStatus = ((cronRuns as any)?.data || [])[0] as { status?: string | null } | undefined
    const storageItems = ((storageUsage as any)?.data || []) as Array<{
      escola_id: string
      escola_nome: string | null
      total_bytes: number | null
      total_documentos: number | null
      last_30d_bytes: number | null
      projected_30d_bytes: number | null
    }>

    const computeHealthScore = (row: Record<string, any>) => {
      let score = 100
      const ultimo = row.ultimo_acesso ? new Date(row.ultimo_acesso).getTime() : null
      const daysSince = ultimo ? (Date.now() - ultimo) / 86400000 : Infinity
      if (!ultimo || daysSince > 5) score -= 40
      if (row.sync_status && row.sync_status !== "synced") score -= 30
      if (Number(row.alunos_ativos ?? 0) === 0) score -= 10
      if (Number(row.professores ?? 0) === 0) score -= 10
      return Math.max(0, Math.min(100, Math.round(score)))
    }

    const healthWithScore = escolas.map((row) => ({
      id: row.id as string,
      nome: row.nome as string,
      score: computeHealthScore(row),
      ultimo_acesso: row.ultimo_acesso as string | null,
    }))
    const issueSchool = healthWithScore.sort((a, b) => a.score - b.score)[0]
    const staleSchools = healthWithScore.filter((row) => {
      if (!row.ultimo_acesso) return true
      const days = (Date.now() - new Date(row.ultimo_acesso).getTime()) / 86400000
      return days >= 5
    })

    const totalStorageBytes = storageItems.reduce((sum, item) => sum + Number(item.total_bytes ?? 0), 0)
    const formatBytes = (bytes: number) => {
      if (!bytes) return "0 MB"
      const mb = bytes / (1024 * 1024)
      return `${mb.toFixed(mb >= 100 ? 0 : 1)} MB`
    }

    const systemSnapshot = (systemHealth as any)?.data as {
      escolas_ativas?: number
      alunos_totais?: number
      professores_totais?: number
      mrr_total?: number
    } | null

    const kpis: KpiItem[] = [
      { title: "Escolas activas", value: systemSnapshot?.escolas_ativas ?? 0, icon: BuildingLibraryIcon },
      { title: "Alunos totais", value: systemSnapshot?.alunos_totais ?? 0, icon: UsersIcon },
      { title: "Professores", value: systemSnapshot?.professores_totais ?? 0, icon: AcademicCapIcon },
      {
        title: "MRR",
        value: systemSnapshot?.mrr_total ? `${(systemSnapshot.mrr_total / 1000).toFixed(0)}K` : "Em construção",
        icon: BanknotesIcon,
      },
    ]

    const activities = ((activityLogs as any)?.data || []).map((row: any) => ({
      id: row.id,
      titulo: row.escolas?.nome ?? "Escola",
      resumo: row.mensagem ?? row.acao ?? "Actividade",
      data: row.created_at,
    }))

    return (
      <>
        <AuditPageView portal="super_admin" acao="PAGE_VIEW" entity="morning_briefing" />
        <DashboardHeader
          title="Morning Briefing"
          description="30 segundos para saber o que precisa da tua atenção."
        />

        <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-3">
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-xs uppercase text-slate-400">Alguma escola tem problema agora?</p>
            {issueSchool && issueSchool.score < 80 ? (
              <div className="mt-3">
                <p className="text-sm font-semibold text-slate-900">{issueSchool.nome}</p>
                <p className="text-sm text-amber-600">{issueSchool.score}% saúde</p>
              </div>
            ) : (
              <p className="mt-3 text-sm text-emerald-600">Nenhuma escola crítica agora</p>
            )}
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-xs uppercase text-slate-400">Alguma coisa falhou esta noite?</p>
            <p className={`mt-3 text-sm font-semibold ${cronStatus?.status === "failed" ? "text-rose-600" : "text-emerald-600"}`}>
              {cronStatus?.status === "failed" ? "Cron recente falhou" : "Cron de notificações · OK"}
            </p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-xs uppercase text-slate-400">O que precisa da tua atenção hoje?</p>
            <p className="mt-3 text-sm font-semibold text-slate-900">
              {staleSchools.length} escolas sem login há 5+ dias
            </p>
            {staleSchools.length > 0 && (
              <p className="mt-1 text-xs text-slate-500">
                {staleSchools.slice(0, 3).map((s) => s.nome).join(" · ")}
              </p>
            )}
          </div>
        </div>

        <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-sm font-semibold text-slate-900">Gestão de Storage</p>
              <p className="text-xs text-slate-500">Monitoriza consumo de documentos por escola.</p>
            </div>
            <div className="text-sm font-semibold text-slate-700">
              Total usado: {formatBytes(totalStorageBytes)}
            </div>
          </div>
          <div className="mt-4 space-y-2">
            {storageItems.slice(0, 6).map((item) => (
              <div key={item.escola_id} className="flex items-center justify-between rounded-lg border border-slate-100 px-3 py-2">
                <div>
                  <p className="text-sm font-medium text-slate-800">{item.escola_nome ?? "Escola"}</p>
                  <p className="text-xs text-slate-500">
                    {item.total_documentos ?? 0} documentos · projeção 30d {formatBytes(Number(item.projected_30d_bytes ?? 0))}
                  </p>
                </div>
                <div className="text-sm font-semibold text-slate-700">
                  {formatBytes(Number(item.total_bytes ?? 0))}
                </div>
              </div>
            ))}
            {storageItems.length === 0 && (
              <p className="text-xs text-slate-500">Sem dados de storage ainda.</p>
            )}
          </div>
          <div className="mt-3 text-xs text-slate-500">
            {totalStorageBytes >= 800 * 1024 * 1024 ? "⚠️ Total acima de 80% do limite free." : "Limite free: 1GB. Alertas a partir de 200MB por escola."}
          </div>
        </div>

        <div className="mt-8 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {kpis.map((kpi) => {
            const content = (
              <div className="bg-white shadow rounded-lg p-4 flex items-center">
                <kpi.icon className="w-10 h-10 text-blue-600 mr-4" />
                <div>
                  <p className="text-sm text-gray-500">{kpi.title}</p>
                  <p className="text-xl font-bold">{kpi.value}</p>
                </div>
              </div>
            )
            return kpi.href ? (
              <Link key={kpi.title} href={kpi.href}>
                {content}
              </Link>
            ) : (
              <div key={kpi.title}>{content}</div>
            )
          })}
        </div>

        {/* Charts Section (server-rendered, no client JS) */}
        <ChartsStaticSection data={charts} />

        {/* Activities e QuickActions Sections */}
        <div className="grid gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <ActivitiesSection activities={activities} />
          </div>
          <div className="lg:col-span-1">
            <QuickActionsSection />
          </div>
        </div>
      </>
    )

  } catch (error) {
    console.error('❌ Erro no servidor:', error)
    
    // Fallback para erro
    const kpis: KpiItem[] = [
      { title: "Alunos ativos", value: 0, icon: UsersIcon },
      { title: "Turmas", value: 0, icon: BuildingLibraryIcon },
      { title: "Professores", value: 0, icon: AcademicCapIcon },
      { title: "Financeiro", value: "0% pago", icon: BanknotesIcon },
    ]

    return (
      <>
        <AuditPageView portal="super_admin" acao="PAGE_VIEW" entity="morning_briefing" />
        <DashboardHeader
          title="Morning Briefing"
          description="30 segundos para saber o que precisa da tua atenção."
        />
        <div className="text-red-500">Erro ao carregar dados</div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {kpis.map((kpi) => {
            const content = (
              <div className="bg-white shadow rounded-lg p-4 flex items-center">
                <kpi.icon className="w-10 h-10 text-blue-600 mr-4" />
                <div>
                  <p className="text-sm text-gray-500">{kpi.title}</p>
                  <p className="text-xl font-bold">{kpi.value}</p>
                </div>
              </div>
            )
            return kpi.href ? (
              <Link key={kpi.title} href={kpi.href}>
                {content}
              </Link>
            ) : (
              <div key={kpi.title}>{content}</div>
            )
          })}
        </div>

        {/* Sections vazias em caso de erro */}
        <div className="grid gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <ActivitiesSection activities={[]} />
          </div>
          <div className="lg:col-span-1">
            <QuickActionsSection />
          </div>
        </div>
      </>
    )
  }
}
