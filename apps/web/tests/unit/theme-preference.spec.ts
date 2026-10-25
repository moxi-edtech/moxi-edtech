import assert from "node:assert/strict";
import { test } from "node:test";
import { parseThemePreference, resolveDarkTheme } from "../../src/lib/theme-preference";

test("aceita apenas preferências suportadas", () => {
  assert.equal(parseThemePreference("dark"), "dark");
  assert.equal(parseThemePreference("light"), "light");
  assert.equal(parseThemePreference("system"), "system");
  for (const value of [null, undefined, "automatic", "", 1]) {
    assert.equal(parseThemePreference(value), "system");
  }
});

test("preferência explícita prevalece sobre o sistema", () => {
  assert.equal(resolveDarkTheme("dark", false), true);
  assert.equal(resolveDarkTheme("light", true), false);
});

test("preferência sistema acompanha o dispositivo", () => {
  assert.equal(resolveDarkTheme("system", true), true);
  assert.equal(resolveDarkTheme("system", false), false);
});
