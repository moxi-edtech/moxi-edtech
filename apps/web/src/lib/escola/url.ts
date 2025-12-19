export function buildEscolaUrl(
  escolaId: string,
  path: string,
  qs?: URLSearchParams | Record<string, string | number | null | undefined>
): string {
  const base = path.startsWith('/') ? path : `/${path}`;
  const url = new URL(`/api/escolas/${escolaId}${base}`, typeof window !== 'undefined' ? window.location.origin : 'http://localhost');

  if (qs instanceof URLSearchParams) {
    qs.forEach((value, key) => {
      if (value !== null && value !== undefined && value !== '') url.searchParams.set(key, value);
    });
  } else if (qs) {
    Object.entries(qs).forEach(([key, value]) => {
      if (value !== null && value !== undefined && value !== '') url.searchParams.set(key, String(value));
    });
  }

  // Return path + query only (origin-less) to keep fetch relative
  return url.pathname + (url.search ? url.search : '');
}

