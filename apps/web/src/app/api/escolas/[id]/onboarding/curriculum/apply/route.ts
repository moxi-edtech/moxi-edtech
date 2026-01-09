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
// 1. Tipagens
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
// Helpers de normalização
// -----------------------------
const removeAccents = (s: string) =>
  s.normalize("NFD").replace(/[\u0300-\u036f]/g, "");

const nomeNorm = (s: string) =>
  removeAccents(s).toLowerCase().trim().replace(/\s+/g, " ");


// -----------------------------
// CORE: Criação de Curso (SSOT & Idempotente)
// This function is from the original file and is used by the new POST handler.
// -----------------------------

async function findOrCreateCursoEscolaSSOT(args: {
  escolaId: string;
  presetKey: CurriculumKey;
  presetMeta: { label: string; course_code: string };
  tipo: CourseType;
  isCustom: boolean;
}) {
  const { escolaId, presetKey, presetMeta, tipo, isCustom } = args;

  // Normalização defensiva: SSOT é Uppercase sem espaços
  const code = presetMeta.course_code?.trim().toUpperCase();
  if (!code) throw new Error("Preset inválido: course_code ausente.");

  // 1) LEITURA OTIMISTA: Busca por qualquer variação do código
  // (OR ajuda a pegar dados legados onde codigo != course_code)
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

  // 2) ESCRITA CANÔNICA
  const payload = {
    escola_id: escolaId,
    nome: presetMeta.label,
    tipo,
    codigo: code,              // ✅ SSOT: codigo == course_code
    course_code: code,         // ✅ SSOT: Chave do Importador
    curriculum_key: presetKey, // ✅ Metadado técnico
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

  // 3) RACE CONDITION HANDLER (O Padrão Big Tech)
  // Se bateu na trave (23505), outro request criou milissegundos antes.
  // Em vez de explodir erro 500, recuperamos o vencedor.
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

// This is the original helper, used by the new findOrCreateClassesForCursoMap
async function findOrCreateClassesForCurso(
  escolaId: string,
  cursoId: string,
  classNames: string[]
) {
  const classesCriadas: { id: string; nome: string }[] = [];

  for (const nome of classNames) {
    // Tenta criar direto (Optimistic Lock pattern)
    const { data: created, error } = await supabaseAdmin
      .from("classes")
      .insert({ escola_id: escolaId, curso_id: cursoId, nome })
      .select("id, nome")
      .maybeSingle();

    if (created) {
      classesCriadas.push(created);
    } else if (error?.code === "23505") {
      // Já existe, busca o ID
      const { data: existing } = await supabaseAdmin
        .from("classes")
        .select("id, nome")
        .eq("escola_id", escolaId)
        .eq("curso_id", cursoId)
        .eq("nome", nome)
        .single();
      if (existing) classesCriadas.push(existing);
    } else if (error) {
        // Handle other potential errors during insert
        console.error(`[findOrCreateClassesForCurso] Error inserting class '${nome}':`, error);
        throw new Error(`Falha ao criar ou buscar a classe: ${nome}`);
    }
  }
  return classesCriadas;
}

// -----------------------------
// NEW IMPLEMENTATION from user
// -----------------------------

// 2.1) Upsert catálogo e retornar disciplina_id por nome
async function upsertDisciplinasCatalogo(escolaId: string, subjects: string[]) {
  const unique = Array.from(
    new Map(subjects.map((n) => [nomeNorm(n), n.trim()])).entries()
  ).map(([norm, raw]) => ({ norm, raw }));

  if (unique.length === 0) return new Map<string, string>();

  // Upsert em massa
  const { error } = await supabaseAdmin
    .from("disciplinas_catalogo")
    .upsert(
      unique.map((x) => ({
        escola_id: escolaId,
        nome: x.raw,
        nome_norm: x.norm,
      })),
      { onConflict: "escola_id,nome_norm", ignoreDuplicates: false }
    );

  if (error) {
    console.error("[CAT] upsert error:", error);
    throw new Error(error.message ?? "Falha ao upsert disciplinas_catalogo");
  }

  // Nem sempre o upsert retorna tudo dependendo do driver; faz um select garantido
  const norms = unique.map((x) => x.norm);
  const { data: rows, error: selErr } = await supabaseAdmin
    .from("disciplinas_catalogo")
    .select("id,nome_norm")
    .eq("escola_id", escolaId)
    .in("nome_norm", norms);

  if (selErr) {
    console.error("[CAT] select error:", selErr);
    throw new Error(selErr.message ?? "Falha ao ler disciplinas_catalogo");
  }

  const map = new Map<string, string>();
  for (const r of rows ?? []) map.set((r as any).nome_norm, (r as any).id);
  return map; // nome_norm -> disciplina_id
}

// 2.2) Upsert curso_matriz a partir da matriz do builder
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

  for (const subject of subjects) {
    const norm = nomeNorm(subject);
    const disciplinaId = disciplinaIdByNorm.get(norm);
    if (!disciplinaId) continue;

    for (const clsNome of classesByNome.keys()) {
      const cls = classesByNome.get(clsNome)!;

      const ativo = ["M", "T", "N"].some((t) => Boolean(matrix[`${subject}::${clsNome}::${t}`]));
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
    .upsert(rows, {
      onConflict: "escola_id,curso_id,classe_id,disciplina_id",
      ignoreDuplicates: false,
    });

  if (error) {
    console.error("[MATRIZ] upsert error:", error);
    throw new Error(error.message ?? "Falha ao upsert curso_matriz");
  }

  return { insertedOrUpdated: rows.length };
}

// 3) Classes do curso (precisa de ids para curso_matriz)
async function findOrCreateClassesForCursoMap(escolaId: string, cursoId: string, classNames: string[]) {
  const created = await findOrCreateClassesForCurso(escolaId, cursoId, classNames);
  const map = new Map<string, { id: string; nome: string }>();
  for (const c of created) map.set(c.nome, c);
  return map; // nome -> {id,nome}
}

// 4) Turmas e população de turma_disciplinas (sem depender de trigger)

// 4.1) Criar turmas
function turnosAtivos(turnos: { manha: boolean; tarde: boolean; noite: boolean }): ("M"|"T"|"N")[] {
  const out: ("M"|"T"|"N")[] = [];
  if (turnos.manha) out.push("M");
  if (turnos.tarde) out.push("T");
  if (turnos.noite) out.push("N");
  return out;
}

async function createTurmasPadrao(args: {
  escolaId: string;
  cursoId: string;
  classes: { id: string; nome: string }[];
  turnos: { manha: boolean; tarde: boolean; noite: boolean };
  anoLetivo: number;
}) {
  const { escolaId, cursoId, classes, turnos, anoLetivo } = args;
  const shifts = turnosAtivos(turnos);
  if (shifts.length === 0) return [];

  const inserts: any[] = [];
  for (const cls of classes) {
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

  const { data, error } = await supabaseAdmin
    .from("turmas")
    .upsert(inserts, {
      onConflict: "escola_id,curso_id,classe_id,ano_letivo,turno,nome",
      ignoreDuplicates: false,
    })
    .select("id,classe_id,turno");

  if (error) {
    console.error("[TURMAS] upsert error:", error);
    throw new Error(error.message ?? "Falha ao criar turmas");
  }

  return (data ?? []) as any[];
}

// 4.2) Popular turma_disciplinas com base na curso_matriz
async function syncTurmaDisciplinasFromMatriz(args: {
  escolaId: string;
  cursoId: string;
  turmas: { id: string; classe_id: string }[];
}) {
  const { escolaId, cursoId, turmas } = args;
  if (turmas.length === 0) return 0;

  // Busca matriz por classe
  const classeIds = Array.from(new Set(turmas.map((t) => t.classe_id)));
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
    if(!m.classe_id) continue;
    const arr = byClasse.get(m.classe_id) ?? [];
    arr.push(m.id);
    byClasse.set(m.classe_id, arr);
  }

  const inserts: any[] = [];
  for (const turma of turmas as any[]) {
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
    .upsert(inserts, {
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
// HANDLER PRINCIPAL (Refactored)
// -----------------------------

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const escolaId = params.id;
    const body = (await req.json()) as CurriculumApplyPayload;

    if (!escolaId || !body?.presetKey) {
      return NextResponse.json({ ok: false, error: "Dados inválidos" }, { status: 400 });
    }

    const presetKey = body.presetKey;
    const presetMeta = CURRICULUM_PRESETS_META[presetKey];
    if (!presetMeta?.course_code) {
      return NextResponse.json({ ok: false, error: "Preset sem course_code" }, { status: 400 });
    }

    // Fallback logic for advancedConfig
    const incoming = body.advancedConfig;
    let advancedConfig: AdvancedConfigPayload;

    if (incoming && Array.isArray(incoming.classes) && incoming.classes.length > 0) {
        advancedConfig = incoming;
    } else {
        const presetClasses = presetMeta.classes ?? [];
        const presetSubjects = Array.from(new Set(CURRICULUM_PRESETS[presetKey]?.map((d: any) => d.nome) || []));
        const defaultTurnos = { manha: true, tarde: false, noite: false };

        const defaultMatrix: Record<string, boolean> = {};
        for (const subject of presetSubjects) {
            for (const cls of presetClasses) {
                if (defaultTurnos.manha) defaultMatrix[`${subject}::${cls}::M`] = true;
                if (defaultTurnos.tarde) defaultMatrix[`${subject}::${cls}::T`] = true;
                if (defaultTurnos.noite) defaultMatrix[`${subject}::${cls}::N`] = true;
            }
        }
        
        advancedConfig = {
            classes: presetClasses,
            subjects: presetSubjects,
            matrix: defaultMatrix,
            turnos: defaultTurnos,
        };
    }

    if (!advancedConfig.classes || advancedConfig.classes.length === 0) {
        return NextResponse.json(
            { ok: false, error: "Preset sem classes default e advancedConfig ausente" },
            { status: 400 }
        );
    }

    // Curso SSOT
    const tipo = PRESET_TO_TYPE[presetKey] || "geral";
    const labelFinal = body.customData?.label?.trim() || presetMeta.label;

    const curso = await findOrCreateCursoEscolaSSOT({
      escolaId,
      presetKey,
      presetMeta: { label: labelFinal, course_code: presetMeta.course_code },
      tipo,
      isCustom: Boolean(body.customData),
    });

    // 1) Classes
    const classesMap = await findOrCreateClassesForCursoMap(
      escolaId,
      curso.id,
      advancedConfig.classes
    );

    // 2) Catálogo
    const subjects = advancedConfig.subjects ?? [];
    const discIdByNorm = await upsertDisciplinasCatalogo(escolaId, subjects);

    // 3) Matriz
    const matrizStats = await upsertCursoMatriz({
      escolaId,
      cursoId: curso.id,
      classesByNome: classesMap,
      matrix: advancedConfig.matrix ?? {},
      subjects,
      disciplinaIdByNorm: discIdByNorm,
    });

    // 4) Turmas
    const anoLetivo = new Date().getFullYear();
    const turmas = await createTurmasPadrao({
      escolaId,
      cursoId: curso.id,
      classes: Array.from(classesMap.values()),
      turnos: advancedConfig.turnos,
      anoLetivo,
    });

    // 5) Turma_disciplinas (derivada da matriz)
    const turmaDiscCount = await syncTurmaDisciplinasFromMatriz({
      escolaId,
      cursoId: curso.id,
      turmas: (turmas as any[]).map((t) => ({ id: t.id, classe_id: t.classe_id })),
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
    return NextResponse.json({ ok: false, error: e.message ?? "Erro interno" }, { status: 500 });
  }
}


