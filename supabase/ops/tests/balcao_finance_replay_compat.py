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
(root / "20260321065000_ci_only_early_curriculum_seed.sql").write_text(seed_source)
print("STAGED-COMPAT 20260321065000_ci_only_early_curriculum_seed.sql")
print("STAGED-COMPAT 20271231000000_ci_only_attach_pautas_archive.sql")
