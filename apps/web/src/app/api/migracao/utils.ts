import crypto from "node:crypto";
import * as XLSX from "xlsx";
import type { AlunoCSV, AlunoStagingRecord, MappedColumns } from "~types/migracao";

export const MAX_UPLOAD_SIZE = 12 * 1024 * 1024; // 12 MB

// --- CONFIGURAÇÃO DE NORMALIZAÇÃO (Fácil de ajustar) ---
const DATE_FORMATS = [
  { regex: /^(\d{4})-(\d{2})-(\d{2})$/, map: (y: string, m: string, d: string) => `${y}-${m}-${d}` }, // ISO: 2025-01-31
  { regex: /^(\d{2})\/(\d{2})\/(\d{4})$/, map: (d: string, m: string, y: string) => `${y}-${m}-${d}` }, // PT: 31/01/2025
  { regex: /^(\d{2})-(\d{2})-(\d{4})$/, map: (d: string, m: string, y: string) => `${y}-${m}-${d}` }, // PT: 31-01-2025
  { regex: /^(\d{2})\.(\d{2})\.(\d{4})$/, map: (d: string, m: string, y: string) => `${y}-${m}-${d}` }, // PT: 31.01.2025
  { regex: /^(\d{1,2})\/(\d{1,2})\/(\d{2})$/, map: (d: string, m: string, y: string) => `20${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}` }, // Curta: 1/1/25
];

const SHIFT_MAP: Record<string, string> = {
  'm': 'M', 'manha': 'M', 'manhã': 'M', 'matutino': 'M',
  't': 'T', 'tarde': 'T', 'vespertino': 'T',
  'n': 'N', 'noite': 'N', 'noturno': 'N'
};

// --- FUNÇÕES UTILITÁRIAS ---

export function hashBuffer(buffer: Buffer): string {
  const hash = crypto.createHash("sha256");
  hash.update(buffer);
  return hash.digest("hex");
}

export function normalizeText(value?: string | null): string | undefined {
  if (!value || typeof value !== 'string') return undefined;
  try {
    const cleaned = value
      .normalize("NFD")
      .replace(/\p{Diacritic}/gu, "")
      .trim()
      .replace(/\s+/g, " ");
    return cleaned.toLowerCase();
  } catch (e) {
    return undefined; // Fallback seguro
  }
}

export function normalizeDateString(value?: string | null): string | undefined {
  if (!value) return undefined;
  const normalized = String(value).trim();

  for (const { regex, map } of DATE_FORMATS) {
    const match = normalized.match(regex);
    if (match) {
      try {
        // Validação extra: verificar se é uma data real
        const isoDate = map(match[1], match[2], match[3]);
        const d = new Date(isoDate);
        if (!isNaN(d.getTime())) return isoDate;
      } catch {
        continue;
      }
    }
  }
  return undefined;
}

// ------------- NORMALIZADORES ESPECÍFICOS -------------

export function normalizeClasseNumero(value?: string | null | number): number | undefined {
  if (value === null || value === undefined) return undefined;
  
  // Se já vier como número do Excel/JSON
  if (typeof value === 'number') return value;

  const strValue = String(value).trim();
  const digits = strValue.replace(/\D/g, ""); // Remove tudo que não é dígito
  
  if (!digits) return undefined;
  
  const parsed = parseInt(digits, 10);
  // Validar range razoável (ex: 1ª a 13ª classe) para evitar lixo
  return (!Number.isNaN(parsed) && parsed > 0 && parsed <= 13) ? parsed : undefined;
}

export function normalizeAnoLetivo(value?: string | null | number): number | undefined {
  if (!value) return undefined;
  const strValue = String(value).trim();
  
  // Aceita "2025", "2025-2026", "2025/2026"
  const match = strValue.match(/(\d{4})/);
  if (!match) return undefined;
  
  const year = parseInt(match[1], 10);
  // Validação de sanidade (ex: entre 2000 e 2100)
  return (!Number.isNaN(year) && year > 2000 && year < 2100) ? year : undefined;
}

export function normalizeTurnoCodigo(value?: string | null): string | undefined {
  if (!value) return undefined;
  const trimmed = String(value).trim().toLowerCase();
  
  // 1. Tenta mapa exato
  if (SHIFT_MAP[trimmed]) return SHIFT_MAP[trimmed];

  // 2. Fallback: Primeira letra se for M, T ou N
  const firstChar = trimmed.charAt(0).toUpperCase();
  if (['M', 'T', 'N'].includes(firstChar)) return firstChar;

  return undefined;
}

export function normalizeTurmaLetra(value?: string | null): string | undefined {
  if (!value) return undefined;
  const trimmed = String(value).trim().toUpperCase();
  
  // Aceita apenas letras simples ou combinadas curtas (ex: "A", "B", "T1")
  // Remove caracteres especiais para evitar injeção ou lixo
  const clean = trimmed.replace(/[^A-Z0-9]/g, "");
  
  return clean.length > 0 ? clean : undefined;
}

// ------------- CSV PARSER -------------

