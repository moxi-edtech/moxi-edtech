import test from "node:test";
import assert from "node:assert/strict";
import {
  findSuspectedSubjectEquivalences,
  normalizeCurricularDisciplineName,
} from "../../src/lib/academico/discipline-equivalences";

const fixture = [
  { id: "manual-short", nome: "Ed. Manual e Plástica", class_ids: ["1"] },
  { id: "manual-long", nome: "Educação Manual e Plástica", class_ids: ["1"] },
  { id: "moral-short", nome: "Ed. Moral e Cívica", class_ids: ["5"] },
  { id: "moral-long", nome: " Educação   Moral e Civica ", class_ids: ["5"] },
  { id: "visual-short", nome: "Ed. Visual e Tecnológica", class_ids: ["6"] },
  { id: "visual-long", nome: "Educação Visual e Tecnológica", class_ids: ["6"] },
  { id: "history-combined", nome: "História e Geografia", class_ids: ["6"] },
  { id: "history", nome: "História", class_ids: ["5"] },
  { id: "geography", nome: "Geografia", class_ids: ["5"] },
  { id: "same-across-classes", nome: "Matemática", class_ids: ["1", "5"] },
] as const;

test("expande abreviaturas, acentos, maiúsculas e espaços na comparação", () => {
  assert.equal(
    normalizeCurricularDisciplineName(" ED.  MORAL e CÍVICA "),
    normalizeCurricularDisciplineName("Educação Moral e Civica"),
  );
});

test("identifica variantes por classe, sem fundir ou eliminar", () => {
  const groups = findSuspectedSubjectEquivalences(fixture);
  assert.equal(groups.length, 3);
  assert.deepEqual(groups.map((group) => group.candidates.length), [2, 2, 2]);
  assert.ok(groups.some((group) => group.classId === "1" &&
    group.candidates.some((candidate) => candidate.id === "manual-short")));
  assert.ok(groups.some((group) => group.classId === "5" &&
    group.candidates.some((candidate) => candidate.id === "moral-long")));
  assert.ok(groups.some((group) => group.classId === "6" &&
    group.candidates.some((candidate) => candidate.id === "visual-short")));
});

test("não confunde disciplina combinada com duas disciplinas separadas", () => {
  const groups = findSuspectedSubjectEquivalences(fixture);
  assert.ok(groups.every((group) =>
    !group.candidates.some((candidate) => candidate.id === "history-combined")));
  assert.ok(groups.every((group) =>
    !group.candidates.some((candidate) => candidate.id === "same-across-classes")));
});

test("não confunde vínculo de turma duplicado com disciplina do catálogo duplicada", () => {
  const groups = findSuspectedSubjectEquivalences([
    { id: "subject-a", nome: "Biologia", class_ids: ["8", "8", "8"] },
    { id: "subject-b", nome: "Biologia", class_ids: ["9"] },
  ]);
  assert.equal(groups.length, 0);
});
