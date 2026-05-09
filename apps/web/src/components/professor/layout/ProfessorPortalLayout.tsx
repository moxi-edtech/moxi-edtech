"use client";

import { useEffect, useMemo } from "react";
import { usePathname, useRouter } from "next/navigation";
import AppShell from "@/components/layout/klasse/AppShell";
import { professorNavItems } from "@/lib/professorNav";
import { ProfessorBottomNav } from "@/components/professor/layout/ProfessorBottomNav";
import { useEscolaId } from "@/hooks/useEscolaId";
import { buildPortalHref, getEscolaParamFromPath } from "@/lib/navigation";

export default function ProfessorPortalLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname() ?? "";
  const { escolaId, escolaSlug } = useEscolaId();
  const escolaParam = getEscolaParamFromPath(pathname) ?? escolaSlug ?? escolaId;

  useEffect(() => {
    if (!escolaParam || !pathname.startsWith("/professor")) return;
    router.replace(buildPortalHref(escolaParam, pathname));
  }, [escolaParam, pathname, router]);

  const mobileNavItems = useMemo(
    () =>
      professorNavItems.map((item) => ({
        ...item,
        href: buildPortalHref(escolaParam, item.path),
      })),
    [escolaParam],
  );

  return (
    <AppShell
      mobileNav={<ProfessorBottomNav items={mobileNavItems} activePath={pathname} />}
      hideSidebarOnMobile
    >
      {children}
    </AppShell>
  );
}
