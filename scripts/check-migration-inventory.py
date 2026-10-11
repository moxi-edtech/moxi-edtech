#!/usr/bin/env python3
"""Audit migration names and checked-in read-only production history snapshots.

This never connects to, modifies, or repairs a database. Presence is NOT proof
that a migration was applied; duplicated filenames need a separate gated plan.
"""
import csv
import re
from collections import Counter, defaultdict
from pathlib import Path

root = Path(__file__).resolve().parent.parent
migrations = root / "supabase/migrations"
snapshot = root / "docs/ops/migration-reconciliation-20261011/remote-history-624.csv"
with snapshot.open(newline="") as handle:
    remote = list(csv.DictReader(handle))
remote_versions = {row["version"] for row in remote}
files = sorted(migrations.glob("*.sql"))
by_version = defaultdict(list)
invalid = []
for file in files:
    match = re.fullmatch(r"([0-9]{14})_.+\.sql", file.name)
    if match:
        by_version[match.group(1)].append(file.name)
    else:
        invalid.append(file.name)

duplicate = {v: names for v, names in by_version.items() if len(names) > 1}
missing_remote = remote_versions - set(by_version)
local_only = set(by_version) - remote_versions
print(f"snapshot_remote_versions={len(remote_versions)} checked_in_files={len(files)}")
print(f"checked_in_versions={len(by_version)} missing_remote_files={len(missing_remote)} local_only_versions={len(local_only)}")
print(f"duplicate_version_count={len(duplicate)} invalid_filename_count={len(invalid)}")
for v, names in sorted(duplicate.items()):
    print(f"::warning::MIGRATION_VERSION_COLLISION {v} {len(names)} files")
for filename in invalid:
    print(f"::warning::INVALID_MIGRATION_FILENAME {filename}")
if missing_remote:
    raise SystemExit(f"Still missing {len(missing_remote)} remote migration versions from tracked source")
if len(remote_versions) != 624:
    raise SystemExit("Unrecognized production migration-history snapshot")
if not (root / "apps/web/tests/unit/fiscal-immutability-guards.spec.ts").exists():
    raise SystemExit("Fiscal negative guards not under permanent main test workflow")
print("historical_remote_versions_accounted_for=true")
print("NOTE: historical presence does not prove runtime equivalence or a clean full replay")
