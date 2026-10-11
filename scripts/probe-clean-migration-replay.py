#!/usr/bin/env python3
"""Attempt migrations sequentially on a disposable Postgres connection.

Stops at the first failure. A baseline failure is recorded as a BLOCKER,
NEVER as schema parity. No connection to production is made.
"""
import os
import re
import subprocess
from pathlib import Path
root = Path(__file__).resolve().parent.parent
migrations = root / "supabase/migrations"
files = sorted(f for f in migrations.glob("*.sql")
               if re.fullmatch(r"[0-9]{14}_.+\.sql", f.name))
succeeded = 0
failure = None
for file in files:
    p = subprocess.run(["psql", "-X", "-v", "ON_ERROR_STOP=1", "--single-transaction",
                        "--no-psqlrc", "-f", str(file)], stdout=subprocess.DEVNULL,
                       stderr=subprocess.PIPE, text=True, env=os.environ.copy())
    if p.returncode:
        # Do not print raw DB error contents (may contain SQL or environment
        # values); log a safe path and a known prerequisite category instead.
        category = ("MISSING_PG_CRON_EXTENSION" if
                    'extension "pg_cron" is not available' in p.stderr else
                    "SQL_REPLAY_FAILURE_REQUIRES_REVIEW")
        failure = (file.name, category)
        break
    succeeded += 1
summary = os.environ.get("GITHUB_STEP_SUMMARY")
line = f"Clean replay: {succeeded}/{len(files)} migrations applied."
if failure:
    line += f" BLOCKED at {failure[0]} ({failure[1]}). Schema parity NOT established."
    print(f"::warning::{line}")
else:
    line += " All migrations ran; a normalized schema dump comparison is still required."
    print(line)
if summary:
    with open(summary, "a") as handle:
        handle.write("\n### Migration replay diagnostic\n\n" + line + "\n\n")
