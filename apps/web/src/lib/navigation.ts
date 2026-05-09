/**
 * Helper to build canonical portal URLs.
 * Ensures we stay within the /escola/[slug] tree to avoid remounts.
 */
export function buildPortalHref(escolaSlug: string | null | undefined, path: string) {
  if (!escolaSlug) return path;
  
  // If path already starts with /escola/[slug], return it
  if (path.startsWith(`/escola/${escolaSlug}`)) {
    return path;
  }

  // Ensure path starts with /
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  
  return `/escola/${escolaSlug}${normalizedPath}`;
}

export function getEscolaParamFromPath(pathname: string | null | undefined) {
  if (!pathname) return null;
  const match = pathname.match(/^\/escola\/([^/]+)/);
  return match?.[1] ?? null;
}
