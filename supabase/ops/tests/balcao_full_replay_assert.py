#!/usr/bin/env python3
"""Verify every versioned original+runner-only migration was applied exactly once.

Unversioned MIGRATION_ADMISSAO_P0.sql is rejected by Supabase CLI itself.
Don't silently count it as an applied migration.
"""
import os
from pathlib import Path
import re
import subprocess
import sys

migration_dir = Path("supabase/migrations")
files = list(migration_dir.glob("*.sql"))
expected = {
    name.group(1)
    for file in files
    if (name := re.fullmatch(r"([0-9]{14})_.+\.sql", file.name))
}
unversioned = [file.name for file in files if not re.fullmatch(r"[0-9]{14}_.+\.sql", file.name)]
if sorted(unversioned) != ["MIGRATION_ADMISSAO_P0.sql"]:
    raise SystemExit(f"Unexpected unversioned migrations: {sorted(unversioned)!r}")
if len(expected) != len(files) - len(unversioned):
    raise SystemExit("Duplicate version IDs in staging; cannot verify exactly")
url = os.environ.get("PGURL")
if not url or "127.0.0.1" not in url:
    raise SystemExit("Refusing to inspect anything but local disposable Postgres")
result = subprocess.run([
    "psql", url, "-At", "-v", "ON_ERROR_STOP=1",
    "-c", "SELECT version FROM supabase_migrations.schema_migrations ORDER BY version"
], check=True, text=True, capture_output=True)
versions = result.stdout.splitlines()
actual = set(versions)
missing = sorted(expected - actual)
unexpected = sorted(actual - expected)
print(f"Expected {len(expected)} individual versioned migrations, applied {len(versions)}")
print(f"Supabase CLI rightly ignores unversioned: {unversioned}")
if missing or unexpected or len(versions) != len(actual):
    print(f"Missing: {missing[:20]}; unexpected: {unexpected[:20]}",
          file=sys.stderr)
    raise SystemExit("Replay is incomplete or diverged")
print("PASS: every versioned original and staging migration is recorded, exactly once")
