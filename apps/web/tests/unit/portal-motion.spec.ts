import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { portalMotion, portalMotionSeconds } from "../../src/components/portal/motion/motion-tokens";
const read = (path: string) => readFileSync(new URL("../../src/" + path, import.meta.url), "utf8");

test("academic motion is short, scoped and respects reduced motion", () => {
  assert.equal(portalMotionSeconds(portalMotion.tab), 0.2);
  assert.equal(portalMotion.sheet, 280);
  for (const duration of [portalMotion.press, portalMotion.tab, portalMotion.sheet, portalMotion.disclosure, portalMotion.feedback]) assert.ok(duration > 0 && duration <= 300);
  const css = read("app/globals.css");
  assert.match(css, /prefers-reduced-motion: no-preference/);
  assert.match(css, /pointer: coarse/);
  assert.match(css, /scale\(0\.98\)/);
  assert.match(css, /\.klasse-academic-mobile \.klasse-portal-motion-sheet/);
  const tabs = read("components/portal/ui/PortalTabs.tsx");
  assert.match(tabs, /useReducedMotion/);
  assert.match(tabs, /layoutId=\{reduceMotion \? undefined : "active-tab"\}/);
  assert.match(tabs, /duration: reduceMotion \? 0/);
  assert.match(tabs, /aria-selected=\{value === tab.id\}/);
});
test("save feedback reflects existing state without timers or network operations", () => {
  const feedback = read("components/portal/motion/MotionFeedback.tsx");
  assert.match(feedback, /aria-live="polite"/);
  assert.match(feedback, /previous.current === label/);
  assert.match(feedback, /prefers-reduced-motion: reduce/);
  assert.doesNotMatch(feedback, /fetch\(|setTimeout|setInterval/);
  const grid = read("components/professor/GradeEntryGrid.tsx");
  assert.match(grid, /isSaving \|\| hasPendingSave/);
  assert.match(grid, /hasSaveError/);
  assert.match(grid, /<MotionFeedback label=\{savingIndicator.label\}/);
});
