import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
const root = new URL("../../../../", import.meta.url);
const read = path => readFileSync(new URL(path, root), "utf8");
const sql = read("supabase/migrations/20271205090100_super_admin_user_presence.sql");
const provider = read("apps/web/src/components/session/SessionLockProvider.tsx");
const host = read("apps/web/src/components/super-admin/CommandCenterWorkspace.tsx");
const dashboard = read("apps/web/src/app/super-admin/page.tsx");
const modal = read("apps/web/src/components/super-admin/ActiveUsersWorkspace.tsx");

test("presence is deduplicated by authenticated identity and server clock, with bounded updates", () => {
  assert.match(sql, /user_id uuid PRIMARY KEY REFERENCES auth.users\(id\) ON DELETE CASCADE/);
  assert.match(sql, /v_uid uuid := auth.uid\(\)/);
  assert.match(sql, /VALUES \(v_uid, v_now\)/);
  assert.match(sql, /ON CONFLICT \(user_id\) DO UPDATE/);
  assert.match(sql, /WHERE presence.last_seen_at <= v_now - interval '2 minutes'/);
  assert.match(provider, /if \(excluded \|\| !user \|\| locked\) return;/);
  assert.match(provider, /document.visibilityState === "visible"/);
  assert.match(provider, /now - last >= 120_000/);
  assert.match(provider, /supabase.rpc\("klasse_touch_presence"\)/);
});
test("global read has a DB authorization guard, private RLS table and restricted grants", () => {
  assert.match(sql, /ENABLE ROW LEVEL SECURITY/);
  assert.match(sql, /REVOKE ALL ON TABLE .* FROM PUBLIC, anon, authenticated/);
  assert.match(sql, /p.role::text IN \('super_admin', 'global_admin', 'superadmin'\)/);
  assert.match(sql, /REVOKE ALL ON FUNCTION public.klasse_admin_active_users\(integer,integer,text\) FROM PUBLIC, anon, authenticated/);
  assert.match(sql, /GRANT EXECUTE ON FUNCTION public.klasse_admin_active_users\(integer,integer,text\) TO authenticated/);
  assert.match(sql, /SECURITY INVOKER SET search_path = ''/);
  assert.match(sql, /interval '5 minutes'/);
  assert.match(sql, /least\(coalesce\(p_limit, 50\), 50\)/);
});
test("dashboard count is separate from registered profiles and opens the shared modal", () => {
  assert.match(dashboard, /rpc\("klasse_admin_active_users", \{ p_limit: 0/);
  assert.match(host, /onClick=\{\(\) => open\("\/super-admin\/usuarios\/activos"\)\}/);
  assert.match(host, /activeUsers == null \? "—"/);
  assert.match(host, /case "\/super-admin\/usuarios\/activos": return <ActiveUsers/);
  assert.match(modal, /PAGE_SIZE = 50/);
  assert.match(modal, /abortSignal\(controller.signal\)/);
  assert.match(modal, /Não representa sessões ligadas em tempo real/);
});
