import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { test } from "node:test";

const src = new URL("../../src/", import.meta.url);
const read = (path) => readFileSync(new URL(path, src), "utf8");
const frozenNeutral = /(?<![\w/-])(?:bg-white|bg-(?:slate|gray|zinc|neutral|stone)-\d+|text-(?:slate|gray|zinc|neutral|stone)-\d+|(?:border|divide|ring)-(?:slate|gray|zinc|neutral|stone)-\d+|ring-white)(?:\/\d+)?(?![\w/-])/g;

test("all super-admin page surfaces and owned components use semantic neutral tokens", () => {
  for (const folder of ["app/super-admin", "components/super-admin"]) {
    const paths = readdirSync(new URL(folder + "/", src), { recursive: true }).filter(path => path.endsWith(".tsx"));
    assert.ok(paths.length > 0);
    for (const path of paths) {
      const content = read(folder + "/" + path);
      assert.deepEqual([...content.matchAll(frozenNeutral)].map(m => m[0]), [], folder + "/" + path);
    }
  }
});

test("Super Admin inherits the shared theme controls and preference provider", () => {
  assert.match(read("app/super-admin/layout.tsx"), /<AppShell>/);
  const topbar = read("components/layout/klasse/Topbar.tsx");
  assert.match(topbar, /portal !== "aluno" && portal !== "professor"/);
  assert.match(topbar, /showThemeControls && <ThemeToggle/);
  assert.match(topbar, /<ThemePreferences\s*\/>/);
  const preferences = read("components/ThemePreferences.tsx");
  for (const theme of ["light", "dark", "system"]) assert.match(preferences, new RegExp('id: "' + theme + '"'));
  assert.match(read("components/providers/ThemeProvider.tsx"), /localStorage\.setItem/);
});

test("school list follows theme rather than forcing a dark surface", () => {
  const list = read("components/super-admin/escolas/SchoolsTableClient.tsx");
  assert.match(list, /min-w-0 rounded-xl bg-background/);
  assert.match(list, /bg-card ring-1 ring-border/);
});

test("health and onboarding status colors include dark-mode contrast variants", () => {
  for (const [path, color] of [
    ["components/super-admin/health/SystemStatus.tsx", "green"],
    ["components/super-admin/health/SchoolsTab.tsx", "emerald"],
    ["components/super-admin/health/AlertsTab.tsx", "red"],
    ["app/super-admin/onboarding/page.tsx", "amber"],
  ]) {
    const source = read(path);
    assert.match(source, new RegExp("dark:bg-" + color + "-950/30"), path);
    assert.match(source, new RegExp("dark:text-" + color + "-(?:200|300)"), path);
  }
});
