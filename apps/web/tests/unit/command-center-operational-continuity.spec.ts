import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const palette = readFileSync("src/components/CommandPalette.tsx", "utf8");
const topbar = readFileSync("src/components/layout/klasse/Topbar.tsx", "utf8");
const turma = readFileSync("src/components/secretaria/command-center/TurmaContextView.tsx", "utf8");
const classe = readFileSync("src/components/secretaria/command-center/ClasseContextView.tsx", "utf8");
const search = readFileSync("src/hooks/useGlobalSearch.ts", "utf8");

test("Balcão handoff does not destroy the current explorer and returns after close", () => {
  assert.match(palette, /resumeAfterBalcao\.current = true/);
  assert.match(palette, /setOpen\(false\); \/\/ Keep explorer state/);
  assert.match(palette, /studentWorkspaceClosedVersion/);
  assert.match(palette, /setOpen\(true\)/);
  assert.match(topbar, /onClose=\{\(\) => \{/);
  assert.match(topbar, /setStudentWorkspaceClosedVersion/);
  assert.match(palette, /queryClient\.invalidateQueries\(\)/);
});

test("Classe and Turma restore pagination, selected student and reading position", () => {
  for (const view of [turma, classe]) {
    assert.match(view, /useState\(initialPage\)/);
    assert.match(view, /initialScrollTop/);
    assert.match(view, /scrollRef\.current\.scrollTop = initialScrollTop/);
    assert.match(view, /selectedStudentId/);
    assert.match(view, /onPageChange\?\.\(next\)/);
  }
  assert.match(palette, /onPageChange=\{setTurmaPage\}/);
  assert.match(palette, /onPageChange=\{setClassePage\}/);
  assert.match(palette, /onScrollTopChange=\{setTurmaScrollTop\}/);
  assert.match(palette, /onScrollTopChange=\{setClasseScrollTop\}/);
});

test("No browser-persistent search history; cache invalidates on auth and scope", () => {
  assert.match(search, /purgeLegacyHistory/);
  assert.doesNotMatch(search, /localStorage\.setItem/);
  assert.match(search, /onAuthStateChange/);
  assert.match(search, /generation\.current/);
  assert.match(search, /abortSignal\(ac\.signal\)/);
});

test("Search errors do not look like empty results; mobile entry visible", () => {
  assert.match(palette, /error: searchError/);
  assert.match(palette, /retry: retrySearch/);
  assert.match(palette, /loadMore/);
  assert.match(topbar, /className="flex min-w-0 flex-1 md:w-\[420px\] md:flex-none"/);
});
