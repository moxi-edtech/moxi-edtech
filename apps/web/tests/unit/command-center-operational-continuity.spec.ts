import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const palette = readFileSync("src/components/CommandPalette.tsx", "utf8");
const topbar = readFileSync("src/components/layout/klasse/Topbar.tsx", "utf8");
const turma = readFileSync("src/components/secretaria/command-center/TurmaContextView.tsx", "utf8");
const classe = readFileSync("src/components/secretaria/command-center/ClasseContextView.tsx", "utf8");
const search = readFileSync("src/hooks/useGlobalSearch.ts", "utf8");
const snapshot = readFileSync("src/lib/command-center/explorer-return-context.ts", "utf8");

test("Balcão return uses one session-scoped explorer handoff", () => {
  assert.match(palette, /saveExplorerReturnContext/);
  assert.match(palette, /consumeExplorerReturnContext/);
  assert.match(topbar, /restoreExplorerOnOpen/);
  assert.match(topbar, /clearExplorerReturnContext/);
  assert.match(snapshot, /escolaId: string/);
  assert.doesNotMatch(snapshot, /localStorage|sessionStorage/);
});

test("Classe and Turma have explicit pagination controls", () => {
  for (const view of [turma, classe]) {
    assert.match(view, /useState\(1\)/);
    assert.match(view, /setPage/);
  }
  // Follow-up backlog: snapshot currently lacks page, sort, scroll and focus.
  assert.doesNotMatch(snapshot, /selectedStudentId|scrollTop/);
});

test("Search recents are in-memory only and cleared on auth changes", () => {
  assert.match(search, /recentSessionStore/);
  assert.match(search, /localStorage\.removeItem/);
  assert.doesNotMatch(search, /localStorage\.setItem/);
  assert.match(search, /recentSessionStore\.clear\(\)/);
});

test("Search exposes distinct errors, load-more and mobile entry", () => {
  assert.match(palette, /error: searchError/);
  assert.match(palette, /clearError/);
  assert.match(palette, /loadMore/);
  assert.match(topbar, /CommandPalette/);
  assert.match(palette, /Fechar pesquisa/);
});
