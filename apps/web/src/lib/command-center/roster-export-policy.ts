/** Padrão: exportação proibida. As regras são declaradas por escola no servidor. */
export type RosterExportPolicy = {
  enabled: boolean;
  maxRows: number;
  roles: string[];
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
  return '"' + safe.replaceAll('"', '""') + '"';
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
}) {
  return {
    actor_id: input.userId, escola_id: input.escolaId,
    entity_type: input.type, entity_id: input.entityId,
    row_count: input.count, search_applied: input.hasSearch,
    created_at: input.exportedAt,
  };
}
