#!/usr/bin/env python3
"""Strict, auditable compatibility for an EMPTY disposable migration replay only.

Never invoke against a linked/remote project or on checked-in production SQL.
Each rewrite fails closed when its exact historical defect is not present.
"""
from pathlib import Path
import sys

root = Path(sys.argv[1]).resolve()
assert root.name == "migrations" and root.is_dir(), root
def once(filename: str, old: str, new: str) -> None:
    path = root / filename
    text = path.read_text()
    if text.count(old) != 1:
        raise RuntimeError(f"unexpected source (no patch applied): {filename}: {text.count(old)} matches")
    path.write_text(text.replace(old, new, 1))
    print("STAGED-COMPAT", filename)

# The 20260202011000 backfill expects aluno_id and two enum types too early.
compat = Path(__file__).with_name("balcao_full_ci_compat_aluno_id.sql")
(root / "20260202010999_ci_only_compat_aluno_id.sql").write_text(compat.read_text())

once("20260203000015_refactor_gerar_mensalidades_trigger.sql",
    "AS $$", "AS $function$")
once("20260203000024_rpc_realizar_pagamento_balcao.sql",
    "  v_lancamentos_ids uuid[] := '{}';",
    "  v_lancamento_id uuid;\n  v_lancamentos_ids uuid[] := '{}';")
# A trigger was applied in February to a table first created in November.
# Keep the function unchanged; stage delayed attachment after the table exists.
once("20260227180000_automate_archive_and_live_events.sql",
    """DROP TRIGGER IF EXISTS trg_pautas_archive_outbox ON public.pautas_oficiais;
CREATE TRIGGER trg_pautas_archive_outbox
AFTER INSERT OR UPDATE ON public.pautas_oficiais
FOR EACH ROW
EXECUTE FUNCTION public.trigger_archive_document_outbox();""",
    """-- Disposable replay only. Exact trigger is attached after the later
-- pautas_oficiais CREATE TABLE, never to a synthetic fake table.
DO $ci_archive_deferred$
BEGIN
  IF to_regclass('public.pautas_oficiais') IS NOT NULL THEN
    EXECUTE 'DROP TRIGGER IF EXISTS trg_pautas_archive_outbox ON public.pautas_oficiais';
    EXECUTE 'CREATE TRIGGER trg_pautas_archive_outbox AFTER INSERT OR UPDATE ON public.pautas_oficiais FOR EACH ROW EXECUTE FUNCTION public.trigger_archive_document_outbox()';
  END IF;
END
$ci_archive_deferred$;""")
(root / "20271231000000_ci_only_attach_pautas_archive.sql").write_text("""
-- Only a disposable runner. Fail if the real historical table was not created.
DO $ci_validate$
BEGIN
 IF to_regclass('public.pautas_oficiais') IS NULL THEN
   RAISE EXCEPTION 'CI_REPLAY_MISSING_REAL_PAUTAS_OFICIAIS_TABLE';
 END IF;
END $ci_validate$;
DROP TRIGGER IF EXISTS trg_pautas_archive_outbox ON public.pautas_oficiais;
CREATE TRIGGER trg_pautas_archive_outbox
AFTER INSERT OR UPDATE ON public.pautas_oficiais
FOR EACH ROW
EXECUTE FUNCTION public.trigger_archive_document_outbox();
""")
# March migration 17 drops numero_login while two security-invoker search
# views STILL depend on it. Migration 18 replaces those views. Preserve all
# DDL by shifting DROP to AFTER replacement; migration 19 restores the column
# (same definition used in the later IF NOT EXISTS migration) to allow later
# historical SQL to reference it. This is runner-only, never prod DDL.
once("20260310000017_drop_profiles_numero_login.sql",
    "ALTER TABLE public.profiles\n  DROP COLUMN IF EXISTS numero_login;",
    "-- CI replay: column drop moved after view replacements in next migration.")
once("20260310000018_update_search_views.sql",
    "ALTER VIEW public.vw_search_usuarios OWNER TO postgres;\n\nCOMMIT;",
    "ALTER VIEW public.vw_search_usuarios OWNER TO postgres;\n\nALTER TABLE public.profiles DROP COLUMN IF EXISTS numero_login;\n\nCOMMIT;")
