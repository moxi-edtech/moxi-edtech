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
print("STAGED-COMPAT 20271231000000_ci_only_attach_pautas_archive.sql")
