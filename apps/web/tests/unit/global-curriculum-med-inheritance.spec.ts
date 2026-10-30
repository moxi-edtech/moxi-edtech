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


const readAnnualSql = () => readFileSync(
  "../../supabase/migrations/20271029235927_med_annual_offering_profiles.sql", "utf8",
);
const readGuardSql = () => readFileSync(
  "../../supabase/migrations/20271029235928_med_year_activation_readiness.sql", "utf8",
);

test("Annual offering profiles are tenant-bound, immutable and separate from active pointers", () => {
  const sql = readAnnualSql();
  assert.match(sql, /PRIMARY KEY \(offering_id,ano_letivo_id\)/);
  assert.match(sql, /FOREIGN KEY \(offering_id,escola_id\)/);
  assert.match(sql, /FOREIGN KEY \(ano_letivo_id,escola_id\)/);
  assert.match(sql, /ENABLE ROW LEVEL SECURITY/);
  assert.match(sql, /MED_YEAR_PROFILE_IMMUTABLE/);
  assert.match(sql, /MED_YEAR_PROFILE_COLLISION/);
  assert.match(sql, /BEFORE UPDATE OF calendar_profile_id/);
  assert.match(sql, /AFTER INSERT ON public\.school_education_offerings/);
  assert.match(sql, /NEW\.calendar_profile_id:=OLD\.calendar_profile_id/);
  assert.match(sql, /AFTER UPDATE OF ativo ON public\.anos_letivos/);
});

test("Cutover fails closed on missing MED year, trimester, course or event lineage", () => {
  const sql = readGuardSql();
  assert.match(sql, /OFFICIAL_CALENDAR_NOT_PUBLISHED_OR_YEAR_MISMATCH/);
  assert.match(sql, /OFFICIAL_TRIMESTERS_INCOMPLETE/);
  assert.match(sql, /COURSES_WITHOUT_ACTIVE_OFFERING/);
  assert.match(sql, /MED_YEAR_OFFERING_PROFILES_MISSING/);
  assert.match(sql, /OFFICIAL_CALENDAR_EVENTS_NOT_APPLIED/);
  assert.match(sql, /MED_YEAR_NOT_READY/);
  assert.match(sql, /BEFORE INSERT OR UPDATE OF ativo ON public\.anos_letivos/);
  assert.match(sql, /auth\.uid\(\) IS NULL/);
  assert.match(sql, /user_has_role_in_school/);
});

test("Preparation and cutover use yearly inheritance with role-scoped MED preflight", () => {
  const prepare = readFileSync("src/lib/academico/prepare-canonical-calendar.ts", "utf8");
  const route = readFileSync("src/app/api/secretaria/operacoes-academicas/virada/cutover/route.ts", "utf8");
  assert.match(prepare, /deriveCanonicalMedCourseSelections/);
  assert.match(route, /med_year_cutover_preflight/);
  assert.match(route, /MED_YEAR_PREFLIGHT_FAILED/);
  assert.match(route, /calendar_readiness/);
});


test("A newly provisioned school inherits official year bounds and three teaching terms", () => {
  const preflight = readFileSync("../../supabase/migrations/20271029235929_guard_med_initial_year.sql", "utf8");
  const bootstrap = readFileSync("../../supabase/migrations/20271029235930_bootstrap_med_terms_on_new_school.sql", "utf8");
  assert.match(preflight, /NEW\.data_inicio:=v_cal\.data_inicio/);
  assert.match(preflight, /NEW\.data_fim:=v_cal\.data_fim/);
  assert.match(preflight, /OFFICIAL_CALENDAR_NOT_PUBLISHED/);
  assert.match(preflight, /FROM public\.cursos/);
  assert.match(bootstrap, /AFTER INSERT ON public\.anos_letivos/);
  assert.match(bootstrap, /INSERT INTO public\.periodos_letivos/);
  assert.match(bootstrap, /source_template_id,source_item_id,source_version/);
  assert.match(bootstrap, /v_distinct_terms<>3/);
  assert.match(bootstrap, /internal\.med_year_readiness/);
});

test("Rollover page only offers future MED calendars and allows target-year re-preparation", () => {
  const endpoint = readFileSync("src/app/api/secretaria/operacoes-academicas/virada/sessions-target/route.ts", "utf8");
  const wizard = readFileSync("src/components/secretaria/virada-ano/ConfigStep.tsx", "utf8");
  assert.match(endpoint, /\.gt\("ano_base", anoAtivo\?\.ano \|\| 0\)/);
  assert.match(wizard, /officialCalendars\.length > 0/);
  assert.match(wizard, /Preparar ano com calendário oficial/);
});


test("Cutover deactivates the source before activating the destination within one transaction", () => {
  const sql = readFileSync("../../supabase/migrations/20271029235931_cutover_activate_year_order.sql", "utf8");
  const deactivate = sql.indexOf("id <> p_to_session_id AND ativo IS TRUE");
  const activate = sql.indexOf("id = p_to_session_id");
  assert.ok(deactivate > 0 && activate > deactivate);
  assert.match(sql, /pg_get_functiondef/);
  assert.match(sql, /MED_CUTOVER_PATCH_MISMATCH/);
});
