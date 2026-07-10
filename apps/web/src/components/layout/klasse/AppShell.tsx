"use client"

import Sidebar from "./Sidebar";
import Topbar from "./Topbar";
import MaintenanceBanner from "./MaintenanceBanner";
import AiChatWidget, { type AiWidgetContext } from "@/components/ai/AiChatWidget";
import { AI_WIDGET_ROLES } from "@/lib/roles/ai-roles";
import { type UserRole } from "@/hooks/useUserRole";
import { useUserRoleContext } from "@/components/auth/UserRoleProvider";
import { useEscolaId } from "@/hooks/useEscolaId";
import { sidebarConfig, type NavItem, type SidebarRole } from "@/lib/sidebarNav";
import { useMemo, useState, useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { PLAN_NAMES, type PlanTier } from "@/config/plans";
import { createClient } from "@/lib/supabaseClient";
import { fetchEscolaInfo } from "@/lib/escolaInfoClient";

const TOPBAR_LABELS: Record<SidebarRole, { title: string; subtitle: string }> = {
  superadmin: { title: "Super Admin", subtitle: "Painel central" },
  admin: { title: "Admin", subtitle: "Portal da escola" },
  operacoes: { title: "Operações", subtitle: "Portal operacional" },
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
  const { userRole, isLoading: isLoadingRole } = useUserRoleContext();
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
    const match = safePathname.match(/\/escola\/([^\/]+)\/(admin|operacoes|secretaria|financeiro|professor|aluno|professores|alunos|horarios)/);
    return match?.[1] ?? null;
  }, [safePathname]);
  
  const inferredRole = useMemo<UserRole | null>(() => {
    // fallback por rota
    if (safePathname.startsWith("/super-admin")) return "superadmin";
    if (safePathname.startsWith("/admin")) return "admin";
    if (safePathname.startsWith("/operacoes")) return "admin";
    if (safePathname.startsWith("/secretaria")) return "secretaria";
    if (safePathname.startsWith("/financeiro")) return "financeiro";
    if (safePathname.startsWith("/professor")) return "professor";
    if (safePathname.startsWith("/aluno")) return "aluno";

    // canonical routes
    if (safePathname.includes("/escola/")) {
        if (safePathname.includes("/operacoes")) return "admin";
        if (safePathname.includes("/admin")) return "admin";
        if (safePathname.includes("/secretaria")) return "secretaria";
        if (safePathname.includes("/financeiro")) return "financeiro";
        if (safePathname.includes("/horarios")) return "secretaria";
        if (safePathname.includes("/professores")) return "admin";
        if (safePathname.includes("/alunos")) return "admin";
        if (safePathname.includes("/professor")) return "professor";
        if (safePathname.includes("/aluno")) return "aluno";
    }

    if (userRole) return userRole;

    return null;
  }, [userRole, safePathname]);

  const navRole = useMemo<SidebarRole | null>(() => {
    if (safePathname.startsWith("/operacoes")) return "operacoes";
    if (safePathname.includes("/escola/") && safePathname.includes("/operacoes")) return "operacoes";
    return inferredRole;
  }, [inferredRole, safePathname]);

  const aiWidgetContext = useMemo<AiWidgetContext>(() => {
    if (safePathname.includes("/admin/comunicacao/whatsapp")) {
      return { module: "whatsapp", page: "central_whatsapp", entityType: "none" };
    }
    if (safePathname.includes("/admin/avisos") || safePathname.includes("/comunicacao")) {
      return { module: "comunicacao", page: "comunicados", entityType: "notice" };
    }
    if (safePathname.includes("/financeiro")) {
      return {
        module: "financeiro",
        page: safePathname.includes("/radar") ? "radar" : "financeiro",
        entityType: safePathname.includes("/radar") ? "invoice" : "none",
      };
    }
    if (safePathname.includes("/secretaria")) {
      return {
        module: "secretaria",
        page: safePathname.includes("/alunos") ? "alunos" : "secretaria",
        entityType: safePathname.includes("/alunos") ? "student" : "none",
      };
    }
    if (safePathname.includes("/operacoes")) {
      return { module: "operacoes", page: "operacoes", entityType: "none" };
    }
    if (safePathname.includes("/admin/ai")) {
      return { module: "classe_ai", page: "actions" };
    }
    if (safePathname.includes("/admin")) {
      return { module: "dashboard", page: "admin" };
    }
    return { module: "dashboard" };
  }, [safePathname]);

  const navEscolaId = escolaSlug || escolaIdFromPath || escolaIdFromSession;
  const displayedEscolaNome = navEscolaId ? escolaNome : null;
  const displayedPlanoNome = navEscolaId ? planoNome : null;

  const navItems = useMemo(() => {
    if (!navRole) return [];
    
    let items = sidebarConfig[navRole] || [];
    
    if (
      navRole === "admin" ||
      navRole === "operacoes" ||
      navRole === "secretaria" ||
      navRole === "financeiro" ||
      navRole === "professor" ||
      navRole === "aluno"
    ) {
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
    
    if (navRole === "financeiro" && Object.keys(financeBadges).length) {
      items = items.map((item) => {
          // Normalizar o href para bater com as chaves dos badges que vêm da API (que são curtas)
          const shortHref = item.href.replace(/\/escola\/[^\/]+/, "");
          return { ...item, badge: financeBadges[shortHref] || item.badge };
      });
    }
    
    return items;
  }, [navRole, isLoadingRole, navEscolaId, financeBadges]);

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
  }, [navEscolaId, navRole, userRole, pathname, router]);

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
    if (navRole !== "financeiro") return;

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
        if (json.cobrancasPendentes > 0) badges["/financeiro/radar"] = String(Math.min(json.cobrancasPendentes, 99));

        setFinanceBadges(badges);
      } catch {
        if (!cancelled) setFinanceBadges({});
      }
    };

    load();

    return () => {
      cancelled = true;
    };
  }, [navRole]);


  const topbarLabels = navRole ? TOPBAR_LABELS[navRole] : null;
  const isPrintView = safePathname.includes("/print");
  const aiAccessRole = navRole === "operacoes"
    ? userRole === "operacoes"
      ? "admin_financeiro"
      : (userRole || inferredRole || "admin")
    : navRole;
  const shouldRenderAiWidget = Boolean(
    navEscolaId &&
    aiAccessRole &&
    AI_WIDGET_ROLES.includes(aiAccessRole)
  );
  const aiWidgetSchoolId = shouldRenderAiWidget && navEscolaId
    ? escolaIdFromSession || navEscolaId
    : null;

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
            escolaId={escolaIdFromSession}
            escolaParam={navEscolaId}
            portal={navRole ?? undefined}
          />
          <MaintenanceBanner />
          <main className={mobileNav ? "p-4 md:p-6 pb-24" : "p-4 md:p-6"}>{children}</main>
        </div>
      </div>
      {mobileNav ? <div className="md:hidden">{mobileNav}</div> : null}
      {aiWidgetSchoolId && navEscolaId && (
        <AiChatWidget
          schoolId={aiWidgetSchoolId}
          schoolParam={navEscolaId}
          hasMobileNav={!!mobileNav}
          context={aiWidgetContext}
        />
      )}
    </div>
  );
}
