import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import * as React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { BookOpen } from "lucide-react";
import {
  ProfessorResourceEmptyState,
  ProfessorResourceErrorState,
  ProfessorResourceGridSkeleton,
} from "../../src/components/professor/ProfessorResourceStates";
import { matchesProfessorResourceQuery } from "../../src/lib/professor/resource-search";

const source = (file: string) => readFileSync(new URL("../../src/app/professor/" + file, import.meta.url), "utf8");

test("resource search ignores accents and supports null descriptions", () => {
  assert.equal(matchesProfessorResourceQuery(" historia ", "História de Angola", null), true);
  assert.equal(matchesProfessorResourceQuery("EDUCACAO", "Educação Musical"), true);
  assert.equal(matchesProfessorResourceQuery("", null, undefined), true);
  assert.equal(matchesProfessorResourceQuery("matematica", "Ciências Naturais"), false);
  assert.equal(matchesProfessorResourceQuery("5ª", "Materiais 5ª Classe"), true);
});

test("resource loading grid mirrors responsive cards, with accessible status", () => {
  const html = renderToStaticMarkup(React.createElement(ProfessorResourceGridSkeleton, { label: "A carregar recursos" }));
  assert.match(html, /role="status"/);
  assert.match(html, /aria-busy="true"/);
  assert.match(html, /sm:grid-cols-2 lg:grid-cols-3/);
  assert.equal((html.match(/aria-hidden="true" class="min-w-0/g) ?? []).length, 3);
  assert.doesNotMatch(html, /<(input|button|select)\b/);
  assert.match(html, /motion-safe:animate-pulse/);
});

test("empty and error states have explicit actions and no fabricated resource rows", () => {
  const empty = renderToStaticMarkup(React.createElement(ProfessorResourceEmptyState, {
    icon: BookOpen,
    title: "Sem resultados",
    description: "Ajuste a pesquisa.",
    actionLabel: "Limpar pesquisa",
    onAction: () => {},
  }));
  const error = renderToStaticMarkup(React.createElement(ProfessorResourceErrorState, {
    title: "Não foi possível carregar.",
    description: "Erro de ligação.",
    onRetry: () => {},
  }));
  assert.match(empty, /Sem resultados/);
  assert.match(empty, /Limpar pesquisa/);
  assert.match(error, /role="alert"/);
  assert.match(error, /Tentar novamente/);
});

test("materials and activities share search, error, loading and empty states", () => {
  for (const file of ["materiais/page.tsx", "atividades/page.tsx"]) {
    const code = source(file);
    assert.match(code, /matchesProfessorResourceQuery/);
    assert.match(code, /ProfessorResourceGridSkeleton/);
    assert.match(code, /ProfessorResourceEmptyState/);
    assert.match(code, /ProfessorResourceErrorState/);
    assert.match(code, /PORTAL_PAGE_INSET/);
    assert.match(code, /bg-background pb-24 text-foreground/);
    assert.match(code, /setLoadError\(null\)/);
    assert.match(code, /if \(!(?:mRes|actRes)\.ok/);
    assert.match(code, /type="search"/);
  }
  assert.match(source("atividades/page.tsx"), /formatDate\(act\.prazo\)/);
});
