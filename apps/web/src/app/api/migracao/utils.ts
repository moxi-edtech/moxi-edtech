import type { AlunoCSV, AlunoStagingRecord, MappedColumns } from "~types/migracao";

export const MAX_UPLOAD_SIZE = 12 * 1024 * 1024; // 12 MB

export function hashBuffer(buffer: Buffer): string {
  const hash = crypto.createHash("sha256");
  hash.update(buffer);
  return hash.digest("hex");
}

export function normalizeText(value?: string | null): string | undefined {
  if (!value) return undefined;
  const cleaned = value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .trim()
    .replace(/\s+/g, " ");
  return cleaned.toLowerCase();
}

export function normalizeDateString(value?: string | null): string | undefined {
  if (!value) return undefined;
  const normalized = value.trim();
  const formats = [
    { regex: /^(\d{4})-(\d{2})-(\d{2})$/, map: (y: string, m: string, d: string) => `${y}-${m}-${d}` },
    { regex: /^(\d{2})\/(\d{2})\/(\d{4})$/, map: (d: string, m: string, y: string) => `${y}-${m}-${d}` },
    { regex: /^(\d{2})-(\d{2})-(\d{4})$/, map: (d: string, m: string, y: string) => `${y}-${m}-${d}` },
    { regex: /^(\d{2})\/(\d{2})\/(\d{2})$/, map: (d: string, m: string, y: string) => `20${y}-${m}-${d}` },
  ];

  for (const { regex, map } of formats) {
    const match = normalized.match(regex);
    if (match) {
      return map(match[1], match[2], match[3]);
    }
  }

  return undefined;
}

export function csvToJsonLines(csv: string): AlunoCSV[] {
  const lines = csv.split(/\r?\n/).filter(Boolean);
  if (lines.length === 0) return [];

  const delimiter = lines[0].includes(";") && !lines[0].includes(",") ? ";" : ",";
  const headers = lines[0].split(delimiter).map((h) => h.trim());

  return lines.slice(1).map((line) => {
    const values = line.split(delimiter);
    const entry: AlunoCSV = {};
    headers.forEach((header, idx) => {
      entry[header] = values[idx]?.trim();
    });
    return entry;
  });
}

export function mapAlunoFromCsv(
  entry: AlunoCSV,
  columnMap: MappedColumns,
  importId: string,
  escolaId: string
): AlunoStagingRecord {
  const mapped: AlunoStagingRecord = {
    import_id: importId,
    escola_id: escolaId,
    raw_data: entry,
  };

  // Dados pessoais
  if (columnMap.nome) mapped.nome = normalizeText(entry[columnMap.nome]);
  if (columnMap.data_nascimento) mapped.data_nascimento = normalizeDateString(entry[columnMap.data_nascimento]);
  if (columnMap.telefone) mapped.telefone = entry[columnMap.telefone]?.replace(/[^\d+]/g, "");
  if (columnMap.bi) mapped.bi = entry[columnMap.bi]?.trim();
  if (columnMap.email) mapped.email = entry[columnMap.email]?.trim().toLowerCase();

  // Matrícula flexível
  if (columnMap.curso_codigo) {
    mapped.curso_codigo = entry[columnMap.curso_codigo]?.trim().toUpperCase();
  }
  if (columnMap.classe_label) {
    mapped.classe_label = entry[columnMap.classe_label]?.trim();
  }
  if (columnMap.turno_codigo) {
    mapped.turno_codigo = entry[columnMap.turno_codigo]?.trim().toUpperCase();
  }
  if (columnMap.turma_label) {
    mapped.turma_label = entry[columnMap.turma_label]?.trim();
  }
  if (columnMap.ano_letivo) {
    mapped.ano_letivo = entry[columnMap.ano_letivo]?.trim();
  }

  return mapped;
}

export function summarizePreview(rows: AlunoStagingRecord[], limit = 20): AlunoStagingRecord[] {
  return rows.slice(0, limit);
}
