import SidebarContainer from "@/components/layout/shared/SidebarContainer";
import { SidebarHeader } from "@/components/layout/shared/SidebarHeader";
import { SidebarNav, type NavItem } from "@/components/layout/shared/SidebarNav";
import { SidebarFooter } from "@/components/layout/shared/SidebarFooter";
import { buildPortalHref } from "@/lib/navigation";
// Icon components are selected client-side in SidebarNav by name.

export default function AlunoSidebar({ escolaParam }: { escolaParam?: string | null }) {
  const href = (path: string) => buildPortalHref(escolaParam, path);
  const items: NavItem[] = [
    { href: href("/aluno/dashboard"), label: "Dashboard", icon: "HomeIcon" },
    { href: href("/aluno/academico"), label: "Académico", icon: "AcademicCapIcon" },
    { href: href("/aluno/financeiro"), label: "Financeiro", icon: "BanknotesIcon" },
    { href: href("/aluno/avisos"), label: "Avisos", icon: "MegaphoneIcon" },
  ];

  return (
    <SidebarContainer storageKey="aluno:sidebar" cssVar="--sidebar-w">
      <div data-slot="header">
        <SidebarHeader title="Portal do Aluno" subtitle="MoxiNexa" href={href("/aluno/dashboard")} />
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