once("20260310000019_fix_login_functions.sql",
    "BEGIN;\n\nDROP FUNCTION IF EXISTS public.confirmar_matricula_core(uuid);",
    "BEGIN;\n\nALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS numero_login text;\n\nDROP FUNCTION IF EXISTS public.confirmar_matricula_core(uuid);")
# Curriculum tables are first defined in November but March migrations
# directly ALTER and INSERT into them. The November DDL is idempotent and
# enables its own RLS/policies. Execute the *same* DDL earlier on an EMPTY
# disposable database, then replay its original November migration normally.
curriculum_source = (root / "20261127000000_curriculum_presets_tables.sql").read_text()
assert "CREATE TABLE IF NOT EXISTS public.curriculum_presets (" in curriculum_source
assert "CREATE TABLE IF NOT EXISTS public.curriculum_preset_subjects (" in curriculum_source
assert "ENABLE ROW LEVEL SECURITY" in curriculum_source
(root / "20260311000099_ci_only_early_curriculum_catalog.sql").write_text(curriculum_source)
print("STAGED-COMPAT 20260311000099_ci_only_early_curriculum_catalog.sql")
# Models table exists in March but its formula/regras columns arrive in
# November, before which March already backfills them. Apply exact later DDL
# (with its RLS intact) prior to the early consumer, then reapply in November.
model_source = (root / "20261121090000_modelos_avaliacao_formula_meta.sql").read_text()
assert "ADD COLUMN IF NOT EXISTS formula jsonb NOT NULL" in model_source
(root / "20260311010099_ci_only_early_modelos_avaliacao_formula.sql").write_text(model_source)
print("STAGED-COMPAT 20260311010099_ci_only_early_modelos_avaliacao_formula.sql")
# A clean schema has no curriculum catalog rows. March health subjects
# require parents first, but their real seed is dated November. Bring forward
# EXACT source seed DML; the source already uses ON CONFLICT upserts, so it
# runs again in November with normal final semantics and no fake parents.
seed_source = (root / "20261127000001_curriculum_presets_seed.sql").read_text()
assert "ON CONFLICT (id) DO UPDATE" in seed_source
assert "ON CONFLICT (preset_id, name, grade_level) DO UPDATE" in seed_source
# One *byte-identical* VALUES row occurs twice in the 1,313 original rows,
# making PostgreSQL reject an otherwise idempotent ON CONFLICT statement.
# Keep all 1,312 DISTINCT original rows. Do NOT generate/fake parents.
duplicate = "  ('esg_puniv_cej','Desenvolvimento Económico e Social','12ª Classe','ESPECIFICA',4,'core'),\n"
assert seed_source.count(duplicate) == 2, "Unexpected historical catalog change"
seed_source = seed_source.replace(duplicate, "", 1)
(root / "20260321065000_ci_only_early_curriculum_seed.sql").write_text(seed_source)
(root / "20261127000001_curriculum_presets_seed.sql").write_text(seed_source)
print("STAGED-COMPAT one byte-identical duplicate removed from the 1,313 source subject rows")
print("STAGED-COMPAT 20260321065000_ci_only_early_curriculum_seed.sql")
# March backfill/triggers refer to public.teachers, which is not created
# until November. Stage ONLY exact CREATE TABLE statements (no fake rows or
# permissive policies). Enable RLS immediately, so the early table fails
# closed. November authentic migration installs indexes/guards/policies.
teachers_source = (root / "20261128030000_create_teachers_tables.sql").read_text()
assert teachers_source.startswith("create table if not exists public.teachers (")
assert "create table if not exists public.teacher_skills (" in teachers_source
teachers_ddl = teachers_source.split("create unique index if not exists teachers_escola_profile_uidx", 1)[0]
skills_ddl = "create table if not exists public.teacher_skills (" + teachers_source.split("create table if not exists public.teacher_skills (", 1)[1].split("create unique index if not exists teacher_skills_teacher_disciplina_uidx", 1)[0]
assert teachers_ddl.rstrip().endswith(");") and skills_ddl.rstrip().endswith(");")
(root / "20260324000000_ci_only_early_teachers_tables.sql").write_text(
    teachers_ddl + "\n" + skills_ddl + "\nALTER TABLE public.teachers ENABLE ROW LEVEL SECURITY;\nALTER TABLE public.teacher_skills ENABLE ROW LEVEL SECURITY;\n"
)
print("STAGED-COMPAT 20260324000000_ci_only_early_teachers_tables.sql")
# The March admin-list function changes its RETURNS TABLE type with CREATE
# OR REPLACE, disallowed by PostgreSQL. Explicitly replace only that function
# (same exact signature, preserving the real permission checks and body).
once("20260325000001_fix_admin_list_profiles_role_cast.sql",
    "CREATE OR REPLACE FUNCTION public.admin_list_profiles(",
    "DROP FUNCTION IF EXISTS public.admin_list_profiles(text[], integer);\n\nCREATE OR REPLACE FUNCTION public.admin_list_profiles(")
