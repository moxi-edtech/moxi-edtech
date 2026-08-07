"use client";

import { createElement, type ReactNode } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";

export const academicContextRoutes = [
  "/secretaria/alunos",
  "/secretaria/turmas",
  "/financeiro/radar",
  "/financeiro/turmas-alunos",
  "/professor/notas",
  "/professor/frequencia",
  "/direcao/pautas",
  "/operacoes/alunos",
  "/operacoes/turmas",
  "/operacoes/academico",
  "/operacoes/financeiro",
] as const;

export const academicContextPreservedParams = ["page", "sort", "order", "search", "view", "tab"] as const;
export const academicContextDependentParams = ["turma_id", "matricula_id", "disciplina_id", "aluno_id", "periodo_id"] as const;

function routePath(path: string) {
  const [pathname] = path.split("?");
  const withoutSchool = pathname.replace(/^\/escola\/[^/]+/, "");
  return withoutSchool || pathname;
}

export function supportsAcademicContext(path: string | null | undefined) {
  if (!path) return false;
  const normalized = routePath(path);
  return academicContextRoutes.some(
    (route) => normalized === route || normalized.startsWith(`${route}/`),
  );
}

export function preserveAcademicContextHref(
  href: string,
  currentSearch: string | URLSearchParams,
) {
  if (!supportsAcademicContext(href)) return href;

  const [pathname, hrefQuery = ""] = href.split("?");
  const next = new URLSearchParams(hrefQuery);
  const current = typeof currentSearch === "string"
    ? new URLSearchParams(currentSearch.replace(/^\?/, ""))
    : currentSearch;
  const academicYearId = current.get("ano_letivo_id");
  if (academicYearId && !next.has("ano_letivo_id")) next.set("ano_letivo_id", academicYearId);
  for (const key of academicContextPreservedParams) {
    if (!next.has(key) && current.has(key)) next.set(key, current.get(key) ?? "");
  }
  for (const key of academicContextDependentParams) next.delete(key);
  const query = next.toString();
  return query ? `${pathname}?${query}` : pathname;
}

export function AcademicContextLink({
  href,
  children,
  className,
}: {
  href: string;
  children: ReactNode;
  className?: string;
}) {
  const searchParams = useSearchParams();
  const resolvedHref = preserveAcademicContextHref(href, searchParams?.toString() ?? "");
  return createElement(Link, { href: resolvedHref, className }, children);
}
