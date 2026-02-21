import { writeFileSync } from "node:fs";
import {
  CURRICULUM_PRESETS,
  CURRICULUM_PRESETS_META,
  type CurriculumKey,
} from "@/lib/academico/curriculum-presets";

const CATEGORY_BY_KEY = (key: CurriculumKey) => {
  if (key.startsWith("primario")) return "PRIMARIO";
  if (key === "esg_ciclo1") return "ESG_CICLO1";
  if (key.startsWith("esg_puniv")) return "ESG_PUNIV";
  if (key.startsWith("tec_saude")) return "TECNICO_SAUDE";
  if (key.startsWith("tec_")) return "TECNICO";
  return "ESG_PUNIV";
};

const escapeSql = (value: string) => value.replace(/'/g, "''");

const presetKeys = Object.keys(CURRICULUM_PRESETS) as CurriculumKey[];

const presetValues = presetKeys
  .map((key) => {
    const meta = CURRICULUM_PRESETS_META[key];
    const name = meta?.label ?? key;
    const description = meta?.description ?? null;
    const category = CATEGORY_BY_KEY(key);
    return {
      id: key,
      name,
      category,
      description,
    };
  })
  .sort((a, b) => a.id.localeCompare(b.id));

const subjectRows = presetKeys.flatMap((key) => {
  const rows = CURRICULUM_PRESETS[key] ?? [];
  return rows.map((row) => ({
    preset_id: key,
    name: row.nome,
    grade_level: row.classe,
    component: row.componente,
    weekly_hours: row.horas,
    subject_type: row.tipo ?? "core",
  }));
});

const presetInsertValues = presetValues
  .map((row) => {
    const description = row.description ? `'${escapeSql(row.description)}'` : "NULL";
    return `('${escapeSql(row.id)}','${escapeSql(row.name)}','${row.category}',${description})`;
  })
  .join(",\n  ");

const subjectInsertValues = subjectRows
  .map((row) => {
    return `('${escapeSql(row.preset_id)}','${escapeSql(row.name)}','${escapeSql(
      row.grade_level
    )}','${row.component}',${row.weekly_hours},'${row.subject_type}')`;
  })
  .join(",\n  ");

const sql = `-- Auto-generated from CURRICULUM_PRESETS
BEGIN;

INSERT INTO public.curriculum_presets (id, name, category, description)
VALUES
  ${presetInsertValues}
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  category = EXCLUDED.category,
  description = EXCLUDED.description;

INSERT INTO public.curriculum_preset_subjects (
  preset_id,
  name,
  grade_level,
  component,
  weekly_hours,
  subject_type
)
VALUES
  ${subjectInsertValues}
ON CONFLICT (preset_id, name, grade_level) DO UPDATE SET
  component = EXCLUDED.component,
  weekly_hours = EXCLUDED.weekly_hours,
  subject_type = EXCLUDED.subject_type;

COMMIT;
`;

const outPath = "supabase/migrations/20261127000001_curriculum_presets_seed.sql";
writeFileSync(outPath, sql, "utf8");
console.log(`Wrote ${outPath} with ${presetValues.length} presets and ${subjectRows.length} subjects.`);
