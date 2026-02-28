// apps/web/src/app/super-admin/dashboard/page.tsx
import { Suspense } from "react"
import KpiSection from "@/components/super-admin/KpiSection"
import ChartsSection from "@/components/super-admin/ChartsSection"
import ActivitiesSection from "@/components/super-admin/ActivitiesSection"
import QuickActionsSection from "@/components/super-admin/QuickActionsSection"
import MorningBriefing from "@/components/super-admin/MorningBriefing"
import { getDashboardData, getChartsData } from "@/lib/charts"
import { getGlobalHealthSummary, getGlobalActivities } from "@/lib/super-admin/escola-saude"

// ─── Data fetching server-side ────────────────────────────────────────────────
async function getPageData() {
  try {
    const [dashboard, charts, health, activities] = await Promise.allSettled([
      getDashboardData(),      // métricas globais
      getChartsData(),         // dados para gráficos agregados
      getGlobalHealthSummary(), // resumo de saúde das escolas
      getGlobalActivities(),   // logs de auditoria globais
    ])

    return {
      dashboard: dashboard.status === "fulfilled" ? dashboard.value : null,
      charts:    charts.status    === "fulfilled" ? charts.value    : null,
      health:    health.status    === "fulfilled" ? health.value    : undefined,
      activities: activities.status === "fulfilled" ? activities.value : [],
    }
  } catch {
    return { dashboard: null, charts: null, health: undefined, activities: [] }
  }
}

// ─── Page ─────────────────────────────────────────────────────────────────────
export default async function SuperAdminDashboard() {
  const { dashboard, charts, health, activities } = await getPageData()

  return (
    <div className="max-w-[1600px] mx-auto space-y-12 pb-20 animate-in fade-in slide-in-from-bottom-4 duration-1000 ease-out">
      
      {/* 1. Camada de Recepção e Status */}
      <Suspense fallback={<div className="h-32 bg-white border border-slate-100 rounded-[2.5rem] animate-pulse" />}>
        <MorningBriefing data={health} />
      </Suspense>

      {/* 2. Camada de Inteligência de Dados */}
      <div className="space-y-8">
        <ChartsSection data={charts ?? undefined} />
        
        <Suspense fallback={
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-32 bg-white border border-slate-100 rounded-3xl animate-pulse" />
            ))}
          </div>
        }>
          <KpiSection data={dashboard ?? undefined} />
        </Suspense>
      </div>

      {/* 3. Central de Comando (Área Própria / Full Width) */}
      <div className="py-4">
        <QuickActionsSection />
      </div>

      {/* 4. Camada de Auditoria e Histórico */}
      <div className="max-w-5xl">
        <ActivitiesSection activities={activities} />
      </div>

    </div>
  )
}
