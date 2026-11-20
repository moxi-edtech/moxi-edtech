/**
 * Standard page inset matches the Alunos list: the AppShell owns the outer
 * responsive gutter; the page owns its consistent inner content inset.
 * Do not stack another p-4/p-6 wrapper around this class.
 */
export const PORTAL_PAGE_INSET = "mx-auto w-full min-w-0 max-w-6xl px-6 py-8";

/** Wide canvases (e.g. the timetable) are opt-in, never the default. */
/** For multi-section pages that own their vertical rhythm (e.g. Turma details). */
export const PORTAL_PAGE_HORIZONTAL_INSET = "mx-auto w-full min-w-0 max-w-6xl px-6";

export const PORTAL_PAGE_WIDE_INSET = "mx-auto w-full min-w-0 max-w-7xl px-6 py-8";

export function isWidePortalPage(pathname: string | null | undefined): boolean {
  if (!pathname) return false;
  const parts = pathname.split("?")[0].split("/").filter(Boolean);
  const schoolPrefix = parts[0] === "escola" && parts.length > 2 ? 2 : 0;
  const section = parts[schoolPrefix] === "operacoes" ? schoolPrefix + 1 : schoolPrefix;
  return parts[section] === "horarios" && parts[section + 1] === "quadro";
}
