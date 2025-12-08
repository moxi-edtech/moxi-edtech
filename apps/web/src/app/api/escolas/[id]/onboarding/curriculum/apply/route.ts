import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "~types/supabase";
import {
  CURRICULUM_PRESETS_META,
  type CurriculumKey,
} from "@/lib/onboarding";
import { PRESET_TO_TYPE, type CourseType } from "@/lib/courseTypes";

const supabaseAdmin = createClient<Database>(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// -----------------------------
// Tipagens alinhadas ao Builder
// -----------------------------

type BuilderTurnos = {
  manha: boolean;
  tarde: boolean;
  noite: boolean;
};

type MatrixKey = string; // "Disciplina::10ª::M"

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
  presetKey: CurriculumKey;           // SEMPRE a base oficial (para custom = associatedPreset)
  sessionId?: string | null;
  customData?: CustomDataPayload;
  advancedConfig: AdvancedConfigPayload;
}

// -----------------------------
// Helpers internos
// -----------------------------

const normalizeNome = (nome: string): string =>
  nome
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_");

const makeGlobalHash = (nome: string, tipo: CourseType): string =>
  `${tipo}_${normalizeNome(nome)}`;

const makeCursoCodigo = (nome: string, escolaId: string): string => {
  const prefix = escolaId.replace(/-/g, "").slice(0, 8);
  return `${prefix}_${normalizeNome(nome)}`;
};

// mapeia CourseType → nivel_ensino texto da tabela disciplinas
const mapCourseTypeToNivel = (tipo: CourseType): string => {
  switch (tipo) {
    case "primario":
      return "base";
    case "ciclo1":
      return "secundario1";
    case "puniv":
      return "secundario2";
    case "tecnico":
      return "tecnico";
    default:
      return "geral";
  }
};

// -----------------------------
// Helpers de Scaffolding (Classes e Turmas)
// -----------------------------

async function findOrCreateClassesForCurso(
  escolaId: string,
  cursoId: string,
  classNames: string[]
) {
  const classesCriadas: { id: string; nome: string }[] = [];

  for (const nome of classNames) {
    // 1. Tenta buscar existente
    const { data: existing } = await supabaseAdmin
      .from("classes")
      .select("id, nome")
      .eq("escola_id", escolaId)
      .eq("curso_id", cursoId)
      .eq("nome", nome)
      .maybeSingle();

    if (existing) {
      classesCriadas.push(existing);
      continue;
    }

    // 2. Se não existe, cria
    const { data: created, error } = await supabaseAdmin
      .from("classes")
      .insert({
        escola_id: escolaId,
        curso_id: cursoId,
        nome: nome,
        // ordem: classNames.indexOf(nome) + 1 // Opcional se tiver coluna ordem
      })
      .select("id, nome")
      .single();

    if (!error && created) {
      classesCriadas.push(created);
    } else if (error?.code === "23505") {
      // Race condition (criado por outro request concorrente)
      const { data: retry } = await supabaseAdmin
        .from("classes")
        .select("id, nome")
        .eq("escola_id", escolaId)
        .eq("curso_id", cursoId)
        .eq("nome", nome)
        .maybeSingle();
      if (retry) classesCriadas.push(retry);
    } else {
      console.error(`Erro ao criar classe ${nome}:`, error);
    }
  }

  return classesCriadas;
}

async function createInitialTurmas(
  escolaId: string,
  cursoId: string,
  classes: { id: string; nome: string }[],
  turnosConfig: BuilderTurnos
) {
  const turnosAtivos: string[] = [];
  if (turnosConfig.manha) turnosAtivos.push("Manhã");
  if (turnosConfig.tarde) turnosAtivos.push("Tarde");
  if (turnosConfig.noite) turnosAtivos.push("Noite");

  if (turnosAtivos.length === 0) return 0;

  const anoLetivo = new Date().getFullYear().toString();
  let turmasCriadasCount = 0;

  for (const cls of classes) {
    for (const turno of turnosAtivos) {
      // Tenta criar Turma "A"
      const { error } = await supabaseAdmin.from("turmas").insert({
        escola_id: escolaId,
        curso_id: cursoId,
        classe_id: cls.id,
        ano_letivo: anoLetivo,
        nome: "A", // Padrão inicial
        turno: turno,
        capacidade_maxima: 35, // Padrão razoável
      });

      // Se for violação de unicidade (23505), ignoramos (sucesso, já existe)
      if (!error || error.code === "23505") {
        if (!error) turmasCriadasCount++;
      } else {
        console.error(
          `Erro ao scaffolding turma ${cls.nome} - ${turno}:`,
          error
        );
      }
    }
  }
  return turmasCriadasCount;
}

// -----------------------------
// Entradas no banco
// -----------------------------

