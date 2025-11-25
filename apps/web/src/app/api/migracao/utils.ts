import crypto from "node:crypto";

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
    { regex: /^(\d{4})-(\d{2})-(\d{2})$/, map: (y: string, m: string, d: string) => `${y}-${m}-${d}` }, // 2025-01-31
    { regex: /^(\d{2})\/(\d{2})\/(\d{4})$/, map: (d: string, m: string, y: string) => `${y}-${m}-${d}` }, // 31/01/2025
    { regex: /^(\d{2})-(\d{2})-(\d{4})$/, map: (d: string, m: string, y: string) => `${y}-${m}-${d}` }, // 31-01-2025
    { regex: /^(\d{2})\/(\d{2})\/(\d{2})$/, map: (d: string, m: string, y: string) => `20${y}-${m}-${d}` }, // 31/01/25
  ];

  for (const { regex, map } of formats) {
    const match = normalized.match(regex);
    if (match) {
      return map(match[1], match[2], match[3]);
    }
  }

  return undefined;
}

// ------------- NOVOS NORMALIZADORES PARA MATRÍCULA -------------

export function normalizeClasseNumero(value?: string | null): number | undefined {
  if (!value) return undefined;
  const digits = value.replace(/\D/g, "");
  if (!digits) return undefined;
  const parsed = parseInt(digits, 10);
  return Number.isNaN(parsed) ? undefined : parsed;
}

/**
 * Aceita "2025", "2025-2026", "2025/2026" e similares.
 * Sempre devolve o primeiro ano (2025).
 */
export function normalizeAnoLetivo(value?: string | null): number | undefined {
  if (!value) return undefined;
  const trimmed = value.trim();
  const match = trimmed.match(/(\d{4})/);
  if (!match) return undefined;
  const year = parseInt(match[1], 10);
  return Number.isNaN(year) ? undefined : year;
}

/**
 * Normaliza turno para um código curto:
 * - "M" / "Manhã" / "manha" -> "M"
 * - "T" / "Tarde" -> "T"
 * - "N" / "Noite" -> "N"
 * Se não bater, devolve a primeira letra maiúscula.
 */
export function normalizeTurnoCodigo(value?: string | null): string | undefined {
  if (!value) return undefined;
  const trimmed = value.trim();
  if (!trimmed) return undefined;

  const lower = trimmed.toLowerCase();

  if (lower.startsWith("m")) return "M";
  if (lower.startsWith("t")) return "T";
  if (lower.startsWith("n")) return "N";

  const first = trimmed[0]?.toUpperCase();
  return first || undefined;
}

export function normalizeTurmaLetra(value?: string | null): string | undefined {
  if (!value) return undefined;
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  return trimmed.toUpperCase();
}

// ------------- CSV -> JSON LINES (para preview local) -------------

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

// ------------- MAPEAR UMA LINHA DO CSV PARA staging_alunos -------------

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

  // --- PESSOAIS ---

  const nomeKey = columnMap.nome;
  if (nomeKey) mapped.nome = normalizeText(entry[nomeKey]);

  const dataKey = columnMap.data_nascimento;
  if (dataKey) mapped.data_nascimento = normalizeDateString(entry[dataKey]);

  const telKey = columnMap.telefone;
  if (telKey) mapped.telefone = entry[telKey]?.replace(/[^\d+]/g, "");

  const biKey = columnMap.bi;
  if (biKey) mapped.bi = entry[biKey]?.trim();

  const emailKey = columnMap.email;
  if (emailKey) mapped.email = entry[emailKey]?.trim()?.toLowerCase();

  const profileKey = columnMap.profile_id;
  if (profileKey) mapped.profile_id = entry[profileKey]?.trim();

  // NOVOS CAMPOS MATRÍCULA
  const cursoKey = columnMap.curso_codigo;
  if (cursoKey) mapped.curso_codigo = entry[cursoKey]?.trim().toUpperCase();

  const classeKey = columnMap.classe_numero;
  if (classeKey) mapped.classe_numero = normalizeClasseNumero(entry[classeKey]);

  const turnoKey = columnMap.turno_codigo;
  if (turnoKey) mapped.turno_codigo = normalizeTurnoCodigo(entry[turnoKey]);

  const turmaKey = columnMap.turma_letra;
  if (turmaKey) mapped.turma_letra = normalizeTurmaLetra(entry[turmaKey]);

  const anoLetivoKey = columnMap.ano_letivo;
  if (anoLetivoKey) mapped.ano_letivo = normalizeAnoLetivo(entry[anoLetivoKey]);

  const numMatKey = columnMap.numero_matricula;
  if (numMatKey) mapped.numero_matricula = entry[numMatKey]?.trim();

  return mapped;
}

// Preview local: só os primeiros N registros para mostrar na UI
export function summarizePreview(rows: AlunoStagingRecord[], limit = 20): AlunoStagingRecord[] {
  return rows.slice(0, limit);
}