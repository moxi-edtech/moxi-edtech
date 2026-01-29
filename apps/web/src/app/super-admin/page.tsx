import { getDashboardData } from "@/lib/dashboard"
import { getChartsData } from "@/lib/charts"
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
    const [data, charts] = await Promise.all([
      getDashboardData(),
      getChartsData()
    ])
    console.log('✅ Estrutura completa dos dados:', JSON.stringify(data, null, 2))

    console.log('✅ Dados carregados no servidor:', data)

    const kpis: KpiItem[] = [
      { title: "Alunos ativos", value: data.alunos, icon: UsersIcon },
      { title: "Turmas", value: data.turmas, icon: BuildingLibraryIcon },
      { title: "Professores", value: data.professores, icon: AcademicCapIcon },
      {
        title: "Financeiro",
        value: `${data.pagamentosPercent.toFixed(1)}% pago`,
        icon: BanknotesIcon,
      },
    ]

    return (
      <>
        <h1 className="text-2xl font-bold">Dashboard Super Admin</h1>
        
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

        {/* Charts Section (server-rendered, no client JS) */}
        <ChartsStaticSection data={charts} />

        {/* Activities e QuickActions Sections */}
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
        <h1 className="text-2xl font-bold">Dashboard Super Admin</h1>
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