async function findOrCreateGlobalCourse(
  nome: string,
  tipo: CourseType,
  escolaId: string
) {
  const hash = makeGlobalHash(nome, tipo);

  // 1. tenta pegar
  const { data: existing, error: selErr } = await supabaseAdmin
    .from("cursos_globais_cache")
    .select("*")
    .eq("hash", hash)
    .maybeSingle();

  if (selErr) {
    console.error("Erro ao buscar cursos_globais_cache:", selErr);
    throw new Error("Erro ao consultar cache global de cursos");
  }

  if (existing) {
    // atualiza usage_count
    await supabaseAdmin
      .from("cursos_globais_cache")
      .update({
        usage_count: (existing.usage_count || 0) + 1,
        last_used_at: new Date().toISOString(),
      })
      .eq("hash", hash);

    return existing;
  }

  // 2. criar
  const { data: created, error: insErr } = await supabaseAdmin
    .from("cursos_globais_cache")
    .insert({
      hash,
      nome,
      tipo,
      usage_count: 1,
      first_seen_at: new Date().toISOString(),
      last_used_at: new Date().toISOString(),
      created_by_escola: escolaId,
    })
    .select("*")
    .single();

  if (insErr || !created) {
    console.error("Erro ao criar cursos_globais_cache:", insErr);
    throw new Error("Erro ao registrar curso global");
  }

  return created;
}

async function findOrCreateCursoEscola(
  escolaId: string,
  nome: string,
  tipo: CourseType,
  cursoGlobalHash: string,
  isCustom: boolean
) {
  // 1. Tenta buscar existente primeiro (Otimização de leitura)
  const { data: existing, error: selErr } = await supabaseAdmin
    .from("cursos")
    .select("*")
    .eq("escola_id", escolaId)
    .or(
      [
        `curso_global_id.eq.${cursoGlobalHash}`,
        `and(nome.eq.${nome},tipo.eq.${tipo})`,
      ].join(",")
    )
    .maybeSingle();

  if (selErr) {
    console.error("Erro ao buscar curso da escola:", selErr);
    throw new Error("Erro ao consultar curso da escola");
  }

  if (existing) {
    return existing;
  }

  // 2. Tenta Criar
  const codigo = makeCursoCodigo(nome, escolaId);

  const { data: created, error: insErr } = await supabaseAdmin
    .from("cursos")
    .insert({
      escola_id: escolaId,
      curso_global_id: cursoGlobalHash,
      nome,
      tipo,
      is_custom: isCustom,
      codigo,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    } as any)
    .select("*")
    .single();

  // 3. Tratamento de Erro Robusto (A CORREÇÃO ESTÁ AQUI)
  if (insErr) {
    // Se o erro for "Violação de Unicidade" (23505), significa que
    // o curso foi criado milissegundos atrás por outro processo (Race Condition)
    // ou a consulta inicial falhou em achá-lo.
    if (insErr.code === '23505') {
      // Retry: Buscamos novamente o registro que conflitou
      const { data: retryData } = await supabaseAdmin
        .from("cursos")
        .select("*")
        .eq("escola_id", escolaId)
        .or(
           `curso_global_id.eq.${cursoGlobalHash},and(nome.eq.${nome},tipo.eq.${tipo})`
        )
        .maybeSingle();

      if (retryData) {
        return retryData; // Sucesso: retornamos o existente
      }
    }

    // Se for outro erro (ex: banco fora do ar, erro de permissão), aí sim estouramos o erro
    console.error("Erro REAL ao criar curso escola:", insErr);
    throw new Error(`Erro ao criar curso: ${insErr.message}`);
  }

  if (!created) {
    throw new Error("Erro desconhecido ao criar curso (sem dados retornados)");
  }

  return created;
}

async function upsertDisciplinasFromConfig(
  escolaId: string,
  cursoId: string,
  tipo: CourseType,
  payload: AdvancedConfigPayload
) {
  const { classes, matrix, subjects } = payload;
  const nivel = mapCourseTypeToNivel(tipo);
  const rows: {
    escola_id: string;
    curso_escola_id: string;
    nome: string;
    classe_nome: string;
    nivel_ensino: string;
    tipo: string;
  }[] = [];

  // Se não veio subject nenhum, tentamos pegar do preset oficial
  let effectiveSubjects = subjects;
  if (effectiveSubjects.length === 0) {
    return 0;
  }

  for (const subject of effectiveSubjects) {
    for (const cls of classes) {
      const keyM = `${subject}::${cls}::M`;
      const keyT = `${subject}::${cls}::T`;
      const keyN = `${subject}::${cls}::N`;

      const ativo =
        Boolean(matrix[keyM]) || Boolean(matrix[keyT]) || Boolean(matrix[keyN]);

      if (!ativo) continue;

      rows.push({
        escola_id: escolaId,
        curso_escola_id: cursoId,
        nome: subject,
        classe_nome: cls + " Classe", // se você já guarda só "10ª", pode manter cls puro
        nivel_ensino: nivel,
        tipo: "core",
      });
    }
  }

  if (rows.length === 0) return 0;

  const { error: upErr } = await supabaseAdmin
    .from("disciplinas")
    .upsert(rows as any, {
      onConflict: "curso_escola_id,classe_nome,nome",
      ignoreDuplicates: false,
    });

  if (upErr) {
    console.error("Erro ao upsert disciplinas:", upErr);
    throw new Error("Erro ao salvar disciplinas");
  }

  return rows.length;
}