# A SQL-language authorization helper in the April formação migration
# refers to a cohort table defined further down IN THE SAME FILE. Reorder
# the helper + its grant after the authentic CREATE TABLE, before RLS policies.
formacao_path = root / "20260407130000_formacao_schema_rls_foundation.sql"
formacao_sql = formacao_path.read_text()
formacao_fn_start = "CREATE OR REPLACE FUNCTION public.can_access_formacao_cohort_as_formador("
formacao_fn_end = "\n$$;\n"
assert formacao_sql.count(formacao_fn_start) == 1
start = formacao_sql.index(formacao_fn_start)
end = formacao_sql.index(formacao_fn_end, start) + len(formacao_fn_end)
helper = formacao_sql[start:end]
formacao_sql = formacao_sql[:start] + formacao_sql[end:]
grant = "GRANT EXECUTE ON FUNCTION public.can_access_formacao_cohort_as_formador(uuid, uuid) TO authenticated;\n"
assert formacao_sql.count(grant) == 1
formacao_sql = formacao_sql.replace(grant, "", 1)
anchor = "-- =========================\n-- Clientes B2B e faturação em lote\n-- ========================="
assert formacao_sql.count(anchor) == 1
formacao_sql = formacao_sql.replace(anchor, helper + "\n" + grant + "\n" + anchor, 1)
formacao_path.write_text(formacao_sql)
print("STAGED-COMPAT SQL auth helper moved after real cohort table in April migration")
# May formação 2026 migrations consume real tables whose files are dated
# April/May 2027. Stage only their exact parent CREATE TABLE statements
# from the future SQL, immediately enabling RLS with zero policies/grants.
# Source's original indexes and tenant policies apply in their normal order.
def table_ddl(filename: str, tablename: str, next_marker: str) -> str:
    source = (root / filename).read_text()
    start = f"CREATE TABLE IF NOT EXISTS public.{tablename} ("
    assert source.count(start) == 1, (filename, start)
    assert source.count(next_marker) == 1, (filename, next_marker)
    beg = source.index(start)
    end = source.index(next_marker, beg)
    ddl = source[beg:end].strip()
    assert ddl.endswith(");"), (filename, ddl[-60:])
    return ddl + f"\nALTER TABLE public.{tablename} ENABLE ROW LEVEL SECURITY;\n"

early_formacao = (
    table_ddl("20270408020000_formacao_backoffice_modules.sql", "formacao_cursos",
              "CREATE INDEX IF NOT EXISTS idx_formacao_cursos_escola_status") + "\n" +
    table_ddl("20270411030000_formacao_catalogo_curso_tabs.sql", "formacao_cohort_modulos",
              "CREATE INDEX IF NOT EXISTS idx_formacao_cohort_modulos_escola_cohort") + "\n" +
    table_ddl("20270502180000_formacao_digital_diary.sql", "formacao_aulas",
              "CREATE INDEX IF NOT EXISTS idx_formacao_aulas_escola_cohort") + "\n" +
    table_ddl("20270411010000_formacao_inscricoes_base.sql", "formacao_inscricoes",
              "CREATE INDEX IF NOT EXISTS idx_formacao_inscricoes_escola_cohort")
)
(root / "20260505000000_ci_only_early_formacao_dependencies.sql").write_text(early_formacao)
print("STAGED-COMPAT 20260505000000_ci_only_early_formacao_dependencies.sql")
print("STAGED-COMPAT 20271231000000_ci_only_attach_pautas_archive.sql")
