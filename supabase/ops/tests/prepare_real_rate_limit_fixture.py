#!/usr/bin/env python3
"""Build a disposable-only SQL fixture from the EXACT canonical migration.

No duplicated/mock throttle code: the SQL comes verbatim from the repo
migration that installed public_rate_limits + check_public_rate_limit.
Does NOT read any connected Supabase project or personal records.
"""
from pathlib import Path

source = Path("supabase/migrations/20270529123000_admissoes_public_protocol_and_vault_rate_limit.sql").read_text()
start = source.index("CREATE TABLE IF NOT EXISTS public.public_rate_limits (")
end_anchor = "ON public.public_rate_limits (updated_at);"
end = source.index(end_anchor, start) + len(end_anchor)
snippet = source[start:end]
assert "FOR UPDATE;" in snippet and "SECURITY DEFINER" in snippet
assert "ON CONFLICT (scope, key) DO NOTHING" in snippet

print("-- Only inside the isolated, synthetic CI PostgreSQL database.")
print("DROP FUNCTION public.check_public_rate_limit(text,text,integer,integer,integer);")
print("DROP TABLE public.public_rate_limits;")
print(snippet)
print("REVOKE ALL ON FUNCTION public.check_public_rate_limit(text,text,integer,integer,integer) FROM PUBLIC;")
print("REVOKE ALL ON TABLE public.public_rate_limits FROM PUBLIC, authenticated, anon;")
