import SidebarContainer from "@/components/layout/shared/SidebarContainer";
import { SidebarHeader } from "@/components/layout/shared/SidebarHeader";
import { SidebarNav, type NavItem } from "@/components/layout/shared/SidebarNav";
import { SidebarFooter } from "@/components/layout/shared/SidebarFooter";
// Icon components are selected client-side in SidebarNav by name.

export default function SecretariaSidebar() {
  const items: NavItem[] = [
    { href: "/secretaria", label: "Dashboard", icon: "HomeIcon" },
    { href: "/secretaria/alunos", label: "Alunos", icon: "UsersIcon" },
    { href: "/secretaria/matriculas", label: "Matrículas", icon: "AcademicCapIcon" },
    { href: "/secretaria/relatorios", label: "Relatórios", icon: "ChartBarIcon" },
    { href: "/secretaria/alertas", label: "Alertas", icon: "BellAlertIcon" },
    { href: "/secretaria/exportacoes", label: "Exportações", icon: "ArrowDownTrayIcon" },
  ];

  return (
    <SidebarContainer storageKey="secretaria:sidebar" cssVar="--sidebar-w">
      <div data-slot="header">
        <SidebarHeader title="Secretaria" subtitle="Painel" />
      </div>
      <div className="px-2">
        <SidebarNav items={items} />
      </div>
      <SidebarFooter>
        <div className="text-xs text-white/80">© 2025 MoxiNexa</div>
      </SidebarFooter>
    </SidebarContainer>
  );
}
