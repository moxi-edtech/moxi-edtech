import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "~types/supabase";
import {
  CURRICULUM_PRESETS_META,
  type CurriculumKey,
  CURRICULUM_PRESETS,
} from "@/lib/academico/curriculum-presets";
import { PRESET_TO_TYPE, type CourseType } from "@/lib/courseTypes";

// Cliente Admin para operações críticas
const supabaseAdmin = createClient<Database>(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// -----------------------------
// 1) Tipagens
// -----------------------------

type BuilderTurnos = {
  manha: boolean;
  tarde: boolean;
  noite: boolean;
};

type MatrixKey = string;

interface AdvancedConfigPayload {
  classes: string[];
  turnos: BuilderTurnos;
  matrix: Record<MatrixKey, boolean>;
  subjects: string[];
}

interface CustomDataPayload {
  label: string;
  associatedPreset: CurriculumKey;
  classes: string[];
  subjects: string[];
}

interface CurriculumApplyPayload {
  presetKey: CurriculumKey;
  sessionId?: string | null;
  customData?: CustomDataPayload;
  advancedConfig?: AdvancedConfigPayload;
}

// -----------------------------
// 2) Utils (SSOT)
// -----------------------------

// Normaliza para bater com o generated column:
// lower(regexp_replace(immutable_unaccent(trim(nome)), '\s+', ' ', 'g'))
function normalizeNomeNorm(s: string): string {
  return (s ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // remove acentos
    .trim()
    .replace(/\s+/g, " ") // colapsa espaços
    .toLowerCase();
}

function turnosAtivos(
  turnos: BuilderTurnos
): Array<"M" | "T" | "N"> {
  const out: Array<"M" | "T" | "N"> = [];
  if (turnos?.manha) out.push("M");
  if (turnos?.tarde) out.push("T");
  if (turnos?.noite) out.push("N");
  return out;
}

// -----------------------------
// 3) CORE: Curso SSOT (idempotente + race-safe)
// -----------------------------

async function findOrCreateCursoEscolaSSOT(args: {
  escolaId: string;
  presetKey: CurriculumKey;
  presetMeta: { label: string; course_code: string };
  tipo: CourseType;
  isCustom: boolean;
}) {
  const { escolaId, presetKey, presetMeta, tipo, isCustom } = args;

  const code = (presetMeta.course_code ?? "").trim().toUpperCase();
  if (!code) throw new Error("Preset inválido: course_code ausente.");

  const { data: existing, error: selErr } = await supabaseAdmin
    .from("cursos")
    .select("*")
    .eq("escola_id", escolaId)
    .or(`codigo.eq.${code},course_code.eq.${code}`)
    .maybeSingle();

  if (selErr) {
    console.error("[SSOT] Erro select curso:", selErr);
    throw new Error("Erro ao consultar curso (SSOT).");
  }
  if (existing) return existing;

  const payload = {
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
  } as any;

  const { data: created, error: insErr } = await supabaseAdmin
    .from("cursos")
    .insert(payload)
    .select("*")
    .single();

  if (!insErr && created) return created;

  if (insErr?.code === "23505") {
    console.warn(`[SSOT] Race condition em ${code}. Recuperando...`);
    const { data: retry, error: retryErr } = await supabaseAdmin
      .from("cursos")
      .select("*")
      .eq("escola_id", escolaId)
      .or(`codigo.eq.${code},course_code.eq.${code}`)
      .single();

    if (retryErr) throw new Error("Erro fatal de concorrência ao criar curso.");
    if (!retry) throw new Error("Falha ao recuperar curso após race condition.");
    return retry;
  }

  console.error("[SSOT] Erro insert curso:", insErr);
  throw new Error(insErr?.message || "Erro ao criar curso.");
}

// -----------------------------
// 4) Classes (idempotente)
// -----------------------------

async function findOrCreateClassesForCurso(
  escolaId: string,
  cursoId: string,
  classNames: string[]
) {
  const classesCriadas: { id: string; nome: string }[] = [];

  for (const raw of classNames ?? []) {
    const nome = (raw ?? "").trim();
    if (!nome) continue;

    const { data: created, error } = await supabaseAdmin
      .from("classes")
      .insert({ escola_id: escolaId, curso_id: cursoId, nome } as any)
      .select("id, nome")
      .maybeSingle();

    if (created) {
      classesCriadas.push(created);
      continue;
    }

    if (error?.code === "23505") {
      const { data: existing, error: selErr } = await supabaseAdmin
        .from("classes")
        .select("id, nome")
        .eq("escola_id", escolaId)
        .eq("curso_id", cursoId)
        .eq("nome", nome)
        .single();

      if (selErr) {
        console.error("[CLASSES] select existing error:", selErr);
        throw new Error(`Falha ao buscar classe existente: ${nome}`);
      }
      if (existing) classesCriadas.push(existing);
      continue;
    }

    if (error) {
      console.error(`[CLASSES] insert error (${nome}):`, error);
      throw new Error(`Falha ao criar ou buscar a classe: ${nome}`);
    }
  }

  return classesCriadas;
}

async function findOrCreateClassesForCursoMap(
  escolaId: string,
  cursoId: string,
  classNames: string[]
) {
  const created = await findOrCreateClassesForCurso(escolaId, cursoId, classNames);
  const map = new Map<string, { id: string; nome: string }>();
  for (const c of created) map.set(c.nome, c);
  return map;
}

// -----------------------------
// 5) Disciplinas (disciplinas_catalogo)
// -----------------------------

async function upsertDisciplinasCatalogo(escolaId: string, subjects: string[]) {
  const byNorm = new Map<string, string>(); // norm -> nome original
  for (const raw of subjects ?? []) {
    const nome = (raw ?? "").trim();
    if (!nome) continue;
    const norm = normalizeNomeNorm(nome);
    if (!norm) continue;
    if (!byNorm.has(norm)) byNorm.set(norm, nome);
  }

  if (byNorm.size === 0) return new Map<string, string>();

  const rows = Array.from(byNorm.entries()).map(([_, nome]) => ({
    escola_id: escolaId,
    nome,
  }));

  const { error: upErr } = await supabaseAdmin
    .from("disciplinas_catalogo")
    .upsert(rows as any, {
      onConflict: "escola_id,nome_norm",
      ignoreDuplicates: false,
    });

  if (upErr) {
    console.error("[CAT] upsert error:", {
      message: upErr.message,
      code: upErr.code,
      details: upErr.details,
      hint: upErr.hint,
    });
    throw new Error(upErr.message ?? "Falha ao upsert disciplinas_catalogo");
  }

  const norms = Array.from(byNorm.keys());

  const { data: got, error: selErr } = await supabaseAdmin
    .from("disciplinas_catalogo")
    .select("id, nome_norm")
    .eq("escola_id", escolaId)
    .in("nome_norm", norms);

  if (selErr) {
    console.error("[CAT] select error:", selErr);
    throw new Error(selErr.message ?? "Falha ao ler disciplinas_catalogo");
  }

  const idByNorm = new Map<string, string>();
  for (const row of got ?? []) {
    if (row?.nome_norm && row?.id) idByNorm.set(row.nome_norm, row.id);
  }

  if (idByNorm.size !== byNorm.size) {
    console.warn("[CAT] mismatch norm count", {
      expected: byNorm.size,
      got: idByNorm.size,
      missing: norms.filter((n) => !idByNorm.has(n)),
    });
  }

  return idByNorm;
}

// -----------------------------
// 6) Matriz (curso_matriz)
// -----------------------------

async function upsertCursoMatriz(args: {
  escolaId: string;
  cursoId: string;
  classesByNome: Map<string, { id: string; nome: string }>;
  matrix: Record<string, boolean>;
  subjects: string[];
  disciplinaIdByNorm: Map<string, string>;
}) {
  const { escolaId, cursoId, classesByNome, matrix, subjects, disciplinaIdByNorm } = args;

  const rows: any[] = [];
  let ordem = 1;

  // A matriz do builder usa subject raw no key: `${subject}::${cls}::${T}`
  // Então a gente usa subject raw pra leitura do matrix, mas norm pra achar disciplina_id.
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

      rows.push({
        escola_id: escolaId,
        curso_id: cursoId,
        classe_id: cls.id,
        disciplina_id: disciplinaId,
        carga_horaria: null,
        obrigatoria: true,
        ordem: ordem++,
        ativo: true,
      });
    }
  }

  if (rows.length === 0) return { insertedOrUpdated: 0 };

  const { error } = await supabaseAdmin
    .from("curso_matriz")
    .upsert(rows as any, {
      onConflict: "escola_id,curso_id,classe_id,disciplina_id",
      ignoreDuplicates: false,
    });

  if (error) {
    console.error("[MATRIZ] upsert error:", error);
    throw new Error(error.message ?? "Falha ao upsert curso_matriz");
  }

  return { insertedOrUpdated: rows.length };
}

