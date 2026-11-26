"use client";

import { Plus } from "lucide-react";
import { PortalBottomNav, type PortalBottomNavItem } from "@/components/layout/klasse/PortalBottomNav";
import { getActiveProfessorNavHref, splitProfessorMobileNav, type ProfessorNavLink } from "@/lib/professorNav";

type Props = {
  items: ProfessorNavLink[];
  activePath: string;
};

const compactLabels: Record<string, string> = {
  "/professor/frequencias": "Chamada",
  "/professor/materiais": "Material",
  "/professor/calendario": "Agenda",
};

export function ProfessorBottomNav({ items, activePath }: Props) {
  const activeHref = getActiveProfessorNavHref(items, activePath);
  const { mainItems, drawerItems } = splitProfessorMobileNav(items);
  const toLink = (item: ProfessorNavLink): PortalBottomNavItem => ({
    ...item, compactLabel: compactLabels[item.path] ?? item.label,
    prefetch: item.path !== "/professor/provas",
  });
  return <PortalBottomNav
    mainItems={mainItems.map(toLink)}
    drawerItems={drawerItems.map(toLink)}
    activeHref={activeHref}
    navigationLabel="Navegação do portal do professor"
    moreLabel="Abrir mais áreas do Portal do Professor"
    description="Aceder às restantes áreas do professor"
    hideOnDesktop
    moreIcon={Plus}
  />;
}
