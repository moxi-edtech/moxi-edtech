"use client";

import Link from "next/link";
import { createContext, useContext, useEffect, type ComponentProps } from "react";
import { useRouter } from "next/navigation";

export const workspaceTitles = {
  "/super-admin/escolas": "Gerir escolas",
  "/super-admin/escolas/nova": "Nova escola",
  "/super-admin/onboarding": "Onboarding",
  "/super-admin/cobrancas": "Cobranças",
  "/super-admin/usuarios": "Utilizadores",
  "/super-admin/usuarios/novo": "Novo utilizador",
  "/super-admin/health": "Saúde e alertas",
  "/super-admin/diagnostics": "Diagnósticos",
  "/super-admin/planos": "Planos e preços",
  "/super-admin/parceiros": "Parceiros",
  "/super-admin/marketing": "Marketing",
  "/super-admin/comissoes": "Comissões",
  "/super-admin/subscricoes": "Subscrições",
  "/super-admin/operacoes-alunos": "Operações de alunos",
  "/super-admin/centros-formacao": "Centros de formação",
  "/super-admin/centros-formacao/novo": "Novo centro",
  "/super-admin/comunicacao": "Comunicação",
  "/super-admin/debug/email-preview": "Pré-visualização de email",
} as const;

export type WorkspaceRoute = { href: string; path: string; title: string; schoolId?: string };
export function resolveWorkspaceRoute(href: string): WorkspaceRoute | null {
  if (!href.startsWith("/super-admin/") || href.includes("\\")) return null;
  const url = new URL(href, "https://workspace.invalid");
  if (url.origin !== "https://workspace.invalid") return null;
  const path = url.pathname.replace(/\/$/, "");
  if (Object.prototype.hasOwnProperty.call(workspaceTitles, path)) {
    return { href: path + url.search, path, title: workspaceTitles[path as keyof typeof workspaceTitles] };
  }
  const match = path.match(/^\/super-admin\/escolas\/([a-f0-9-]{36})(?:\/edit)?$/i);
  if (match) return { href: path + url.search, path, title: "Gerir escola", schoolId: match[1] };
  return null;
}

export type WorkspaceNavigation = {
  open: (href: string) => boolean;
  back: () => void;
  markChanged: () => void;
  setGuard: (key: string, state: "busy" | "dirty" | null) => void;
  revision: number;
  route?: WorkspaceRoute;
};

export const SuperAdminWorkspaceContext = createContext<WorkspaceNavigation | null>(null);
export const useSuperAdminWorkspace = () => useContext(SuperAdminWorkspaceContext);

export function useWorkspaceGuard(key: string, busy: boolean, dirty = false) {
  const workspace = useSuperAdminWorkspace();
  const setGuard = workspace?.setGuard;
  useEffect(() => {
    if (!setGuard) return;
    setGuard(key, busy ? "busy" : dirty ? "dirty" : null);
    return () => setGuard(key, null);
  }, [setGuard, key, busy, dirty]);
}

export function useWorkspaceNavigate() {
  const router = useRouter();
  const workspace = useSuperAdminWorkspace();
  return (href: string) => {
    if (!workspace?.open(href)) router.push(href);
  };
}

export function WorkspaceLink({ href, onClick, ...props }: ComponentProps<typeof Link>) {
  const workspace = useSuperAdminWorkspace();
  return <Link {...props} href={href} prefetch={workspace ? false : props.prefetch} onClick={(event) => {
    onClick?.(event);
    if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.altKey || event.shiftKey || props.target === "_blank") return;
    if (typeof href === "string" && workspace?.open(href)) event.preventDefault();
  }} />;
}
