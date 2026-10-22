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
  assert.doesNotMatch(snapshot, /(?:window\.)?(?:localStorage|sessionStorage)\.(?:setItem|getItem)\(/);
});

test("Classe and Turma have explicit pagination controls", () => {
  for (const view of [turma, classe]) {
    assert.match(view, /useState\(initialPage\)/);
    assert.match(view, /setPage/);
  }
  assert.match(snapshot, /selectedStudentId/);
  assert.match(snapshot, /scrollTop/);
  assert.match(palette, /viewState: viewStateRef.current/);
  for (const view of [turma, classe]) {
    assert.match(view, /initialPage/);
    assert.match(view, /initialScrollTop/);
    assert.match(view, /onViewChange/);
    assert.match(view, /data-student-id/);
  }
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

test("P0 session scope rejects another user, school, polo, year or portal", () => {
  assert.match(snapshot, /sameExplorerScope/);
  for (const key of ["userId", "escolaId", "poloId", "academicYearId", "portal"]) {
    assert.match(snapshot, new RegExp(`a\\.${key} === b\\.${key}`));
  }
  assert.match(palette, /getExplorerScope/);
  assert.match(palette, /sessionUserId/);
  assert.match(snapshot, /MAX_AGE_MS/);
});

test("P0 search cancellation rejects obsolete responses and bounds memory", () => {
  assert.match(search, /generationRef/);
  assert.match(search, /abortSignal\(ac\.signal\)/);
  assert.match(search, /if \(!isCurrent\(\)\) return/);
  assert.match(search, /pagingAbortRef\.current\?\.abort\(\)/);
  assert.match(search, /SEARCH_CACHE_LIMIT/);
  assert.match(search, /recentSessionStore\.clear\(\)/);
});

test("P0 missing pupil selection produces an actionable, accessible notice", () => {
  for (const view of [turma, classe]) {
    assert.match(view, /pendingReturnCheck/);
    assert.match(view, /setReturnWarning\(true\)/);
    assert.match(view, /role="status"/);
  }
});