export function csvToJsonLines(csv: string): AlunoCSV[] {
  if (!csv) return [];
  
  try {
    const lines = csv.split(/\r?\n/).filter(line => line.trim().length > 0);
    if (lines.length === 0) return [];

    // Detecção automática de delimitador (conta ocorrências na primeira linha)
    const headerLine = lines[0];
    const countSemi = (headerLine.match(/;/g) || []).length;
    const countComma = (headerLine.match(/,/g) || []).length;
    const delimiter = countSemi >= countComma ? ";" : ",";

    // Limpeza de headers (remove BOM, quotes e espaços)
    const headers = headerLine.split(delimiter).map((h) => 
      h.replace(/^[\uFEFF]/, '').trim().replace(/^"|"$/g, '')
    );

    return lines.slice(1).map((line) => {
      // Tratamento básico para CSV quotes (não perfeito, mas melhor que split simples)
      // Nota: Para produção pesada, recomenda-se uma lib como 'papaparse', 
      // mas para manter zero deps, este split funciona para casos simples.
      const values = line.split(delimiter);
      
      const entry: AlunoCSV = {};
      headers.forEach((header, idx) => {
        // Remove aspas envolventes dos valores
        let val = values[idx]?.trim();
        if (val && val.startsWith('"') && val.endsWith('"')) {
          val = val.slice(1, -1);
        }
        entry[header] = val || "";
      });
      return entry;
    });
  } catch (error) {
    console.error("Erro ao processar CSV:", error);
    return [];
  }
}

export async function fileToCsvText(
  file: Blob,
  opts: { fileName?: string; mimeType?: string } = {}
): Promise<string> {
  const buffer = Buffer.from(await file.arrayBuffer());

  // Detecta XLSX pelo magic number "PK\x03\x04" + mime/ext
  const nameLower = (opts.fileName || (file as any).name || "").toLowerCase();
  const contentType = opts.mimeType || (file as any).type || "";
  const isXlsx =
    (!!nameLower && nameLower.endsWith(".xlsx")) ||
    contentType === "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" ||
    (buffer[0] === 0x50 && buffer[1] === 0x4b && buffer[2] === 0x03 && buffer[3] === 0x04);

  if (isXlsx) {
    const wb = XLSX.read(buffer, { type: "buffer" });
    const firstSheet = wb.SheetNames[0];
    if (!firstSheet) return "";
    return XLSX.utils.sheet_to_csv(wb.Sheets[firstSheet], { FS: "," });
  }

  // Fallback: trata como texto (CSV)
  return buffer.toString("utf8");
}

// ------------- MAPPER PRINCIPAL -------------

export function mapAlunoFromCsv(
  entry: AlunoCSV,
  columnMap: MappedColumns,
  importId: string,
  escolaId: string,
  explicitAnoLetivo: number
): AlunoStagingRecord {
  
  // Inicializa objeto seguro
  const mapped: AlunoStagingRecord = {
    import_id: importId,
    escola_id: escolaId,
    raw_data: entry,
    // Inicializa com undefined para garantir que a chave existe no objeto final
    nome: undefined,
    data_nascimento: undefined,
    telefone: undefined,
    bi: undefined,
    bi_numero: undefined,
    nif: undefined,
    email: undefined,
    encarregado_nome: undefined,
    encarregado_telefone: undefined, // NOVO
    encarregado_email: undefined,
    numero_processo: undefined, // NOVO
    profile_id: undefined,
    turma_codigo: undefined, // NOVO
    ano_letivo: explicitAnoLetivo, // Usa o ano letivo explícito do body
    numero_matricula: undefined
  };

  // Helper para pegar valor cru de forma segura
  const getVal = (key?: string) => key && entry[key] ? String(entry[key]) : null;

  // --- DADOS PESSOAIS ---
  mapped.nome = normalizeText(getVal(columnMap.nome));
  mapped.data_nascimento = normalizeDateString(getVal(columnMap.data_nascimento));
  
  mapped.encarregado_nome = getVal(columnMap.encarregado_nome)?.trim();
  // Telefone: mantemos apenas números e o sinal +
  const rawTel = getVal(columnMap.telefone);
  mapped.telefone = rawTel ? rawTel.replace(/[^\d+]/g, "") : undefined;
  
  // Encarregado Telefone: mantemos apenas números e o sinal +
  const rawEncarregadoTel = getVal(columnMap.encarregado_telefone);
  mapped.encarregado_telefone = rawEncarregadoTel ? rawEncarregadoTel.replace(/[^\d+]/g, "") : undefined;

  const rawBi = getVal(columnMap.bi)?.trim();
  mapped.bi = rawBi ? rawBi.toUpperCase() : undefined; // BI geralmente é Upper
  const rawBiNumero = getVal(columnMap.bi_numero)?.trim();
  mapped.bi_numero = (rawBiNumero || rawBi)?.toUpperCase();

  const rawNif = getVal(columnMap.nif)?.trim();
  mapped.nif = rawNif ? rawNif.toUpperCase() : undefined;

  mapped.email = getVal(columnMap.email)?.trim().toLowerCase();
  mapped.encarregado_email = getVal(columnMap.encarregado_email)?.trim().toLowerCase();
  mapped.profile_id = getVal(columnMap.profile_id)?.trim();
  mapped.numero_processo = getVal(columnMap.numero_processo)?.trim(); // NOVO: Número de Processo

  // --- DADOS ACADÊMICOS (Normalizados) ---
  mapped.turma_codigo = getVal(columnMap.turma_codigo)?.trim(); // NOVO: Turma Código
  mapped.ano_letivo = normalizeAnoLetivo(getVal(columnMap.ano_letivo));
  mapped.numero_matricula = getVal(columnMap.numero_matricula)?.trim();

  return mapped;
}

export function summarizePreview(rows: AlunoStagingRecord[], limit = 20): AlunoStagingRecord[] {
  return rows.slice(0, limit);
}
