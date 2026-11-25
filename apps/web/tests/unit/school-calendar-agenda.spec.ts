import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const ui = readFileSync(new URL("../../src/app/secretaria/(portal-secretaria)/calendario/page.tsx", import.meta.url), "utf8");

test("school calendar uses an agenda with on-demand creation and no nested event scroll", () => {
  assert.match(ui, /PORTAL_PAGE_INSET/);
  assert.match(ui, /<ModalShell open=\{open\}/);
  assert.match(ui, /Novo evento/);
  assert.match(ui, /groups\.map/);
  assert.match(ui, /divide-y divide-border/);
  assert.doesNotMatch(ui, /max-h-\[600px\]|event\.cor_hex|event\.tipo\.replace|📅|🏁|👥/);
  assert.match(ui, /Aplicável ao curso:/);
  assert.match(ui, /Evento geral do calendário académico/);
});

test("calendar keeps scoped filters and prevents concurrent reads and duplicate submits", () => {
  assert.match(ui, /params\.set\("ano_letivo_id", selectedYearId\)/);
  assert.match(ui, /params\.set\("curso_id", selectedCourseId\)/);
  assert.match(ui, /controller\.abort\(\)/);
  assert.match(ui, /if \(!active\) return/);
  assert.match(ui, /if \(submitLock\.current\) return/);
  assert.match(ui, /ano_letivo_id: effectiveYearId/);
  assert.match(ui, /fim_at: fimAt \|\| null/);
  assert.match(ui, /fimAt < inicioAt/);
  assert.match(ui, /operacoes \? "Operações" : "Secretaria"/);
});
