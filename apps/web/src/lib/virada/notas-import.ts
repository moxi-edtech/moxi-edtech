import { z } from "zod";

export const RESULTADOS_FINAIS = ["TRANSITADO", "RETIDO", "CONCLUIDO", "PENDENTE"] as const;

const optionalText = z.preprocess(
  (value) => value == null || String(value).trim() === "" ? undefined : String(value).trim(),
  z.string().optional(),
);

const notaValue = z.preprocess((value) => {
  if (value == null || String(value).trim() === "") return undefined;
  if (typeof value === "number") return value;
  return Number(String(value).trim().replace(",", "."));
}, z.number().min(0).max(20).optional());

const resultadoValue = z.preprocess(
  (value) => value == null || String(value).trim() === "" ? undefined : String(value).trim().toUpperCase(),
  z.enum(RESULTADOS_FINAIS).optional(),
);

export const NotaImportRowSchema = z.object({
  matricula_id: optionalText.pipe(z.string().uuid().optional()),
  avaliacao_id: optionalText.pipe(z.string().uuid().optional()),
  numero_processo: optionalText,
  aluno_nome: optionalText,
  turma: optionalText,
  disciplina: optionalText,
  periodo: optionalText,
  avaliacao: optionalText,
  nota: notaValue,
  resultado_final: resultadoValue,
}).superRefine((row, ctx) => {
  if (!row.matricula_id && !row.numero_processo) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Informe matricula_id ou numero_processo.",
      path: ["matricula_id"],
    });
  }
  if (row.nota == null && !row.resultado_final) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Informe nota ou resultado_final.",
      path: ["nota"],
    });
  }
  if (row.nota != null && !row.avaliacao_id) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Notas exigem avaliacao_id para impedir associação ambígua.",
      path: ["avaliacao_id"],
    });
  }
});

export type NotaImportRow = z.infer<typeof NotaImportRowSchema>;

export type NotaImportPreview = {
  total: number;
  validas: Array<NotaImportRow & { linha: number; chave: string }>;
  rejeitadas: Array<{ linha: number; erros: string[] }>;
  duplicadas: Array<{ linha: number; chave: string }>;
};

const HEADER_ALIASES: Record<string, keyof NotaImportRow> = {
  matricula: "matricula_id",
  matricula_id: "matricula_id",
  avaliacao_id: "avaliacao_id",
  numero_de_processo: "numero_processo",
  numero_processo: "numero_processo",
  processo: "numero_processo",
  aluno: "aluno_nome",
  aluno_nome: "aluno_nome",
  nome_do_aluno: "aluno_nome",
  turma: "turma",
  disciplina: "disciplina",
  periodo: "periodo",
  trimestre: "periodo",
  avaliacao: "avaliacao",
  nota: "nota",
  classificacao: "nota",
  resultado: "resultado_final",
  resultado_final: "resultado_final",
  decisao_final: "resultado_final",
};

function normaliseHeader(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "");
}

export function normaliseNotaSpreadsheetRow(raw: Record<string, unknown>) {
  const normalized: Record<string, unknown> = {};
  for (const [header, value] of Object.entries(raw)) {
    const canonical = HEADER_ALIASES[normaliseHeader(header)];
    if (canonical) normalized[canonical] = value;
  }
  return normalized;
}

function normaliseKey(value?: string) {
  return value?.trim().toLocaleLowerCase("pt-AO") ?? "";
}

export function buildNotaImportKey(row: NotaImportRow) {
  const aluno = row.matricula_id || normaliseKey(row.numero_processo);
  const resultado = row.resultado_final ? "resultado-final" : "nota";
  return [
    aluno,
    resultado,
    row.avaliacao_id ?? normaliseKey(row.disciplina),
    normaliseKey(row.periodo),
    normaliseKey(row.avaliacao),
  ].join("|");
}

export function previewNotaImport(rows: unknown[]): NotaImportPreview {
  const validas: NotaImportPreview["validas"] = [];
  const rejeitadas: NotaImportPreview["rejeitadas"] = [];
  const duplicadas: NotaImportPreview["duplicadas"] = [];
  const seen = new Set<string>();

  rows.forEach((raw, index) => {
    const linha = index + 2;
    const parsed = NotaImportRowSchema.safeParse(raw);
    if (!parsed.success) {
      rejeitadas.push({
        linha,
        erros: parsed.error.issues.map((issue) => `${issue.path.join(".") || "linha"}: ${issue.message}`),
      });
      return;
    }

    const chave = buildNotaImportKey(parsed.data);
    if (seen.has(chave)) {
      duplicadas.push({ linha, chave });
      return;
    }

    seen.add(chave);
    validas.push({ ...parsed.data, linha, chave });
  });

  return { total: rows.length, validas, rejeitadas, duplicadas };
}
