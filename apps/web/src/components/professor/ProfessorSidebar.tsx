"use client";

import SidebarContainer from "@/components/layout/shared/SidebarContainer";
import { SidebarHeader } from "@/components/layout/shared/SidebarHeader";
import { SidebarNav, type NavItem } from "@/components/layout/shared/SidebarNav";
import { SidebarFooter } from "@/components/layout/shared/SidebarFooter";

export default function ProfessorSidebar() {
  const items: NavItem[] = [
    { label: "Dashboard", href: "/professor", icon: "HomeIcon" },
    { label: "Presenças", href: "/professor/frequencias", icon: "BoltIcon" },
    { label: "Notas", href: "/professor/notas", icon: "AcademicCapIcon" },
    { label: "Fluxos", href: "/professor/fluxos", icon: "ChartBarIcon" },
  ];
  return (
    <SidebarContainer storageKey="professor:sidebar" cssVar="--sidebar-w-professor">
      <div className="p-4">
        <SidebarHeader title="Professor" subtitle="Painel" />
        <SidebarNav items={items} />
      </div>
      <SidebarFooter>
        <div className="p-3 text-xs opacity-80">Moxi Nexa • Docente</div>
      </SidebarFooter>
    </SidebarContainer>
  );
}

