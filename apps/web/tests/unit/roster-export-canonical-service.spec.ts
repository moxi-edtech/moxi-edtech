import assert from "node:assert/strict";
import test from "node:test";
import {
  selectAndSortNominalMatriculas, toNominalXlsxRows,
  NominalRosterError, type NominalMatricula, type NominalRoster,
} from "../../src/lib/documentos/listaNominalService";
import { sortClasseNominalRows } from "../../src/lib/documentos/listaNominalXlsx";
import { resumoExclusoes } from "../../src/lib/documentos/listaNominalPolicy";

const turmas = new Map([
  ["tC", { nome: "8.ª C" }],
  ["tA", { nome: "8.ª A" }],
  ["tB", { nome: "8.ª B" }],
]);

const records: NominalMatricula[] = Array.from({ length: 55 }, (_, index) => ({
  id: "m" + String(index).padStart(3, "0"),
  turma_id: index % 3 === 0 ? "tC" : index % 3 === 1 ? "tA" : "tB",
  numero_chamada: index === 54 ? null : index % 20 + 1,
  status: index % 2 === 0 ? "concluido" : "ativo",
  ativo: index % 2 !== 0,
  alunos: {
    id: "a" + index,
    nome: index < 2 ? "Nome Repetido" : "Aluno " + index,
    numero_processo: String(index).padStart(6, "0"),
  },
}));

const project = (
  mode: "ano_letivo" | "operacional",
  isClasseScope: boolean,
  includeAllStatus = false,
) => {
  const selected = selectAndSortNominalMatriculas(records, {
    mode, includeAllStatus, isClasseScope, turmaById: turmas,
  });
  const roster = {
    ...selected,
    isClasseScope, turmaById: turmas, anoLabel: "2026/2027",
  } as unknown as NominalRoster;
  return { ...selected, rows: toNominalXlsxRows(roster) };
};

test("fonte única: PDF/XLSX incluem mesma população e ordenação por classe", () => {
  const canonical = project("ano_letivo", true);
  assert.equal(canonical.rows.length, 55);
  assert.deepEqual(canonical.rows, sortClasseNominalRows(canonical.rows));
  assert.equal(canonical.rows[0].turma, "8.ª A");
  assert.equal(canonical.rows.at(-1)?.turma, "8.ª C");
  assert.equal(new Set(canonical.rows.map(x => x.processo)).size, 55);
  assert.equal(canonical.rows.find(x => x.processo === "000054")?.chamada, null);
  assert.equal(canonical.rows.filter(x => x.nome === "Nome Repetido").length, 2);
  assert.deepEqual(canonical.sortedMatriculas.map(m => m.id).sort(), records.map(m => m.id).sort());
});

test("fonte única: modo operacional não inclui concluídos mesmo com activo falso", () => {
  const operational = project("operacional", true);
  assert.equal(operational.rows.length, 27);
  assert.equal(operational.seleccao.totalOrigem, 55);
  assert.match(resumoExclusoes(operational.seleccao.excluidos), /concluídas: 28/);
  assert.equal(project("ano_letivo", true).rows.length, 55);
  assert.equal(project("operacional", true, true).rows.length, 55);
});

test("sem numeração: turma preserva chamada sequencial e classe preserva vazio", () => {
  const byTurma = project("ano_letivo", false);
  assert.equal(byTurma.rows[54].chamada, 55);
  const byClasse = project("ano_letivo", true);
  assert.equal(byClasse.rows.filter(row => row.chamada === null).length, 1);
});

test("erros canónicos preservam códigos 400/403/409/413/503", () => {
  const error = new NominalRosterError("Sem acesso à escola", 403);
  assert.equal(error.name, "NominalRosterError");
  assert.equal(error.status, 403);
  assert.equal(error.message, "Sem acesso à escola");
});
