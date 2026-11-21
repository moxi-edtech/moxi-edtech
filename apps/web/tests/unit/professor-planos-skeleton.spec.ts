import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { ProfessorLessonPlansSkeleton } from "../../src/components/professor/ProfessorLoadingSkeletons";

test("Planos de Aula skeleton mirrors both form and list without interactive controls", () => {
  const html = renderToStaticMarkup(React.createElement(ProfessorLessonPlansSkeleton));
  assert.match(html, /role="status"/);
  assert.match(html, /A carregar planos de aula/);
  assert.match(html, /lg:grid-cols-\[1\.4fr_0\.8fr\]/);
  assert.equal((html.match(/<section/g) ?? []).length, 2);
  // Nine curricular text areas plus observations; other fields stay single-line.
  assert.equal((html.match(/h-24/g) ?? []).length, 10);
  assert.match(html, /motion-safe:animate-pulse/);
  assert.doesNotMatch(html, /<(?:button|input|textarea|select)\b/);
});

test("Planos de Aula does not render a live empty form while assignments are loading", () => {
  const page = readFileSync(new URL("../../src/app/professor/planos-aula/page.tsx", import.meta.url), "utf8");
  assert.match(page, /loading \? <ProfessorLessonPlansSkeleton \/> : \(/);
  assert.match(page, /PORTAL_PAGE_INSET/);
  assert.doesNotMatch(page, /h-16 rounded-xl bg-slate-100/);
});