// -----------------------------
// 7) Turmas (turmas) + vínculo (turma_disciplinas)
// -----------------------------

async function createTurmasPadrao(args: {
  escolaId: string;
  cursoId: string;
  classes: { id: string; nome: string }[];
  turnos: BuilderTurnos;
  anoLetivo: number;
}) {
  const { escolaId, cursoId, classes, turnos, anoLetivo } = args;
  const shifts = turnosAtivos(turnos);
  if (shifts.length === 0) return [];

  const inserts: any[] = [];
  for (const cls of classes ?? []) {
    if (!cls?.id) continue;
    for (const turno of shifts) {
      inserts.push({
        escola_id: escolaId,
        curso_id: cursoId,
        classe_id: cls.id,
        ano_letivo: anoLetivo,
        nome: "A",
        turno, // ✅ "M" | "T" | "N"
        capacidade_maxima: 35,
        status_validacao: "ativo",
      });
    }
  }

  if (inserts.length === 0) return [];

  const { data, error } = await supabaseAdmin
    .from("turmas")
    .upsert(inserts as any, {
      onConflict: "escola_id,curso_id,classe_id,ano_letivo,nome,turno",
      ignoreDuplicates: false,
    })
    .select("id,classe_id");

  if (error) {
    console.error("[TURMAS] upsert error:", error);
    throw new Error(error.message ?? "Falha ao criar turmas");
  }

  return (data ?? []) as Array<{ id: string; classe_id: string }>;
}

