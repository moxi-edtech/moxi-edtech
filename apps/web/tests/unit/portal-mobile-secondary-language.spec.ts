import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
const read = (path: string) => readFileSync(new URL("../../src/" + path, import.meta.url), "utf8");
test("academic payment flows use accessible constrained dialogs without changing payment endpoints", () => {
  const consolidated = read("components/aluno/financeiro-portal/PaymentDrawer.tsx");
  const service = read("components/aluno/layout/ServicePaymentDrawer.tsx");
  for (const ui of [consolidated, service]) {
    assert.match(ui, /<PortalSheet/);
    assert.match(ui, /busy=\{sending\}/);
    assert.match(ui, /inFlight.current/);
  }
  const sheet = read("components/portal/ui/PortalSheet.tsx");
  assert.match(sheet, /<DialogContent layout="bottom-sheet"/);
  assert.match(sheet, /overflow-y-auto/);
  assert.match(sheet, /!next && !busy/);
  assert.match(sheet, /onCloseAutoFocus/);
  assert.match(consolidated, /\/api\/aluno\/financeiro\/comprovativo/);
  assert.match(service, /StudentAppyPayButton/);
});
test("academic actions and activity selection share the restrained visual language", () => {
  const activity = read("app/professor/atividades/page.tsx");
  assert.match(activity, /aria-pressed=\{filterStatus === tab.id\}/);
  assert.match(activity, /bg-accent text-accent-foreground/);
  const formula = read("components/provas/MobileFormulaInput.tsx");
  assert.match(formula, /aria-pressed=\{part.operator===op.id\}/);
  assert.match(formula, /bg-accent text-accent-foreground/);
  const pwa = read("components/aluno/layout/PWAInstallPrompt.tsx");
  assert.doesNotMatch(pwa, /bg-gradient-to|framer-motion|bg-slate-900/);
  assert.match(pwa, /beforeinstallprompt/);
});
test("teacher exam and operational printing keep distinct authorization boundaries", () => {
  const operational = read("components/provas/ProvasPortalPage.tsx");
  const teacher = read("app/escola/[id]/professor/provas/page.tsx");
  assert.doesNotMatch(operational, /portal === "professor"/);
  assert.match(operational, /!access.distribute/);
  assert.match(teacher, /!access.author/);
  assert.match(teacher, /teacherWizard/);
});
