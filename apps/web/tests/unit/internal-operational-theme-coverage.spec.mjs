import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const relativePaths = [
  "onboarding/CurriculumSelector.tsx",
  "onboarding/LogoUpload.tsx",
  "onboarding/MatrixTable.tsx",
  "onboarding/StepFooter.tsx",
  "onboarding/StepHeader.tsx",
  "onboarding/TurnosField.tsx",
  "shared/AcaoRapidaCard.tsx",
  "shared/SecaoLabel.tsx",
  "shared/StatCard.tsx",
  "migracao/ColumnMapper.tsx",
  "migracao/MatriculasEmMassa.tsx",
  "financeiro/ExtratoActions.tsx",
  "financeiro/MissingPricingAlert.tsx",
  "financeiro/PricingConfigurationModal.tsx",
  "financeiro/ReverterPagamentoButton.tsx",
  "escola-admin/AlunosListClient.tsx",
  "feedback/FeedbackSystem.tsx",
  "session/SessionLockProvider.tsx",
  "dashboard/KpiCardSkeleton.tsx",
  "dashboard/NoticePanelSkeleton.tsx",
  "auth/SignOutButton.tsx",
  "system/ConfigHealthBanner.tsx",
  "layout/shared/SidebarContainer.tsx",
];

const source = (relativePath) =>
  readFileSync(new URL("../../src/components/" + relativePath, import.meta.url), "utf8");

// Only neutral operational chrome: status colors and deliberately dark brand
// sidebars/overlays have independent contrast contracts.
const frozenNeutral =
  /(?<![\w:/-])(?:(?:hover|focus|group-hover|focus-visible|disabled|placeholder):)?(?:bg-(?:white(?:\/(?:[4-9]\d|100))?|(?:slate|gray|zinc)-(?:50|100|200|300)(?:\/\d+)?)|(?:text|placeholder:text)-(?:slate|gray|zinc)-(?:400|500|600|700|800|900|950)(?:\/\d+)?|(?:border|divide|ring)-(?:slate|gray|zinc)-(?:100|200|300|400)(?:\/\d+)?)(?![\w/-])/g;

test("internal operational theme manifest tracks 23 independent TSX modules", () => {
  assert.equal(relativePaths.length, 23);
  assert.equal(new Set(relativePaths).size, relativePaths.length);
  for (const path of relativePaths) {
    assert.doesNotMatch(path, /(?:fiscal|onboarding\.bak|print|pdf|aluno|professor)\//i);
    assert.ok(source(path).length > 0, path);
  }
});

test("internal operational components do not freeze neutral backgrounds, borders or text", () => {
  const violations = [];
  for (const path of relativePaths) {
    const content = source(path);
    for (const match of content.matchAll(frozenNeutral)) {
      const line = content.slice(0, match.index).split("\n").length;
      violations.push(path + ":" + line + " " + match[0]);
    }
  }
  assert.deepEqual(violations, [], violations.join("\n"));
});

test("brand colors use KLASSE shared tokens, not new inline hex palettes", () => {
  for (const path of relativePaths) {
    assert.doesNotMatch(source(path), /#(?:1F6B3B|E3B23C|185830|9a7010)\b/i, path);
  }
});

test("operational selections, warnings and the financial reversal preserve semantic contrast", () => {
  const curriculum = source("onboarding/CurriculumSelector.tsx");
  const schedule = source("onboarding/MatrixTable.tsx");
  const payment = source("financeiro/ReverterPagamentoButton.tsx");
  const pricing = source("financeiro/MissingPricingAlert.tsx");
  const students = source("escola-admin/AlunosListClient.tsx");

  assert.match(curriculum, /border-klasse-gold/);
  assert.match(curriculum, /text-klasse-gold-900/);
  assert.match(schedule, /role="region" aria-label="Matriz de turmas por turno" tabIndex=\{0\}/);
  assert.match(payment, /bg-card/);
  assert.match(payment, /dark:text-rose-300/);
  assert.match(pricing, /dark:bg-amber-950\/40/);
  assert.match(pricing, /bg-klasse-gold/);
  assert.match(students, /text-klasse-gold-900/);
  assert.match(students, /bg-klasse-green/);
});

test("global chrome, lock screen and loading surfaces honor active theme tokens", () => {
  const feedback = source("feedback/FeedbackSystem.tsx");
  const locked = source("session/SessionLockProvider.tsx");
  const skeleton = source("dashboard/NoticePanelSkeleton.tsx");
  const action = source("shared/AcaoRapidaCard.tsx");
  assert.match(feedback, /bg-card/);
  assert.match(feedback, /text-foreground/);
  assert.match(locked, /bg-klasse-dark\/85/);
  assert.match(locked, /bg-card/);
  assert.match(skeleton, /bg-muted-foreground\/15/);
  assert.match(action, /bg-card/);
});
