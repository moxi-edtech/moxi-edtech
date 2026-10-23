import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  clearExplorerReturnContext, consumeExplorerReturnContext,
  peekExplorerReturnContext, retainExplorerViewState, saveExplorerReturnContext,
  type ExplorerScope, type ExplorerViewState,
} from "../../src/lib/command-center/explorer-return-context";


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
    assert.match(view, /selectedStudentId &&/);
    assert.match(view, /!visibleStudents\.some/);
    assert.match(view, /returnWarning &&/);
    assert.match(view, /role="status"/);
  }
});

test("EX-004: three consecutive students preserve one school/year-scoped Turma return state", () => {
  clearExplorerReturnContext();
  const scope: ExplorerScope = {
    userId: "actor-fixture", escolaId: "school-fixture", poloId: null,
    academicYearId: "year-fixture", portal: "secretaria",
  };
  const entity = {
    type: "turma" as const, id: "turma-fixture", label: "Turma de teste",
    escolaId: scope.escolaId, academicYearId: scope.academicYearId,
  };
  const key = `turma:${entity.id}:${scope.academicYearId}`;
  let states: Record<string, ExplorerViewState> = {};
  const students = [
    { id: "student-1", page: 1, scrollTop: 120, search: "" },
    { id: "student-2", page: 2, scrollTop: 350, search: "Lu" },
    { id: "student-3", page: 2, scrollTop: 620, search: "Lu" },
  ];
  for (const student of students) {
    states = retainExplorerViewState(states, key, {
      page: student.page, scrollTop: student.scrollTop,
      selectedStudentId: student.id, search: student.search,
      sort: "nome_asc", filter: "todos",
    });
    saveExplorerReturnContext({
      scope, escolaId: scope.escolaId, entityContext: entity,
      contextTrail: [], courseClassId: null, courseTurmaId: null,
      viewState: states,
    });
    assert.deepEqual(peekExplorerReturnContext(scope)?.viewState[key], {
      page: student.page, scrollTop: student.scrollTop,
      selectedStudentId: student.id, search: student.search,
      sort: "nome_asc", filter: "todos",
    });
    const restored = consumeExplorerReturnContext(scope);
    assert.equal(restored?.entityContext.id, entity.id);
    assert.equal(restored?.viewState[key]?.selectedStudentId, student.id);
    assert.equal(consumeExplorerReturnContext(scope), null);
  }
  saveExplorerReturnContext({
    scope, escolaId: scope.escolaId, entityContext: entity,
    contextTrail: [], courseClassId: null, courseTurmaId: null,
    viewState: states,
  });
  assert.equal(peekExplorerReturnContext({ ...scope, escolaId: "another-school" }), null);
  assert.equal(peekExplorerReturnContext(scope), null);
  clearExplorerReturnContext();
});

test("EX-004: command palette owns Turma scrolling; restoration waits for roster", () => {
  const roster = readFileSync("src/hooks/useExplorerRoster.ts", "utf8");
  assert.match(palette, /scrollContainerRef=\{contextualScrollRef\}/);
  assert.match(palette, /contextualScrollRef\.current\.scrollTop/);
  assert.match(turma, /scrollContainerRef\?\.current/);
  assert.match(turma, /scrollRestored\.current/);
  assert.match(turma, /requestAnimationFrame/);
  assert.match(turma, /if \(loading \|\| !container/);
  assert.doesNotMatch(turma, /ref=\{scrollRef\} onScroll/);
  assert.match(roster, /const querySettled = debounced === search\.trim\(\)/);
  assert.match(turma, /roster\.querySettled \? roster\.items : \[\]/);
  assert.match(turma, /!roster\.querySettled/);
  assert.match(turma, /O aluno selecionado não está nesta página ou nos filtros atuais/);
  assert.match(palette, /<ClasseContextView scrollContainerRef=\{contextualScrollRef\}/);
  assert.match(classe, /scrollContainerRef\?\.current/);
  assert.match(classe, /scrollRestored\.current/);
  assert.match(classe, /roster\.querySettled \? roster\.items : \[\]/);
  assert.doesNotMatch(classe, /ref=\{scrollRef\} onScroll/);
});
