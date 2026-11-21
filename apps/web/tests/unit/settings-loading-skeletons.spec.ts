import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import * as React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import {
  CalendarSettingsSkeleton,
  CoursesSettingsSkeleton,
  EvaluationSettingsSkeleton,
  IdentitySettingsSkeleton,
} from "../../src/components/escola/settings/SettingsLoadingSkeletons";

const source = (path: string) => readFileSync(new URL("../../src/" + path, import.meta.url), "utf8");
const count = (html: string, marker: RegExp) => (html.match(marker) ?? []).length;

test("settings skeletons have accessible loading status, matching cards, and no live forms", () => {
  const cases = [
    [IdentitySettingsSkeleton, "identidade da escola", 6],
    [CoursesSettingsSkeleton, "cursos e classes", 2],
    [EvaluationSettingsSkeleton, "avaliação e frequência", 6],
    [CalendarSettingsSkeleton, "calendário escolar", 2],
  ] as const;

  for (const [Component, description, expectedCards] of cases) {
    const html = renderToStaticMarkup(React.createElement(Component));
    assert.match(html, /role="status"/, description);
    assert.match(html, /aria-busy="true"/, description);
    assert.ok(html.includes(description), description);
    assert.equal(count(html, /<section\b/g), expectedCards, description);
    assert.match(html, /motion-safe:animate-pulse/, description);
    assert.doesNotMatch(html, /<(?:input|button|textarea|select)\b/, description);
    assert.doesNotMatch(html, /Ana Paulo|Kz [0-9]+|Aluno matriculado/, description);
  }
});

test("settings skeletons retain the same responsive layout recipes", () => {
  const identity = renderToStaticMarkup(React.createElement(IdentitySettingsSkeleton));
  const evaluation = renderToStaticMarkup(React.createElement(EvaluationSettingsSkeleton));
  const courses = renderToStaticMarkup(React.createElement(CoursesSettingsSkeleton));
  const calendarEvents = renderToStaticMarkup(React.createElement(CalendarSettingsSkeleton, { tab: "eventos" }));

  assert.ok(identity.includes("lg:grid-cols-[1.2fr_0.8fr]"));
  assert.ok(evaluation.includes("md:grid-cols-3"));
  assert.ok(courses.includes("md:flex-row"));
  assert.equal(count(calendarEvents, /<section\b/g), 1);
});

test("four settings routes render skeletons instead of tiny spinners while loading", () => {
  const base = "app/escola/[id]/(portal)/admin/configuracoes/";
  for (const [path, name] of [
    ["identidade/page.tsx", "IdentitySettingsSkeleton"],
    ["turmas/page.tsx", "CoursesSettingsSkeleton"],
    ["avaliacao/page.tsx", "EvaluationSettingsSkeleton"],
    ["calendario/page.tsx", "CalendarSettingsSkeleton"],
  ]) {
    const code = source(base + path);
    assert.ok(code.includes(`<${name}`), path);
    assert.ok(code.includes("loading ? ("), path);
  }
  const calendar = source(base + "calendario/page.tsx");
  assert.match(calendar, /disabled=\{loading \|\| saving\}/);
  assert.match(calendar, /!loading && periodos\.length === 0/);
  const evaluation = source(base + "avaliacao/page.tsx");
  assert.match(evaluation, /disabled=\{loading\}/);
});
