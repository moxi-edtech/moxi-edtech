import assert from "node:assert/strict";
import test from "node:test";

import { checkGlobalSearchContract } from "./kf2-search-audit-core";

const hookFile = "apps/web/src/hooks/useGlobalSearch.ts";
const sqlFile = "supabase/migrations/20990101000000_search_global.sql";
const globalSearchFile = "apps/web/src/components/GlobalSearch.tsx";
const commandPaletteFile = "apps/web/src/components/CommandPalette.tsx";

const goodHook = `
const debouncedQuery = useDebounce(effectiveQuery, 300);
const limit = Math.min(8, 50);
if (!escolaId || !q || q.length < 2) return;
await supabase.rpc("search_global_entities", {
  p_limit: limit,
  p_cursor_score: pageCursor?.score,
  p_cursor_updated_at: pageCursor?.updated_at,
  p_cursor_created_at: pageCursor?.created_at,
  p_cursor_id: pageCursor?.id,
});
await supabase.rpc("search_global_entities", {
  p_limit: Math.min(8, 50),
  p_cursor_score: cursor.score,
  p_cursor_updated_at: cursor.updated_at,
  p_cursor_created_at: cursor.created_at,
  p_cursor_id: cursor.id,
});
`;

const goodSql = `
create or replace function public.search_global_entities(...) returns table(...) as $$
declare
  v_query text := coalesce(trim(p_query), '');
  v_limit int := least(greatest(coalesce(p_limit, 10), 1), 50);
begin
  if not public.has_access_to_escola_fast(p_escola_id) then raise exception 'forbidden'; end if;
  if v_query = '' or length(v_query) < 2 then return; end if;
  with ranked as (
    select * from source b where b.escola_id = p_escola_id
  ), filtered as (
    select * from ranked
    where (score, updated_at, created_at, id)
      < (p_cursor_score, p_cursor_updated_at, p_cursor_created_at, p_cursor_id)
  ), candidates as (
    select * from filtered
    order by score desc, updated_at desc, created_at desc, id desc
    limit v_limit
  )
  select * from candidates c
  order by c.score desc, c.updated_at desc, c.created_at desc, c.id desc;
end;
$$;
`;

function run(overrides: Partial<Parameters<typeof checkGlobalSearchContract>[0]> = {}) {
  return checkGlobalSearchContract({
    hookFile,
    hookContent: goodHook,
    sqlFile,
    sqlContent: goodSql,
    globalSearchFile,
    globalSearchContent: "useGlobalSearch(escolaId)",
    commandPaletteFile,
    commandPaletteContent: "useGlobalSearch(escolaId)",
    ...overrides,
  });
}

test("accepts the documented KF2 global-search contract", () => {
  assert.deepEqual(run(), []);
});

test("fails when debounce leaves the 250-400ms contract", () => {
  const findings = run({ hookContent: goodHook.replace("300", "100") });
  assert.ok(findings.some((item) => item.error.includes("Debounce")));
});

test("fails when a RPC p_limit is not provably bounded to 50", () => {
  const findings = run({
    hookContent: goodHook.replace("p_limit: Math.min(8, 50)", "p_limit: requestedLimit"),
  });
  assert.ok(findings.some((item) => item.error.includes("p_limit sem limite superior")));
});

test("fails when the SQL RPC removes the server-side limit clamp", () => {
  const findings = run({
    sqlContent: goodSql.replace(
      "v_limit int := least(greatest(coalesce(p_limit, 10), 1), 50);",
      "v_limit int := coalesce(p_limit, 10);",
    ),
  });
  assert.ok(findings.some((item) => item.error.includes("clamp server-side")));
});

test("fails when deterministic ordering is removed", () => {
  const findings = run({
    sqlContent: goodSql.replace(
      "order by score desc, updated_at desc, created_at desc, id desc",
      "order by score desc",
    ),
  });
  assert.ok(findings.some((item) => item.error.includes("ORDER BY determinístico antes")));
});

test("fails when tenant isolation is removed", () => {
  const findings = run({
    sqlContent: goodSql.replace("where b.escola_id = p_escola_id", "where true"),
  });
  assert.ok(findings.some((item) => item.error.includes("tenant")));
});
