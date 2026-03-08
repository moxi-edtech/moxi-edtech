"use client";

import { usePathname } from "next/navigation";
import AppShell from "@/components/layout/klasse/AppShell";
import { professorNavItems } from "@/lib/professorNav";
import { ProfessorBottomNav } from "@/components/professor/layout/ProfessorBottomNav";

export default function ProfessorPortalLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() ?? "";

  return (
    <AppShell
      mobileNav={<ProfessorBottomNav items={professorNavItems} activePath={pathname} />}
      hideSidebarOnMobile
    >
      {children}
    </AppShell>
  );
}
