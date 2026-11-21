import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import * as React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { StudentStatusCard } from "../../src/components/aluno/home/StudentStatusCard";
import { RecentGradesCard } from "../../src/components/aluno/home/RecentGradesCard";

test("student status loading matches card surface and uses accessible status", () => {
  const html = renderToStaticMarkup(React.createElement(StudentStatusCard, { loading: true }));
  assert.match(html, /role="status"/);
  assert.match(html, /aria-busy="true"/);
  assert.match(html, /bg-card/);
  assert.match(html, /motion-safe:animate-pulse/);
  assert.doesNotMatch(html, /<(input|button)\b/);
});

test("student academic status is neutral when pending or unspecified", () => {
  const html = renderToStaticMarkup(React.createElement(StudentStatusCard, {
    loading: false, nome: "Aluna Exemplo", classe: "6ª Classe", turma: "A", estadoAcademico: "Pendente",
  }));
  assert.match(html, /Pendente/);
  assert.match(html, /6ª Classe/);
  assert.match(html, /bg-muted/);
  assert.doesNotMatch(html, /bg-emerald\/10/);
});

test("recent grades show true zero and do not invent marks", () => {
  const html = renderToStaticMarkup(React.createElement(RecentGradesCard, {
    loading: false, items: [{ disciplina: "História", tipo: "Prova", nota: 0, data: "2026-09-01" }],
  }));
  assert.match(html, /História/);
  assert.match(html, />0</);
  assert.match(html, /rounded-xl border border-border/);
});

test("recent grade loading and empty states remain distinct", () => {
  const loading = renderToStaticMarkup(React.createElement(RecentGradesCard, { loading: true, items: [] }));
  const empty = renderToStaticMarkup(React.createElement(RecentGradesCard, { loading: false, items: [] }));
  assert.match(loading, /A carregar avaliações recentes/);
  assert.match(empty, /Sem avaliações recentes/);
  assert.doesNotMatch(empty, /motion-safe:animate-pulse/);
});

test("legacy student shell keeps sidebar while using shared theme tokens", () => {
  const source = readFileSync(new URL("../../src/components/aluno/AlunoShell.tsx", import.meta.url), "utf8");
  assert.match(source, /<AlunoSidebar/);
  assert.match(source, /paddingLeft: "var\(--sidebar-w, 256px\)"/);
  assert.match(source, /bg-background text-foreground/);
  assert.match(source, /border-border bg-card/);
  assert.match(source, /p-4 sm:p-6/);
});
