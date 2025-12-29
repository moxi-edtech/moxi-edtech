"use server";

import { CURRICULUM_PRESETS, type CurriculumDisciplineBlueprint, type CurriculumKey } from "@/lib/onboarding";
import { createClient } from "@/utils/supabase/server";

const COMMON_TRUNK_SUBJECTS = [
  "Português",
  "Matemática",
  "Inglês",
  "Educação Física",
];

const normalize = (value?: string | null): string =>
  (value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();

const normalizeClasse = (value?: string | null): string =>
  normalize(value).replace(/classe/g, "").replace(/[^a-z0-9]/g, "");

const detectPresetByCourse = (
  nome?: string | null,
  codigo?: string | null,
): CurriculumKey | null => {
  const haystack = `${normalize(nome)} ${normalize(codigo)}`;

  const mappings: Array<{ preset: CurriculumKey; keywords: string[] }> = [
    {
      preset: "tecnico_gestao",
      keywords: ["gestao", "financas", "administracao", "contabilidade"],
    },
    {
      preset: "tecnico_informatica",
      keywords: ["informatica", "computador", "sistemas", "programacao", "ti"],
    },
    {
      preset: "tecnico_construcao",
      keywords: ["construcao", "civil", "obras"],
    },
    {
      preset: "saude_enfermagem",
      keywords: ["enfermagem", "enfermage"],
    },
    {
      preset: "saude_farmacia_analises",
      keywords: ["analises", "farmacia", "laboratorio"],
    },
  ];

  for (const mapping of mappings) {
    if (mapping.keywords.some((kw) => haystack.includes(kw))) {
      return mapping.preset;
    }
  }

  return null;
};

const buildFallbackPreset = (
  classes: Array<{ id?: string; nome?: string | null }>,
): CurriculumDisciplineBlueprint[] =>
  classes
    .filter((cls) => !!cls.nome)
    .flatMap((cls) =>
      COMMON_TRUNK_SUBJECTS.map((nome) => ({
        nome,
        classe: cls.nome as string,
        tipo: "core",
      })),
    );

export async function hydrateCourseCurriculum(
  escolaId: string,
  cursoId: string,
) {
  const supabase = await createClient();

  const { data: curso, error: cursoError } = await supabase
    .from("cursos")
    .select("id, nome, codigo")
    .eq("id", cursoId)
    .eq("escola_id", escolaId)
    .maybeSingle();

  if (cursoError) throw cursoError;
  if (!curso) throw new Error("Curso não encontrado para hidratação.");

  const { data: classes, error: classesError } = await supabase
    .from("classes")
    .select("id, nome")
    .eq("escola_id", escolaId)
    .eq("curso_id", cursoId);

  if (classesError) throw classesError;
  if (!classes || classes.length === 0) return;

  const presetKey = detectPresetByCourse((curso as any).nome, (curso as any).codigo);
  const preset = presetKey ? CURRICULUM_PRESETS[presetKey] : null;
  const buildRowsFromBlueprint = (source: CurriculumDisciplineBlueprint[]) =>
    classes.flatMap((cls) => {
      if (!cls?.nome) return [] as any[];
      const classKey = normalizeClasse(cls.nome);
      const disciplinas = source.filter((d) => normalizeClasse(d.classe) === classKey);

      return disciplinas.map((disc) => ({
        escola_id: escolaId,
        curso_escola_id: cursoId,
        nome: disc.nome,
        classe_nome: cls.nome,
        classe_id: cls.id ?? null,
        nivel_ensino: disc.nivel || "geral",
        tipo: disc.tipo || "core",
      }));
    });

  let rows = buildRowsFromBlueprint(preset ?? []);
  if (!rows.length) {
    rows = buildRowsFromBlueprint(buildFallbackPreset(classes));
  }

  if (!rows.length) return;

  const { error: upsertError } = await supabase
    .from("disciplinas")
    .upsert(rows, {
      onConflict: "curso_escola_id,classe_nome,nome",
      ignoreDuplicates: false,
    });

  if (upsertError) throw upsertError;
}
