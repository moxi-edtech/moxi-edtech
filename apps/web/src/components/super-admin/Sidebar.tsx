import SidebarContainer from "@/components/layout/shared/SidebarContainer";
import { SidebarHeader } from "@/components/layout/shared/SidebarHeader";
import { SidebarNav, type NavItem } from "@/components/layout/shared/SidebarNav";
import { SidebarFooter } from "@/components/layout/shared/SidebarFooter";
// Icon components are selected client-side in SidebarNav by name.

export default async function SuperAdminSidebar() {
  const base: NavItem[] = [
    { label: "Dashboard", href: "/super-admin", icon: "HomeIcon" },
    { label: "Escolas", href: "/super-admin/escolas", icon: "BuildingLibraryIcon" },
    { label: "Usuários Globais", href: "/super-admin/usuarios", icon: "UsersIcon" },
    { label: "Financeiro", href: "/financeiro", icon: "BanknotesIcon" },
    { label: "Relatórios", href: "/super-admin/relatorios", icon: "ChartBarIcon" },
    { label: "Configurações", href: "/super-admin/configuracoes", icon: "Cog6ToothIcon" },
    { label: "Suporte", href: "/super-admin/suporte", icon: "LifebuoyIcon" },
  ];

  const items: NavItem[] = [...base];
  if (process.env.NODE_ENV !== "production" || process.env.NEXT_PUBLIC_ENABLE_SEED === "1") {
    items.push({ label: "Seed Super Admin", href: "/admin-seed", icon: "BoltIcon" });
  }
  if (process.env.NODE_ENV !== "production") {
    items.push({ label: "Debug", href: "/super-admin/debug", icon: "BoltIcon" });
    items.push({ label: "Debug Email", href: "/super-admin/debug/email-preview", icon: "EnvelopeIcon" });
  }

  return (
    <SidebarContainer storageKey="super-admin:sidebar" cssVar="--sidebar-w">
      <div data-slot="header">
        <SidebarHeader title="Super Admin" subtitle="Painel" />
      </div>
      <div className="px-2">
        <SidebarNav items={items} />
      </div>
      <SidebarFooter>
        <div className="text-xs text-white/80">v2.1 · Super Admin</div>
      </SidebarFooter>
    </SidebarContainer>
  );
}
