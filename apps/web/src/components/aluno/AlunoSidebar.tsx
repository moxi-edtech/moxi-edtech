import SidebarContainer from "@/components/layout/shared/SidebarContainer";
import { SidebarHeader } from "@/components/layout/shared/SidebarHeader";
import { SidebarNav, type NavItem } from "@/components/layout/shared/SidebarNav";
import { SidebarFooter } from "@/components/layout/shared/SidebarFooter";
// Icon components are selected client-side in SidebarNav by name.

export default function AlunoSidebar() {
  const items: NavItem[] = [
    { href: "/aluno/dashboard", label: "Dashboard", icon: "HomeIcon" },
    { href: "/aluno/disciplinas", label: "Disciplinas", icon: "AcademicCapIcon" },
    { href: "/aluno/financeiro", label: "Financeiro", icon: "BanknotesIcon" },
    { href: "/aluno/avisos", label: "Avisos", icon: "MegaphoneIcon" },
  ];

  return (
    <SidebarContainer storageKey="aluno:sidebar" cssVar="--sidebar-w">
      <div data-slot="header">
        <SidebarHeader title="Portal do Aluno" subtitle="MoxiNexa" />
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
