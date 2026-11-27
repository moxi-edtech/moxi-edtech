import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import * as React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { Input } from "../../src/components/ui/Input";
import { Select } from "../../src/components/ui/Select";
import { ProfessorPlanosAulaSkeleton, ProfessorPlanosListSkeleton } from "../../src/components/professor/ProfessorLoadingSkeletons";
import { DashboardHeader } from "../../src/components/layout/DashboardHeader";

const source = (path: string) => readFileSync(new URL(path, import.meta.url), "utf8");

test("shared input preserves description, label and error semantics", () => {
  const html = renderToStaticMarkup(<Input id="nome" label="Nome" error="Obrigatório" aria-describedby="hint" />);
  assert.match(html, /<label[^>]*for="nome"/);
  assert.match(html, /aria-invalid="true"/);
  assert.match(html, /aria-describedby="hint nome-error"/);
  assert.match(html, /id="nome-error"[^>]*>Obrigatório/);
  assert.match(html, /focus-visible:ring-red-500\/20/);
});

test("unlabelled select keeps legacy bare-select DOM when valid, exposes errors when invalid", () => {
  const valid = renderToStaticMarkup(<Select id="ano" options={[{ value: "2026", label: "2026/2027" }]} />);
  assert.match(valid, /^<select /);
  const invalid = renderToStaticMarkup(<Select id="ano" error="Selecione o ano" aria-describedby="help" options={[{ value: "", label: "Selecione" }]} />);
  assert.match(invalid, /aria-invalid="true"/);
  assert.match(invalid, /aria-describedby="help ano-error"/);
  assert.match(invalid, /id="ano-error"[^>]*>Selecione o ano/);
});

test("plan skeletons mirror mobile grids, announce once and avoid motion when reduced", () => {
  const full = renderToStaticMarkup(<ProfessorPlanosAulaSkeleton />);
  const list = renderToStaticMarkup(<ProfessorPlanosListSkeleton />);
  assert.match(full, /role="status"/);
  assert.match(full, /aria-busy="true"/);
  assert.match(full, /lg:grid-cols-\[1\.4fr_0\.8fr\]/);
  assert.match(full, /motion-safe:animate-pulse/);
  assert.match(list, /A atualizar planos de aula/);
  assert.doesNotMatch(full + list, /class="animate-pulse/);
});

test("shared page header wraps actions instead of forcing viewport overflow", () => {
  const html = renderToStaticMarkup(<DashboardHeader title="Turmas" actions={<button type="button">Ação</button>} />);
  assert.match(html, /sm:flex-row/);
  assert.match(html, /flex-wrap items-center gap-2/);
});

test("plan editor uses canonical layout, form tokens, safe buttons and real initial skeleton", () => {
  const html = source("../../src/components/professor/ProfessorPlanosWorkspace.tsx");
  assert.match(html, /PORTAL_PAGE_INSET/);
  assert.match(html, /<ProfessorPlanosAulaSkeleton\s*\/>/);
  assert.match(html, /<ProfessorPlanosListSkeleton\s*\/>/);
  assert.match(html, /disabled=\{loading \|\| saving\}/);
  assert.match(html, /<Button type="button" tone="gold"/);
  assert.match(html, /getElementById\("plan-tema"\)/);
});

test("settings skeleton keeps widths bounded on mobile", () => {
  const html = source("../../src/components/escola/settings/SettingsHubSkeleton.tsx");
  assert.match(html, /max-w-6xl/);
  assert.match(html, /w-full min-w-0 sm:w-auto sm:min-w-\[280px\]/);
  assert.match(html, /motion-safe:animate-pulse/);
});
