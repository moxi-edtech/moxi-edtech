import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import { ExplorerHorarioSemanal, ExplorerHorarioTurma } from "../../src/components/secretaria/command-center/ExplorerHorario";
import { groupPublishedLessons, sortPublishedLessons, type PublishedLesson } from "../../src/lib/command-center/published-horario";

const lesson = (id: string, diaSemana: number, inicio: string, extra: Partial<PublishedLesson> = {}): PublishedLesson => ({
  id,
  diaSemana,
  inicio,
  fim: "09:00:00",
  disciplinaNome: "Matemática",
  professorNome: null,
  salaNome: null,
  ...extra,
});

test("EX-015: published lessons order by day and period without mutation", () => {
  const input = [
    lesson("tue", 2, "07:00:00"),
    lesson("late-mon", 1, "10:00:00"),
    lesson("early-mon", 1, "08:00:00"),
    lesson("sat", 6, "08:30:00"),
  ];
  assert.deepEqual(sortPublishedLessons(input).map((l) => l.id), ["early-mon", "late-mon", "tue", "sat"]);
  assert.deepEqual(input.map((l) => l.id), ["tue", "late-mon", "early-mon", "sat"]);
  assert.deepEqual(groupPublishedLessons(input).map((d) => d.nome), ["Segunda", "Terça", "Sábado"]);
});

test("EX-015: no professor key is not inferred from an academic allocation", () => {
  const html = renderToStaticMarkup(React.createElement(ExplorerHorarioSemanal, {
    aulas: [
      lesson("no-teacher", 2, "07:00:00"),
      lesson("removed", 2, "08:00:00", { professorVinculoRegistrado: true }),
    ],
  }));
  assert.match(html, /Professor não indicado no horário/);
  assert.match(html, /Identidade docente indisponível/);
  assert.match(html, /Sala não indicada no horário/);
  assert.doesNotMatch(html, /sem professor vinculado à turma/i);
});

test("EX-015: professor schedule uses the same grid without inventing room", () => {
  const html = renderToStaticMarkup(React.createElement(ExplorerHorarioSemanal, {
    showTurma: true,
    aulas: [lesson("math", 1, "08:15:00", { turmaNome: "Turma A", disciplinaNome: "Álgebra" })],
  }));
  assert.match(html, /Turma A/);
  assert.match(html, /Álgebra/);
  assert.doesNotMatch(html, /Professor não indicado/);
  assert.doesNotMatch(html, /Sala não indicada/);
});

test("EX-015: incomplete timetable is not presented as an empty official week", () => {
  const html = renderToStaticMarkup(React.createElement(ExplorerHorarioSemanal, {
    aulas: [], parcial: true,
  }));
  assert.match(html, /resultado é parcial/);
});

test("EX-015: only opening the section starts a scoped read", () => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const html = renderToStaticMarkup(
    React.createElement(QueryClientProvider, { client },
      React.createElement(ExplorerHorarioTurma, {
        escolaId: "school-a", anoLetivoId: "year-a", turmaId: "turma-a",
      })),
  );
  assert.match(html, /Ver horário/);
  assert.match(html, /aria-expanded="false"/);
  assert.doesNotMatch(html, /A carregar horário publicado/);
  client.clear();
  const code = readFileSync("src/components/secretaria/command-center/ExplorerHorario.tsx", "utf8");
  assert.match(code, /enabled: expanded && Boolean\(effectiveTurma\)/);
  assert.match(code, /"horario-publicado", escolaId, anoLetivoId, effectiveTurma/);
  assert.match(code, /credentials: "same-origin", cache: "no-store", signal/);
});

test("EX-015: authenticated read verifies school, year, turma and canonical publication", () => {
  const code = readFileSync("src/app/api/escolas/[id]/command-center/turmas/[turmaId]/horario/route.ts", "utf8");
  for (const token of [
    "resolveEscolaIdForUser", "requireRoleInSchool", "requireCommandCenterSchoolWideAccess",
    "resolveAcademicYearScope", '.eq("status", "publicada")',
    '.eq("turma_id", turmaId)', '.eq("versao_id", version.id)',
    'Cache-Control', "MAX_LESSONS",
  ]) {
    assert.ok(code.includes(token), "Missing route guard: " + token);
  }
  assert.match(code, /turma\.ano_letivo_id !== year\.id/);
  assert.doesNotMatch(code, /ensure_horario_versao|upsert_quadro_horarios|\.insert\(|\.update\(|\.delete\(/);
  assert.match(code, /professorVinculoRegistrado: Boolean\(raw\.professor_id\)/);
});

test("EX-015: five explorers reuse the read-only timetable, without five APIs", () => {
  const base = "src/components/secretaria/command-center/";
  for (const name of ["Course", "Classe", "Turma", "Disciplina"]) {
    const source = readFileSync(base + name + "ContextView.tsx", "utf8");
    assert.match(source, /ExplorerHorarioTurma/, name + " missing shared timetable");
  }
  assert.match(readFileSync(base + "ProfessorContextView.tsx", "utf8"), /ExplorerHorarioSemanal/);
});


test("EX-015: weekly schedule exposes prototype-like weekday navigation", () => {
  const html = renderToStaticMarkup(React.createElement(ExplorerHorarioSemanal, {
    aulas: [lesson("monday", 1, "07:30:00", {
      disciplinaNome: "Física", professorNome: "Prof. Carlos", salaNome: "Lab. 02",
    })],
  }));
  for (const weekday of ["Seg", "Ter", "Qua", "Qui", "Sex"]) {
    assert.match(html, new RegExp(">" + weekday + "<"), "missing weekday " + weekday);
  }
  assert.match(html, /aria-label="Filtrar horário por dia"/);
  assert.match(html, /07:30–09:00/);
  assert.match(html, /Prof. Carlos/);
  assert.match(html, /Sala Lab. 02/);
});

test("EX-015: Turma uses three contextual tabs and lazy published timetable", () => {
  const src = readFileSync("src/components/secretaria/command-center/TurmaContextView.tsx", "utf8");
  assert.match(src, /role="tablist"/);
  assert.match(src, /label: "Alunos"/);
  assert.match(src, /label: "Horário"/);
  assert.match(src, /label: "Disciplinas"/);
  assert.match(src, /activeTab === "horario" &&/);
  assert.match(src, /initiallyExpanded/);
  assert.match(src, /role="tabpanel"/);
  assert.match(src, /activeTab === "alunos" &&/);
  assert.match(src, /activeTab === "disciplinas" &&/);
});

test("EX-015: Classe compares two authorized turma schedules only after explicit expansion", () => {
  const classe = readFileSync("src/components/secretaria/command-center/ClasseContextView.tsx", "utf8");
  const horario = readFileSync("src/components/secretaria/command-center/ExplorerHorario.tsx", "utf8");
  assert.match(classe, /allowCompare/);
  assert.match(horario, /Comparar com \(opcional\)/);
  assert.match(horario, /enabled: expanded && Boolean\(effectiveCompare\)/);
  assert.match(horario, /item\.id !== effectiveTurma/);
  assert.match(horario, /Sem publicação/);
  assert.match(horario, /Versão oficial · apenas consulta/);
});
