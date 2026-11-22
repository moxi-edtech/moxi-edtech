import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const filenames = [
  "ActivitiesSection.tsx",
  "CrmSection.tsx",
  "EscolaSettingsClient.tsx",
  "MarketingSection.tsx",
  "MorningBriefing.tsx",
  "StudentReclassificationTool.tsx",
];

const read = (filename) =>
  readFileSync(new URL("../../src/components/super-admin/" + filename, import.meta.url), "utf8");

const frozenNeutral =
  /(?<![\w:/-])(?:(?:hover|focus|focus-visible|placeholder):)?(?:bg-(?:white(?:\/(?:[4-9]\d|100))?|(?:slate|gray|zinc)-(?:50|100|200|300)(?:\/\d+)?)|(?:text|placeholder:text)-(?:slate|gray|zinc)-(?:400|500|600|700|800|900|950)(?:\/\d+)?|(?:border|ring)-(?:slate|gray|zinc)-(?:100|200|300|400)(?:\/\d+)?)(?![\w/-])/g;

test("six operational super-admin components have theme-aware neutral surfaces", () => {
  assert.equal(filenames.length, 6);
  for (const filename of filenames) {
    const content = read(filename);
    const hits = [...content.matchAll(frozenNeutral)].map((m) =>
      filename + ":" + content.slice(0, m.index).split("\n").length + ": " + m[0]);
    assert.deepEqual(hits, [], filename + ": " + hits.join("\n"));
    assert.doesNotMatch(content, /#(?:1F6B3B|E3B23C|185830|9a7010)\b/i, filename);
  }
});

test("CRM pipeline tables remain keyboard reachable and visually contextual", () => {
  const content = read("CrmSection.tsx");
  assert.match(content, /role="region" tabIndex=\{0\} aria-label="Pipeline recente de escolas"/);
  assert.match(content, /role="region" tabIndex=\{0\} aria-label="Carteiras e faturamento de parceiros"/);
  for (const status of ["rose", "amber", "emerald"]) {
    assert.match(content, new RegExp("dark:bg-" + status + "-950/30"));
    assert.match(content, new RegExp("dark:text-" + status + "-300"));
  }
  assert.match(content, /recentPipeline\.map/);
});

test("super-admin school settings retain privileged change workflow and explicit form label", () => {
  const content = read("EscolaSettingsClient.tsx");
  assert.match(content, /htmlFor="escola-plano"/);
  assert.match(content, /id="escola-plano" value=\{plano\}/);
  assert.match(content, /focus:ring-klasse-gold\/20/);
  assert.match(content, /method: 'PATCH'/);
  assert.match(content, /disabled=\{saving\}/);
  assert.match(content, /tone="gold"/);
});

test("student reclassification preserves financial choice, danger colors and summary", () => {
  const content = read("StudentReclassificationTool.tsx");
  for (const token of ["reprecificarAbertas", "reprecificarPagas", "motivo", "canSubmit"]) {
    assert.match(content, new RegExp("\\b" + token + "\\b"));
  }
  assert.match(content, /dark:bg-rose-950\/30/);
  assert.match(content, /dark:bg-emerald-950\/30/);
  assert.match(content, /dark:text-rose-100/);
  assert.match(content, /bg-card/);
  assert.match(content, /fetch\("\/api\/super-admin\/alunos\/reclassificar"/);
});

test("marketing, activity feed and morning status retain actions with semantic surfaces", () => {
  const marketing = read("MarketingSection.tsx");
  const activities = read("ActivitiesSection.tsx");
  const brief = read("MorningBriefing.tsx");
  assert.match(marketing, /dark:bg-emerald-950\/30/);
  assert.match(marketing, /bg-card/);
  assert.match(activities, /bg-card/);
  assert.match(brief, /bg-klasse-gold/);
  assert.match(brief, /window\.location\.reload\(\)/);
  assert.match(brief, /text-foreground/);
});
