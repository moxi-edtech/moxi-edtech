import assert from "node:assert/strict";
import { test } from "node:test";
import { isLightOnlyPortalPath, parseThemePreference, resolveDarkTheme } from "../../src/lib/theme-preference";

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

test("portais de aluno e professor mantêm tema claro sem afetar áreas administrativas", () => {
  for (const path of [
    "/aluno", "/aluno/dashboard", "/professor", "/professor/turmas",
    "/escola/escola-klasse/aluno/academico",
    "/escola/123/professor/diario",
  ]) {
    assert.equal(isLightOnlyPortalPath(path), true, path);
  }
  for (const path of [
    "/", "/login", "/admin", "/professores", "/alunos", "/professorado",
    "/escola/escola-klasse/admin", "/escola/escola-klasse/professores",
    "/escola/escola-klasse/alunos", "/escola/escola-klasse/secretaria",
    "/escola/escola-klasse/professorado",
    null, undefined,
  ]) {
    assert.equal(isLightOnlyPortalPath(path), false, String(path));
  }
});
