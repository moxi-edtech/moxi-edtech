"use client"

import Sidebar from "./Sidebar";
import Topbar from "./Topbar";
import { useUserRole, type UserRole } from "@/hooks/useUserRole";
import { useEscolaId } from "@/hooks/useEscolaId";
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
  const { escolaId: escolaIdFromSession } = useEscolaId();
  const [escolaIdState, setEscolaIdState] = useState<string | null>(null);
  const [financeBadges, setFinanceBadges] = useState<Record<string, string>>({});

  // Extract escolaId from the pathname if available
  useEffect(() => {
    const match = pathname.match(/\/escola\/([^\/]+)\/(admin|secretaria)/);
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
    if (pathname.includes("/escola/") && pathname.includes("/secretaria")) return "secretaria";

    return null;
  }, [userRole, pathname]);

  const navItems = useMemo(() => {
    if (isLoadingRole || !inferredRole) return [];
    let items = sidebarConfig[inferredRole] || [];

    const navEscolaId = escolaIdState || escolaIdFromSession;
    if ((inferredRole === "admin" || inferredRole === "secretaria") && navEscolaId) {
      return items.map((item) => ({
        ...item,
        href: item.href.replace("[escolaId]", navEscolaId),
      }));
    }
    if (inferredRole === "financeiro" && Object.keys(financeBadges).length) {
      items = items.map((item) => ({ ...item, badge: financeBadges[item.href] || item.badge }));
    }
    return items;
  }, [inferredRole, isLoadingRole, escolaIdState, escolaIdFromSession, financeBadges]);

  useEffect(() => {
    if (inferredRole !== "financeiro") return;

    let cancelled = false;

    const load = async () => {
      try {
        const res = await fetch("/api/financeiro/sidebar-badges", { cache: "force-cache" });
        const json = await res.json().catch(() => null);

        if (cancelled) return;

        if (!res.ok || !json?.ok) {
          setFinanceBadges({});
          return;
        }

        const badges: Record<string, string> = {};
        if (json.candidaturasPendentes > 0) badges["/financeiro/candidaturas"] = String(Math.min(json.candidaturasPendentes, 99));
        if (json.cobrancasPendentes > 0) badges["/financeiro/cobrancas"] = String(Math.min(json.cobrancasPendentes, 99));

        setFinanceBadges(badges);
      } catch {
        if (!cancelled) setFinanceBadges({});
      }
    };

    load();

    return () => {
      cancelled = true;
    };
  }, [inferredRole]);


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
