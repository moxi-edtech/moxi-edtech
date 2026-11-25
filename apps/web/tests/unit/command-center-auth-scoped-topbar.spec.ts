import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

// Guard against a regression in which Topbar.userScope is optional but no
// AppShell caller ever passes a verified actor identifier.
const appShell = readFileSync(new URL("../../src/components/layout/klasse/AppShell.tsx", import.meta.url), "utf8");
const topbar = readFileSync(new URL("../../src/components/layout/klasse/Topbar.tsx", import.meta.url), "utf8");

test("CC-003 Topbar scope follows verified Supabase Auth actor, not userName", () => {
  assert.match(appShell, /supabase\.auth\.getUser\(\)/);
  assert.match(appShell, /setUserScope\(user\?\.id \?\? null\)/);
  assert.match(appShell, /userScope=\{userScope\}/);
  assert.match(topbar, /props\.userScope \?\? "-"/);
  assert.match(topbar, /return <ScopedTopbar key=\{scope\}/);
});
test("CC-003 auth switch invalidates student modal and stale lookup requests", () => {
  assert.match(appShell, /onAuthStateChange/);
  assert.match(appShell, /"SIGNED_OUT"/);
  assert.match(appShell, /"SIGNED_IN"/);
  assert.match(appShell, /requestVersion !== authVersion/);
  assert.match(appShell, /subscription\.unsubscribe\(\)/);
  assert.match(topbar, /clearExplorerReturnContext\(\)/);
});

test("professor topbar has no global search trigger or mounted command palette", () => {
  assert.match(topbar, /const showCommandCenter = portal !== "professor";/);
  const branch = topbar.slice(topbar.indexOf("{showCommandCenter ? ("), topbar.indexOf('<div className="ml-auto flex'));
  assert.match(branch, /\{showCommandCenter \? \(/);
  const [enabled, disabled] = branch.split(") : (");
  assert.ok(disabled, "the teacher branch must not render the global search");
  assert.match(enabled, /Pesquisar ou digitar acção/);
  assert.match(enabled, /aria-label="Pesquisar ou abrir Command Center"/);
  assert.match(enabled, /<CommandPalette\b/);
  assert.doesNotMatch(disabled, /<CommandPalette\b|<Search\b|setPaletteOpen/);
  assert.equal((topbar.match(/<CommandPalette\b/g) ?? []).length, 1);
  assert.match(topbar, /props\.portal \?\? "-"/);
  assert.match(topbar, /<NotificacoesDropdown/);
  assert.match(topbar, /<SignOutButton/);
});
