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

export function isOperacoesContext(pathname: string | null | undefined) {
  return Boolean(pathname?.includes("/operacoes"));
}

export function toContextualPortalPath(path: string, pathname: string | null | undefined) {
  if (!isOperacoesContext(pathname)) return path;

  const [rawPath, query = ""] = path.split("?");
  const suffix = query ? `?${query}` : "";

  const directPrefixes: Array<[string, string]> = [
    ["/admin/dashboard", "/operacoes/dashboard"],
    ["/admin/configuracoes", "/operacoes/configuracoes"],
    ["/admin/professores", "/operacoes/professores"],
    ["/admin/turmas", "/operacoes/turmas"],
    ["/admin/alunos", "/operacoes/alunos"],
    ["/admin/avisos", "/operacoes/avisos"],
    ["/admin/comunicacao/whatsapp", "/operacoes/comunicacao/whatsapp"],
    ["/admin/comunicacao", "/operacoes/comunicacao"],
    ["/admin/migracao/pautas", "/operacoes/migracao/pautas"],
    ["/admin/migracao", "/operacoes/migracao/alunos"],
    ["/admin/operacoes-academicas", "/operacoes/academico"],
    ["/secretaria/admissoes", "/operacoes/admissoes"],
    ["/secretaria/alunos", "/operacoes/alunos"],
    ["/secretaria/turmas", "/operacoes/turmas"],
    ["/secretaria/classes", "/operacoes/classes"],
    ["/secretaria/matriculas", "/operacoes/matriculas"],
    ["/secretaria/rematricula", "/operacoes/rematricula"],
    ["/secretaria/calendario", "/operacoes/calendario"],
    ["/secretaria/documentos-oficiais", "/operacoes/documentos-oficiais"],
    ["/secretaria/documentos", "/operacoes/documentos"],
    ["/secretaria/operacoes-academicas", "/operacoes/academico"],
    ["/secretaria/importacoes", "/operacoes/importacoes"],
    ["/secretaria/exportacoes", "/operacoes/exportacoes"],
    ["/secretaria/relatorios", "/operacoes/relatorios"],
    ["/secretaria/fecho", "/operacoes/fecho"],
    ["/secretaria/recebimentos", "/operacoes/recebimentos"],
    ["/secretaria/acesso-alunos", "/operacoes/acesso-alunos"],
    ["/secretaria/acesso", "/operacoes/acessos"],
    ["/secretaria/alertas", "/operacoes/alertas"],
    ["/secretaria/migracao", "/operacoes/migracao"],
    ["/horarios", "/operacoes/horarios"],
    ["/financeiro/turmas-alunos", "/operacoes/turmas-alunos"],
    ["/financeiro/pagamentos", "/operacoes/recebimentos"],
    ["/financeiro/radar", "/operacoes/recebimentos"],
    ["/financeiro/cobrancas", "/operacoes/recebimentos"],
    ["/financeiro/fecho", "/operacoes/fecho"],
    ["/financeiro/relatorios/mapa-aproveitamento", "/operacoes/relatorios/mapa-aproveitamento"],
    ["/financeiro/relatorios/mensal-escolar", "/operacoes/relatorios/mensal-escolar"],
    ["/financeiro/relatorios/propinas", "/operacoes/relatorios/propinas"],
  ];

  for (const [from, to] of directPrefixes) {
    if (rawPath === from || rawPath.startsWith(`${from}/`)) {
      return `${rawPath.replace(from, to)}${suffix}`;
    }
  }

  if (rawPath === "/financeiro" || rawPath === "/financeiro/dashboard") {
    return `/operacoes/recebimentos${suffix}`;
  }

  if (rawPath === "/secretaria") {
    return `/operacoes/dashboard${suffix}`;
  }

  if (rawPath === "/admin") {
    return `/operacoes/dashboard${suffix}`;
  }

  return path;
}

export function buildContextualPortalHref(
  escolaSlug: string | null | undefined,
  path: string,
  pathname: string | null | undefined,
) {
  return buildPortalHref(escolaSlug, toContextualPortalPath(path, pathname));
}

export function getEscolaParamFromPath(pathname: string | null | undefined) {
  if (!pathname) return null;
  const match = pathname.match(/^\/escola\/([^/]+)/);
  return match?.[1] ?? null;
}
