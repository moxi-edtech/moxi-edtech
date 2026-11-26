"use client";

import type { LucideIcon } from "lucide-react";
import { PortalBottomNav, type PortalBottomNavItem } from "@/components/layout/klasse/PortalBottomNav";
import { preloadPortalData } from "../usePortalSWR";

type NavItem = {
  href: string;
  path?: string;
  label: string;
  icon: LucideIcon;
  badge?: number;
  preload?: { keys: string[]; urls: string[] };
};

type Props = {
  items: NavItem[];
  activePath: string;
  withAlunoParam: (href: string) => string;
};

const matchesRoute = (item: NavItem, activePath: string) =>
  activePath === item.href || activePath.startsWith(item.href + "/") ||
  (item.path ? activePath === item.path || activePath.startsWith(item.path + "/") : false);

export function AlunoBottomNav({ items, activePath, withAlunoParam }: Props) {
  const mainItems = items.slice(0, 4);
  const drawerItems = items.slice(4);
  const active = items.filter(item => matchesRoute(item, activePath)).sort((a,b) => (b.path ?? b.href).length - (a.path ?? a.href).length)[0];
  const toLink = (item: NavItem): PortalBottomNavItem => ({ ...item, href: withAlunoParam(item.href) });
  const handlePreload = (item: PortalBottomNavItem) => {
    const original = items.find(candidate => withAlunoParam(candidate.href) === item.href);
    original?.preload?.keys.forEach((key, index) => {
      const url = original.preload?.urls[index];
      if (url) void preloadPortalData(key, url);
    });
  };
  return <PortalBottomNav mainItems={mainItems.map(toLink)} drawerItems={drawerItems.map(toLink)}
    activeHref={active ? withAlunoParam(active.href) : null}
    navigationLabel="Navegação do portal do aluno"
    moreLabel="Abrir mais áreas do Portal do Aluno"
    onPreload={handlePreload} />;
}
