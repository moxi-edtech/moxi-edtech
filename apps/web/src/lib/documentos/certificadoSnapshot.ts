import { notaParaExtensoPTAO } from "@/lib/academico/extenso";
import {
  clean,
  toNumber,
  extractClassNumber,
  slugify,
  normalizeOverallMedia,
  buildDisciplineAverage,
} from "./snapshotUtils";

type SupabaseSelectResult<T> = PromiseLike<{ data: T[] | null; error: unknown }> & {
  select(query: string): SupabaseSelectResult<T>;
  eq(column: string, value: unknown): SupabaseSelectResult<T>;
  in(column: string, values: string[]): SupabaseSelectResult<T>;
  order(column: string, options: { ascending: boolean }): SupabaseSelectResult<T>;
};

type SupabaseLike = {
  from<T>(table: string): {
    select(query: string): SupabaseSelectResult<T>;
  };
};

export type CertificadoClasseColuna = {
  key: string;
  label: string;
  classe_numero: number;
};

export type CertificadoDisciplinaLinha = {
  nome: string;
  notas: Record<string, number | null>;
  media_final: number | null;
  media_extenso: string | null;
};

export type CertificadoSnapshot = {
  aluno_nome: string;
  aluno_bi?: string | null;
  turma_nome?: string | null;
  turma_turno?: string | null;
  ano_letivo?: number | string | null;
  media_final?: number | null;
  media_extenso?: string | null;
  hash_validacao?: string | null;
  qrCodeDataUrl?: string | null;
  escola_nome?: string | null;
  escola_codigo?: string | null;
  escola_municipio?: string | null;
  escola_provincia?: string | null;
  diretora_nome?: string | null;
  pai_nome?: string | null;
  mae_nome?: string | null;
  naturalidade?: string | null;
  provincia?: string | null;
  data_nascimento?: string | null;
  data_emissao?: string | null;
  bi_emitido_em?: string | null;
  regime?: string | null;
  classe_concluida?: string | null;
  curso_nome?: string | null;
  area_formacao?: string | null;
  processo_individual_numero?: string | null;
  numero_sequencial?: number | string | null;
  ciclo_designacao?: string | null;
  colunas: CertificadoClasseColuna[];
  disciplinas: CertificadoDisciplinaLinha[];
};

type HistoryClassSource = {
  source: "historico" | "transitado";
  sourceId: string;
  classNumber: number | null;
  classLabel: string | null;
  year: number | null;
};

type HistoryNote = {
  sourceId: string;
  disciplineKey: string;
  disciplineName: string;
  order: number | null;
  score: number | null;
};

type Relation<T> = T | T[] | null;

type HistoricalClassRow = {
  id: string;
  ano_letivo: number | string | null;
  turmas?: Relation<{
    nome?: string | null;
    classes?: Relation<{ nome?: string | null }>;
  }>;
};

type TransitedClassRow = {
  id: string;
  ano_letivo: number | string | null;
  classe_nome?: string | null;
};

type HistoricalNoteRow = {
  historico_ano_id: string;
  disciplina_id?: string | null;
  disciplina_nome?: string | null;
  nota_final?: number | string | null;
  media_final?: number | string | null;
};

type TransitedNoteRow = {
  historico_transitado_ano_id: string;
  disciplina_id?: string | null;
  disciplina_nome?: string | null;
  ordem?: number | string | null;
  nota_final?: number | string | null;
};

const firstRelation = <T,>(value?: Relation<T>) => (Array.isArray(value) ? value[0] ?? null : value ?? null);
const stringOrNull = (value: unknown) => (typeof value === "string" ? value : null);

const buildCycleColumns = (currentClassNumber: number | null, availableNumbers: number[]) => {
  if (currentClassNumber && currentClassNumber > 0) {
    return [currentClassNumber - 2, currentClassNumber - 1, currentClassNumber].filter((item) => item > 0);
  }

  const uniqueSorted = Array.from(new Set(availableNumbers)).sort((a, b) => a - b);
  return uniqueSorted.slice(-3);
};

const getCycleLabel = (currentClassNumber: number | null, fallback?: string | null) => {
  if (currentClassNumber === 9) return "I CICLO DO ENSINO SECUNDÁRIO GERAL";
  if (currentClassNumber === 12) return "II CICLO DO ENSINO SECUNDÁRIO GERAL";
  return clean(fallback)?.toUpperCase() ?? "ENSINO SECUNDÁRIO";
};