async function syncTurmaDisciplinasFromMatriz(args: {
  escolaId: string;
  cursoId: string;
  turmas: Array<{ id: string; classe_id: string }>;
}) {
  const { escolaId, cursoId, turmas } = args;
  if (!turmas?.length) return 0;

  const classeIds = Array.from(new Set(turmas.map((t) => t.classe_id).filter(Boolean)));

  const { data: matriz, error } = await supabaseAdmin
    .from("curso_matriz")
    .select("id,classe_id")
    .eq("escola_id", escolaId)
    .eq("curso_id", cursoId)
    .in("classe_id", classeIds)
    .eq("ativo", true);

  if (error) {
    console.error("[TD] select matriz error:", error);
    throw new Error(error.message ?? "Falha ao ler curso_matriz");
  }

  const byClasse = new Map<string, string[]>();
  for (const m of (matriz ?? []) as any[]) {
    if (!m?.classe_id || !m?.id) continue;
    const arr = byClasse.get(m.classe_id) ?? [];
    arr.push(m.id);
    byClasse.set(m.classe_id, arr);
  }

  const inserts: any[] = [];
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

  const { error: upErr } = await supabaseAdmin
    .from("turma_disciplinas")
    .upsert(inserts as any, {
      onConflict: "escola_id,turma_id,curso_matriz_id",
      ignoreDuplicates: true,
    });

  if (upErr) {
    console.error("[TD] upsert error:", upErr);
    throw new Error(upErr.message ?? "Falha ao upsert turma_disciplinas");
  }

  return inserts.length;
}

// -----------------------------
// 8) Handler principal
// Next 15: params podem ser async -> await ctx.params
// -----------------------------

