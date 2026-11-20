/** Shared nominal-list export preferences and safe, human-readable filenames. */
export type NominalOrder = "chamada" | "nome_asc" | "nome_desc";
export type NominalNameOrder = Exclude<NominalOrder, "chamada">;

export function parseNominalNameOrder(value: string | null): NominalNameOrder | null {
  if (value === null || value === "nome_asc") return "nome_asc";
  if (value === "nome_desc") return "nome_desc";
  return null;
}

function filenamePart(value: string | null | undefined): string {
  return (value ?? "")
    .replace(/[\\/<>:"|?*\u0000-\u001f\u007f]/g, " ")
    .replace(/\s+/g, " ")
    .replace(/^[.\s]+|[.\s]+$/g, "")
    .slice(0, 65);
}

export function nominalExportFilename(input: {
  scope: "turma" | "classe";
  classe?: string | null;
  turma?: string | null;
  ano?: string | null;
  extension: "pdf" | "xlsx";
}): string {
  const prefix = input.scope === "classe" ? "Lista de Classe" : "Lista de Turma";
  const parts = [
    prefix,
    filenamePart(input.classe),
    input.scope === "turma" ? filenamePart(input.turma) : "",
    filenamePart(input.ano?.replaceAll("/", "-")),
  ].filter(Boolean);
  return parts.join(" - ").slice(0, 180).trim() + "." + input.extension;
}

/** ASCII fallback for older clients plus RFC 5987 UTF-8 name. */
export function nominalContentDisposition(filename: string): string {
  const ascii = filename.normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9 ._()\-]/g, "")
    .replace(/"/g, "")
    .slice(0, 180) || "Lista de Turma";
  return `attachment; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(filename)}`;
}

/** The response header wins over any filename guessed in the browser. */
export function downloadFilenameFromDisposition(header: string | null): string | null {
  if (!header) return null;
  const encoded = /filename\*=UTF-8''([^;]+)/i.exec(header)?.[1];
  if (encoded) {
    try {
      const value = decodeURIComponent(encoded);
      if (value && !/[\\/\u0000-\u001f\u007f]/.test(value)) return value;
    } catch { /* fall through to ASCII filename */ }
  }
  const fallback = /filename="([^"]+)"/i.exec(header)?.[1];
  return fallback && !/[\\/\u0000-\u001f\u007f]/.test(fallback) ? fallback : null;
}
