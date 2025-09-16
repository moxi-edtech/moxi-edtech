import { getDashboardData } from "@/lib/dashboard"
import { getChartsData } from "@/lib/charts"
import ChartsSection from "@/components/super-admin/ChartsSection"
import Header from '@/components/super-admin/Header'
import Sidebar from '@/components/super-admin/Sidebar' // ✅ Adicionei
import ActivitiesSection from '@/components/super-admin/ActivitiesSection' // ✅ Adicionei  
import QuickActionsSection from '@/components/super-admin/QuickActionsSection' // ✅ Adicionei

export const dynamic = 'force-dynamic'

import {
  BuildingLibraryIcon,
  UsersIcon,
  AcademicCapIcon,
  BanknotesIcon,
} from "@heroicons/react/24/outline"

export default async function SuperAdminDashboard() {
  try {
    const [data, charts] = await Promise.all([
      getDashboardData(),
      getChartsData()
    ])
    console.log('✅ Estrutura completa dos dados:', JSON.stringify(data, null, 2))

    console.log('✅ Dados carregados no servidor:', data)

    const kpis = [
      { title: "Escolas", value: data.escolas, icon: BuildingLibraryIcon },
      { title: "Usuários Globais", value: data.usuarios, icon: UsersIcon },
      { title: "Matrículas", value: data.matriculas, icon: AcademicCapIcon },
      {
        title: "Financeiro",
        value: `${data.pagamentosPercent.toFixed(1)}% pago`,
        icon: BanknotesIcon,
      },
    ]

    return (
      <div className="flex h-screen bg-gray-100">
        <Sidebar />
        
        <div className="flex-1 flex flex-col">
          <Header />
          
          <main className="p-6 overflow-y-auto space-y-6">
            <h1 className="text-2xl font-bold">Dashboard Super Admin</h1>
            
            {/* KPIs */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {kpis.map((kpi) => (
                <div
                  key={kpi.title}
                  className="bg-white shadow rounded-lg p-4 flex items-center"
                >
                  <kpi.icon className="w-10 h-10 text-blue-600 mr-4" />
                  <div>
                    <p className="text-sm text-gray-500">{kpi.title}</p>
                    <p className="text-xl font-bold">{kpi.value}</p>
                  </div>
                </div>
              ))}
            </div>

            {/* Charts Section */}
            <ChartsSection data={charts} />

            {/* Activities e QuickActions Sections */}
            <div className="grid gap-6 lg:grid-cols-3">
              <div className="lg:col-span-2">
                <ActivitiesSection activities={[]} />
              </div>
              <div className="lg:col-span-1">
                <QuickActionsSection />
              </div>
            </div>
          </main>
        </div>
      </div>
    )

  } catch (error) {
    console.error('❌ Erro no servidor:', error)
    
    // Fallback para erro
    const kpis = [
      { title: "Escolas", value: 0, icon: BuildingLibraryIcon },
      { title: "Usuários Globais", value: 0, icon: UsersIcon },
      { title: "Matrículas", value: 0, icon: AcademicCapIcon },
      { title: "Financeiro", value: "0% pago", icon: BanknotesIcon },
    ]

    return (
      <div className="flex h-screen bg-gray-100">
        <Sidebar />
        
        <div className="flex-1 flex flex-col">
          <Header />
          
          <main className="p-6 overflow-y-auto space-y-6">
            <h1 className="text-2xl font-bold">Dashboard Super Admin</h1>
            <div className="text-red-500">Erro ao carregar dados</div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {kpis.map((kpi) => (
                <div
                  key={kpi.title}
                  className="bg-white shadow rounded-lg p-4 flex items-center"
                >
                  <kpi.icon className="w-10 h-10 text-blue-600 mr-4" />
                  <div>
                    <p className="text-sm text-gray-500">{kpi.title}</p>
                    <p className="text-xl font-bold">{kpi.value}</p>
                  </div>
                </div>
              ))}
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
          </main>
        </div>
      </div>
    )
  }
}
