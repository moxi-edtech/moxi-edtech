import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

const readSql = () => readFileSync(
  "../../supabase/migrations/20271029235926_global_curriculum_med_calendar_contract.sql",
  "utf8",
);

test("Global KLASSE catalog covers every installed preset, not tenant names", () => {
  const sql = readSql();
  assert.match(sql, /CREATE TABLE public\.curriculum_preset_calendar_contract/);
  assert.match(sql, /REFERENCES public\.curriculum_presets\(id\)/);
  assert.match(sql, /FROM public\.curriculum_presets p/);
  assert.match(sql, /KLASSE_GLOBAL_CALENDAR_CATALOG_INCOMPLETE/);
  assert.match(sql, /'SECUNDARIO_PEDAGOGICO'/);
  assert.match(sql, /'TECNICO_PROFISSIONAL'/);
  assert.doesNotMatch(sql, /WHERE p\.id IN \(/);
});

test("Installing a course derives school-specific profile from year and preset", () => {
  const sql = readSql();
  assert.match(sql, /CREATE OR REPLACE FUNCTION public\.ensure_k12_course_offering/);
  assert.match(sql, /map\.education_subsystem,map\.education_level/);
  assert.match(sql, /c\.curriculum_key=p_curriculum_preset_id/);
  assert.match(sql, /a\.escola_id=p_escola_id AND a\.ativo IS TRUE/);
  assert.match(sql, /t\.ano_base=v_year/);
  assert.match(sql, /JOIN public\.calendarios_oficiais_anos parent/);
  assert.match(sql, /v_matches<>1/);
  assert.match(sql, /pg_advisory_xact_lock/);
  assert.match(sql, /COURSE_OFFERING_AMBIGUOUS/);
  assert.match(sql, /CURRICULUM_CALENDAR_MAPPING_REQUIRED/);
});

test("Global classification and installation RPC do not bypass school roles", () => {
  const sql = readSql();
  assert.match(sql, /ENABLE ROW LEVEL SECURITY/);
  assert.match(sql, /REVOKE ALL ON public\.curriculum_preset_calendar_contract FROM PUBLIC, anon, authenticated/);
  assert.match(sql, /auth\.uid\(\) IS NULL/);
  assert.match(sql, /user_has_role_in_school/);
  assert.match(sql, /c\.escola_id=p_escola_id/);
  assert.match(sql, /o\.escola_id=p_escola_id/);
});

test("School onboarding and academic installer invoke shared course offering contract", () => {
  const installer = readFileSync("src/app/api/escola/[id]/admin/curriculo/install-preset/route.ts", "utf8");
  const onboarding = readFileSync("src/app/api/escolas/[id]/onboarding/core/finalize/route.ts", "utf8");
  for (const src of [installer, onboarding]) {
    assert.match(src, /ensureCurriculumCourseOffering/);
  }
});
