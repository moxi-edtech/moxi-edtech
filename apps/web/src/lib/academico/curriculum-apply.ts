import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "~types/supabase";
import {
  CURRICULUM_PRESETS_META,
  type CurriculumKey,
} from "@/lib/academico/curriculum-presets";
import { PRESET_TO_TYPE, type CourseType } from "@/lib/courseTypes";

type TableRow<Name extends keyof Database["public"]["Tables"]> =
  Database["public"]["Tables"][Name]["Row"];
type TableInsert<Name extends keyof Database["public"]["Tables"]> =
  Database["public"]["Tables"][Name]["Insert"];

export type BuilderTurnos = {
  manha: boolean;
  tarde: boolean;
  noite: boolean;
};

export type { CurriculumKey };

type MatrixKey = string;

export interface AdvancedConfigPayload {
  classes: string[];
  turnos: BuilderTurnos;
  matrix: Record<MatrixKey, boolean>;
  subjects: string[];
  cargaByClass?: Record<string, number>;
}

export interface CustomDataPayload {
  label: string;
  associatedPreset: CurriculumKey;
  classes: string[];
  subjects: string[];
}

export interface CurriculumApplyPayload {
  presetKey: CurriculumKey;
  sessionId?: string | null;
  customData?: CustomDataPayload;
  advancedConfig?: AdvancedConfigPayload;
}

export type ApplyCurriculumOptions = {
  supabase: SupabaseClient<Database>;
  escolaId: string;
  presetKey: CurriculumKey;
  customData?: CustomDataPayload;
  advancedConfig?: AdvancedConfigPayload;
  createTurmas?: boolean;
  anoLetivo?: number;
  createCurriculo?: boolean;
  anoLetivoId?: string | null;
};

export type ApplyCurriculumResult = {
  curso: { id: string; nome: string; course_code: string | null };
  stats: {
    catalogo_upserted: number;
    matriz_rows: number;
    turmas: number;
    turma_disciplinas: number;
  };
  counts: {
    classes: number;
    subjects: number;
  };
  curriculo?: { id: string; version: number; status: string } | null;
};

