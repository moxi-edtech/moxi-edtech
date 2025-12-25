"use client"

import Sidebar from "./Sidebar";
import Topbar from "./Topbar";
import { useUserRole } from "@/hooks/useUserRole";
import { sidebarConfig } from "@/lib/sidebarNav";
import { useMemo, useState, useEffect } from "react";
import { usePathname } from "next/navigation";

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

  const navItems = useMemo(() => {
    if (isLoadingRole || !userRole) return [];
    const items = sidebarConfig[userRole] || [];

    // Adjust href for admin role dynamically
    if (userRole === "admin" && escolaIdState) {
      return items.map(item => ({
        ...item,
        href: item.href.replace("[escolaId]", escolaIdState)
      }));
    }
    return items;
  }, [userRole, isLoadingRole, escolaIdState]);

  if (isLoadingRole) {
    return <div>Loading...</div>; // Or a more sophisticated loader
  }
  
  return (
    <div className="min-h-screen bg-slate-50">
      <div className="flex">
        <Sidebar items={navItems} />
        <div className="flex-1 min-w-0">
          <Topbar />
          <main className="p-4 md:p-6">{children}</main>
        </div>
      </div>
    </div>
  );
}