export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  try {
    const { id: escolaId } = await ctx.params;
    const body = (await req.json()) as CurriculumApplyPayload;

    if (!escolaId || !body?.presetKey) {
      return NextResponse.json({ ok: false, error: "Dados inválidos" }, { status: 400 });
    }

    const presetKey = body.presetKey;
    const presetMeta = CURRICULUM_PRESETS_META[presetKey];

    if (!presetMeta?.course_code) {
      return NextResponse.json({ ok: false, error: "Preset sem course_code" }, { status: 400 });
    }

    // Fallback robusto do advancedConfig (para quick install do marketplace)
    const incoming = body.advancedConfig;
    let advancedConfig: AdvancedConfigPayload;

    if (
      incoming &&
      Array.isArray(incoming.classes) &&
      incoming.classes.length > 0 &&
      Array.isArray(incoming.subjects) &&
      incoming.subjects.length > 0 &&
      incoming.turnos
    ) {
      advancedConfig = incoming as AdvancedConfigPayload;
    } else {
      const presetClasses = (presetMeta.classes ?? []).filter(Boolean);

      const presetSubjects = Array.from(
        new Set((CURRICULUM_PRESETS[presetKey] ?? []).map((d: any) => String(d?.nome ?? "").trim()).filter(Boolean))
      );

      const defaultTurnos: BuilderTurnos = { manha: true, tarde: false, noite: false };

      const defaultMatrix: Record<string, boolean> = {};
      for (const subject of presetSubjects) {
        for (const cls of presetClasses) {
          // default liga só manhã
          defaultMatrix[`${subject}::${cls}::M`] = true;
        }
      }

      advancedConfig = {
        classes: presetClasses,
        subjects: presetSubjects,
        matrix: defaultMatrix,
        turnos: defaultTurnos,
      };
    }

    if (!advancedConfig.classes?.length) {
      return NextResponse.json(
        { ok: false, error: "Sem classes para instalar (preset/advancedConfig vazio)" },
        { status: 400 }
      );
    }

    if (!advancedConfig.subjects?.length) {
      return NextResponse.json(
        { ok: false, error: "Sem disciplinas para instalar (preset/advancedConfig vazio)" },
        { status: 400 }
      );
    }

    // 1) Curso SSOT
    const tipo = PRESET_TO_TYPE[presetKey] || "geral";
    const labelFinal = body.customData?.label?.trim() || presetMeta.label;

    const curso = await findOrCreateCursoEscolaSSOT({
      escolaId,
      presetKey,
      presetMeta: { label: labelFinal, course_code: presetMeta.course_code },
      tipo,
      isCustom: Boolean(body.customData),
    });

    // 2) Classes
    const classesMap = await findOrCreateClassesForCursoMap(
      escolaId,
      curso.id,
      advancedConfig.classes
    );

    // 3) Catálogo
    const discIdByNorm = await upsertDisciplinasCatalogo(
      escolaId,
      advancedConfig.subjects
    );

    // 4) Matriz
    const matrizStats = await upsertCursoMatriz({
      escolaId,
      cursoId: curso.id,
      classesByNome: classesMap,
      matrix: advancedConfig.matrix ?? {},
      subjects: advancedConfig.subjects ?? [],
      disciplinaIdByNorm: discIdByNorm,
    });

    // 5) Turmas
    const anoLetivo = new Date().getFullYear();
    const turmas = await createTurmasPadrao({
      escolaId,
      cursoId: curso.id,
      classes: Array.from(classesMap.values()),
      turnos: advancedConfig.turnos,
      anoLetivo,
    });

    // 6) turma_disciplinas
    const turmaDiscCount = await syncTurmaDisciplinasFromMatriz({
      escolaId,
      cursoId: curso.id,
      turmas,
    });

    return NextResponse.json({
      ok: true,
      curso: { id: curso.id, nome: curso.nome, course_code: curso.course_code },
      stats: {
        catalogo_upserted: discIdByNorm.size,
        matriz_rows: matrizStats.insertedOrUpdated,
        turmas: turmas.length,
        turma_disciplinas: turmaDiscCount,
      },
    });
  } catch (e: any) {
    console.error("[INSTALL] fatal:", e);
    return NextResponse.json(
      { ok: false, error: e?.message ?? "Erro interno" },
      { status: 500 }
    );
  }
}