const normalizeNomeNorm = (value: string): string =>
  (value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .replace(/\s+/g, " ")
    .toLowerCase();

const turnosAtivos = (turnos: BuilderTurnos): Array<"M" | "T" | "N"> => {
  const out: Array<"M" | "T" | "N"> = [];
  if (turnos?.manha) out.push("M");
  if (turnos?.tarde) out.push("T");
  if (turnos?.noite) out.push("N");
  return out;
};

async function findOrCreateCursoEscolaSSOT(args: {
  supabase: SupabaseClient<Database>;
  escolaId: string;
  presetKey: CurriculumKey;
  presetMeta: { label: string; course_code: string };
  tipo: CourseType;
  isCustom: boolean;
}) {
  const { supabase, escolaId, presetKey, presetMeta, tipo, isCustom } = args;

  const code = (presetMeta.course_code ?? "").trim().toUpperCase();
  if (!code) throw new Error("Preset inválido: course_code ausente.");

  const { data: existing, error: selErr } = await supabase
    .from("cursos")
    .select("*")
    .eq("escola_id", escolaId)
    .or(`codigo.eq.${code},course_code.eq.${code}`)
    .maybeSingle();

  if (selErr) throw new Error("Erro ao consultar curso (SSOT).");
  if (existing) return existing as TableRow<"cursos">;

  const payload: TableInsert<"cursos"> = {
    escola_id: escolaId,
    nome: presetMeta.label,
    tipo,
    codigo: code,
    course_code: code,
    curriculum_key: presetKey,
    status_aprovacao: "aprovado",
    is_custom: isCustom,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  const { data: created, error: insErr } = await supabase
    .from("cursos")
    .insert(payload)
    .select("*")
    .single();

  if (!insErr && created) return created as TableRow<"cursos">;

  if (insErr?.code === "23505") {
    const { data: retry, error: retryErr } = await supabase
      .from("cursos")
      .select("*")
      .eq("escola_id", escolaId)
      .or(`codigo.eq.${code},course_code.eq.${code}`)
      .single();

    if (retryErr) throw new Error("Erro fatal de concorrência ao criar curso.");
    if (!retry) throw new Error("Falha ao recuperar curso após race condition.");
    return retry as TableRow<"cursos">;
  }

  throw new Error(insErr?.message || "Erro ao criar curso.");
}

async function findOrCreateClassesForCurso(
  supabase: SupabaseClient<Database>,
  escolaId: string,
  cursoId: string,
  classNames: string[]
) {
  const classesCriadas: { id: string; nome: string }[] = [];

  for (const raw of classNames ?? []) {
    const nome = (raw ?? "").trim();
    if (!nome) continue;

    const insertPayload: TableInsert<"classes"> = { escola_id: escolaId, curso_id: cursoId, nome };

    const { data: created, error } = await supabase
      .from("classes")
      .insert(insertPayload)
      .select("id, nome")
      .maybeSingle();

    if (created) {
      classesCriadas.push(created as TableRow<"classes">);
      continue;
    }

    if (error?.code === "23505") {
      const { data: existing, error: selErr } = await supabase
        .from("classes")
        .select("id, nome")
        .eq("escola_id", escolaId)
        .eq("curso_id", cursoId)
        .eq("nome", nome)
        .single();

      if (selErr) throw new Error(`Falha ao buscar classe existente: ${nome}`);
      if (existing) classesCriadas.push(existing as TableRow<"classes">);
      continue;
    }

    if (error) throw new Error(`Falha ao criar ou buscar a classe: ${nome}`);
  }

  return classesCriadas;
}

async function findOrCreateClassesForCursoMap(
  supabase: SupabaseClient<Database>,
  escolaId: string,
  cursoId: string,
  classNames: string[]
) {
  const created = await findOrCreateClassesForCurso(
    supabase,
    escolaId,
    cursoId,
    classNames
  );
  const map = new Map<string, { id: string; nome: string }>();
  for (const c of created) map.set(c.nome, c);
  return map;
}

async function upsertDisciplinasCatalogo(
  supabase: SupabaseClient<Database>,
  escolaId: string,
  subjects: string[]
) {
  const byNorm = new Map<string, string>();
  for (const raw of subjects ?? []) {
    const nome = (raw ?? "").trim();
    if (!nome) continue;
    const norm = normalizeNomeNorm(nome);
    if (!norm) continue;
    if (!byNorm.has(norm)) byNorm.set(norm, nome);
  }

  if (byNorm.size === 0) return new Map<string, string>();

  const rows: TableInsert<"disciplinas_catalogo">[] = Array.from(byNorm.entries()).map(
    ([_, nome]) => ({
      escola_id: escolaId,
      nome,
    })
  );

  const { error: upErr } = await supabase
    .from("disciplinas_catalogo")
    .upsert(rows, {
      onConflict: "escola_id,nome_norm",
      ignoreDuplicates: false,
    });

  if (upErr) throw new Error(upErr.message ?? "Falha ao upsert disciplinas_catalogo");

  const norms = Array.from(byNorm.keys());

  const { data: got, error: selErr } = await supabase
    .from("disciplinas_catalogo")
    .select("id, nome_norm")
    .eq("escola_id", escolaId)
    .in("nome_norm", norms);

  if (selErr) throw new Error(selErr.message ?? "Falha ao ler disciplinas_catalogo");

  const idByNorm = new Map<string, string>();
  for (const row of got ?? []) {
    if (row?.nome_norm && row?.id) idByNorm.set(row.nome_norm, row.id);
  }

  return idByNorm;
}

async function upsertCursoMatriz(args: {
  supabase: SupabaseClient<Database>;
  escolaId: string;
  cursoId: string;
  classesByNome: Map<string, { id: string; nome: string }>;
  matrix: Record<string, boolean>;
  subjects: string[];
  disciplinaIdByNorm: Map<string, string>;
  presetSubjectIdByKey?: Map<string, string>;
  cursoCurriculoIdByClasse?: Map<string, string> | null;
  cargaByClass?: Record<string, number>;
}) {
  const {
    supabase,
    escolaId,
    cursoId,
    classesByNome,
    matrix,
    subjects,
    disciplinaIdByNorm,
    presetSubjectIdByKey,
    cursoCurriculoIdByClasse,
    cargaByClass,
  } = args;

  const rows: TableInsert<"curso_matriz">[] = [];
  let ordem = 1;

  for (const subjectRaw of subjects ?? []) {
    const subject = (subjectRaw ?? "").trim();
    if (!subject) continue;

    const norm = normalizeNomeNorm(subject);
    const disciplinaId = disciplinaIdByNorm.get(norm);
    if (!disciplinaId) continue;

    for (const clsNome of classesByNome.keys()) {
      const cls = classesByNome.get(clsNome);
      if (!cls?.id) continue;

      const ativo = (["M", "T", "N"] as const).some((t) =>
        Boolean(matrix?.[`${subject}::${clsNome}::${t}`])
      );

      if (!ativo) continue;

      const cargaKey = `${subject}::${clsNome}`;
      const cargaSemanal =
        cargaByClass?.[cargaKey] ??
        cargaByClass?.[
          `${normalizeNomeNorm(subject)}::${normalizeNomeNorm(clsNome)}`
        ];
      let presetSubjectId: string | null = null;
      if (presetSubjectIdByKey && presetSubjectIdByKey.size > 0) {
        const presetKey = `${normalizeNomeNorm(subject)}::${normalizeNomeNorm(clsNome)}`;
        presetSubjectId = presetSubjectIdByKey.get(presetKey) ?? null;
        if (!presetSubjectId) {
          throw new Error(
            `Disciplina fora do preset: ${subject} (${clsNome}).`
          );
        }
      }
      const curriculoId = cursoCurriculoIdByClasse?.get(cls.id) ?? null;

      rows.push({
        escola_id: escolaId,
        curso_id: cursoId,
        curso_curriculo_id: curriculoId,
        classe_id: cls.id,
        disciplina_id: disciplinaId,
        preset_subject_id: presetSubjectId,
        carga_horaria: null,
        carga_horaria_semanal: Number.isFinite(cargaSemanal)
          ? Number(cargaSemanal)
          : null,
        obrigatoria: true,
        classificacao: "core",
        ordem: ordem++,
        ativo: true,
        periodos_ativos: [1, 2, 3],
        entra_no_horario: true,
        avaliacao_mode: "inherit_school",
        status_completude: "incompleto",
      });
    }
  }

  if (rows.length === 0) return { insertedOrUpdated: 0 };

  const onConflict = cursoCurriculoIdByClasse && cursoCurriculoIdByClasse.size > 0
    ? "escola_id,curso_curriculo_id,classe_id,disciplina_id"
    : "escola_id,curso_id,classe_id,disciplina_id";

  const { error } = await supabase
    .from("curso_matriz")
    .upsert(rows, {
      onConflict,
      ignoreDuplicates: false,
    });

  if (error) throw new Error(error.message ?? "Falha ao upsert curso_matriz");

  return { insertedOrUpdated: rows.length };
}

async function createTurmasPadrao(args: {
  supabase: SupabaseClient<Database>;
  escolaId: string;
  cursoId: string;
  classes: { id: string; nome: string }[];
  turnos: BuilderTurnos;
  anoLetivo: number;
}) {
  const { supabase, escolaId, cursoId, classes, turnos, anoLetivo } = args;
  const shifts = turnosAtivos(turnos);
  if (shifts.length === 0) return [];

  const inserts: TableInsert<"turmas">[] = [];
  for (const cls of classes ?? []) {
    if (!cls?.id) continue;
    for (const turno of shifts) {
      inserts.push({
        escola_id: escolaId,
        curso_id: cursoId,
        classe_id: cls.id,
        ano_letivo: anoLetivo,
        nome: "A",
        turno,
        capacidade_maxima: 35,
        status_validacao: "ativo",
      });
    }
  }

  if (inserts.length === 0) return [];

  const { data, error } = await supabase
    .from("turmas")
    .upsert(inserts, {
      onConflict: "escola_id,curso_id,classe_id,ano_letivo,nome,turno",
      ignoreDuplicates: false,
    })
    .select("id,classe_id");

  if (error) throw new Error(error.message ?? "Falha ao criar turmas");

  return (data ?? []) as Array<{ id: string; classe_id: string }>;
}

async function syncTurmaDisciplinasFromMatriz(args: {
  supabase: SupabaseClient<Database>;
  escolaId: string;
  cursoId: string;
  turmas: Array<{ id: string; classe_id: string }>;
}) {
  const { supabase, escolaId, cursoId, turmas } = args;
  if (!turmas?.length) return 0;

  const classeIds = Array.from(new Set(turmas.map((t) => t.classe_id).filter(Boolean)));

  const { data: matriz, error } = await supabase
    .from("curso_matriz")
    .select("id,classe_id")
    .eq("escola_id", escolaId)
    .eq("curso_id", cursoId)
    .in("classe_id", classeIds)
    .eq("ativo", true);

  if (error) throw new Error(error.message ?? "Falha ao ler curso_matriz");

  const byClasse = new Map<string, string[]>();
  for (const m of (matriz ?? []) as Array<{ id?: string | null; classe_id?: string | null }>) {
    if (!m?.classe_id || !m?.id) continue;
    const arr = byClasse.get(m.classe_id) ?? [];
    arr.push(m.id);
    byClasse.set(m.classe_id, arr);
  }

  const inserts: TableInsert<"turma_disciplinas">[] = [];
  for (const turma of turmas) {
    const matrizIds = byClasse.get(turma.classe_id) ?? [];
    for (const cursoMatrizId of matrizIds) {
      inserts.push({
        escola_id: escolaId,
        turma_id: turma.id,
        curso_matriz_id: cursoMatrizId,
        professor_id: null,
      });
    }
  }

  if (inserts.length === 0) return 0;

  const { error: upErr } = await supabase
    .from("turma_disciplinas")
    .upsert(inserts, {
      onConflict: "escola_id,turma_id,curso_matriz_id",
      ignoreDuplicates: true,
    });

  if (upErr) throw new Error(upErr.message ?? "Falha ao upsert turma_disciplinas");

  return inserts.length;
}

async function createCurriculoDraft(args: {
  supabase: SupabaseClient<Database>;
  escolaId: string;
  cursoId: string;
  anoLetivoId: string;
  classeIds: string[];
}) {
  const { supabase, escolaId, cursoId, anoLetivoId, classeIds } = args;

  const { data: last } = await supabase
    .from("curso_curriculos")
    .select("version")
    .eq("escola_id", escolaId)
    .eq("curso_id", cursoId)
    .eq("ano_letivo_id", anoLetivoId)
    .order("version", { ascending: false })
    .limit(1)
    .maybeSingle();

  let nextVersion = (last?.version ?? 0) + 1;

  for (let attempt = 0; attempt < 2; attempt += 1) {
    const payload: Database["public"]["Tables"]["curso_curriculos"]["Insert"][] = classeIds.map(
      (classeId) => ({
        escola_id: escolaId,
        curso_id: cursoId,
        ano_letivo_id: anoLetivoId,
        version: nextVersion,
        status: "draft",
        classe_id: classeId,
      })
    )

    const { data: curriculos, error } = await supabase
      .from("curso_curriculos")
      .insert(payload)
      .select("id, version, status, classe_id");

    if (!error && curriculos && curriculos.length > 0) {
      const { data: published } = await supabase
        .from("curso_curriculos")
        .select("id, classe_id")
        .eq("escola_id", escolaId)
        .eq("curso_id", cursoId)
        .eq("ano_letivo_id", anoLetivoId)
        .eq("status", "published")
        .order("version", { ascending: false });

      if (published && published.length > 0) {
        for (const publishedRow of published) {
          const targetDraft = curriculos.find(
            (draft) => draft.classe_id === publishedRow.classe_id
          );
          if (!targetDraft) continue;
          const { data: matrizRows } = await (supabase as any)
            .from("curso_matriz")
            .select(
              "escola_id, curso_id, classe_id, disciplina_id, carga_horaria, obrigatoria, ordem, ativo, carga_horaria_semanal, classificacao, periodos_ativos, entra_no_horario, avaliacao_mode, avaliacao_modelo_id, avaliacao_disciplina_id, status_completude, status_horario, status_avaliacao"
            )
            .eq("escola_id", escolaId)
            .eq("curso_curriculo_id", publishedRow.id)
            .eq("classe_id", publishedRow.classe_id);

          if (matrizRows && matrizRows.length > 0) {
            const inserts = matrizRows.map((row: any) => ({
              ...row,
              curso_curriculo_id: targetDraft.id,
            }));

            await (supabase as any)
              .from("curso_matriz")
              .insert(inserts, {
                onConflict: "escola_id,curso_id,classe_id,disciplina_id,curso_curriculo_id",
              });
          }
        }
      }

      const byClasse = new Map<string, string>();
      for (const row of curriculos) {
        if (row.classe_id) byClasse.set(row.classe_id, row.id);
      }
      return {
        curriculo: curriculos[0] as TableRow<"curso_curriculos">,
        byClasse,
      };
    }

    if (error?.code === "23505") {
      const { data: retryLast } = await supabase
        .from("curso_curriculos")
        .select("version")
        .eq("escola_id", escolaId)
        .eq("curso_id", cursoId)
        .eq("ano_letivo_id", anoLetivoId)
        .order("version", { ascending: false })
        .limit(1)
        .maybeSingle();
      nextVersion = (retryLast?.version ?? nextVersion) + 1;
      continue;
    }

    throw new Error(error?.message || "Falha ao criar currículo.");
  }

  throw new Error("Falha ao criar currículo.");
}

function buildCargaByClassFromPreset(
  presetSubjects: Array<{ name: string; gradeLevel: string; weeklyHours: number }>,
  allowedClasses?: string[],
  allowedSubjects?: string[]
): Record<string, number> {
  const classSet = new Set((allowedClasses ?? []).map((cls) => String(cls).trim()));
  const subjectSet = new Set((allowedSubjects ?? []).map((subj) => String(subj).trim()));
  const hasClassFilter = classSet.size > 0;
  const hasSubjectFilter = subjectSet.size > 0;
  const cargaByClass: Record<string, number> = {};

  presetSubjects.forEach((disciplina) => {
    const nome = String(disciplina?.name ?? "").trim();
    const classe = String(disciplina?.gradeLevel ?? "").trim();
    if (!nome || !classe) return;
    if (hasClassFilter && !classSet.has(classe)) return;
    if (hasSubjectFilter && !subjectSet.has(nome)) return;
    if (Number.isFinite(disciplina?.weeklyHours)) {
      const value = Number(disciplina.weeklyHours);
      cargaByClass[`${nome}::${classe}`] = value;
      cargaByClass[
        `${normalizeNomeNorm(nome)}::${normalizeNomeNorm(classe)}`
      ] = value;
    }
  });

  return cargaByClass;
}

async function loadPresetSubjects(args: {
  supabase: SupabaseClient<Database>;
  escolaId: string;
  presetKey: CurriculumKey;
}) {
  const { supabase, escolaId, presetKey } = args;
  const { data: presetRows, error: presetErr } = await (supabase as any)
    .from("curriculum_preset_subjects")
    .select("id, name, grade_level, weekly_hours")
    .eq("preset_id", presetKey);

  if (presetErr) throw new Error(presetErr.message || "Falha ao carregar presets.");

  const presetIds = (presetRows || []).map((row: any) => row.id).filter(Boolean);
  if (presetIds.length === 0) {
    throw new Error("Preset sem disciplinas cadastradas.");
  }

  let schoolMap = new Map<string, any>();
  const { data: schoolRows, error: schoolErr } = await (supabase as any)
    .from("school_subjects")
    .select("preset_subject_id, custom_weekly_hours, custom_name, is_active")
    .eq("escola_id", escolaId)
    .in("preset_subject_id", presetIds);

  if (schoolErr) throw new Error(schoolErr.message || "Falha ao carregar disciplinas da escola.");
  schoolMap = new Map((schoolRows || []).map((row: any) => [row.preset_subject_id, row]));

  return (presetRows || [])
    .map((row: any) => {
      const override = schoolMap.get(row.id);
      if (override?.is_active === false) return null;
      return {
        id: row.id,
        name: String(override?.custom_name ?? row.name ?? "").trim(),
        gradeLevel: String(row.grade_level ?? "").trim(),
        weeklyHours: Number(override?.custom_weekly_hours ?? row.weekly_hours ?? 0),
      };
    })
    .filter((row: any) => row && row.name && row.gradeLevel);
}

function buildDefaultAdvancedConfig(presetSubjects: Array<{ name: string; gradeLevel: string; weeklyHours: number }>) {
  const presetClasses = Array.from(new Set(presetSubjects.map((row) => row.gradeLevel))).filter(Boolean);
  const presetSubjectsUnique = Array.from(
    new Set(presetSubjects.map((row) => row.name).filter(Boolean))
  );
  const cargaByClass = buildCargaByClassFromPreset(
    presetSubjects,
    presetClasses,
    presetSubjectsUnique
  );

  const defaultTurnos: BuilderTurnos = { manha: true, tarde: false, noite: false };
  const defaultMatrix: Record<string, boolean> = {};

  for (const subject of presetSubjectsUnique) {
    for (const cls of presetClasses) {
      defaultMatrix[`${subject}::${cls}::M`] = true;
    }
  }

  return {
    classes: presetClasses,
    subjects: presetSubjectsUnique,
    matrix: defaultMatrix,
    turnos: defaultTurnos,
    cargaByClass,
  } as AdvancedConfigPayload;
}

function resolveAdvancedConfig(
  payload: CurriculumApplyPayload,
  presetSubjects: Array<{ name: string; gradeLevel: string; weeklyHours: number }>
) {
  const incoming = payload.advancedConfig;

  if (
    incoming &&
    Array.isArray(incoming.classes) &&
    incoming.classes.length > 0 &&
    Array.isArray(incoming.subjects) &&
    incoming.subjects.length > 0 &&
    incoming.turnos
  ) {
    const hasCargaByClass =
      incoming.cargaByClass && Object.keys(incoming.cargaByClass).length > 0;
    return {
      ...(incoming as AdvancedConfigPayload),
      cargaByClass: hasCargaByClass
        ? incoming.cargaByClass
        : buildCargaByClassFromPreset(
            presetSubjects,
            incoming.classes,
            incoming.subjects
          ),
    };
  }

  return buildDefaultAdvancedConfig(presetSubjects);
}

export async function applyCurriculumPreset(
  options: ApplyCurriculumOptions
): Promise<ApplyCurriculumResult> {
  const {
    supabase,
    escolaId,
    presetKey,
    customData,
    advancedConfig: advancedConfigInput,
    createTurmas = true,
    anoLetivo = new Date().getFullYear(),
    createCurriculo = false,
    anoLetivoId,
  } = options;

  const presetMeta = CURRICULUM_PRESETS_META[presetKey];

  const { data: presetCatalog } = await (supabase as any)
    .from("curriculum_presets")
    .select("name, course_code")
    .eq("id", presetKey)
    .maybeSingle();

  const courseCode = presetCatalog?.course_code ?? presetMeta?.course_code;
  if (!courseCode) {
    throw new Error("Preset sem course_code");
  }

  const presetSubjects = await loadPresetSubjects({ supabase, escolaId, presetKey });
  const presetSubjectIdByKey = new Map<string, string>();

  for (const subject of presetSubjects) {
    if (!subject?.id) continue;
    const key = `${normalizeNomeNorm(subject.name)}::${normalizeNomeNorm(subject.gradeLevel)}`;
    presetSubjectIdByKey.set(key, subject.id);
  }

  const advancedConfig = resolveAdvancedConfig(
    { presetKey, customData, advancedConfig: advancedConfigInput },
    presetSubjects
  );

  if (!advancedConfig.classes?.length) {
    throw new Error("Sem classes para instalar (preset/advancedConfig vazio)");
  }
  if (!advancedConfig.subjects?.length) {
    throw new Error("Sem disciplinas para instalar (preset/advancedConfig vazio)");
  }

  const tipo = PRESET_TO_TYPE[presetKey] || "geral";
  const labelFinal =
    customData?.label?.trim() || presetCatalog?.name?.trim() || presetMeta.label;

  const curso = await findOrCreateCursoEscolaSSOT({
    supabase,
    escolaId,
    presetKey,
    presetMeta: { label: labelFinal, course_code: courseCode },
    tipo,
    isCustom: Boolean(customData),
  });

  const classesMap = await findOrCreateClassesForCursoMap(
    supabase,
    escolaId,
    curso.id,
    advancedConfig.classes
  );

  let curriculo: ApplyCurriculumResult["curriculo"] = null;
  let curriculoByClasse: Map<string, string> | null = null;
  if (createCurriculo) {
    if (!anoLetivoId) throw new Error("Ano letivo é obrigatório para currículo.");
    const classeIds = Array.from(classesMap.values())
      .map((cls) => cls.id)
      .filter(Boolean);
    if (classeIds.length === 0) {
      throw new Error("Sem classes para criar currículo.");
    }
    const curriculoDraft = await createCurriculoDraft({
      supabase,
      escolaId,
      cursoId: curso.id,
      anoLetivoId,
      classeIds,
    });
    curriculo = curriculoDraft.curriculo;
    curriculoByClasse = curriculoDraft.byClasse;
  }

  const discIdByNorm = await upsertDisciplinasCatalogo(
    supabase,
    escolaId,
    advancedConfig.subjects
  );

  const matrizStats = await upsertCursoMatriz({
    supabase,
    escolaId,
    cursoId: curso.id,
    classesByNome: classesMap,
    matrix: advancedConfig.matrix ?? {},
    subjects: advancedConfig.subjects ?? [],
    disciplinaIdByNorm: discIdByNorm,
    presetSubjectIdByKey,
    cursoCurriculoIdByClasse: curriculoByClasse,
    cargaByClass: advancedConfig.cargaByClass ?? undefined,
  });

  let turmas: Array<{ id: string; classe_id: string }> = [];
  let turmaDiscCount = 0;

  if (createTurmas) {
    turmas = await createTurmasPadrao({
      supabase,
      escolaId,
      cursoId: curso.id,
      classes: Array.from(classesMap.values()),
      turnos: advancedConfig.turnos,
      anoLetivo,
    });

    turmaDiscCount = await syncTurmaDisciplinasFromMatriz({
      supabase,
      escolaId,
      cursoId: curso.id,
      turmas,
    });
  }

  return {
    curso: {
      id: curso.id,
      nome: curso.nome,
      course_code: curso.course_code ?? null,
    },
    stats: {
      catalogo_upserted: discIdByNorm.size,
      matriz_rows: matrizStats.insertedOrUpdated,
      turmas: turmas.length,
      turma_disciplinas: turmaDiscCount,
    },
    counts: {
      classes: advancedConfig.classes.length,
      subjects: advancedConfig.subjects.length,
    },
    curriculo,
  };
}
