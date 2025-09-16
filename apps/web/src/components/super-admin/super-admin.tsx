// apps/web/src/types/super-admin.ts
import { ReactElement } from "react"

export type IconType = (props: React.ComponentProps<"svg">) => ReactElement

export interface Kpi {
  title: string
  value: string | number
  icon: IconType
}

export interface QuickAction {
  label: string
  icon: IconType
}

export interface DashboardData {
  kpis: Kpi[]
  activities: string[]
  quickActions: QuickAction[]
}