const selectPreferredSource = (existing: HistoryClassSource | undefined, candidate: HistoryClassSource) => {
  if (!existing) return candidate;
  if (existing.source === "historico" && candidate.source !== "historico") return existing;
  if (candidate.source === "historico" && existing.source !== "historico") return candidate;
  const existingYear = existing.year ?? -1;
  const candidateYear = candidate.year ?? -1;
  return candidateYear >= existingYear ? candidate : existing;
};

async function fetchOfficialHistoryRows(
  supabase: SupabaseLike,
  escolaId: string,
  alunoId: string
): Promise<HistoryClassSource[]> {
  const { data, error } = await supabase
    .from("historico_anos")
    .select(`
      id,
      ano_letivo,
      turmas:turma_id (
        nome,
        classes:classe_id (
          nome
        )
      )
    `)
    .eq("escola_id", escolaId)
    .eq("aluno_id", alunoId)
    .order("ano_letivo", { ascending: true });

  if (error || !Array.isArray(data)) return [];

  return (data as HistoricalClassRow[])
    .map((row) => {
      const turma = firstRelation(row.turmas);
      const turmaClass = firstRelation(turma?.classes);
      const className =
        clean(turmaClass?.nome) ??
        clean(turma?.nome) ??
        null;
      return {
        source: "historico" as const,
        sourceId: String(row.id ?? ""),
        classNumber: extractClassNumber(className),
        classLabel: className,
        year: toNumber(row.ano_letivo),
      };
    })
    .filter((row) => row.sourceId.length > 0);
}

async function fetchTransitedHistoryRows(
  supabase: SupabaseLike,
  escolaId: string,
  alunoId: string
): Promise<HistoryClassSource[]> {
  const { data, error } = await supabase
    .from("historico_transitado_anos")
    .select("id, ano_letivo, classe_nome")
    .eq("escola_id", escolaId)
    .eq("aluno_id", alunoId)
    .order("ano_letivo", { ascending: true });

  if (error || !Array.isArray(data)) return [];

  return (data as TransitedClassRow[])
    .map((row) => ({
      source: "transitado" as const,
      sourceId: String(row.id ?? ""),
      classNumber: extractClassNumber(row.classe_nome),
      classLabel: clean(row.classe_nome),
      year: toNumber(row.ano_letivo),
    }))
    .filter((row) => row.sourceId.length > 0);
}

async function fetchOfficialHistoryNotes(supabase: SupabaseLike, sourceIds: string[]): Promise<HistoryNote[]> {
  if (sourceIds.length === 0) return [];

  const { data, error } = await supabase
    .from("historico_disciplinas")
    .select("historico_ano_id, disciplina_id, disciplina_nome, nota_final, media_final")
    .in("historico_ano_id", sourceIds);

  if (error || !Array.isArray(data)) return [];

  return (data as HistoricalNoteRow[])
    .map((row) => {
      const disciplineName = clean(row.disciplina_nome) ?? "Disciplina";
      const disciplineId = clean(row.disciplina_id);
      return {
        sourceId: String(row.historico_ano_id ?? ""),
        disciplineKey: disciplineId ?? slugify(disciplineName),
        disciplineName,
        order: null,
        score: normalizeOverallMedia(row.nota_final ?? row.media_final),
      };
    })
    .filter((row) => row.sourceId.length > 0);
}

async function fetchTransitedHistoryNotes(supabase: SupabaseLike, sourceIds: string[]): Promise<HistoryNote[]> {
  if (sourceIds.length === 0) return [];

  const { data, error } = await supabase
    .from("historico_transitado_notas")
    .select("historico_transitado_ano_id, disciplina_id, disciplina_nome, ordem, nota_final")
    .in("historico_transitado_ano_id", sourceIds)
    .order("ordem", { ascending: true })
    .order("disciplina_nome", { ascending: true });

  if (error || !Array.isArray(data)) return [];

  return (data as TransitedNoteRow[])
    .map((row) => {
      const disciplineName = clean(row.disciplina_nome) ?? "Disciplina";
      const disciplineId = clean(row.disciplina_id);
      return {
        sourceId: String(row.historico_transitado_ano_id ?? ""),
        disciplineKey: disciplineId ?? slugify(disciplineName),
        disciplineName,
        order: toNumber(row.ordem),
        score: normalizeOverallMedia(row.nota_final),
      };
    })
    .filter((row) => row.sourceId.length > 0);
}