async function upsertConfiguracaoCurriculo(
  escolaId: string,
  cursoId: string,
  config: AdvancedConfigPayload
) {
  const { error } = await supabaseAdmin
    .from("configuracoes_curriculo")
    .upsert(
      {
        escola_id: escolaId,
        curso_id: cursoId,
        config,
        updated_at: new Date().toISOString(),
      } as any,
      { onConflict: "escola_id,curso_id" }
    );

  if (error) {
    console.error("Erro ao upsert configuracoes_curriculo:", error);
    throw new Error("Erro ao salvar configuração visual do currículo");
  }
}

// -----------------------------
// HANDLER
// -----------------------------

export async function POST(
  req: NextRequest,
  // 1. Tipagem estrita: 'params' é uma Promise contendo o slug definido na pasta [id]
  props: { params: Promise<{ id: string }> }
) {
  try {
    // 2. Await obrigatório no Next.js 15 antes de ler qualquer parâmetro
    const params = await props.params;
    
    // 3. Mapeamento explícito: A pasta chama-se [id], logo o param é .id
    const escolaId = params.id;

    if (!escolaId) {
      return NextResponse.json(
        { ok: false, error: "escolaId não informado na URL." },
        { status: 400 }
      );
    }

    const body = (await req.json()) as CurriculumApplyPayload;

    if (!body.presetKey) {
      return NextResponse.json(
        { ok: false, error: "presetKey é obrigatório" },
        { status: 400 }
      );
    }

    if (!body.advancedConfig || !body.advancedConfig.classes?.length) {
      return NextResponse.json(
        { ok: false, error: "advancedConfig incompleto (classes ausentes)" },
        { status: 400 }
      );
    }

    const presetKey = body.presetKey;
    const presetMeta = CURRICULUM_PRESETS_META[presetKey];

    if (!presetMeta) {
      return NextResponse.json(
        { ok: false, error: "presetKey inválido" },
        { status: 400 }
      );
    }

    const tipo: CourseType = PRESET_TO_TYPE[presetKey] || "geral";

    // Nome do curso:
    const nomeCurso =
      body.customData?.label?.trim() ||
      presetMeta.label ||
      "Curso sem nome";

    // 1. Curso global
    const global = await findOrCreateGlobalCourse(nomeCurso, tipo, escolaId);

    // 2. Curso da escola
    const cursoEscola = await findOrCreateCursoEscola(
      escolaId,
      nomeCurso,
      tipo,
      global.hash,
      Boolean(body.customData)
    );

    // 3. Disciplinas (a partir da matriz/subjects)
    const createdCount = await upsertDisciplinasFromConfig(
      escolaId,
      cursoEscola.id,
      tipo,
      body.advancedConfig
    );

    // 4. Configuração visual
    await upsertConfiguracaoCurriculo(
      escolaId,
      cursoEscola.id,
      body.advancedConfig
    );

    // 5. [NOVO] Scaffolding: Criar Classes (Estrutura) e Turmas (Oferta)
    // Isso garante que ao final do wizard o usuário já tenha turmas prontas
    let turmasCriadas = 0;
    try {
      const classesCriadas = await findOrCreateClassesForCurso(
        escolaId,
        cursoEscola.id,
        body.advancedConfig.classes
      );

      if (classesCriadas.length > 0) {
        turmasCriadas = await createInitialTurmas(
          escolaId,
          cursoEscola.id,
          classesCriadas,
          body.advancedConfig.turnos
        );
      }
    } catch (scaffoldErr) {
      console.error("Aviso: Falha ao criar estrutura automática:", scaffoldErr);
      // Não bloqueia o sucesso do request principal, pois o curso já foi criado
    }

    return NextResponse.json({
      ok: true,
      message: "Currículo aplicado com sucesso",
      curso: {
        id: cursoEscola.id,
        nome: cursoEscola.nome,
        tipo: cursoEscola.tipo,
        curso_global_id: cursoEscola.curso_global_id,
        is_custom: cursoEscola.is_custom,
      },
      disciplinasCriadasOuAtualizadas: createdCount,
      turmasAutomaticasCriadas: turmasCriadas, // Retorna info extra para debug
    });
  } catch (e: any) {
    console.error("Erro na rota curriculum/apply:", e);
    return NextResponse.json(
      { ok: false, error: e.message || "Erro interno ao aplicar currículo" },
      { status: 500 }
    );
  }
}