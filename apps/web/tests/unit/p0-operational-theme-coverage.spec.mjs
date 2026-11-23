import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const repoFile = (path) =>
  readFileSync(new URL("../../../../" + path, import.meta.url), "utf8");
const inventory = JSON.parse(
  repoFile("docs/product/KLASSE_THEME_P0_INVENTORY_20261122.json"),
);
const files = inventory.files.map(({ name }) => name);

// The invariant applies to standard operating chrome (surfaces, text, borders).
// Semantic status colors and deliberately dark panels are different contracts.
const fixedNeutral =
  /(?<![\w:/-])(?:(?:hover|focus|group-hover|focus-visible):)?(?:bg-(?:white(?:\/(?:[4-9]\d|100))?|(?:slate|gray|zinc)-(?:50|100|200|300)(?:\/\d+)?)|(?:text|placeholder:text)-(?:slate|gray|zinc)-(?:400|500|600|700|800|900|950)(?:\/\d+)?|(?:border|divide|ring)-(?:slate|gray|zinc)-(?:100|200|300|400)(?:\/\d+)?)(?![\w/-])/g;

test("P0 theme migration manifest contains four operational groups and no fiscal/print files", () => {
  assert.equal(files.length, 184);
  assert.equal(new Set(files).size, files.length);
  assert.deepEqual(
    Object.keys(inventory.groups).sort(),
    ["app/escola", "app/secretaria", "components/escola", "components/secretaria"].sort(),
  );
  assert.deepEqual(
    Object.entries(inventory.groups)
      .map(([key, value]) => [key, value.files])
      .sort(([a], [b]) => a.localeCompare(b)),
    [
      ["app/escola", 68],
      ["app/secretaria", 30],
      ["components/escola", 19],
      ["components/secretaria", 67],
    ].sort(([a], [b]) => a.localeCompare(b)),
  );
  for (const file of files) {
    assert.match(file, /^apps\/web\/src\/(?:app\/(?:escola|secretaria)|components\/(?:secretaria|escola))\//);
    assert.doesNotMatch(file, /\/(?:api|fiscal|_print|print|imprimir|pdf|professor|aluno)\//i);
    assert.doesNotMatch(file, /\/onboarding\.bak\//);
  }
});

test("P0 operational surfaces have no fixed neutral classes after theme conversion", () => {
  const violations = [];
  for (const file of files) {
    const source = repoFile(file);
    for (const match of source.matchAll(fixedNeutral)) {
      const lineNumber = source.slice(0, match.index).split("\n").length;
      violations.push(`${file}:${lineNumber} ${match[0]}`);
    }
  }
  assert.deepEqual(violations, [], violations.join("\n"));
});

test("P0 operational components have no leftover inline brand utility hex", () => {
  const hex = /(?:bg|text|border|ring|from|via|to|outline)-\[#(?:1F6B3B|E3B23C)\]/gi;
  const violations = [];
  for (const file of files) {
    if (hex.test(repoFile(file))) violations.push(file);
    hex.lastIndex = 0;
  }
  assert.deepEqual(violations, []);
});

test("existing theme provider and light-only portal policy remain unchanged", () => {
  assert.match(repoFile("apps/web/src/lib/theme-preference.ts"), /LIGHT_ONLY_PORTAL_PATH_PATTERN/);
  assert.match(repoFile("apps/web/src/components/providers/ThemeProvider.tsx"), /lightOnlyPortal/);
});