export async function buildCertificadoSnapshot(params: {
  supabase: unknown;
  escolaId: string;
  alunoId: string;
  baseSnapshot: Record<string, unknown>;
  hashValidacao?: string | null;
}) {
  const { supabase, escolaId, alunoId, baseSnapshot, hashValidacao } = params;
  const client = supabase as SupabaseLike;

  const [officialRows, transitedRows] = await Promise.all([
    fetchOfficialHistoryRows(client, escolaId, alunoId),
    fetchTransitedHistoryRows(client, escolaId, alunoId),
  ]);

  const sourceByClassNumber = new Map<number, HistoryClassSource>();
  for (const row of [...transitedRows, ...officialRows]) {
    if (row.classNumber == null) continue;
    sourceByClassNumber.set(row.classNumber, selectPreferredSource(sourceByClassNumber.get(row.classNumber), row));
  }

  const currentClassNumber = extractClassNumber(clean(stringOrNull(baseSnapshot.classe_concluida)));
  const columnNumbers = buildCycleColumns(
    currentClassNumber,
    Array.from(sourceByClassNumber.keys())
  );
  const colunas: CertificadoClasseColuna[] = columnNumbers.map((value) => ({
    key: `classe_${value}`,
    label: `${value}.a`,
    classe_numero: value,
  }));

  const selectedSources = columnNumbers
    .map((value) => sourceByClassNumber.get(value))
    .filter((value): value is HistoryClassSource => Boolean(value));

  const officialSourceIds = selectedSources
    .filter((item) => item.source === "historico")
    .map((item) => item.sourceId);
  const transitedSourceIds = selectedSources
    .filter((item) => item.source === "transitado")
    .map((item) => item.sourceId);

  const [officialNotes, transitedNotes] = await Promise.all([
    fetchOfficialHistoryNotes(client, officialSourceIds),
    fetchTransitedHistoryNotes(client, transitedSourceIds),
  ]);

  const notesBySourceId = new Map<string, HistoryNote[]>();
  for (const row of [...officialNotes, ...transitedNotes]) {
    const current = notesBySourceId.get(row.sourceId) ?? [];
    current.push(row);
    notesBySourceId.set(row.sourceId, current);
  }

  const disciplineMap = new Map<
    string,
    {
      nome: string;
      ordem: number | null;
      notas: Record<string, number | null>;
    }
  >();

  for (const coluna of colunas) {
    const source = sourceByClassNumber.get(coluna.classe_numero);
    const sourceNotes = source ? notesBySourceId.get(source.sourceId) ?? [] : [];

    for (const note of sourceNotes) {
      const existing = disciplineMap.get(note.disciplineKey) ?? {
        nome: note.disciplineName,
        ordem: note.order,
        notas: Object.fromEntries(colunas.map((item) => [item.key, null])),
      };

      if (existing.ordem == null && note.order != null) existing.ordem = note.order;
      if (!existing.nome || existing.nome === "Disciplina") existing.nome = note.disciplineName;
      existing.notas[coluna.key] = note.score;
      disciplineMap.set(note.disciplineKey, existing);
    }
  }

  const disciplinas: CertificadoDisciplinaLinha[] = Array.from(disciplineMap.values())
    .sort((left, right) => {
      const leftOrder = left.ordem ?? Number.MAX_SAFE_INTEGER;
      const rightOrder = right.ordem ?? Number.MAX_SAFE_INTEGER;
      if (leftOrder !== rightOrder) return leftOrder - rightOrder;
      return left.nome.localeCompare(right.nome, "pt");
    })
    .map((item) => {
      const mediaFinal = buildDisciplineAverage(colunas.map((coluna) => item.notas[coluna.key]));
      return {
        nome: item.nome,
        notas: item.notas,
        media_final: mediaFinal,
        media_extenso: mediaFinal != null ? notaParaExtensoPTAO(mediaFinal) : null,
      };
    });

  const mediaFinal = normalizeOverallMedia(baseSnapshot.media_final);

  return {
    ...baseSnapshot,
    aluno_nome: clean(stringOrNull(baseSnapshot.aluno_nome)) ?? String(baseSnapshot.aluno_nome ?? ""),
    hash_validacao: hashValidacao ?? clean(stringOrNull(baseSnapshot.hash_validacao)) ?? null,
    media_final: mediaFinal,
    media_extenso:
      clean(stringOrNull(baseSnapshot.media_extenso)) ?? (mediaFinal != null ? notaParaExtensoPTAO(mediaFinal) : null),
    numero_sequencial: toNumber(baseSnapshot.numero_sequencial),
    data_emissao: clean(stringOrNull(baseSnapshot.data_emissao)) ?? new Date().toISOString().slice(0, 10),
    ciclo_designacao: getCycleLabel(currentClassNumber, clean(stringOrNull(baseSnapshot.classe_concluida))),
    colunas,
    disciplinas,
  } satisfies CertificadoSnapshot;
}
