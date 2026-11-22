#!/usr/bin/env python3
"""Produce a disposable PG17-only test layout from the existing 2025 batch fixture.

The source migration remains pinned to the exact live production function hash.
Only a TEMPORARY test copy gets the fixture hash; this cannot weaken production.
"""
from pathlib import Path
import os
import re
import subprocess

ROOT = Path(__file__).resolve().parents[4]
SRC = ROOT / "supabase/ops/tests/raa_historico/curtume_batch_fixture.sql"
REGRESSION = ROOT / "supabase/ops/tests/raa_historico/curtume_batch_regression.sql"
MIGRATION = ROOT / "supabase/migrations/20271201100000_curtume_2025_autofecho_proteger_ano_documental.sql"
OUT = Path("/tmp/curtume-autofecho-pg17")
OUT.mkdir(exist_ok=True)

setup = SRC.read_text(encoding="utf8")
regression = REGRESSION.read_text(encoding="utf8")
marker = "DO $verify$"
assert regression.count(marker) == 1, "Synthetic baseline regression changed"
data = regression.split(marker, 1)[0]
assert "BEGIN;" in data and "SET ROLE authenticated;" in data, "Missing synthetic transaction / actor"
setup = setup.replace(
    r"\ir finalist_guard_fixture.sql",
    r"\i supabase/ops/tests/raa_historico/finalist_guard_fixture.sql",
).replace(
    r"\ir ../../../migrations/20271117190000_curtume_fechar_pautas_2025_lote.sql",
    r"\i supabase/migrations/20271117190000_curtume_fechar_pautas_2025_lote.sql",
)
assert r"\ir" not in setup, "Unexpected fixture import"
(OUT / "setup.sql").write_text(setup, encoding="utf8")
(OUT / "data.sql").write_text(data, encoding="utf8")

def prepare_migration() -> None:
    pgurl = os.environ["PGURL"]
    result = subprocess.run(
        ["psql", pgurl, "-X", "-Atc",
         "SELECT md5(prosrc) FROM pg_proc "
         "WHERE pronamespace='public'::regnamespace AND "
         "proname='curtume_fechar_pautas_2025_lote'"],
        check=True, capture_output=True, text=True,
    ).stdout.strip()
    if not re.fullmatch(r"[0-9a-f]{32}", result):
        raise RuntimeError("Synthetic function baseline missing")
    original = MIGRATION.read_text(encoding="utf8")
    target = "480edb93d338672e9a6df2dee0a5d72a"
    assert original.count(target) == 1, "Production pinned hash changed"
    (OUT / "migration_test_only.sql").write_text(
        original.replace(target, result), encoding="utf8")
    print("Test-only migration prepared; real source hash remains untouched.")

if __name__ == "__main__":
    import sys
    if sys.argv[1:] == ["layout"]:
        print("Disposable PG17 fixture setup/data prepared.")
    elif sys.argv[1:] == ["migration"]:
        prepare_migration()
    else:
        raise SystemExit("Usage: prepare_autofecho_fixture.py [layout|migration]")
