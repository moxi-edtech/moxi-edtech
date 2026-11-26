import React from "react";
import { createRoot } from "react-dom/client";
import Sidebar from "../src/components/layout/klasse/Sidebar";
import { sidebarConfig, type NavItem, type SidebarRole } from "../src/lib/sidebarNav";
import "./fixture.css";
import "../src/app/globals.css";
import "../src/app/theme-print.css";

const role = (new URLSearchParams(window.location.search).get("portal") ?? "operacoes") as SidebarRole;
const items: NavItem[] = [
  ...(sidebarConfig[role] ?? []),
  {
    href: "/fixture/stress",
    label: "Menu de teste com um título excepcionalmente longo",
    icon: "BookOpen",
    badge: "999999+",
    children: [
      { href: "/fixture/stress/child", label: "Submenu excepcionalmente longo para validar a integridade visual", badge: "Resolver" },
    ],
  },
];

createRoot(document.getElementById("root")!).render(
  <div className="flex min-h-screen">
    <Sidebar items={items} escolaNome="Complexo Escolar Privado de Teste com um Nome Extraordinariamente Longo" planoNome="Plano de demonstração com nome extenso" portalTitle={role} />
    <main className="min-w-0 flex-1 p-4">Conteúdo</main>
  </div>,
);
