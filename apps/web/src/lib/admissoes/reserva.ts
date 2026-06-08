export const DEFAULT_RESERVA_EXPIRACAO_HORAS = 48;
export const MIN_RESERVA_EXPIRACAO_HORAS = 1;
export const MAX_RESERVA_EXPIRACAO_HORAS = 168;
export const DEFAULT_PENDENCIA_SLA_HORAS = 72;
export const MIN_PENDENCIA_SLA_HORAS = 1;
export const MAX_PENDENCIA_SLA_HORAS = 720;
export const MIN_ANO_LETIVO_ADMISSOES = 2000;
export const MAX_ANO_LETIVO_ADMISSOES = 2100;

export const DEFAULT_DOCUMENTOS_ADMISSAO = [
  { id: "bi_candidato", label: "BI do candidato" },
  { id: "foto_candidato", label: "Fotografia do candidato" },
  { id: "certificado_habilitacoes", label: "Certificado ou declaração" },
  { id: "bi_encarregado", label: "BI do encarregado" },
] as const;

export function normalizeReservaExpiracaoHoras(value: unknown) {
  const numericValue =
    typeof value === "number"
      ? value
      : typeof value === "string" && value.trim() !== ""
        ? Number(value)
        : DEFAULT_RESERVA_EXPIRACAO_HORAS;

  if (!Number.isFinite(numericValue)) return DEFAULT_RESERVA_EXPIRACAO_HORAS;

  return Math.min(
    MAX_RESERVA_EXPIRACAO_HORAS,
    Math.max(MIN_RESERVA_EXPIRACAO_HORAS, Math.trunc(numericValue))
  );
}

export function getReservaExpiracaoHorasFromConfig(config: unknown) {
  if (!config || typeof config !== "object" || Array.isArray(config)) {
    return DEFAULT_RESERVA_EXPIRACAO_HORAS;
  }

  return normalizeReservaExpiracaoHoras(
    (config as Record<string, unknown>).reserva_expiracao_horas
  );
}

export function normalizePendenciaSlaHoras(value: unknown) {
  const numericValue =
    typeof value === "number"
      ? value
      : typeof value === "string" && value.trim() !== ""
        ? Number(value)
        : DEFAULT_PENDENCIA_SLA_HORAS;

  if (!Number.isFinite(numericValue)) return DEFAULT_PENDENCIA_SLA_HORAS;

  return Math.min(
    MAX_PENDENCIA_SLA_HORAS,
    Math.max(MIN_PENDENCIA_SLA_HORAS, Math.trunc(numericValue))
  );
}

export function getPendenciaSlaHorasFromConfig(config: unknown) {
  if (!config || typeof config !== "object" || Array.isArray(config)) {
    return DEFAULT_PENDENCIA_SLA_HORAS;
  }

  return normalizePendenciaSlaHoras(
    (config as Record<string, unknown>).pendencia_sla_horas
  );
}

export function normalizeAnoLetivoAdmissoes(value: unknown) {
  const numericValue =
    typeof value === "number"
      ? value
      : typeof value === "string" && value.trim() !== ""
        ? Number(value)
        : null;

  if (!Number.isFinite(numericValue)) return null;

  const year = Math.trunc(Number(numericValue));
  if (year < MIN_ANO_LETIVO_ADMISSOES || year > MAX_ANO_LETIVO_ADMISSOES) return null;
  return year;
}

export function getAnoLetivoAdmissoesFromConfig(config: unknown, fallback?: number | null) {
  const fallbackYear = normalizeAnoLetivoAdmissoes(fallback);
  if (!config || typeof config !== "object" || Array.isArray(config)) {
    return fallbackYear;
  }

  return normalizeAnoLetivoAdmissoes(
    (config as Record<string, unknown>).ano_letivo_admissoes
  ) ?? fallbackYear;
}

export function getDocumentosAdmissaoCatalogoFromConfig(config: unknown) {
  if (!config || typeof config !== "object" || Array.isArray(config)) {
    return [...DEFAULT_DOCUMENTOS_ADMISSAO];
  }

  const rawCatalog = (config as Record<string, unknown>).documentos_admissao_catalogo;
  if (!Array.isArray(rawCatalog)) return [...DEFAULT_DOCUMENTOS_ADMISSAO];

  const catalog = rawCatalog
    .map((item) => {
      if (!item || typeof item !== "object" || Array.isArray(item)) return null;
      const record = item as Record<string, unknown>;
      const id = typeof record.id === "string" ? record.id.trim().toLowerCase() : "";
      const label = typeof record.label === "string" ? record.label.trim() : "";
      if (!/^[a-z0-9_-]{1,120}$/.test(id) || label.length < 2) return null;
      return { id, label: label.slice(0, 120) };
    })
    .filter((item): item is { id: string; label: string } => Boolean(item));

  return catalog.length > 0 ? catalog : [...DEFAULT_DOCUMENTOS_ADMISSAO];
}
