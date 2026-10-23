import type { Role } from "@/lib/authz";
/** Padrão: exportação proibida. As regras são declaradas por escola no servidor. */
export type RosterExportPolicy = {
  enabled: boolean;
  maxRows: number;
  roles: Role[];
  purposeCode?: string;
  retentionDays?: number;
};

export const DEFAULT_ROSTER_EXPORT_POLICY: Readonly<RosterExportPolicy> = Object.freeze({
  enabled: false,
  maxRows: 0,
  roles: [],
});

export function safeCsvCell(value: string | number | null | undefined): string {
  const source = String(value ?? "");
  // Excel/LibreOffice can interpret formula prefixes even after whitespace.
  const safe = /^[\s\u0000-\u001f]*[=+@-]/u.test(source) ? "'" + source : source;
  return '"' + safe.replace(/"/g, '""') + '"';
}

export type MinimalExportRow = {
  nome: string;
  numero: string | null;
  turma: string;
};

export function serializeRosterCsv(rows: readonly MinimalExportRow[], actorId: string, createdAt: string): string {
  const header = ["Nome", "Número de processo", "Turma"].map(safeCsvCell).join(",");
  const body = rows.map((row) => [row.nome, row.numero, row.turma].map(safeCsvCell).join(","));
  const footer = ["Emitido por", actorId, createdAt].map(safeCsvCell).join(",");
  return "\uFEFF" + [header, ...body, footer].join("\r\n") + "\r\n";
}

/** Metadados permitidos para auditoria; nunca guardar a pesquisa textual ou o CSV. */
export function rosterExportAudit(input: {
  userId: string;
  escolaId: string;
  type: "turma" | "classe";
  entityId: string;
  count: number;
  hasSearch: boolean;
  exportedAt: string;
  purposeCode?: string;
  retentionDays?: number;
  filter?: "todos" | "documentos_sinalizados" | "propinas_vencidas" | "ambos";
  sort?: "nome_asc" | "nome_desc" | "pendencias_primeiro";
}) {
  return {
    actor_id: input.userId, escola_id: input.escolaId,
    entity_type: input.type, entity_id: input.entityId,
    row_count: input.count, search_applied: input.hasSearch,
    filter_code: input.filter ?? "todos",
    sort_code: input.sort === "nome_desc" ? "Z_A"
      : input.sort === "pendencias_primeiro" ? "PENDING_FIRST" : "A_Z",
    purpose_code: input.purposeCode ?? "NOT_CONFIGURED",
    retention_until: input.retentionDays == null ? null
      : new Date(Date.parse(input.exportedAt) + input.retentionDays * 86_400_000).toISOString(),
    created_at: input.exportedAt,
  };
}

/** Só configuração explícita por escola activa exportação; erro na configuração = negar. */
export function resolveRosterExportPolicy(
  escolaId: string,
  json: string | undefined,
): RosterExportPolicy {
  if (!json) return DEFAULT_ROSTER_EXPORT_POLICY;
  try {
    const all: unknown = JSON.parse(json);
    if (!all || typeof all !== "object" || Array.isArray(all)) return DEFAULT_ROSTER_EXPORT_POLICY;
    const entry: unknown = (all as Record<string, unknown>)[escolaId];
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) return DEFAULT_ROSTER_EXPORT_POLICY;
    const row = entry as Record<string, unknown>;
    const allowed: readonly string[] = ["admin", "admin_escola", "staff_admin", "diretor", "secretaria", "admin_secretaria"];
    // O job histórico elimina logs aos 30 dias. A configuração por escola
    // só pode reter 1..30 dias (nunca mais do que o máximo institucional).
    // Um job aditivo específico elimina exportações antes dos 30 dias.
    if (typeof row.purposeCode !== "string" ||
        !/^[a-z][a-z0-9_]{2,47}$/.test(row.purposeCode) ||
        !Number.isInteger(row.retentionDays) || typeof row.retentionDays !== "number" ||
        row.retentionDays < 1 || row.retentionDays > 30) {
      return DEFAULT_ROSTER_EXPORT_POLICY;
    }
    if (row.enabled !== true || !Number.isInteger(row.maxRows) ||
        typeof row.maxRows !== "number" || row.maxRows < 1 || row.maxRows > 200 ||
        !Array.isArray(row.roles) || !row.roles.length ||
        !row.roles.every((role) => typeof role === "string" && allowed.includes(role))) {
      return DEFAULT_ROSTER_EXPORT_POLICY;
    }
    return { enabled: true, maxRows: row.maxRows, roles: row.roles as Role[],
      purposeCode: row.purposeCode, retentionDays: row.retentionDays };
  } catch {
    return DEFAULT_ROSTER_EXPORT_POLICY;
  }
}
