import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { test } from "node:test";

const code = relative => readFileSync(new URL(relative, import.meta.url), "utf8");

test("ModuleSwitcher was deliberately removed from the KLASSE topbar", () => {
  const topbar = code("../../src/components/layout/klasse/Topbar.tsx");
  assert.doesNotMatch(topbar, /ModuleSwitcher(?:Inner)?/);
  assert.match(topbar, /<ThemeToggle\b/);
  assert.match(topbar, /<ThemePreferences\b/);
  assert.match(topbar, /<CommandPalette\b/);
});

test("Legacy PortalLayout no longer restores ModuleSwitcher", () => {
  const portal = code("../../src/components/layout/PortalLayout.tsx");
  assert.doesNotMatch(portal, /ModuleSwitcher(?:Inner)?/);
});

test("Legacy ModuleSwitcher entry point is absent", () => {
  assert.equal(existsSync(new URL("../../src/components/layout/klasse/ModuleSwitcher.tsx", import.meta.url)), false);
});

test("ThemeSwitcher retains light, dark and system preferences", () => {
  const prefs = code("../../src/components/ThemePreferences.tsx");
  assert.match(prefs, /id:\s*"light"/);
  assert.match(prefs, /id:\s*"dark"/);
  assert.match(prefs, /id:\s*"system"/);
});
