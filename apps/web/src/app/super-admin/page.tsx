import ControlPanelSection from "@/components/super-admin/ControlPanelSection";
import CrmSection from "@/components/super-admin/CrmSection";
import ManagementSection from "@/components/super-admin/ManagementSection";
import { getDashboardData, getChartsData, type ChartsData } from "@/lib/charts";
import { getGlobalHealthSummary, getGlobalActivities } from "@/lib/super-admin/escola-saude";
import { supabaseServer } from "@/lib/supabaseServer";

type DashboardData = {
  escolas?: number;
  usuarios?: number;
  matriculas?: number;
  financeiro?: number;
};

type HealthSummary = {
  escolasEmRisco: number;
  scoreMedio: number;
};

type Activity = {
  id: string;
  titulo: string;
  resumo: string;
  data: string;
};

type School = {
  id: string;
  nome: string;
  plano: string;
  onboarding_finalizado: boolean;
  progresso_onboarding: number;
  alunos_ativos: number;
};

async function getPageData(): Promise<{
  dashboard?: DashboardData;
  charts?: ChartsData;
  health?: HealthSummary;
  activities: Activity[];
  schools: School[];
}> {
  try {
    const supabase = await supabaseServer();
    const [dashboard, charts, health, activities, schoolsRes] = await Promise.allSettled([
      getDashboardData(),
      getChartsData(),
      getGlobalHealthSummary(),
      getGlobalActivities(),
      supabase.rpc("admin_get_escola_health_metrics"),
    ]);

    return {
      dashboard: dashboard.status === "fulfilled" ? dashboard.value : undefined,
      charts: charts.status === "fulfilled" ? charts.value : undefined,
      health: health.status === "fulfilled" ? health.value : undefined,
      activities: activities.status === "fulfilled" ? activities.value : [],
      schools: schoolsRes.status === "fulfilled" ? ((schoolsRes.value.data as School[] | null) ?? []) : [],
    };
  } catch {
    return { dashboard: undefined, charts: undefined, health: undefined, activities: [], schools: [] };
  }
}

export default async function SuperAdminDashboard() {
  const { dashboard, charts, health, activities, schools } = await getPageData();

  return (
    <div className="mx-auto max-w-[1600px] space-y-6 pb-16">
      <ControlPanelSection health={health} charts={charts} activities={activities} />
      <ManagementSection dashboard={dashboard} charts={charts} schools={schools} />
      <CrmSection />
    </div>
  );
}
