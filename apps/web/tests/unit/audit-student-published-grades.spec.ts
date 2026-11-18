import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  publishedTrimestersFromOfficialSheets,
  selectPublishedStudentGrades,
} from "../../src/lib/aluno/published-notes";
import type { DisciplinaBoletim, DisciplinaClassificacoes } from "../../src/lib/aluno/boletimNotas";

const grades: DisciplinaBoletim[] = [{
  id: "subject-maths", nome: "Matemática",
  avaliacoes: [
    { nome: "Prova", tipo: "PP", nota: 15, trimestre: 1 },
    { nome: "Trabalho", tipo: "MAC", nota: 16, trimestre: 2 },
  ],
}];
const finals: DisciplinaClassificacoes[] = [{
  id: "subject-maths",
  classificacoes: [
    { trimestre: 1, nota: 14, status: "disponivel" },
    { trimestre: 2, nota: null, status: "pendente" },
  ],
}];

test("a publicação exige pauta oficial trimestral concluída, sem inferir um trimestre", () => {
  const set = publishedTrimestersFromOfficialSheets([
    { tipo: "trimestral", status: "SUCCESS", pdf_path: "escola-a/2026/pauta.pdf", numero: 1 },
    { tipo: "trimestral", status: "PROCESSING", pdf_path: "escola-a/2026/provisorio.pdf", numero: 2 },
    { tipo: "trimestral", status: "SUCCESS", pdf_path: "", numero: 3 },
    { tipo: "anual", status: "SUCCESS", pdf_path: "escola-a/2026/anual.pdf", numero: 2 },
  ]);
  assert.deepEqual([...set], [1]);
});

test("apenas avaliações e classificações de período publicado são visíveis", () => {
  const selected = selectPublishedStudentGrades(grades, finals, new Set([1]));
  assert.equal(selected.length, 1);
  assert.deepEqual(selected[0].avaliacoes.map((x) => x.trimestre), [1]);
  assert.deepEqual(selected[0].classificacoes, [{ trimestre: 1, nota: 14, status: "disponivel" }]);
  assert.deepEqual(selectPublishedStudentGrades(grades, finals, new Set()), []);
});

test("uma classificação incompleta não é apresentada como definitiva", () => {
  const selected = selectPublishedStudentGrades(grades, finals, new Set([2]));
  assert.equal(selected[0].classificacoes[0].status, "pendente");
  assert.equal(selected[0].classificacoes[0].nota, null);
});

test("a consulta académica não cobra; a emissão do PDF mantém o controlo financeiro", () => {
  const notes = readFileSync(resolve(process.cwd(), "src/app/api/aluno/minhas-notas/route.ts"), "utf8");
  const pdf = readFileSync(resolve(process.cwd(), "src/app/api/aluno/boletim/pdf/route.ts"), "utf8");
  const visual = readFileSync(resolve(process.cwd(), "src/components/aluno/tabs/TabNotas.tsx"), "utf8");
  assert.match(notes, /getAlunoContext\(\)/);
  assert.match(notes, /resolveBoletimMatricula/);
  assert.match(notes, /publishedTrimestersFromOfficialSheets/);
  assert.doesNotMatch(notes, /checkBoletimAccess|isBoletimPaid|servico_pedidos/);
  assert.match(pdf, /checkBoletimAccess/);
  assert.match(pdf, /if \(!access\.granted\)/);
  assert.match(visual, /fetch\(`\/api\/aluno\/minhas-notas/);
  assert.match(visual, /boletimPago/);
});
