#!/usr/bin/env python3
"""Make a disposable PG17 migration test with *synthetic* historic identifiers.

The committed migration always pins the exact production function-body hashes.
Test-only functions deliberately substitute synthetic record IDs; their prosrc
hashes differ. Rewrite ONLY the six expected hashes in a TEMPORARY TEST COPY,
never in the deployable migration, to exercise the same fail-closed SQL guard.
No customer identifiers, credentials, or remote DB access are used in CI.
"""
from __future__ import annotations

import re
import subprocess
import sys
from pathlib import Path


def main() -> None:
    if len(sys.argv) != 3:
        raise SystemExit("Usage: prepare_fixture_migration.py SOURCE_SQL TEST_OUTPUT_SQL")
    source = Path(sys.argv[1]).read_text(encoding="utf8")
    matches = re.findall(
        r"\('(?P<name>curtume_2025_[a-z0-9_]+)','(?P<hash>[a-f0-9]{32})'\)",
        source,
    )
    if len(matches) != 6 or len({name for name, _ in matches}) != 6:
        raise SystemExit("Expected exactly six pinned Curtume production function hashes")

    query = (
        "SELECT proname,md5(prosrc) FROM pg_catalog.pg_proc "
        "WHERE pronamespace='public'::regnamespace "
        "AND proname IN (" + ",".join("'" + name + "'" for name, _ in matches) + ")"
        " ORDER BY proname"
    )
    response = subprocess.run(
        ["psql", "-X", "-A", "-t", "-F", "|", "-c", query],
        check=True, capture_output=True, text=True,
    )
    fixture_hashes = {}
    for line in response.stdout.splitlines():
        if not line.strip():
            continue
        name, fingerprint = line.split("|", 1)
        if not re.fullmatch(r"[a-f0-9]{32}", fingerprint):
            raise SystemExit("Invalid fixture fingerprint")
        fixture_hashes[name] = fingerprint

    if set(fixture_hashes) != {name for name, _ in matches}:
        raise SystemExit("Disposable DB does not contain the exact six expected functions")

    test_sql = source
    for name, pinned in matches:
        # Avoid changing original SQL predicates, role checks or ACLs.
        needle = f"('{name}','{pinned}')"
        replacement = f"('{name}','{fixture_hashes[name]}')"
        if test_sql.count(needle) != 1:
            raise SystemExit("Expected one exact hash entry: " + name)
        test_sql = test_sql.replace(needle, replacement)
    out = Path(sys.argv[2])
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(test_sql, encoding="utf8")
    print("Prepared synthetic PostgreSQL 17 migration contract for six functions")


if __name__ == "__main__":
    main()
