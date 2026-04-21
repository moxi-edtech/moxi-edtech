"use client"

import Sidebar from "./Sidebar";
import Topbar from "./Topbar";
import { useUserRole, type UserRole } from "@/hooks/useUserRole";
import { useEscolaId } from "@/hooks/useEscolaId";
import { sidebarConfig, type NavItem } from "@/lib/sidebarNav";
import { useMemo, useState, useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { PLAN_NAMES, type PlanTier } from "@/config/plans";
import { createClient } from "@/lib/supabaseClient";
import { fetchEscolaInfo } from "@/lib/escolaInfoClient";

const TOPBAR_LABELS: Record<UserRole, { title: string; subtitle: string }> = {
  superadmin: { title: "Super Admin", subtitle: "Painel central" },
  admin: { title: "Admin", subtitle: "Portal da escola" },
  secretaria: { title: "Secretaria", subtitle: "Portal da secretaria" },
  financeiro: { title: "Financeiro", subtitle: "Portal financeiro" },
  aluno: { title: "Aluno", subtitle: "Portal do aluno" },
  professor: { title: "Professor", subtitle: "Portal do professor" },
  gestor: { title: "Gestor", subtitle: "Portal do gestor" },
};

export default function AppShell({
  children,
  mobileNav,
  hideSidebarOnMobile = false,
}: {
  children: React.ReactNode;
  mobileNav?: React.ReactNode;
  hideSidebarOnMobile?: boolean;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const { userRole, isLoading: isLoadingRole } = useUserRole();
  const { escolaId: escolaIdFromSession, escolaSlug } = useEscolaId();
  const [financeBadges, setFinanceBadges] = useState<Record<string, string>>({});
  const [escolaNome, setEscolaNome] = useState<string | null>(null);
  const [planoNome, setPlanoNome] = useState<string | null>(null);
  const [userName, setUserName] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);

  // Extract escolaId from the pathname if available
  const safePathname = pathname ?? "";

  const escolaIdFromPath = useMemo(() => {
    if (!safePathname) return null;
    const match = safePathname.match(/\/escola\/([^\/]+)\/(admin|secretaria|professores)/);
    return match?.[1] ?? null;
  }, [safePathname]);
  
  const inferredRole = useMemo<UserRole | null>(() => {
    if (userRole) return userRole;

    // fallback por rota
    if (safePathname.startsWith("/super-admin")) return "superadmin";
    if (safePathname.startsWith("/admin")) return "admin";
    if (safePathname.startsWith("/secretaria")) return "secretaria";
    if (safePathname.startsWith("/financeiro")) return "financeiro";
    if (safePathname.includes("/escola/") && safePathname.includes("/admin")) return "admin";
    if (safePathname.includes("/escola/") && safePathname.includes("/secretaria")) return "secretaria";
    if (safePathname.includes("/escola/") && safePathname.includes("/professores")) return "admin";

    return null;
  }, [userRole, safePathname]);

  const navEscolaId = escolaSlug || escolaIdFromPath || escolaIdFromSession;
  const displayedEscolaNome = navEscolaId ? escolaNome : null;
  const displayedPlanoNome = navEscolaId ? planoNome : null;

  const navItems = useMemo(() => {
    if (isLoadingRole || !inferredRole) return [];
    
    let items = sidebarConfig[inferredRole] || [];
    
    if (inferredRole === "admin" || inferredRole === "secretaria" || inferredRole === "financeiro") {
      items = items
        .map((item) => {
          const children = item.children?.map((child) => {
            let href = child.href;
            if (href.includes("[escolaId]")) {
              if (!navEscolaId) return null;
              href = href.replace("[escolaId]", navEscolaId);
            }
            if (href.includes("[id]")) {
              if (!navEscolaId) return null;
              href = href.replace("[id]", navEscolaId);
            }
            return { ...child, href };
          }).filter(Boolean);
          if (item.href.includes("[escolaId]")) {
            if (!navEscolaId) return null;
            return {
              ...item,
              href: item.href.replace("[escolaId]", navEscolaId),
              children,
            };
          }
          if (children) {
            return { ...item, children };
          }
          return item;
        })
        .filter(Boolean) as NavItem[];
    }
    
    if (inferredRole === "financeiro" && Object.keys(financeBadges).length) {
      items = items.map((item) => ({ ...item, badge: financeBadges[item.href] || item.badge }));
    }
    
    return items;
  }, [inferredRole, isLoadingRole, navEscolaId, financeBadges]);

  useEffect(() => {
    if (!navEscolaId) return;

    let cancelled = false;

    const load = async () => {
      try {
        const info = await fetchEscolaInfo(navEscolaId);
        if (cancelled) return;

        if (!info.nome) {
          setEscolaNome(null);
          setPlanoNome(null);
          setStatus(null);
          return;
        }

        const escolaStatus = info.status || null;
        setEscolaNome(info.nome || null);
        setPlanoNome(info.plano ? PLAN_NAMES[info.plano as PlanTier] : null);
        setStatus(escolaStatus);

        // Redirecionar se suspensa (e não for superadmin)
        if (escolaStatus === 'suspensa' && userRole !== 'superadmin' && pathname !== '/escola/suspensa') {
          router.push('/escola/suspensa');
        }
      } catch {
        if (!cancelled) {
          setEscolaNome(null);
          setPlanoNome(null);
        }
      }
    };

    load();
    return () => {
      cancelled = true;
    };
  }, [navEscolaId, inferredRole, userRole, pathname, router]);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        if (!cancelled) setUserName(null);
        return;
      }

      const { data: profile } = await supabase
        .from("profiles")
        .select("nome, email")
        .eq("user_id", user.id)
        .maybeSingle();

      const resolvedName =
        profile?.nome ||
        (user.user_metadata as { full_name?: string } | null)?.full_name ||
        user.email ||
        null;

      if (!cancelled) setUserName(resolvedName ? String(resolvedName) : null);
    };

    load();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (inferredRole !== "financeiro") return;

    let cancelled = false;

    const load = async () => {
      try {
        const res = await fetch("/api/financeiro/sidebar-badges", { cache: "no-store" });
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
  const isPrintView = safePathname.includes("/print");

  if (isPrintView) {
    return <div className="min-h-screen bg-white">{children}</div>;
  }
  
  return (
    <div className="min-h-screen bg-slate-50">
      <div className="flex">
        <div className={hideSidebarOnMobile ? "hidden md:block" : "block"}>
          <Sidebar
            items={navItems}
            escolaNome={displayedEscolaNome}
            planoNome={displayedPlanoNome}
            portalTitle={topbarLabels?.title}
          />
        </div>
        <div className="flex-1 min-w-0">
          <Topbar
            portalTitle={topbarLabels?.title}
            portalSubtitle={topbarLabels?.subtitle}
            userName={userName}
            contextLabel="Dashboard"
            escolaNome={displayedEscolaNome}
            planoNome={displayedPlanoNome}
            escolaId={navEscolaId}
            portal={inferredRole ?? undefined}
          />
          <main className={mobileNav ? "p-4 md:p-6 pb-24" : "p-4 md:p-6"}>{children}</main>
        </div>
      </div>
      {mobileNav ? <div className="md:hidden">{mobileNav}</div> : null}
    </div>
  );
}
