"use client"

import Sidebar from "./Sidebar";
import Topbar from "./Topbar";
import { useUserRole, type UserRole } from "@/hooks/useUserRole";
import { sidebarConfig } from "@/lib/sidebarNav";
import { useMemo, useState, useEffect } from "react";
import { usePathname } from "next/navigation";

const TOPBAR_LABELS: Record<UserRole, { title: string; subtitle: string }> = {
  superadmin: { title: "Super Admin", subtitle: "Painel central" },
  admin: { title: "Admin", subtitle: "Portal da escola" },
  secretaria: { title: "Secretaria", subtitle: "Portal da secretaria" },
  financeiro: { title: "Financeiro", subtitle: "Portal financeiro" },
  aluno: { title: "Aluno", subtitle: "Portal do aluno" },
  professor: { title: "Professor", subtitle: "Portal do professor" },
  gestor: { title: "Gestor", subtitle: "Portal do gestor" },
};

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { userRole, isLoading: isLoadingRole } = useUserRole();
  const [escolaIdState, setEscolaIdState] = useState<string | null>(null);

  // Extract escolaId from the pathname if available
  useEffect(() => {
    const match = pathname.match(/\/escola\/([^\/]+)\/admin/);
    if (match && match[1]) {
      setEscolaIdState(match[1]);
    } else {
      setEscolaIdState(null);
    }
  }, [pathname]);
  
  const inferredRole = useMemo<UserRole | null>(() => {
    if (userRole) return userRole;

    // fallback por rota
    if (pathname.startsWith("/super-admin")) return "superadmin";
    if (pathname.startsWith("/secretaria")) return "secretaria";
    if (pathname.includes("/escola/") && pathname.includes("/admin")) return "admin";

    return null;
  }, [userRole, pathname]);

  const navItems = useMemo(() => {
    if (isLoadingRole || !inferredRole) return [];
    const items = sidebarConfig[inferredRole] || [];

    if (inferredRole === "admin" && escolaIdState) {
      return items.map((item) => ({
        ...item,
        href: item.href.replace("[escolaId]", escolaIdState),
      }));
    }
    return items;
  }, [inferredRole, isLoadingRole, escolaIdState]);


  if (isLoadingRole) {
    return <div>Loading...</div>; // Or a more sophisticated loader
  }

  const topbarLabels = inferredRole ? TOPBAR_LABELS[inferredRole] : null;
  
  return (
    <div className="min-h-screen bg-slate-50">
      <div className="flex">
        <Sidebar items={navItems} />
        <div className="flex-1 min-w-0">
          <Topbar
            portalTitle={topbarLabels?.title}
            portalSubtitle={topbarLabels?.subtitle}
          />
          <main className="p-4 md:p-6">{children}</main>
        </div>
      </div>
    </div>
  );
}
