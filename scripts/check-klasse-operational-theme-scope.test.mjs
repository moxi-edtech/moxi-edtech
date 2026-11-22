import assert from "node:assert/strict";
import { test } from "node:test";
import {
  inScope,
  scanRepository,
  violationsForContent,
} from "./check-klasse-operational-theme-scope.mjs";

const p = "apps/web/src/app/escola/[id]/(portal)/financeiro/page.tsx";
test("guards authenticated operational pages and shared components, not fiscal or printed artefacts", () => {
  assert.equal(inScope(p), true);
  assert.equal(inScope("apps/web/src/components/secretaria/AdmissoesInboxClient.tsx"), true);
  assert.equal(inScope("apps/web/src/components/ai/AiChatWidget.tsx"), true);
  assert.equal(inScope("apps/web/src/components/aluno/StudentReceiptHistory.tsx"), false);
  assert.equal(inScope("apps/web/src/components/financeiro/FiscalOperationsClient.tsx"), false);
  assert.equal(inScope("apps/web/src/app/secretaria/documentos/_print/PrintLetterhead.tsx"), false);
});
test("gold action rejects white text with inadequate contrast", () => {
  assert.deepEqual(
    violationsForContent(p, '<button className="bg-klasse-gold text-white"/>').map((x) => x.token),
    ["bg-klasse-gold"]
  );
  assert.deepEqual(
    violationsForContent(p, '<button className="text-white bg-klasse-gold"/>').map((x) => x.token),
    ["text-white"]
  );
  assert.deepEqual(
    violationsForContent(p, '<button className="bg-klasse-gold text-klasse-gold-900"/>'),
    []
  );
});

test("new fixed neutral background and text are blocked", () => {
  const found = violationsForContent(p, '<div className="bg-white border-slate-200 text-slate-900">a</div>');
  assert.deepEqual(found.map((x) => x.token), ["bg-white", "border-slate-200", "text-slate-900"]);
});
test("semantic surfaces and financial statuses are allowed", () => {
  assert.deepEqual(violationsForContent(p, '<p className="bg-card text-foreground border-border bg-rose-50 dark:bg-rose-950/30"/>'), []);
});
test("translucent white is allowed only on reviewed brand-dark panels", () => {
  assert.deepEqual(violationsForContent(p, '<div className="hover:bg-white/10"/>').map((x) => x.token), ["hover:bg-white/10"]);
  const s = "apps/web/src/components/secretaria/QuickViewTimeline.tsx";
  assert.deepEqual(violationsForContent(s, '<div className="bg-white/10 hover:bg-white/20"/>'), []);
});
test("official WhatsApp brand is explicitly limited to original integrations", () => {
  const s = "apps/web/src/components/secretaria/AdmissoesInboxClient.tsx";
  assert.deepEqual(violationsForContent(s, '<span className="text-[#25D366] fill-[#25D366]"/>'), []);
  assert.equal(violationsForContent(p, '<span className="text-[#25D366]"/>').length, 1);
});
test("print styling stays isolated", () => {
  assert.deepEqual(violationsForContent(p, '<div className="print:border-slate-300"/>'), []);
  assert.equal(violationsForContent(p, '<div className="border-slate-900"/>').length, 1);
});
test("complete operational routes and internal components have no unapproved fixed colors", () => {
  const result = scanRepository();
  assert.ok(result.scanned > 300, "small/missing scope");
  assert.deepEqual(result.failures, []);
});
