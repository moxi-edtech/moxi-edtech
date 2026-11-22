import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const files = [
  "apps/web/src/components/secretaria/TurmasListClient.tsx",
  "apps/web/src/components/secretaria/TurmaDetailClient.tsx",
  "apps/web/src/components/secretaria/BalcaoAtendimento.tsx",
  "apps/web/src/components/secretaria/RematriculaBalcaoModal.tsx",
  "apps/web/src/components/secretaria/RematriculaBalcaoCard.tsx",
  "apps/web/src/components/secretaria/EnrollmentPostActions.tsx",
  "apps/web/src/components/secretaria/TurmaHorarioModal.tsx",
  "apps/web/src/components/secretaria/AcessoPortalManager.tsx",
  "apps/web/src/components/secretaria/AcoesRapidasBalcao.tsx",
  "apps/web/src/components/secretaria/ModalPagamentoRapido.tsx",
  "apps/web/src/components/secretaria/QuickViewTimeline.tsx",
  "apps/web/src/components/secretaria/AlunosSecretariaPage.tsx",
  "apps/web/src/app/escola/[id]/(portal)/turmas/page.tsx",
  "apps/web/src/app/escola/[id]/(portal)/alunos/page.tsx",
  "apps/web/src/components/escola/settings/SettingsHub.tsx",
  "apps/web/src/components/escola/settings/CourseManager.tsx",
  "apps/web/src/components/escola/settings/CurriculumBuilder.tsx",
  "apps/web/src/components/escola/settings/ConfirmDialog.tsx",
  "apps/web/src/components/escola/onboarding/SchoolCurriculumManager.tsx",
  "apps/web/src/components/escola/horarios/HorarioWizard.tsx",
  "apps/web/src/components/escola/horarios/wizard/StepSlots.tsx",
  "apps/web/src/app/escola/[id]/(portal)/admin/configuracoes/fluxos/page.tsx",
  "apps/web/src/components/academic/AcademicYearSelector.tsx",
];

const source = (file) =>
  readFileSync(new URL("../../../../" + file, import.meta.url), "utf8");

// Intentionally dark hero panels, transparent overlays and print/PDF documents
// have a separate visual contract; this gate covers operating surfaces.
const fixedNeutral =
  /(?<![\w:/-])(?:(?:hover|focus|group-hover|focus-visible):)?(?:bg-(?:white(?:\/(?:[4-9]\d|100))?|(?:slate|gray|zinc)-(?:50|100|200|300)(?:\/\d+)?)|(?:text|placeholder:text)-(?:slate|gray|zinc)-(?:400|500|600|700|800|900|950)(?:\/\d+)?|(?:border|divide|ring)-(?:slate|gray|zinc)-(?:100|200|300|400)(?:\/\d+)?)(?![\w/-])/g;

test("secretaria, balcao and academic settings use semantic neutral surfaces", () => {
  const violations = [];
  for (const file of files) {
    for (const match of source(file).matchAll(fixedNeutral)) {
      const line = source(file).slice(0, match.index).split("\n").length;
      violations.push(`${file}:${line} ${match[0]}`);
    }
  }
  assert.deepEqual(violations, [], violations.join("\n"));
});

test("brand and contrast classes are shared, no new inline brand hex palettes", () => {
  const violations = [];
  for (const file of files) {
    const content = source(file);
    assert.doesNotMatch(content, /#[0-9A-Fa-f]{6}\]/, file);
    assert.doesNotMatch(content, /bg-klasse-gold[^\n]{0,130}\btext-white/, file);
    assert.doesNotMatch(content, /bg-\[\$\{(?:C|T)\./, file);
    if (/\b(?:bg|text|border)-\[#(?:1F6B3B|E3B23C)\]/i.test(content)) violations.push(file);
  }
  assert.deepEqual(violations, []);
});

test("theme policy and on-screen branding remain independently controlled", () => {
  const prefs = source("apps/web/src/lib/theme-preference.ts");
  const provider = source("apps/web/src/components/providers/ThemeProvider.tsx");
  const shared = source("packages/design-tokens/src/index.ts");
  assert.match(prefs, /LIGHT_ONLY_PORTAL_PATH_PATTERN/);
  assert.match(provider, /applyTheme\(preference, lightOnlyPortal\)/);
  assert.match(shared, /klasseColors/);
  assert.match(shared, /bg-card/);
});
