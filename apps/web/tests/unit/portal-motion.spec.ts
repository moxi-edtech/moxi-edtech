import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { parseMotionDuration } from "../../src/components/portal/motion/motion-tokens";
const read = (path: string) => readFileSync(new URL("../../src/" + path, import.meta.url), "utf8");

test("CSS is the sole source of durations; values are short and parse safely", () => {
  const css = read("app/globals.css");
  for (const token of ["press","tab","sheet","feedback","disclosure"]) {
    const declarations = [...css.matchAll(new RegExp("--portal-motion-" + token + ":\\s*([^;]+);", "g"))];
    assert.equal(declarations.length, 1, token);
    const duration = parseMotionDuration(declarations[0][1]);
    assert.ok(duration > 0 && duration <= 300, token);
  }
  assert.equal(parseMotionDuration("0.2s"), 200);
  assert.equal(parseMotionDuration(" 280ms "), 280);
  for (const invalid of ["", "-1ms", "100", "NaNms"]) assert.equal(parseMotionDuration(invalid), 0);
  assert.match(css, /prefers-reduced-motion: no-preference/);
  assert.match(css, /pointer: coarse/);
  assert.match(css, /scale\(0\.98\)/);
  const tabs = read("components/portal/ui/PortalTabs.tsx");
  assert.equal((tabs.match(/data-portal-motion-indicator=/g) ?? []).length, 1);
  assert.match(tabs, /"--portal-tab-index": selectedIndex/);
  assert.match(tabs, /aria-selected=\{value === tab.id\}/);
  const nav = read("components/layout/klasse/PortalBottomNav.tsx");
  assert.match(nav, /<PortalSheet/);
  const sheet = read("components/portal/ui/PortalSheet.tsx");
  assert.match(sheet, /present = open \|\| retained/);
  assert.match(sheet, /onAnimationEnd/);
  assert.match(sheet, /readMotionDuration\(content.current, "sheet"\)/);
  assert.match(sheet, /onCloseAutoFocus/);
});

test("save feedback reflects existing state without timers or network operations", () => {
  const feedback = read("components/portal/motion/MotionFeedback.tsx");
  assert.match(feedback, /aria-live="polite"/);
  assert.match(feedback, /previous.current === label/);
  assert.match(feedback, /readMotionDuration\(element, "feedback"\)/);
  assert.match(feedback, /prefers-reduced-motion: reduce/);
  assert.doesNotMatch(feedback, /fetch\(|setTimeout|setInterval/);
  const grid = read("components/professor/GradeEntryGrid.tsx");
  assert.match(grid, /isSaving \|\| hasPendingSave/);
  assert.match(grid, /hasSaveError/);
  assert.match(grid, /<MotionFeedback label=\{savingIndicator.label\}/);
});

test("outside pointer dismissal preserves modal focus until the retained exit finishes", () => {
  const sheet = read("components/portal/ui/PortalSheet.tsx");
  assert.match(sheet, /onPointerDownOutside/);
  assert.match(sheet, /event\.detail\.originalEvent\.preventDefault\(\)/);
  assert.match(sheet, /onFocusOutside/);
  assert.match(sheet, /const requestClose = \(\) => \{/);
  assert.match(sheet, /if \(busy \|\| closing \|\| !open\) return/);
  assert.match(sheet, /useLayoutEffect\(\(\) => \{/);
  const css = read("app/globals.css");
  assert.doesNotMatch(css, /klasse-context-sheet-exit[^;]*; pointer-events: none/);
});
